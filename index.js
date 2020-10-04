"use strict";

const RuleStack = require('./ruleStack');
const PromisableRule = require('./promisableRule');

// TODO: factor out 'requires' from basic TrackingRuleOnly a ComputedRule needs to track required rules.
// TODO: reverse the ordering, so that PromisableRule inherits from ComptuedRule, so that applications can use ComputedRules
// that do NOT try to be fancy with promises. How this is done (mixins?) depends on what ProxyRule needs to do with
// promise elements. (Maybe split the promise tracking from the promise computing?)
class ComputedRule extends PromisableRule {
  constructor(instance, key, methodKey) {
    super(instance, key);
    this.methodKey = methodKey;
  }
  compute(receiver) {
    let method = receiver[this.methodKey];
    if (!method) return;
    let stack = RuleStack.current;
    if (stack.isCircularReference(this)) {
      throw new Error(`Circular Rule ${this} depends on itself within computation:${stack.map(rule => `\n${rule}`)}.`)
    }
    try {
      stack.noteComputing(this);
      return method.call(receiver, receiver);
    } finally {
      stack.restoreComputing(this);
    }
  }
}

class PropertyRule extends ComputedRule {
  constructor(instance, key, init, methodKey) {
    super(instance, key, methodKey);
    this.cached = init; // Rules are JIT-instantiated, so cached is never going to be undefined for long. No space-wastage.
  }
  retrieveValue(target, property, receiver = target) {
    super.retrieveValue(target, property, receiver);
    return this.cached;
  }
  storeValue(target, property, value, receiver = target) {
    super.storeValue(target, property, value, receiver);    
    this.cached = value;
  }
  trackRule(value) {
    if (value === undefined) { // Whether we had a method or not. But not an error for ProxyRule.
      throw new Error(`No Rule value returned for ${this}.`);
    }
    return super.trackRule(value);
  }
  static attach(objectOrProto, key, methodOrInit, isRedefineable) {
    // Defines a Rule property on object, which may be an individual instance or a prototype.
    // If a method function is provided it is used to lazily calculate the value when read, if not already set.
    var ruleKey = '_' + key,
        methodKey = '_' + ruleKey,
        isMethod = methodOrInit instanceof Function,
        method = isMethod ? methodOrInit : undefined,
        init = isMethod ? undefined : methodOrInit;
    if (method) {
      objectOrProto[methodKey] = method;
    }
    let ensureRule = (instance) => {
      // The actual Rule object is added lazilly, only when the property is first accessed (by get or set).
      var rule = instance[ruleKey];
      if (!rule) {
        rule = instance[ruleKey] = new this(instance, key, init, methodKey);
      }
      return rule;
    };
    delete objectOrProto[ruleKey]; // attach clears any previous rule.
    return Object.defineProperty(objectOrProto, key, {
      // Within these functions, objectOrProto might not equal this, as objectOrProto could be a __proto__.
      configurable: isRedefineable,
      get: function () {
        var rule = ensureRule(this);
        return rule.get(objectOrProto, key, this);
      },
      set: function (value) {
        let rule = ensureRule(this);
        return rule.set(rule, key, value, objectOrProto);
      }
    });
  }
}

var Rule = PropertyRule;

class ProxyRule extends PromisableRule {
  // this.instance is the original target, not the proxy. This allows these two methods to be invoked
  // by other kinds of Rules that do not know the details of our target vs proxy.
  retrieveValue(target, property, receiver = target) {
    super.retrieveValue(target, property, receiver);    
    return this.instance[property];
  }
  storeValue(target, property, value, receiver = target) {
    //if (property === 'length') console.warn(`fixme storeValue(${target}, ${property}, ${value})`);
    super.storeValue(target, property, value, receiver);    
    this.instance[property] = value;
  }
  resetReferences() {
    //if (this.key === 'length') console.warn(`fixme ${this}.resetReferences: ${this.usedBy}`);
    return super.resetReferences();
  }
  // Answer a proxy that automatically tracks any property that answers a non-empty string for ruleKey(key).
  static attach(target, getRuleKey) {
    let rulesStore = {};
    let ensureRule = (key) => { // gets/stores a Rule in ruleStore.
      let ruleKey = getRuleKey(key);
      if (!ruleKey) return;
      var rule = rulesStore[ruleKey];
      if (rule !== undefined) return rule;
      return rulesStore[ruleKey] = new this(target, key);
    }
    return new Proxy(target, {
      // This simple version is the heart of dependency-directed backtracking.
      // It does not cache results, compute values, nor resolve promises.
      // TODO: ensure there is a test case for when ruleKey answers falsy.
      get: function (target, key) {
        if (key === 'toString') return _ => `[${target.toString()}]`;
        let rule = ensureRule(key);
        return (rule || Reflect).get(target, key, target);
      },
      set: function (target, key, value) {
        let rule = ensureRule(key);
        return (rule || Reflect).set(target, key, value, target);
      }
    });
  }
}

class EagerRule extends PropertyRule {
  reset() {
    super.reset();
    process.nextTick(_ => this.get(this.instance, this.property));
  }
}
Rule.EagerRule = EagerRule;


// Convert an entire instance or prototype, or list to Rules.
Rule.rulify = function rulify(object, optionalPropertiesToRulify, eagerRules = []) {
  if (Array.isArray(object)) { // We treat lists differently. See README.md.
    return ProxyRule.attach(object,
                            function rulifiablePropertyName(key) { // We don't want to rulify array methods
                              let keyString = key.toString();
                              if (keyString === 'length') return keyString;
                              if (/^[0-9]+$/.test(keyString)) return keyString; // integer keys are good
                              // Everything else, we'll want to use the property (typically a method) in object.
                              return false;
                            });
  }
  // Everything else - covers all and only the current properties (and caches and Promises).
  var keys = optionalPropertiesToRulify // FIXME: or get from some static method?
      || Object.getOwnPropertyNames(object).filter(function (prop) { return 'constructor' !== prop; });
  keys.forEach(function (key) {
    let isEager = eagerRules.includes(key);
    let klass = isEager ? EagerRule : Rule; // fixme
    klass.attach(object, key, object[key], false);
  });
  return object;
}

module.exports = Rule;
