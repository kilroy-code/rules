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
// Subclasses must define the actual:
//   retrieveValue(target, property, receiver=target) { }
//   storeValue(target, property, value, receiver=target) { }
export class Cached {
  constructor({instance, key}) { // instance must be the specific instance, not the __proto__.
    this.instance = instance;
    this.key = key;
  }
  toString() {
    return `[${this.constructor.name} ${this.instanceToString()} ${this.key}]`;
  }
  instanceToString() { // See Proxied.instanceToString
    return this.instance.toString();
  }

  get(...args) {
    return this.retrieveValue(...args);
  }
  set(...args) {
    this._setInternal(...args);
    return true; // To be compatible with Reflect.set and Proxy handler.set, must answer a success boolean.
  }
  reset() {
    // Same code as set(), but not going through that method, which can redefined for application-specific assignments.
    this._setInternal(this.instance, this.key, undefined);
  }

  _setInternal(...args) {
    this.storeValue(...args);
  }
}
