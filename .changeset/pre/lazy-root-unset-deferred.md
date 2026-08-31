---
"@valdres/redux-devtools": patch
---

Keep root `unset()` lazy when `store.onChange` is active. Reporting an unset no
longer evaluates a function or async default just to populate the event; a root
unset omits `value` unless propagation already rematerialized it. Redux DevTools
now removes cold root entries when that optional value is absent.
