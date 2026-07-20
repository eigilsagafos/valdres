---
"valdres": patch
"@valdres-react/jotai": patch
---

Update Jotai compatibility coverage to Jotai 2.20.2. Preserve dependency read
order when mounting sibling atoms, and surface original atom-read errors from
the Jotai adapter instead of Valdres diagnostic wrappers. Support Jotai's
per-store `INTERNAL_onInit` hook for primitive atoms.
