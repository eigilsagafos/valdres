---
"valdres": patch
---

**A failing selector does much less stack work for each dependent it fails.**

A throw fails every subscribed dependent, and each gets its own
`SelectorGetterError` wrapping a `SelectorDependencyError`. On the measured
workloads, stack work for these wrappers was most of the cost of a failing
write. V8 (Chrome, Node) captured frames for every wrapper. Bun computed every
wrapper's stack immediately because the wrapper was frozen.

- On V8, a wrapper whose `cause` is another selector error is now constructed
  without stack frames, so its `stack` is just its name and message. The first
  wrapper around the thrown value keeps its stack as before, so every cause
  chain still has frames, even when a string or plain object was thrown.
  `Error.stackTraceLimit` is suspended only while such a wrapper is constructed,
  and it is left alone when it is not an own writable data property.
- In Bun, wrappers are no longer frozen, so the engine computes a stack only
  when it is read. Their metadata (`message`, `code`, `name`, `selector` or
  `dependency`, and `cause`) stays read-only and they cannot gain properties.
  The engine's own `stack`, `line` and `column` stay writable, as `stack`
  already was on V8.
- Other engines, including Safari, keep the frozen, framed wrappers.
- The wrappers define their `name` rather than assigning it, so a setter on
  `Error.prototype.name` no longer runs for them.

Codes, messages, cause chains, identity and the thrown value are unchanged. The
`selector` docs now describe these wrappers, their cause chain and their stacks.
