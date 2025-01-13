/* Class hierarchy
  BaseRule
    Tracked
      Promisable
        Property
          Computed
            Eager
        Proxied
*/

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

// An abstract rule that only only supports get/set/reset, and printing.
export class BaseRule extends BaseClass {
  init({instance, key, instanceLabel}) { // instance must be the specific instance, not the __proto__.
    super.init();
    // TODO: The instance <=> Rule reference loop can delay garbage collection. Can we get rid of it?
    // Promisable.onResolved, Computed.retrieveValue, Proxied.store/retrieveValue, printing.
    this.instance = instance;
    this.key = key;
    this.collectingReferences = [];
    if (instanceLabel) this.instanceLabel = instanceLabel;
  }
  toString() {
    return `[${this.constructor.name} ${this.instanceLabel || this.instanceToString()} ${this.key}]`;
  }
  instanceToString() { // See Proxied.instanceToString
    if (this.instance.toString !== Object.prototype.toString || !this.instance.constructor) return this.instance.toString();
    return `[object ${this.instance.constructor.name}]`;
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
    // Same code as set(), but not going through that method, which can be redefined for application-specific assignments.
    this._setInternal(this.instance, this.key, undefined);
  }
  free() {
    // Release reference that this rule has, and remove it from it's instance.
    const {instance, key} = this;
    this.reset(); // Remove us from other's usedBy.
    Object.getOwnPropertyNames(this).forEach(key => delete this[key]);
    delete instance[key];
  }
  static get(instance) {
    // Return all and only those rules that have ever been instantiated (and thus take up memory).
    return Object.getOwnPropertyNames(instance).filter(prop => {
      return prop.startsWith("_") && (instance[prop] instanceof BaseRule);
    });
  }
  static free(instance) {
    this.get(instance).forEach(ruleKey => instance[ruleKey].free());
  }
}
