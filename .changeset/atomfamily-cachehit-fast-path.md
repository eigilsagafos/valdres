---
"valdres": patch
---

Speed up the `atomFamily(id)` cache-hit hot path — the only benchmark where
valdres trailed Jotai on Bun/JSC (~15ns vs 6ns). The hot path used a rest parameter
(`(...args)`), which forces a fresh array allocation on every call, plus a
cross-module `familyKey()` call that acts as an inlining barrier. Ablation showed
the rest-array allocation was the dominant cost (~7ns) and the call a minor one
(~2ns).

The cache-hit path now declares a single positional parameter and reads only
`arguments.length` (never indexing `arguments`), so the engine can skip both the
rest-array allocation and materializing the arguments object; a single primitive
arg is its own cache key, so it looks up the map directly with no `familyKey()`
call. Object / multi-arg / non-primitive calls fall through to the original
variadic logic unchanged. Construction moves to a cold `build()` helper that only
runs on a cache miss.

Result: cache hit drops to ~6ns on Bun (Jotai parity) and ~2ns on Node/V8 (from
~12ns), a strict win on both engines with identical behavior. The create/miss
path also benefits, since single-primitive args now skip `familyKey()` entirely.
