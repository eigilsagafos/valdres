---
"valdres": minor
---

Allow duplicate copies of the same known Valdres version to adopt one shared
global runtime instead of throwing. The shared `globalStore`, backing store
data, semantic side tables, lifecycle markers, generated store IDs, name
indexes, and global-family registry now keep engine state unified across copies,
including `instanceof`-based error control flow. Different or unknown versions
fail with actionable guidance.

Global atom families remain first-definition-wins singletons, but development
builds now warn when a later default or options object is ignored, and
detectable kind or `keyOf` contract mismatches throw.
