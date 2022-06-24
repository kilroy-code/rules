import { Tracked } from './tracked.mjs';
import { Computed } from './computed.mjs';

class LengthRule extends Tracked {
  retrieveValue(target, key) {
    return this.instance[key];
  }
  storeValue(target, key, value) {
    this.instance[key] = value;
  }
}

export class Proxied extends Computed {
  // There are two different ways we could go about storing and using the rules.
  // The approach we use here is to keep an array of normal Rules used in the normal way (plus the length Rule).
  //   The original target is not effected, and the Proxy is a completely independent copy.
  //   It is then absolutely necessary to define proxy traps for 'has' and 'ownKeys' that use that array or Rules.
  //   Otherwise, Array methods that iterate will fall through to the original target array.
  // The other is to side-effect the original target to store the value of each element and of the length. (E.g., 
  //   In this case, would need to have a retriveValue and storeValue here that interacts with that target,
  //   instead of rule.cached,) and each Rule's 'instance' would be the target (including the length Rule).
  // It's a wash as to which is more compact, but the former seems safer and less punny.
  
  instanceToString() {
    // Seems unnecessary, until you wonder why a rule attached to the array [x] prints
    // as [ProxyRule x foo] instead of [ProxyRule [x] foo]!
    return `[${this.instance.toString()}]`;
  }

  // Answer a proxy that automatically tracks any property that answers a non-empty string for ruleKey(key).
  // While a PropertyRule.attach operates on a specific property named by the second argument,
  // ProxyRule.attach operates on the whole target (more like rulify).
  static attach(target) {
    const rules = Array(target.length), // TODO: Which is faster, [] or {}?
	  lengthRule = LengthRule.create({instance: rules, key: 'length'}),
	  ensureRule = (proxy, key) => { // gets/stores a Rule in ruleStore.
	    if (key === 'length') return lengthRule;
	    if (!(/^[0-9]/.test(key.toString()))) return; // If (string or symbol) key doesn't start with a number.
	    const rule = rules[key];
	    if (rule) return rule;
	    return rules[key] = this.create({instance: proxy, key});
	  },
	  proxy = new Proxy(target, {
	    // If there is no rule (as for anything other than an index or 'length'),
	    // then we use Reflect.get/.set, which stores/retrieves from our internal rules object.
	    get(target, key, proxy = this) {
              const rule = ensureRule(proxy, key);
	      if (rule) return rule.get(rules, key); // proxy target
	      if (key === 'rules') return rules; // Handy for debugging.
	      return Reflect.get(rules, key);
	    },
	    set(target, key, value, proxy = this) {
              const rule = ensureRule(proxy, key);
	      if (rule) return rule.set(rules, key, value); // proxy target
              return Reflect.set(rules, key, value);
	    },
	    has(target, property) {
	      return !!rules[property];
	    },
	    ownKeys() {
	      return Object.getOwnPropertyNames(rules);
	    }
	  });
    // Make a clean copy now of all the current elements and length, rather than lazilly demanding them later.
    target.forEach((element, index) => proxy[index] = element);
    return proxy;
  }
}

// FIXME: Not 'length', because in some implementations of ProxiedRule, we would try to assign anArray.length to a Rule.
Proxied.lengthRuleKey = 'length'; // fixme explain this.
