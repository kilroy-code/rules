import { BaseRule } from './baseRule.mjs';
import { RuleStack } from './ruleStack.mjs';

export class Tracker { // A list of WeakRefs, so that required and usedBy do not hold on to Rules that would otherwise get GC'd.
  constructor(items = []) {
    this.items = items;
    this.set = new WeakSet();
  }
  has(item) {
    return this.set.has(item);
  }
  add(item) {
    this.items.push(new WeakRef(item));
    this.set.add(item);
  }
  forEach(f) {
    this.items.forEach(e => e.deref() && f(e.deref()));
  }
  map(f) { // Used in debugging tools.
    return this.items.map(e => e.deref() && f(e.deref()));
  }
  filter(f) {
    return new Tracker(this.items.filter(e => e.deref() && f(e.deref())));
  }
  get any() { // Just used in unit tests
    return this.items[0].deref();
  }
}

// An abstract rule that only only supports get/set/reset in terms of informing the other rules when it is used, and resetting them when set.
// Subclasses must arrange for the actual computation and storage.
export class Tracked extends BaseRule {
  constructor(properties) {
    super(properties);
    this.usedBy = new Tracker(); // Other (computed) rules that reference us in their computation, and which we must reset when we are set.
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
    if (reference.usedBy.has(this)) return; // Just once, please
    this.addReference(reference);
  }
  addReference(reference) {
    reference.usedBy.add(this);
  }
  trackRule(value) { // Return true IFF we are inside Compute#compute().
    return RuleStack.current.trackRule(this);  // Promisable#trackRule() cares about the answer.
  }
  resetReferences() {
    let usedBy = this.usedBy;
    this.usedBy = new Tracker();
    usedBy.forEach(usedBy => usedBy.reset()); // Reset everything that depended on us.
  }
}

