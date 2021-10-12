import { Promisable } from './promisable.mjs';

export class Proxied extends Promisable {
  // this.instance is the original target, not the proxy. This allows these two methods to be invoked
  // by other kinds of Rules that do not know the details of our target vs proxy.
  //
  retrieveValue(target, property, proxyReceiver = target) {
    // No need: super.retrieveValue(target, property, receiver);
    return this.instance[property];
  }
  storeValue(target, property, value, proxyReceiver = target) {
    super.storeValue(target, property, value, proxyReceiver);
    this.instance[property] = value;
  }
  instanceToString() {
    // Seems unnecessary, until you wonder why a rule attached to the array [x] prints
    // as [ProxyRule x foo] instead of [ProxyRule [x] foo]!
    return `[${this.instance.toString()}]`;
  }

  // ISSUE:
  // We currently instantiate a distinct Proxied Rule for each element of the array we reference. That's nice
  // in the sense that we can have a rule reference a single element and only be dependent on that element.
  // But it seems wasteful if we're going to reference ALL the elements of an array. IWBNI we didn't do that in
  // such cases, unless there was some value to be had.... (see next).
  
  // ISSUE:
  // Suppose we have an ordinary property rule A that is used by another ordinary property rule B.
  // However, suppose that the value of A is a rulified array, and that the rule in B maps that array to another.
  // Currently, that will result in the rule B having dependencies on A, every element of the array in A, and the
  // length of the array in A. That's good in the sense that any changes to A as a whole -- and also changes to the
  // A array length or any element -- will cause B to be recomputed. However, IWBNI assigning one element in A only
  // changes the corresponding element in B, rather than remapping everything.
  // I think that we COULD achieve this by acting more like Computed, but having compute note the individual Proxied
  // element being computed (and continue to have Proxied.get track the individual Proxied element being referenced,
  // as we already do, per above issue). Maybe forEach and map on these beasts could arraynge for
  // RuleStack.current.noteComputing? But I imagine that we still have to keep array length changes as they are now...

  // Answer a proxy that automatically tracks any property that answers a non-empty string for ruleKey(key).
  static attach(target, getRuleKey, _, configuration) {
    let rulesStore = {};
    let ensureRule = (key) => { // gets/stores a Rule in ruleStore.
      let ruleKey = getRuleKey(key);
      if (!ruleKey) return;
      var rule = rulesStore[ruleKey];
      if (rule !== undefined) return rule;
      // Issue: It is hard to distinguish between one array target instance vs another when debugging dependencies.
      return rulesStore[ruleKey] = new this({instance: target, key, ...configuration});
    }
    return new Proxy(target, {
      // This simple version is the heart of dependency-directed backtracking.
      // It does not compute values, nor resolve promises (although we inherit from Promisable, which does resolve promises).
      // TODO: ensure there is a test case for when ruleKey answers falsy.
      // If there is no rule (because getRuleKey said no, as for anything other than an integer or 'length'),
      // then we use Reflect.get/.set, which should pull it from the original target (which is where we
      // happen to actually store the values, per store/retrieveValue).
      get: function (target, key, proxy = this) {
        if (key === 'toString') return _ => this.instanceToString();
        let rule = ensureRule(key);
        return (rule || Reflect).get(target, key, proxy);
      },
      set: function (target, key, value, proxy = this) {
        let rule = ensureRule(key);
        return (rule || Reflect).set(target, key, value, proxy);
      }
    });
  }
}
