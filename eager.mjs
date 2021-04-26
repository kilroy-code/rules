import { Computed } from './computed.mjs';
export class Eager extends Computed {
  reset() {
    super.reset();
    setTimeout(_ => this.get(this.instance, this.property)); // FIXME: really nextTick
  }
}
