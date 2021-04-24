import { Cached } from './cached.mjs';
import { RuleStack } from './ruleStack.mjs';

// An abstract rule that only only supports get/set/reset in terms of informing the other rules when it is used, and resetting them when set.
// Subclasses must arrange for the actual computation and storage.
export class Tracked extends Cached {
  constructor({instance, key}) { // instance must be the specific instance, not the __proto__.
    super();
    this.key = key;
    this.instance = instance;

    // TBD: Under what circumstance is this is a memory leak, where usedBy is the only reference to rules in objects that are no longer otherwise live?
    // Outline of potential fix: a global weakmap from rule => array-of-usedby-rules, and insert a reference to that array in each
    // usedby rule. But then the array doesn't disappear until ALL the usedBy are gone. Hmm...?

    // usedBy and requires are other Rules.
    this.usedBy = [];
    this.requires = [];
  }
  toString() {
    return `[${this.constructor.name} ${this.instanceToString()} ${this.key}]`;
  }
  instanceToString() { // Seems unnecessary, until you wonder why a rule attached to the array [x] prints
    // as [ProxyRule x foo] instead of [ProxyRule [x] foo]!
    if (Array.isArray(this.instance)) {
      return `[${this.toString()}]`;
    }
    return this.instance.toString();
  }

  addReference(reference) { // Used by RuleStack
    if (reference.usedBy.includes(this)) return;
    reference.usedBy.push(this);
    this.requires.push(reference);
  }
  trackRule(value) {
    return RuleStack.current.trackRule(this);
  }
  resetReferences() {
    var usedBy = this.usedBy,
        requires = this.requires,
        notUs = element => element !== this;
    this.usedBy = [];
    this.requires = [];
    // Remove us from usedBy of everything that we had required.
    requires.forEach(required => required.usedBy = required.usedBy.filter(notUs));
    // And reset everything that depended on us.
    usedBy.forEach(usedBy => usedBy.reset());
    return true;  // To be compatible with Reflect.set and Proxy handler.set, which must answer a success boolean.
  }

  retrieveOrComputeValue(...args) {
    return this.retrieveValue(...args);
  }
  get(...args) {
    let value = this.retrieveOrComputeValue(...args);
    this.trackRule(value);
    return value;
  }
  set(...args) {
    return this.setInternal(...args);
  }
  reset() {
    // Same code as set(), but not going through that method, which can redefined for real, application assignments.
    this.setInternal(this.instance, this.key, undefined);
  }
  setInternal(...args) {
    this.storeValue(...args);
    return this.resetReferences();
  }

  // Must be defined by subclasses, and must not add or remove references.
  // retrieveValue(target, property, receiver=target) { }
  // storeValue(target, property, value, receiver=target) { }
}

