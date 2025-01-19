import { Promisable } from './promisable.mjs';
import { Tracker } from './tracked.mjs';

// A rule that stores it's sole value for retrieval.
export class Property extends Promisable {
  init(props) {
    super.init(props);
    // Rules are JIT-instantiated, so cached is never going to be undefined for long. No space-wastage even when no init.
    this.cached = props.init;
    this.requires = new Tracker(); // Other rules that WE require, for use in resetReferences.
  }
  storeValue(target, property, value) {
    super.storeValue(...arguments);    
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
    this.requires.add(reference);
  }
  resetReferences() {
    let requires = this.requires,
        notUs = element => element !== this;
    this.requires = new Tracker();
    super.resetReferences();
    // Remove us from usedBy of everything that we had required.
    requires.forEach(required => required.usedBy = required.usedBy.filter(notUs));
  }

  static ruleKey(key) { return '_' + key; }
  static getRule(object, key) { return object[this.ruleKey(key)]; }
  
  static attach(objectOrProto, key, methodOrInit, {assignment = (value => value), enumerable = true, ...descriptors} = {}) {
    // Defines a Rule property on object, which may be an individual instance or a prototype.
    // If a method function is provided it is used to lazily calculate the value when read, if not already set.
    var ruleKey = '_' + key, // Why does it take so much longer to do: this.ruleKey(key),
        methodKey = '__' + key,
        isMethod = methodOrInit instanceof Function,
        method = isMethod ? methodOrInit : undefined,
        init = isMethod ? undefined : methodOrInit;
    if (method) {
      objectOrProto[methodKey] = method;
    }
    let ensureRule = (instance) => {
      // The actual Rule object is added lazilly, only when the property is first accessed (by get or set).
      if (instance.hasOwnProperty(ruleKey)) return instance[ruleKey];
      const rule = this.create({instance, key, init, methodKey});
      // This is very subtle:
      // IF we said here:
      //    instance[ruleKey] = rule;
      // AND if instance was a Proxy to the thing we rulified, then assigning instance[ruleKey] would go through the Proxy's set trap.
      // That's not what we would want (e.g., if the Proxy is something that traps assignments and nothing else, merely getting
      // the computed value of a rule named 'foo' would use the Proxy trap to assign '_foo').
      // Using Reflect.set here allows us to bypass that.
      // (The assignment just goes through the instance's setter for the propery, which may be a Proxy with a set trap.
      //  However, Reflect.set uses property descriptor of the target===objectOrProto. In this case, there is no descriptor
      //  for ruleKey (e.g., with a leading underscore), but I _think_ that Reflect.set then uses the default Object property assignment behavior,
      //  rather than the trap behavior of the instance===Proxy.
      Reflect.set(objectOrProto, ruleKey, rule, instance);
      //Object.defineProperty(instance, ruleKey, {enumerable: false}); // Doesn't really accomplish anything for us when objectOrProto is a prototype.
      //let descriptor = Object.getOwnPropertyDescriptor(objectOrProto, key);
      //descriptor.enumerable = true;
      //Object.defineProperty(instance, key, {enumerable: true});
      return rule;
    };
    delete objectOrProto[ruleKey]; // attach clears any previous rule.
    return Object.defineProperty(objectOrProto, key, {
      // Within these functions, objectOrProto might not equal this, as objectOrProto could be a __proto__.
      enumerable, ...descriptors,
      // FIXME: is there some way to reset dependencies if someone explicitly deletes the property?
      // e.g., delete this[key]
      // TODO: Add a unit test that illustrates the behavior, and added to README.md#quirks
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
        return rule.set(objectOrProto, key, assignment(value, key, this), this);
      }
    });
  }
  // For debugging:
  static requires(instance, key) { // Returns a list of each [instance, propertyName] pair that the specified rule requires.
    return this.getRule(instance, key).requires.map(rule => [rule.instance, rule.key]);
  }
}
