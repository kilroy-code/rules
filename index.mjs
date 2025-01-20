import { Proxied } from './proxied.mjs';
import { Computed } from './computed.mjs';
import { Eager } from './eager.mjs';
export const Rule = Computed;

Rule.Eager = Eager;

function getterPropertyData(objectOrPrototype) {
  return Object.entries(Object.getOwnPropertyDescriptors(objectOrPrototype)).filter(([key, descriptor]) => descriptor.get && !descriptor.set);
}
function allRulablePropertyNames(objectOrPrototype) {
  return Object.getOwnPropertyNames(objectOrPrototype).filter(function (prop) { return 'constructor' !== prop; });
}
function defaultPropertyRuleNames(objectOrPrototype, defaultAll = true) {
  let getterData = getterPropertyData(objectOrPrototype);
  if (getterData.length) return getterData;
  return defaultAll ? allRulablePropertyNames(objectOrPrototype) : [];
}

// Convert an entire instance or prototype, or list to Rules.
// FIXME: let's either call this create or from, or just make it the constructor. (Make a new package version.)
Rule.rulify = function rulify(object, {defaultAll, ...options} = {}) {
  if (Array.isArray(object)) return Proxied.attach(object);
  const {
    ruleClass = Rule, 
    ruleNames = defaultPropertyRuleNames(object, defaultAll),
    eagerNames = [],
    ...configuration // Might include, e.g., configurable, assignment, ...  See Property.attach().
  } = options;
  ruleNames.forEach(function (key) {
    let formula;
    if (Array.isArray(key)) {
      formula = key[1].get;
      key = key[0];
    } else {
      formula = object[key];
    }
    const isEager = eagerNames.includes(key),
	  klass = isEager ? Eager : ruleClass;
    klass.attach(object, key, formula, configuration);
  });
  return object;
}
