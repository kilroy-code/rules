import { Proxied } from './proxied.mjs';
import { Computed } from './computed.mjs';
import { Eager } from './eager.mjs';
export const Rule = Computed;

Rule.Eager = Eager;

function rulifiableArrayPropertyName(key) { // We don't want to rulify array methods
  let keyString = key.toString();
  if (keyString === 'length') return Proxied.lengthRuleKey; 
  if (/^[0-9]+$/.test(keyString)) return keyString; // integer keys are good
  // Everything else, we'll want to use the property (typically a method) in object.
  return false;
}

function getterPropertyData(objectOrPrototype) {
  return Object.entries(Object.getOwnPropertyDescriptors(objectOrPrototype)).filter(([key, descriptor]) => descriptor.get && !descriptor.set);
}
function allRulablePropertyNames(objectOrPrototype) {
  return Object.getOwnPropertyNames(objectOrPrototype).filter(function (prop) { return 'constructor' !== prop; });
}
function defaultPropertyRuleNames(objectOrPrototype) {
  let getterData = getterPropertyData(objectOrPrototype);
  if (getterData.length) return getterData;
  return allRulablePropertyNames(objectOrPrototype);
}

// Convert an entire instance or prototype, or list to Rules.
// FIXME: let's either call this create or from, or just make it the constructor. (Make a new package version.)
Rule.rulify = function rulify(object, options = {}) {
  if (Array.isArray(object)) return Proxied.attach(object);
  const {
    ruleClass = Rule, 
    ruleNames = defaultPropertyRuleNames(object),
    eagerNames = [],
    ...configuration // Might include, e.g., configurable, assignment, ...  See Property.attach().
  } = options;
  ruleNames.forEach(function (key) {
    const isEager = eagerNames.includes(key),
	  klass = isEager ? Eager : ruleClass;
    klass.attach(object, key, object[key], configuration);
  });
  return object;
}
