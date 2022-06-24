import { BaseRule } from './baseRule.mjs';
import { RuleStack } from './ruleStack.mjs';

// An abstract rule that only only supports get/set/reset in terms of informing the other rules when it is used, and resetting them when set.
// Subclasses must arrange for the actual computation and storage.
export class Tracked extends BaseRule {
  constructor(properties) {
    super(properties);
    this.usedBy = []; // Other (computed) rules that reference us in their computation, and which we must reset when we are set.
  }

  get() {
    let value = super.get(...arguments);
    this.trackRule(value);
    return value;
  }
  _setInternal() {
    super._setInternal(...arguments);
    this.resetReferences();
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
}

