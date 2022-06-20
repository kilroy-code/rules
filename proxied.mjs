//import { Promisable } from './promisable.mjs';
//import { Property as Promisable } from './property.mjs';
import { Computed as Promisable } from './computed.mjs';

export class Proxied extends Promisable {

  // I would like for rules to be an array of ordinary PropertyRules (or Computedrules), in which each value
  // is stored in rules[n].cached.  Then we wouldn't need these two methods at all.
  // I don't know why that doesn't work. See also instance and lengthInstance in Proxy definition.
  retrieveValue(target, property, proxyReceiver = target) {
    // No need: return super.retrieveValue(target, property, proxyReceiver);
    return this.instance[property];
  }
  storeValue(target, property, value, proxyReceiver = target) {
    super.storeValue(target, property, value, proxyReceiver);
    this.instance[property] = value;
  }

  instanceToString() {
    // Seems unnecessary, until you wonder why a rule attached to the array [x] prints
    // as [ProxyRule x foo] instead of [ProxyRule [x] foo]!

    // If this.instance is implemented with the original array:
    return `[${this.instance.toString()}]`;

    // If this.instance is implemented with the proxy:
    //return `[${this.instance.rules.map(rule => rule.retrieveValue())}]`;
  }

  // ISSUE:
  // Suppose we have an ordinary property rule A that is used by another ordinary property rule B.
  // However, suppose that the value of A is a rulified array, and that the rule in B maps that array to another.
  // Currently, that will result in the rule B having dependencies on A, every element of the array in A, and the
  // length of the array in A. That's good in the sense that any changes to A as a whole -- and also changes to the
  // A array length or any element -- will cause B to be recomputed. However, IWBNI assigning one element in A only
  // changes the corresponding element in B, rather than remapping everything.
  // I think that we COULD achieve this by acting more like Computed, but having compute note the individual Proxied
  // element being computed (and continue to have Proxied.get track the individual Proxied element being referenced,
  // as we already do, per above issue). Maybe forEach and map on these beasts could arrange for
  // RuleStack.current.noteComputing? But I imagine that we still have to keep array length changes as they are now...

  // Answer a proxy that automatically tracks any property that answers a non-empty string for ruleKey(key).
  // FIXME: While a PropertyRule is attached for a specific property named by the second argument,
  // a ProxyRule is attached for the whole target, that will dynamically apply to those keys for which getRuleKey(key) is true.
  // Issue: It is hard to distinguish between one array target instance vs another when debugging dependencies.
  static attach(target, getRuleKey, _ignoredTargetValueAtGetRuleKey, configuration) {

    // While PropertyRules side-effect the objectOrProto (converting each methodOrInit value to rules),
    // ProxyRules do not (FIXME) alter the original target (which means we must keep our own array).
    const rules = []; // TODO: Which is faster, [] or {}?

    let lengthRule,
        instance = target,
	// lengthInstance is the object that we will trampoline length get/set to.
	// I would think that rules is perfectly good value here, but for reasons I don't understand, doing so causes array methods
	// such as map, forEach, reduce, etc. to operate only on the original length.
	lengthInstance = target; //fixme target or rules

    const ensureRule = (key) => { // gets/stores a Rule in ruleStore.
      if (key === 'length') return lengthRule;
      const ruleKey = getRuleKey(key);
      if (!ruleKey) return;
      const rule = rules[key]; // fixme explain ruleKey];
      if (rule !== undefined) return rule;
      return rules[key] = this.create({ // fixme? key or ruleKey
	instance: instance,
	key: key, // fixme? key or ruleKey,
	// key rather than ruleKey, in case of transformation such as 'length' => 'lengthRule'. See rulifiableArrayPropertyName.
	init: target[key], // This line isn't needed if we use the original array (rule.instance) for value storage.
	...configuration
      });
    };
    const proxy = new Proxy(target, {
      // This simple version is the heart of dependency-directed backtracking.
      // It does not compute values, nor resolve promises (although we inherit from Promisable, which does resolve promises).
      // TODO: ensure there is a test case for when ruleKey answers falsy.
      // If there is no rule (because getRuleKey said no, as for anything other than an integer or 'length'),
      // then we use Reflect.get/.set, which should pull it from the original target (which is where we
      // happen to actually store the values, per store/retrieveValue).
      get: function (target, key, proxy = this) {
        const rule = ensureRule(key);
	if (rule) return rule.get(target, key, proxy);
        if (key === 'toString') return _ => lengthRule.instanceToString();
	if (key === 'rules') return rules;
	return lengthInstance[key]; // Same as Reflect.get
      },
      set: function (target, key, value, proxy = this) {
        const rule = ensureRule(key);
        return (rule || Reflect).set(target, key, value, proxy);
      }
    });

    // Special in so many ways. Might as well take it completely separately.
    lengthRule = this.create({instance, key: 'length', ...configuration}); // fixme: try Tracked.create
    lengthRule.retrieveValue = _ => lengthInstance.length;
    lengthRule.storeValue = (t, k, value) => {
      for (let index = rules.length; index < value; index++) { Reflect.get(t, index); } // fixme: not needed after all?
      lengthInstance.length = value;
    }
    lengthRule.storeValue(instance, 'length', target.length); // redundant if instance is target

    window.rules = rules; window.lengthRule = lengthRule; // fixme remove

    return proxy;
  }
}

// FIXME: Not 'length', because in some implementations of ProxiedRule, we would try to assign anArray.length to a Rule.
Proxied.lengthRuleKey = 'length'; // fixme explain this.
