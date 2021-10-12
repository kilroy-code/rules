import { RuleStack } from './ruleStack.mjs';
import { Property } from './property.mjs';
import { Promisable } from './promisable.mjs';

// TODO: Define (and create tests for) what get/set arguments really are, as to target/receiver.
//       The candidates are rule, self/this/instance, the objectOrPrototype that the rule is defined on, and the proxy (if any).
//       See comments before Proxied.retrieveValue, and keep in mind that this and this.instance are available outside of arguments.
//       Think in terms of inheritance and event dispatch.
//       Also, same question for the arguments to fixme/assignment.
// TODO: reverse the ordering, so that PromisableRule inherits from ComptuedRule, so that applications can use ComputedRules
// that do NOT try to be fancy with promises. How this is done (mixins?) depends on what ProxyRule needs to do with
// promise elements. (Maybe split the promise tracking from the promise computing?)

// A Rule that calls a method to compute a value when there is nothing cached (and then it caches the result).
export class Computed extends Property {
  constructor(props) {
    super(props);
    this.methodKey = props.methodKey;
  }
  // FIXME: This is an optimized version that basically expands calls inline. Why doesn't the compiler do this for us?
  get(target, property, receiver = this.instance) {
    let value = this.cached; // expand retrieveValue
    if (undefined === value) {
      value = this.compute(receiver);
      // expand storeValue
      this.cached = value;
      if (value instanceof Promise) this.setupPromiseResolution(target, property, value, receiver);
    }
    // expand trackRule:
    if (value === undefined) throw new Error(`No Rule value returned for ${this}.`); // Property rule
    if (!RuleStack.current.trackRule(this)) return value; // Tracked rule
    if (value instanceof Promise) throw this; // Promisable rule
    return value;
  }
  retrieveValue(target, property, receiver = this.instance) {
    let value = super.retrieveValue(target, property, receiver);
    if (undefined !== value) return value;
    value = this.compute(receiver);
    this.storeValue(target, property, value, receiver);
    return value;
  }
  compute(receiver) {
    // Compute and store it, noting any required rules.
    let value, stack = RuleStack.current;
    if (stack.isCircularReference(this)) {
      throw new Error(`Circular Rule ${this} depends on itself within computation:${stack.map(rule => `\n${rule}`)}.`)
    }
    try {
      stack.noteComputing(this);

      value = receiver[this.methodKey].call(receiver, receiver);
    } catch (thrown) {
      value = this.maybeBecomePromisableByContagion(thrown);
    } finally {

      stack.restoreComputing(this);
    }
    return value;
  }
}
