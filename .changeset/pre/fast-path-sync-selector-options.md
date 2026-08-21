---
"valdres": patch
---

Speed up selector initialization on V8 (Node). `evaluateSelector` no longer
builds a per-evaluation options object with an accessor `signal` getter for
selectors that don't declare the options parameter (`get.length < 2`) — they
reuse the shared per-store sync options (real `storeId`, non-abortable `signal`)
and skip the `abortControllers` WeakMap traffic. Cuts ~15–20% off the Node
`sub+unsub` chain-init latency (now matching or beating Jotai on small/medium
chains) with no measurable change on Bun/JSC and no behavior change for
selectors that declare `options` positionally or via destructuring
(`(get, opts)`, `(get, { signal })`).
