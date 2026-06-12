---
"valdres": patch
---

Unnamed `atomFamily.name` / `selectorFamily.name` are now `undefined` instead of
the intrinsic JS function names `"atomFamily"` / `"selectorFamily"`. Previously a
family created without `{ name }` reported the declaring function's name, so
consumers that use `name` as an identity/address (devtools, sync/persistence
adapters) had to treat those literal strings as reserved "unnamed" sentinels.
That heuristic broke under minification (bundlers mangle the intrinsic name, so
an unnamed family slipped unnamed-detection in production builds) and wrongly
flagged a family a user legitimately named `"atomFamily"` / `"selectorFamily"`.

Unnamed families now mirror unnamed atoms/selectors (`atom()` / `selector()`
without options have `name` undefined): `atomFamily(x).name === undefined`. A
family explicitly named `"atomFamily"` keeps that name and is now distinguishable
from an unnamed one. Named-family member naming (`name + "_" + key`) is unchanged.
