import { Promisable } from './promisable.mjs';

export class Proxied extends Promisable {
  // this.instance is the original target, not the proxy. This allows these two methods to be invoked
  // by other kinds of Rules that do not know the details of our target vs proxy.
  retrieveValue(target, property, receiver = target) {
    // super does not define an implementation:
    // super.retrieveValue(target, property, receiver);    
    return this.instance[property];
  }
  storeValue(target, property, value, receiver = target) {
    super.storeValue(target, property, value, receiver);    
    this.instance[property] = value;
  }
  // Answer a proxy that automatically tracks any property that answers a non-empty string for ruleKey(key).
  static attach(target, getRuleKey) {
    let rulesStore = {};
    let ensureRule = (key) => { // gets/stores a Rule in ruleStore.
      let ruleKey = getRuleKey(key);
      if (!ruleKey) return;
      var rule = rulesStore[ruleKey];
      if (rule !== undefined) return rule;
      return rulesStore[ruleKey] = new this({instance: target, key});
    }
    return new Proxy(target, {
      // This simple version is the heart of dependency-directed backtracking.
      // It does not cache results, compute values, nor resolve promises.
      // TODO: ensure there is a test case for when ruleKey answers falsy.
      get: function (target, key) {
        if (key === 'toString') return _ => `[${target.toString()}]`;
        let rule = ensureRule(key);
        return (rule || Reflect).get(target, key, target);
      },
      set: function (target, key, value) {
        let rule = ensureRule(key);
        return (rule || Reflect).set(target, key, value, target);
      }
    });
  }
}
