import { Cached } from './cached.mjs';
import { RuleStack } from './ruleStack.mjs';

// An abstract rule that only only supports get/set/reset in terms of informing the other rules when it is used, and resetting them when set.
// Subclasses must arrange for the actual computation and storage.
export class Tracked extends Cached {
  constructor(properties) {
    super(properties);

    // TBD: Under what circumstance is this (and Computed.requires) a memory leak, where usedBy (or requires)
    // is the only reference to rules in objects that are no longer otherwise live?
    // Outline of potential fix: a global weakmap from rule => array-of-usedby-rules, and insert a reference
    // to that array in each usedby rule. But then the array doesn't disappear until ALL the usedBy are gone. Hmm...?

    this.usedBy = []; // Other (computed) rules that reference us in their computation, and which we must reset when we are set.
  }

  addReferenceIfNew(reference) { // Used by RuleStack
    if (reference.usedBy.includes(this)) return; // Just once, please
    this.addReference(reference);
  }
  addReference(reference) {
    reference.usedBy.push(this);
  }
  trackRule(value) { // Return true IFF we are inside Compute#compute().
    return RuleStack.current.trackRule(this);  // Promisable#trackRule() cares about the answer.
  }
  resetReferences() {
    let usedBy = this.usedBy;
    this.usedBy = [];
    usedBy.forEach(usedBy => usedBy.reset()); // Reset everything that depended on us.
  }

  get(...args) {
    let value = super.get(...args);
    this.trackRule(value);
    return value;
  }
  _setInternal(...args) {
    super._setInternal(...args);
    this.resetReferences();
  }
}

