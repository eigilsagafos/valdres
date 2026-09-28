---
"valdres": patch
---

**A failing selector no longer does stack work for every dependent it fails.**

A throw fails every subscribed dependent, and each gets its own
`SelectorGetterError` wrapping a `SelectorDependencyError`. Stack work for these
wrappers was most of the cost of a failing write: V8 (Chrome, Node) captured
frames for each one, and JavaScriptCore (Bun, Safari) computed each stack
immediately because the wrapper was frozen.

- On V8, wrappers are now constructed without stack frames. Their `stack` is
  just their name and message. The `selector` and `dependency` fields identify
  where the failure passed, and the thrown value at the end of the `cause` chain
  keeps its own stack. `Error.stackTraceLimit` is suspended only while a wrapper
  is constructed and is left alone when it is not writable.
- On JavaScriptCore, wrappers are no longer frozen, so the engine computes a
  stack only when it is read. Their metadata (`message`, `code`, `name`,
  `selector` or `dependency`, and `cause`) stays read-only and they stay
  non-extensible; the engine's own `stack`, `line` and `column` stay writable,
  as `stack` already was on V8.

Codes, messages, cause chains and identity are unchanged.
