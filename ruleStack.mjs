/* 
   Call stack.noteComputing(computingRule) and stack.restoreComputing(computingRule) around the computation of a rule.
   During this interval:
   1. stack.trackRule(referencedRule) should be called for each rule that the computation requires.
      It answers truthy, unless it is called outside the interval, in which case it answers false.
   2. All such tracked rule will be added as computingRule.addReference(referencedRule), 
      but only at the END of the computation (when restoreComputing is called).
      TODO: create an example that illustrates WHY we do it at the end. 
      (I forget why! I assume it has to do with computation evaluated multiple times when dependent on promises?)
   3. stack.isCircularReference(referencedRule) will answer true IFF the tracked rule is already the subject
      of an unresolved stack.trackRule(referencedRule).
      TODO: Clean this up and shrink the API.
*/
export class RuleStack extends Array {
  noteComputing(rule) {
    this.push(rule);
  }
  restoreComputing(rule) {
    rule.collectingReferences.forEach(reference => rule.addReferenceIfNew(reference));
    rule.collectingReferences.length = 0;
    this.pop();
  }
  isCircularReference(rule) {
    return this.includes(rule);
  }
  trackRule(rule) {
    let length = this.length;
    if (!length) return false;
    this[length - 1].collectingReferences.push(rule);
    return true;
  }
}
// This is not thread-safe.
// It isn't enough to make different instance of this for each worker, as instances aren't thread safe.
RuleStack.current = new RuleStack();
