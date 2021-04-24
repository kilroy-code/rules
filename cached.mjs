/*
  Cached
    Tracked
      Promisable
        //Property (desired)
          Computed
            Property (currently)
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
