"use strict";

/* 
   Call stack.noteComputing(computingRule) and stack.restoreComputing(computingRule) around the computation of a rule.
   During this interval:
   1. stack.trackRule(referencedRule) should be called for each rule that the computation requires.
      It answers truthy, unless it is called outside the interval, in which case it answers false.
   2. All such referencedRules will be added as computingRule.addReference(referencedRule), 
      but only at the END of the computation (when restoreComputing is called).
      TODO: create an example that illustrates WHY we do it at the end.
   3. stack.isCircularReference(referencedRule) will answer true IFF referencedRule is already the subject
      of an unresolved stack.trackRule(referencedRule).
      TODO: Clean this up and shrink the API.
   4. The computingRule is given an additional property named '_collectingReferences' (which is then removed).
*/


class RuleStack extends Array {
  noteComputing(rule) {
    this.push(rule);
    rule._collectingReferences = [];
  }
  restoreComputing(rule) {
    rule._collectingReferences.forEach(reference => rule.addReference(reference));
    delete rule._collectingReferences;
    this.pop();
  }
  isCircularReference(rule) {
    return this.includes(rule);
  }
  trackRule(rule) {
    let length = this.length;
    if (!length) return false;
    this[length - 1]._collectingReferences.push(rule);
    return true;
  }
}
// This is not thread-safe.
// It isn't enough to make different instance of this for each worker, as instances aren't thread safe.
RuleStack.current = new RuleStack(); // Static class vars not allowed in Safari
module.exports = RuleStack;
