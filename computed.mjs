import { RuleStack } from './ruleStack.mjs';
import { Promisable } from './promisable.mjs';

// TODO: Define (and create tests for) what get/set arguments really are, as to target/receiver.
//       The candidates are rule, self/this/instance, the objectOrPrototype that the rule is defined on, and the proxy (if any).
//       See comments before ProxyRule.retrieveValue, and keep in mind that this and this.instance are available outside of arguments.
//       Think in terms of inheritance and event dispatch.
//       Also, same question for the arguments to fixme/assignment.
// TODO: factor out 'requires' from basic TrackingRule. Only a ComputedRule needs to track required rules.
// TODO: reverse the ordering, so that PromisableRule inherits from ComptuedRule, so that applications can use ComputedRules
// that do NOT try to be fancy with promises. How this is done (mixins?) depends on what ProxyRule needs to do with
// promise elements. (Maybe split the promise tracking from the promise computing?)
export class Computed extends Promisable {
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
