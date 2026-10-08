---
"valdres": patch
---

Stop `options.equal` from inferring or widening the value type of `atom`,
`atom.lazy` and `selector`. The value type now comes only from the initial
value, initializer or read function, so `atom(untyped, { equal: deepEqual })`
stays `Atom<any>` instead of `Atom<unknown>` and `atom(1, { equal: deepEqual })`
is `Atom<number>`. Comparators are still checked against, and inline comparator
parameters still typed by, that value type: a comparator narrower than the value
(for example `(previous: 1, next: 1) => boolean` for `atom(1)`) is now rejected
instead of narrowing it. Declarations only; the runtime is unchanged and the
declarations do not require TypeScript 5.4's `NoInfer`.
