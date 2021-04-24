import { PropertyRule } from './propertyRule.mjs';
import { ProxyRule } from './proxyRule.mjs';
export var Rule = PropertyRule;

class EagerRule extends PropertyRule {
  reset() {
    super.reset();
    setTimeout(_ => this.get(this.instance, this.property)); // FIXME: really nextTick
  }
}
Rule.EagerRule = EagerRule;

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
  ruleClass = asArray ? ProxyRule : Rule,
  ruleNames = asArray ?
    [rulifiablePropertyName] :
    Object.getOwnPropertyNames(object).filter(function (prop) { return 'constructor' !== prop; }),
  eagerNames = [],
  ...configuration // Might include, e.g., configurable, assignment, ...  See PropertyRule.attach().
} = {}) {
  let result = object;
  ruleNames.forEach(function (key) {
    let isEager = eagerNames.includes(key);
    let klass = isEager ? EagerRule : ruleClass; // fixme
    result = klass.attach(object, key, object[key], configuration);
  });
  return result;
}
