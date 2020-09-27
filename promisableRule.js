"use strict";

const assert = require('assert').strict;
const RuleStack = require('./ruleStack');
const TrackingRule = require('./trackingRule');

//let fixmeLog = console.log;
let fixmeLog = _ => _;

// TODO:
// Split the simple parts out into a class Memoize, and Rule that inherits from it.
// Create method that displays circularity, without making clients pull in the util package.

class PromisableRule extends TrackingRule {
  compute(receiver) {
    // Subclasses that do something must also track dependencies through note/restoreComputing.
  }
  retrieveOrComputeValue(target, property, receiver = target) {
    // Return the retrieved or computed value as possible.

    // Proposed:
    // 
    // If computation references a value that is still a promise, a special Promise value is stored
    // and returned:
    // - When a required referenced promise resolves, the computation will be tried again, which may
    //   result in no change -- e.g., if this rule still requires a promise -- but if the computation
    //   completes, this rule's special promise is resolved.
    //     FIXME: do we clear the stored special promise and create a new one if necessary, or re-use the old?
    // - When a required referenced promise is rejected, this rule's special promise is rejected.
    //
    // If the value is a promise -- whether such a special promise or not -- arrangements are made to
    // handle resolution or rejection of the promise. A resolution stores the resolved value.
    // FIXME: rejection of a special promise should reject special promises that used it. What should reject
    // of other promises do? Throw or remain silent? (Other rules are propogated from the first part, and non-rule code can attach it's own catchers?)
    // FIXME: Try to arrage for this to break out cleanly into existing methods where possible, such as storeValue.
    // Use onReject onResolve if/as necessary.

    // If the value is a promise, ensure that arrangements are made to replace the cached promise with the resolved value
    // when the promise resolves. Note that this might need to repeat if a promise resolves to another promise.
    // FIXME: define this more tightly. E.g., if compute produces a promise that resolves to a promise to a promise, etc.,
    // do we store each new value, or do we sometimes have resolved promises as value? Are the rules different for
    // a promise that we produce because of a dependenency?
    
    // If the computation requires something that is still a promise, then create a promise as the value, and arrange
    // for this promise to resolve when all such required rule values resolve. Note that this might need repeated
    // attempts to evaluate the computation as required rules resolve, and further computation in this rule reveal new promised requirements.

    // FIXME: define rejection in this context.
    
    let cached = this.retrieveValue(target, property, receiver),
        value = cached;
    fixmeLog(`${this}.retrieveOrComputeValue value:${value}, retry:${this.retryData}.`);
    if ((value !== undefined) && !this.isPendingPromise(value)) {
      return this.ensureResolution(target, property, value, receiver);
    }
    try {
      value = this.compute(receiver);
    } catch (thrown) {
      let retry = this.retryData;
      if (thrown instanceof PromisableRule) {
        // compute() involved a rule whose trackRule saw that it was still a Promise.
        value = this.ensurePromise(target, property, value, receiver);
      } else if (retry) {
        retry.reject(thrown);
      } else {
        throw thrown; // Not a Promise rule, so re-signal the error.
      }
    }
    fixmeLog(`${this}.retrieveOrComputeValue cached:${cached}, value:${value} (=? ${cached === value}), retry:${this.retryData}.`);    
    if (value !== undefined) {
      if (cached === undefined) this.storeValue(target, property, value, receiver);
      let retry = this.retryData;
      if (retry) {
        if (value instanceof Promise) {
          value.then(resolved => retry.resolve(resolved), rejected => retry.reject(rejected));
        } else {
          process.nextTick(_ => retry.resolve(value));
        }
      }
    }
    return this.ensureResolution(target, property, value, receiver);
  }
  ensurePromise(target, property, value, receiver) {
    // We depend on an unresolved Promise. Make sure we have a value that is the one
    // and only Promise we will ever have until all our requirements are resolved/rejected
    // (or until we are (re)set).
    if (value !== undefined) {
      if (this.isPendingPromise(value)) return value;
      throw new Error(`${this} has improper value ${value}.`);
    }
    return new Promise((resolve, reject) => this.retryData = {resolve, reject});
  }
  ensureResolution(target, property, value, receiver) {
    fixmeLog(`${this}.ensureResolution(...${value}...), willResolve:${this.willResolve}.`);
    if (!(value instanceof Promise)) {
      let retry = this.retryData;
      if (retry) {
        process.nextTick(_ => retry.resolve(value));
      }
      return value;
    }
    // We are a Promise (whether by explicit application compute or by contagion above),
    // so make sure we resolve to a final value to store.
    if (this.willResolve) return value;
    this.willResolve = true;
    value.then(resolved => this.resolve(target, property, resolved, receiver),
               reason => this.reject(target, property, reason, receiver));
    return value;
  }
  resolve(target, property, resolved, receiver) {
    fixmeLog(`${this}.resolve(...${resolved}...)`);
    this.clearFlags();
    this.storeValue(target, property, resolved, receiver);
    this.usedBy.forEach(dependent => dependent.retryData && dependent.get(dependent.instance, dependent.key));
  }
  reject(target, property, reason, receiver) {
    let retryData = this.retryData;
    this.clearFlags();
    if (retryData) retryData.reject(reason);
    this.usedBy.forEach(dependent => dependent.retryData && dependent.retryData.reject(reason));
  }
  clearFlags() {
    delete this.willResolve;
    delete this.retryData;
  }
  isPendingPromise(value) {
    return this.retryData && (value instanceof Promise);
  }
  trackRule(value) {
    let isTracking = super.trackRule(value);
    if (isTracking && (value instanceof Promise)) {
      throw this; // So that the computing rule that uses us can track this Promise in its catch.
    }
    return isTracking;
  }
  ofInterest() { // FIXME remove
    //return ['referencingRules', 'childrenInitialized', 'parts', 'entity'].includes(this.key);
  }
  resetReferences() {
    if (this.ofInterest()) console.log(`resetReferences ${this}`);
    this.clearFlags();
    return super.resetReferences();
  }
}
module.exports = PromisableRule;

/*
fixme Failures:
1) Persistable example restores what it saves, and responds to change.
2) Persistable example chains across objects.
3) PersistedTree example restores what it saves, and responds to change.
4) Tree initialChildren does not resolve until specs resolve.
*/
