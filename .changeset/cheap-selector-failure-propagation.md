---
"valdres": patch
---

**A failing selector no longer computes a stack for every dependent it fails on
JavaScriptCore (Bun, Safari).**

A throw fails every subscribed dependent, and each gets its own
`SelectorGetterError` wrapping a `SelectorDependencyError`. On JavaScriptCore,
freezing these wrappers computed their stack, line and column immediately, which
was most of the cost of a failing write. They now keep their metadata
(`message`, `code`, `name`, `selector` or `dependency`, and `cause`) read-only
and are non-extensible, but are no longer frozen, so the engine computes each
stack only when it is read. On V8 (Chrome, Node) freezing never computed the
stack and wrappers stay frozen. Codes, messages, cause chains, identity and
stack contents are unchanged.
