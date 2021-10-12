import { Promisable } from './promisable.mjs';

// A rule that stores it's sole value for retrieval.
export class Property extends Promisable {
  constructor(props) {
    super(props);
    // Rules are JIT-instantiated, so cached is never going to be undefined for long. No space-wastage even when no init.
    this.cached = props.init;
    this.requires = []; // Other rules that WE require, for use in resetReferences.    
  }
  storeValue(target, property, value, receiver = this.instance) {
    super.storeValue(target, property, value, receiver);    
    this.cached = value;
  }
  retrieveValue() {
    // No need: super.retrieveValue(target, property, receiver);
    return this.cached;
  }
  trackRule(value) {
    if (value === undefined) { // Whether we had a method or not. But not an error for ProxyRule.
      throw new Error(`No Rule value returned for ${this}.`);
    }
    return super.trackRule(value);
  }

  // When we are reset, then we don't belong in anyone's usedBy list any more.
  // If we don't remove ourself from those rule's usedBy, then resetting any of those rules would clear any explicitly set value here.
  // To accomplish this, we keep track of the rules that WE require.
  addReference(reference) {
    super.addReference(reference);
    this.requires.push(reference);
  }
  resetReferences() {
    let requires = this.requires,
        notUs = element => element !== this;
    this.requires = [];
    super.resetReferences();
    // Remove us from usedBy of everything that we had required.
    requires.forEach(required => required.usedBy = required.usedBy.filter(notUs));
  }
  
  static attach(objectOrProto, key, methodOrInit, {configurable, assignment = (value => value)} = {}) {
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
        // FIXME?? The assignment is run for all assignment, including those made
        // during construction. Is that what we want? (I think not, or at least, we
        // need a way for a supplied assignment function to inspect enough to determine
        // whether or not to do something (such as replicating the value).
        return rule.set(rule, key, assignment(value, key, this), objectOrProto);
      }
    });
  }
}
