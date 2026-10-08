---
---

Correct the `atom`, `selector` and compatibility documentation for Valdres v1:
values are shared by reference and never copied or frozen, `Object.is` is the
default equality, `AtomOptions` and `SelectorOptions` contain only `name` and
`equal`, and pre-1.0 options are kept under clearly labelled legacy sections.

Intentionally empty: a documentation-only change to the docs site source.
