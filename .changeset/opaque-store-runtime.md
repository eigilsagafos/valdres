---
"valdres": minor
"valdres-react": patch
"valdres-vue": patch
"valdres-solid": patch
"valdres-svelte": patch
"valdres-angular": patch
"@valdres/redux-devtools": patch
"@valdres-react/jotai": patch
"@valdres-react/recoil": patch
"@valdres-react/panable": patch
---

Make Store runtimes opaque. Stores now expose stable public identity through
`store.id` instead of publishing mutable `StoreData`; `StoreData` is no longer
exported from `valdres`, and `onSet` receives the public Store facade. Framework
and tooling adapters now use the capability-based, versioned
`valdres/adapter-internals/v1` boundary, which keeps adapter lookups off atom
get/set hot paths. Engine-only atom/global-atom synchronization fields and the
`MaxAgeInterval` timer type are no longer part of the public type surface.
