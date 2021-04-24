import { Property } from './property.mjs';
import { Proxied } from './proxied.mjs';
import { Eager } from './eager.mjs';
export var Rule = Property;

Rule.Eager = Eager;

function rulifiablePropertyName(key) { // We don't want to rulify array methods
  let keyString = key.toString();
  if (keyString === 'length') return keyString;
  if (/^[0-9]+$/.test(keyString)) return keyString; // integer keys are good
  // Everything else, we'll want to use the property (typically a method) in object.
  return false;
}

// Convert an entire instance or prototype, or list to Rules.
Rule.rulify = function rulify(object, {
  asArray = Array.isArray(object),
  ruleClass = asArray ? Proxied : Rule,
  ruleNames = asArray ?
    [rulifiablePropertyName] :
    Object.getOwnPropertyNames(object).filter(function (prop) { return 'constructor' !== prop; }),
  eagerNames = [],
  ...configuration // Might include, e.g., configurable, assignment, ...  See Property.attach().
} = {}) {
  let result = object;
  ruleNames.forEach(function (key) {
    let isEager = eagerNames.includes(key);
    let klass = isEager ? Eager : ruleClass; // fixme
    result = klass.attach(object, key, object[key], configuration);
  });
  return result;
}
