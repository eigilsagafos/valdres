---
"valdres": patch
---

Unnamed `atomFamily.name` is now `undefined` instead of the intrinsic JS function
name `"atomFamily"`. Previously a family created without `{ name }` reported the
declaring function's name, so consumers that use `name` as an identity/address
(devtools, sync/persistence adapters) had to treat the literal string
`"atomFamily"` as a reserved "unnamed" sentinel. That heuristic broke under
minification (bundlers mangle the intrinsic name, so an unnamed family slipped
unnamed-detection in production builds) and wrongly flagged a family a user
legitimately named `"atomFamily"`.

Unnamed families now mirror unnamed atoms (`atom()` without options has `name`
undefined): `atomFamily(x).name === undefined`. A family explicitly named
`"atomFamily"` keeps that name and is now distinguishable from an unnamed one.
Named-family member naming (`name + "_" + key`) is unchanged.
