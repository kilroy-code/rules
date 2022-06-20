/* Class hierarchy
  BaseRule
    Tracked
      Promisable
        Property
          Computed
            Eager
        Proxied
*/

var fixmeDebug = false;
export function debug(x) { fixmeDebug = x; }
var oneShotArmed = true;

// A horrible hook for injecting a new base class and construction mechanism.
// define window.baseRuleClass before import.
const BaseClass = ((typeof window !== 'undefined') && window.baseRuleClass) ?
      window.baseRuleClass :
      class BaseRuleClass {
	constructor(properties) {
	  this.init(properties);
	}
	init() {
	}
	static create(properties) { // A hook so we can do it different ways.
	  return new this(properties);
	}
      };

console.log({window, baseRuleClass: window.baseRuleClass, BaseClass});

// An abstract rule that only only supports get/set/reset, and printing.
export class BaseRule extends BaseClass {
  init({instance, key, instanceLabel}) { // instance must be the specific instance, not the __proto__.
    super.init();
    this.instance = instance;
    this.key = key;
    this.collectingReferences = [];
    if (instanceLabel) this.instanceLabel = instanceLabel;
  }
  toString() {
    return `[${this.constructor.name} ${this.instanceLabel || this.instanceToString()} ${this.key}]`;
  }
  instanceToString() { // See Proxied.instanceToString
    return this.instance.toString();
  }

  // get and set can be used directly, exactly as for the Reflect protocol.
  // In fact, Reflect.get and .set should work on rules.
  // In a proxy, get(originalTargetBeingProxied, propertyName, proxyReceiverOrObjectThatInheritsFromIt)
  get() {
    return this.retrieveValue(...arguments);
  }
  set() {
    this._setInternal(...arguments);
    return true; // To be compatible with Reflect.set and Proxy handler.set, must answer a success boolean.
  }
  // Subclasses must define the actual methods:
  // retrieveValue(target, property, receiver=target) { }
  // storeValue(target, property, value, receiver=target) { }
  _setInternal() {
    this.storeValue(...arguments);
  }
  reset() {
    if (fixmeDebug) {
      try {
        if (oneShotArmed) {
          oneShotArmed = false;
          throw new Error('here');
        } else {
          console.log('reset', this);
        }
      } catch (e) {
        console.log('reset', this, e);
      }
    }
    // Same code as set(), but not going through that method, which can be redefined for application-specific assignments.
    this._setInternal(this.instance, this.key, undefined);
  }
}
