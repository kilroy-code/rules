import { Promisable } from './promisable.mjs';

export class Property extends Promisable {
  constructor({init, ...properties}) {
    super({...properties});
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
  static attach(objectOrProto, key, methodOrInit, {configurable, assignment = Property.fixme} = {}) {
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
      return instance[ruleKey] = new this({instance, key, init, methodKey});
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
Property.fixme = value => value;
