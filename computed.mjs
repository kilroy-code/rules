import { RuleStack } from './ruleStack.mjs';
import { Property } from './property.mjs';

// TODO: Define (and create tests for) what get/set arguments really are, as to target/receiver.
//       The candidates are rule, self/this/instance, the objectOrPrototype that the rule is defined on, and the proxy (if any).
//       See comments before Proxied.retrieveValue, and keep in mind that this and this.instance are available outside of arguments.
//       Think in terms of inheritance and event dispatch.
//       Also, same question for the arguments to fixme/assignment.
// TODO: factor out 'requires' from basic TrackingRule. Only a ComputedRule needs to track required rules.
// TODO: reverse the ordering, so that PromisableRule inherits from ComptuedRule, so that applications can use ComputedRules
// that do NOT try to be fancy with promises. How this is done (mixins?) depends on what ProxyRule needs to do with
// promise elements. (Maybe split the promise tracking from the promise computing?)
export class Computed extends Property {
  constructor({methodKey, ...properties}) {
    super({...properties});
    this.methodKey = methodKey;
    this.requires = []; // Other rules that WE require, for use in resetReferences.
  }
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
  compute(receiver) {
    let method = receiver[this.methodKey];
    if (!method) return; // FIXME: throw explicit error?
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
