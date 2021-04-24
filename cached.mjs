/*
  Cached
    Tracked
      Promisable
        Property
          Computed
            Eager
        Proxied
vs
  TrackingRule
    PromisableRule
      ComputedRule
        PropertyRule - reference
          EagerRule - referenced
      ProxyRule - referenced
 */

export class Cached {
}
