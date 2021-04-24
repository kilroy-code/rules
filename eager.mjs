import { Property } from './property.mjs';

export class Eager extends Property {
  reset() {
    super.reset();
    setTimeout(_ => this.get(this.instance, this.property)); // FIXME: really nextTick
  }
}
