---
"valdres": patch
---

Defer `AbortController` allocation on the first evaluation of a selector
until the selector body actually reads `options.signal`. `options.signal` is
now a lazy getter, so selectors that don't use the signal (the common case)
pay no allocation cost on their first eval. The known-sync cache still
short-circuits subsequent evaluations to a shared options object. Aborting a
previous controller on re-eval and storing the new controller for async
re-eval cancellation are preserved.
