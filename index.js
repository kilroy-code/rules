/*global exports*/
"use strict";

// TODO:
// Split the simple parts out into a class Memoize, and Rule that inherits from it.
// Create method that displays circularity, without making clients pull in the util package.

const inspect = require('util').inspect; // For printing the error when there is a circular dependency.

function simpleReset(instance, key) {
  instance[key] = undefined;
}
function eagerReset(instance, key) {
  instance[key] = undefined;
  process.nextTick(() => instance[key]);
}

function Rule(instance, key, init, onreset = simpleReset, methodKey) { // instance must be the specific instance, not the __proto__.
  // usedBy and requires are other Rules.
  this.key = key; // FIXME for debugging
  this.cached = init; // Rules are JIT-instantiated, so cached is never going to be undefined for long. No space-wastage.
  // TBD: Under what circumstance is this is a memory leak, where usedBy is the only reference to rules in objects that are no longer otherwise live?
  // Outline of potential fix: a global weakmap from rule => array-of-usedby-rules, and insert a reference to that array in each
  // usedby rule. But then the array doesn't disappear until ALL the usedBy are gone. Hmm...?
  this.usedBy = [];
  this.requires = [];
  // Subtle: This will use the setter defined on instance when this Rule is attached to instance. The setter has side-effects.
  this.reset = function () { onreset(instance, key); };
}

// Bookkeeping for references.
Rule.prototype.addReference = function addReference(reference) {
  if (reference.usedBy.indexOf(this) < 0) {
    reference.usedBy.push(this);
    this.requires.push(reference);
  }
}
Rule.prototype.resetReferences = function resetReferences() {
  var that = this,
      usedBy = this.usedBy,
      requires = this.requires,
      notUs = function (element) { return element !== that; };
  this.usedBy = [];
  this.requires = [];
  requires.forEach(function (required) { // Remove us from usedBy of each required.
    required.usedBy = required.usedBy.filter(notUs);
  });
  usedBy.forEach(function (usedBy) {
    usedBy.reset();
  });
}

// Bookkeeping for Promises.
var XPromise = Promise || function XPromise() {}; // No Promises on IE.

Rule.prototype.requiresPromise = function requiresPromise(instance, key, ourPromise, requiredRule) {
  var that = this;
  if (!ourPromise) { // Ensure a promise that will only resolve when all we require is resolved.
    ourPromise = new XPromise(function (resolve, reject) {
      that.resolve = resolve;
      that.reject = reject;
    });
  }
  requiredRule.cached.then(function () {
    var val, resolve = that.resolve;
    try { // try our rule again.
      val = instance[key]; // will still be our promise if still waiting.
    } catch (e) {
      delete that.resolve;
      that.reject(e);
    }
    if (val === ourPromise) return; // Don't loop if still waiting
    delete that.resolve;
    resolve(val);
  }, function (reason) {
    delete that.resolve;
    that.reject(reason);
  });
  return ourPromise;
}
Rule.prototype.ensurePromiseResolution = function ensurePromiseResolution(promise, key) {
  var that = this;
  if (!(promise instanceof XPromise)) return;
  if (this.hasFollowup) return;
  // Might be a Promise we we created above, or explicitly created by the method body.
  this.hasFollowup = true;
  promise.then(function (result) { // When our freshly created Promise resolves...
    delete that.hasFollowup;
    if (that.cached !== promise) return; // In case it has since been reset.
    that.cached = result; // ... replace the Promise with the result, leaving usedBy/requires alone.
  }, function () { // Keep rejection in the promise chain, rather than throwing asynchronously
  });
}


// Tracking the dynamic extent of rule evaluation.
// This is so much easier with Javascript class (and faster performing), but Internet Explorer...
function RuleStack() { Array.call(this); }
// Don't pollute Array.prototype.  Alas, Object.create isn't in IE8
function clone(obj) { function F() { } F.prototype = obj; return new F(); }
RuleStack.prototype = clone(Array.prototype);

RuleStack.prototype.noteComputing = function noteComputing(rule) {
  this.push(rule);
  rule.collectingReferences = [];
}
RuleStack.prototype.restoreComputing = function restoreComputing(rule) {
  var add = rule.addReference.bind(rule);
  rule.collectingReferences.forEach(add);
  delete rule.collectingReferences;
  this.pop();
}
RuleStack.prototype.isCircularReference = function isCircularReference(rule) {
  return this.indexOf(rule) >= 0;
}
RuleStack.prototype.trackRule = function trackRule(rule) {
  if (!this.length) return false;
  this[this.length - 1].collectingReferences.push(rule);
  return true;
}
Rule.RuleStack = RuleStack;

// This is not thread-safe.
// It isn't enough to make different instance of this for each worker, as instances aren't thread safe.
Rule.beingComputed = new RuleStack();

var XProxy = Proxy || function Proxy() { return "Proxy is not implemented, and so we cannot rulify Arrays." };
// Answer a proxy that automatically tracks any property that answers a non-empty string for ruleKey(key).
function proxyRules(object, rulesStore, ruleKey) {
  var proxy;
  function ensureRule(key) { // gets/stores a Rule in ruleStore.
    key = ruleKey(key);
    if (!key) return;
    var rule = rulesStore[key];
    if (rule !== undefined) return rule;
    return rulesStore[key] = new Rule(proxy, key);
  }
  proxy = new XProxy(object, {
    // This simple version is the heart of dependency-directed backtracking.
    // It does not cache results, compute values, nor resolve promises.
    get: function (self, key) {
      var rule = ensureRule(key);
      if (rule) Rule.beingComputed.trackRule(rule);
      return self[key];
    },
    set: function (self, key, value) {
      var rule = ensureRule(key);
      if (rule) rule.resetReferences();
      self[key] = value;
      return true;
    }
  });
  return proxy;
}


// Expression-based way to create rules, on object instances or prototypes.
Rule.attach = function attach(objectOrProto, key, methodOrInit, isRedefineable, onreset = simpleReset) {
  // Defines a Rule property on object, which may be an individual instance or a prototype.
  // If a method function is provided it is used to lazily calculate the value when read, if not already set.
  // The method will be passed one argument, defaulting to the actual specific instance to which the rule property is attached.
  // (To support entity/component architectures, if that specific instance defines a property called 'entity', it's value will
  // be used instead.)
  var ruleKey = '_' + key,
      methodKey = '_' + ruleKey,
      isMethod = methodOrInit instanceof Function,
      method = isMethod ? methodOrInit : undefined,
      init = isMethod ? undefined : methodOrInit;
  if (method) { objectOrProto[methodKey] = method; } // Just for accessing super.__whatever() in subclasses.
  function ensureRule(instance) {
    // The actual Rule object is added lazilly, only when the property is first accessed (by get or set).
    var rule = instance[ruleKey];
    if (!rule) {
      rule = instance[ruleKey] = new Rule(instance, key, init, onreset, methodKey);
    }
    return rule;
  }
  delete objectOrProto[ruleKey]; // attach clears any previous rule.
  Object.defineProperty(objectOrProto, key, {
    // Within these functions, objectOrProto might not equal this, as objectOrProto could be a __proto__.
    configurable: isRedefineable,
    get: function () {
      var rule = ensureRule(this),
          cached = rule.cached;
      if ((cached === undefined) || rule.resolve) {
        if (method) {
          if (Rule.beingComputed.isCircularReference(rule)) {
            throw new Error("Circular Rule depends on itself: "
                            + inspect({rule: rule, ruleStack: Rule.beingComputed}, {depth: 2}));
          }
          try {
            Rule.beingComputed.noteComputing(rule);
            // this.entity is a hook for components. If this defines an entity property, use it.
            cached = method.call(this, this.entity || this);
          } catch (e) {
            if (!(e instanceof Rule)) {
              throw e; // Not a Promise rule, so re-signal the error.
            }
            cached = rule.requiresPromise(this, key, cached, e);
          } finally {
            Rule.beingComputed.restoreComputing(rule);
          }
          rule.cached = cached;
        }
        if (cached === undefined) { // Whether we had a method or not.
          const message = "No Rule value returned for " + key + " in " + objectOrProto.toString();
          throw new Error(message);
          //console.log(message);
        }
      }
      rule.ensurePromiseResolution(cached, key);
      if (Rule.beingComputed.trackRule(rule) && (rule.cached instanceof XPromise)) {
        throw rule; // So that the computing rule that uses us can track this Promise, in its catch like above.
      }
      return cached;
    },
    set: function (value) {
      var rule = ensureRule(this);
      rule.hasFollowup = rule.resolve = rule.reject = false;
      rule.cached = value;
      rule.resetReferences();
    }
  });
}

// Convert an entire instance or prototype, or list to Rules.
Rule.rulify = function rulify(object, optionalPropertiesToRulify, eagerRules = []) {
  if (Array.isArray(object)) { // We treat lists differently. See README.md.
    return proxyRules(object,
                      new Array(object.length),
                      function rulifiablePropertyName(key) { // We don't want to rulify array methods
                        if (key === 'length') return 'trackedLength'; // Not length!
                        if (/^[0-9]+$/.test(key.toString())) return key.toString(); // integer keys are good
                        return false;
                      });
  }
  // Everything else - covers all and only the current properties (and caches and Promises).
  var keys = optionalPropertiesToRulify // FIXME: or get from some static method?
      || Object.getOwnPropertyNames(object).filter(function (prop) { return 'constructor' !== prop; });
  keys.forEach(function (key) { Rule.attach(object, key, object[key], false, (eagerRules.includes(key) ? eagerReset : simpleReset)); });
  return object;
}

module.exports = Rule;
