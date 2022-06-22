// These top ones are for debugging. Not part of API (yet).
export { RuleStack } from './ruleStack.mjs';
export { BaseRule } from './baseRule.mjs';

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
Rule.rulify = function rulify(object, {
  asArray = Array.isArray(object),
  ruleClass = asArray ? Proxied : Rule,
  ruleNames = asArray ? [rulifiableArrayPropertyName] : defaultPropertyRuleNames(object),
  eagerNames = [],
  ...configuration // Might include, e.g., configurable, assignment, ...  See Property.attach().
} = {}) {
  let result = object; // In case attach produces a proxy.
  ruleNames.forEach(function (key) {
    let formula;
    if (Array.isArray(key)) {
      formula = key[1].get;
      key = key[0];
    } else {
      formula = object[key];
    }
    let isEager = eagerNames.includes(key);
    let klass = isEager ? Eager : ruleClass; // fixme
    result = klass.attach(result, key, formula, configuration);
  });
  return result;
}
