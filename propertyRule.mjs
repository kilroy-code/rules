import { RuleStack } from './ruleStack.mjs';
import { PromisableRule } from './promisableRule.mjs';

// TODO: Define (and create tests for) what get/set arguments really are, as to target/receiver.
//       The candidates are rule, self/this/instance, the objectOrPrototype that the rule is defined on, and the proxy (if any).
//       See comments before ProxyRule.retrieveValue, and keep in mind that this and this.instance are available outside of arguments.
//       Think in terms of inheritance and event dispatch.
//       Also, same question for the arguments to fixme/assignment.
// TODO: factor out 'requires' from basic TrackingRule. Only a ComputedRule needs to track required rules.
// TODO: reverse the ordering, so that PromisableRule inherits from ComptuedRule, so that applications can use ComputedRules
// that do NOT try to be fancy with promises. How this is done (mixins?) depends on what ProxyRule needs to do with
// promise elements. (Maybe split the promise tracking from the promise computing?)
export class ComputedRule extends PromisableRule {
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

export class PropertyRule extends ComputedRule {
  constructor(instance, key, init, methodKey) {
    super(instance, key, methodKey);
    this.cached = init; // Rules are JIT-instantiated, so cached is never going to be undefined for long. No space-wastage.
  }
  retrieveValue(target, property, receiver = target) {
    // Supers don't define this:
    // super.retrieveValue(target, property, receiver);
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
  static attach(objectOrProto, key, methodOrInit, {configurable, assignment = PropertyRule.fixme} = {}) {
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
      if (instance.hasOwnProperty(ruleKey)) return instance[ruleKey];
      return instance[ruleKey] = new this(instance, key, init, methodKey);
    };
    delete objectOrProto[ruleKey]; // attach clears any previous rule.
    return Object.defineProperty(objectOrProto, key, {
      // Within these functions, objectOrProto might not equal this, as objectOrProto could be a __proto__.
      configurable,
      get: function () {
        let rule = ensureRule(this);
        return rule.get(objectOrProto, key, this);
      },
      set: function (value) {
        let rule = ensureRule(this);
        return rule.set(rule, key, assignment(value, key, this), objectOrProto);
      }
    });
  }
}
PropertyRule.fixme = value => value;
