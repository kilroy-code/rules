import { Tracked } from './tracked.mjs';

// TODO:
// Split the simple parts out into a class Memoize, and Rule that inherits from it.
/* Resolve elements of a rulified array, like this:
class ResolveArrayExample {
  array() { return Rule.rulify([1, Promise.resolve(2)]); }
  reference() { return this.array.map(element => element + 1); }
}
await new ResolveArrayExample.reference; // [2, 3]
   I think maybe the only reason this doesn't already work is that initial values don't pass through storeValue. Making this so would then also make this work:
let example = Rule.rulify({
  promise: Promise.resolve(1),  // Not a computation
  reference: self => return self.promise + 1
});
await example.reference; // 2
*/
            

// Return the retrieved or computed value as possible.
//
// If computation references a value that is still a promise, a placeholder Promise value is stored
// and returned:
// - When a required referenced promise resolves, the computation will be tried again - which again
//   might result in a placeholder Promise.
// - When a required referenced promise is rejected, this rule's placeholder Promise is rejected.
//
// If the value is a promise -- whether a placeholder Promise or not -- arrangements are made to
// handle resolution or rejection of the promise.
// - A resolution stores the resolved value, and retries any pending rules that are usedBy this one.
// - A rejection rejects any pending rules that are usedBy this one. (By definition, a Promise rejection
//   will occur asynchronously from application code. It will either be handled by an explicit rejection
//   handler, or be treated by the Javascript implentation as an unhandled rejection.)

export class Promisable extends Tracked {
  storeValue(target, property, value, receiver = target) {
    if (value instanceof Promise) this.setupPromiseResolution(target, property, value, receiver);
    // No need: super.storeValue(ruleTarget, property, value, receiver);
  }
  setupPromiseResolution(target, property, value, receiver) {
    value.then(resolved => this.onResolved(target, property, resolved, receiver),
               reason => this.onRejected(target, property, reason, receiver));
  }

  trackRule(value) {
    if (!super.trackRule(value)) return false;
    if (value instanceof Promise) {
      throw this; // So that the computing rule that uses us can track this Promise in its catch.
    }
    return true;
  }
  maybeBecomePromisableByContagion(thrown) {
    if (thrown instanceof Promisable) {
      // A Computed subclass required something that threw a Promise in trackRule, above.
      return new Promise((resolve, reject) => this.placeholderPromiseData = {resolve, reject});
    }
    throw thrown; // Not a Promise rule, so re-signal the error.
  }
  resetReferences() {
    delete this.placeholderPromiseData;
    super.resetReferences();
  }
  onResolved(target, property, resolved, receiver) {
    // Store resolved value and re-demand each dependency (resolving dependencies as possible).

    // We will reset each dependency, below. That will recursively reset their dependencies and placeholder promises,
    // so gather them all up now into an array of all dependent {rule, placeholder} pairs.
    // (IWBNI we did this in a way that produced less garbage.)
    let usedBy = [],
        add1 = (rule) => {
          if (rule !== this) usedBy.push({rule, placeholder: rule.placeholderPromiseData});
          rule.usedBy.forEach(add1);
        };
    add1(this);

    // The resolved value has already been determined, perhaps by computation that has already captured dependencies.
    // We want to preserve that, so we storeValue rather than set (which would resetReferences).
    this.storeValue(target, property, resolved, receiver);

    // Reset each dependency and re-demand it, resolving any that can be resolved.
    usedBy.forEach(({rule}) => rule.reset()); // Reset 'em all, so that dependencies can be gathered.
    usedBy.forEach(({rule, placeholder}) => { // Demand each, and resolve as possible.
      let value = rule.get(rule.instance, rule.key);
      if (!placeholder || (value === undefined)) return;
      placeholder.resolve(value);
    });
  }
  onRejected(target, property, reason, receiver) {
    this.usedBy.forEach(dependent => {
      let retry = dependent.placeholderPromiseData;
      if (!retry) return;
      retry.reject(reason);
    });
  }
}

