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
