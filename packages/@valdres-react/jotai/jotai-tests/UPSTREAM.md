# Upstream Jotai test snapshot

The compatibility tests in this directory were last compared with Jotai
`v2.20.2` at commit `5c4ca26b0db5571114be58393e17854a771f7790`.

The suite adapts upstream tests to Bun and imports the local compatibility
implementation instead of Jotai. It covers the adapter's exported core, React,
`atomFamily`, and `atomWithLazy` APIs. Tests for Jotai APIs that this package
does not export are intentionally not copied.

Local adaptations, skipped internal-only cases, and known gaps are tracked in
[`../COMPAT_TODO.md`](../COMPAT_TODO.md).
