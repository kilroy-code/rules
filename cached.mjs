/* Class hierarchy
  Cached
    Tracked
      Promisable
        Property
          Computed
            Eager
        Proxied
*/

// An abstract rule that only only supports get/set/reset, and printing.
export class Cached {
  constructor({instance, key}) { // instance must be the specific instance, not the __proto__.
    this.instance = instance;
    this.key = key;
    this.collectingReferences = [];
  }
  toString() {
    return `[${this.constructor.name} ${this.instanceToString()} ${this.key}]`;
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
  reset() {
    // Same code as set(), but not going through that method, which can redefined for application-specific assignments.
    this._setInternal(this.instance, this.key, undefined);
  }

  _setInternal() {
    this.storeValue(...arguments);
  }
  // Subclasses must define the actual methods:
  // retrieveValue(target, property, receiver=target) { }
  // storeValue(target, property, value, receiver=target) { }
}
