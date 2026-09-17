---
"valdres": patch
"valdres-react": patch
---

Add read-only ExternalAtom definitions for synchronous external sources. Stores
share one projection across scopes, attach sources while consumers retain them,
capture transaction snapshots, and isolate server/hydration reads. Family
factories can create ExternalAtoms, and inspection reports their lifecycle work
without recording values. React bindings are certified for SSR, hydration,
rebinding, and StrictMode with ordinary and inspectable Stores.
