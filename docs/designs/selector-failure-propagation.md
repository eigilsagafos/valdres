# Selector failure propagation cost

Status: implemented, pending owner approval. Both changes alter an observable
property of the wrapper errors on one engine, and the size allowance below is
not yet approved.

## Problem

A selector that throws fails every subscribed dependent. Each failing dependent
gets its own `SelectorGetterError`, whose `cause` is the
`SelectorDependencyError` its getter received, whose `cause` is the dependency's
own error outcome. One throw under 2,000 subscribed dependents in 20 layers
therefore creates 4,001 library errors (2,001 getter and 2,000 dependency
wrappers), and each chain is up to 41 wrappers deep. ShiftX reported the same
shape (3 root throws, 3,981 wrappers) on `valdres@1.0.0-beta.40`, not current
`main`.

The wrapper count follows from the public error shape: each wrapper carries a
different `selector` or `dependency`, and a selector that catches the dependency
error sees its own wrapper. The cost per wrapper does not. Measured on Bun 1.4.0
and Node 24.16 with `packages/valdres/test/performance/failure-propagation`:

- **JavaScriptCore** keeps an Error's stack, line and column as lazily computed
  own data properties. `Object.freeze` enumerates them and forces the
  computation: 1.1–1.3 µs per wrapper, against 0.1 µs to construct it unfrozen.
  `Object.freeze` was 68% of the CPU profile of a loop of failing and recovering
  writes. `Error.stackTraceLimit = 0` does not help (freezing still costs 1.2
  µs) and makes `stack` undefined.
- **V8** exposes `stack` as an own accessor, so freezing computes nothing.
  Construction captures frames eagerly instead: about 230 ns per frame, 2.4 µs
  at the default limit of ten. A frozen V8 error's `stack` can still be
  reassigned through the accessor's setter.

Safari and Chrome use these engines but were not measured; their behavior is
inferred from Bun and Node.

## Changes

Both changes apply only to `SelectorGetterError` and `SelectorDependencyError`.
Every other error is constructed and frozen as before. The engine is detected
once per module instance, at the first propagated error. Bun is identified
directly, because reading any Error's stack there runs the application's
`Error.prepareStackTrace`. Elsewhere detection reads the shape of
`Object.getOwnPropertyDescriptor(new Error(), "stack")`, which runs no
application code. If that read throws, the wrappers stay frozen and framed as on
`main`, and detection is not retried.

1. **Lazy stacks where freezing computes them (JavaScriptCore).** Wrappers make
   `message`, `code`, `name`, `selector` or `dependency`, and `cause`
   non-writable and non-configurable, and make the error non-extensible, instead
   of freezing it. The engine computes a stack only when it is read. Where
   `stack` is not an own data property, wrappers are still frozen.
2. **No frames on wrappers around wrappers (V8).** A wrapper whose `cause` is
   already a selector error from this module is constructed with
   `Error.stackTraceLimit` set to 0 and restored in `finally`. The limit is
   suspended only while it is an own writable data property, and only around the
   wrapper constructor, which runs no application code. Every other wrapper is
   constructed at its call site exactly as before. In practice that is the first
   wrapper around a thrown value, a query failure or a cycle error.

The check in 2 is a private-field brand that only this module's constructors can
create. It never reads the thrown value, and a thrown value's `code`, `name`,
prototype or `instanceof` result cannot forge it.

## Observable changes

- On JavaScriptCore (Bun, Safari), `Object.isFrozen(wrapper)` is `false`. The
  engine's own `stack`, `line`, `column` and `sourceURL` stay writable and
  configurable, as `stack` already was on V8. The wrapper's metadata stays
  read-only and it cannot gain properties.
- On V8 (Chrome, Node), a wrapper around another selector error has a `stack` of
  only its name and message. The first wrapper around the thrown value keeps the
  stack it had before, so every cause chain still has frames, including when the
  thrown value is a primitive or plain object. At the default
  `Error.stackTraceLimit` of 10, those frames show Valdres internals down to the
  operation, such as `mutate`; they reach application code only with a higher
  limit. Baseline wrappers further up the chain also recorded the reading
  selector's `get()` call site; those frames are gone.
- On JavaScriptCore, a custom `Error.prepareStackTrace` used to run for every
  wrapper during every failing write, inside the selector's callback. It now
  runs only when a stack is read. On V8 it was, and still is, called only on
  read.

Unchanged: error classes and codes, messages, `selector`, `dependency`, cause
chains, identity (repeated reads return the same wrapper, and each failing
dependent gets its own), catch behavior, and the thrown value itself. The thrown
value is inspected no further than the existing thenable and classification
checks. The number and order of evaluations, notifications and reported failures
is also unchanged.

## Results

These numbers cover the measured failing-write workloads only, not selector
performance in general or ShiftX overall. Workload: 2,000 subscribed dependents
in 20 layers of 100. Each cell is the median of three fresh processes, each the
p50 of 30 interleaved rounds. A byte-identical copy of `main` measured
0.93–1.05× `main` on failing writes and 1.00–1.17× on healthy ones.

V8 variants, failing write on Node 24.16. The first four columns are one run;
the last is a separate run with its own `main` of 26.5–28.4 ms:

| Workload                 |    main | fully frameless | first wrapper framed, private brand | same, WeakSet brand | also frame the first dependency wrapper (WeakSet) |
| ------------------------ | ------: | --------------: | ----------------------------------: | ------------------: | ------------------------------------------------: |
| chain, `Error`           | 27.2 ms |          3.4 ms |                              3.4 ms |              4.0 ms |                                            4.4 ms |
| chain, string            | 26.0 ms |          3.3 ms |                              3.5 ms |              4.0 ms |                                            4.5 ms |
| mixed, plain object      | 26.9 ms |          4.4 ms |                              4.4 ms |              4.8 ms |                                            5.4 ms |
| mixed, `Error`, 3 roots  | 26.9 ms |          4.3 ms |                              4.4 ms |              4.8 ms |                                            5.9 ms |
| diamond, string, 3 roots | 29.1 ms |          4.9 ms |                              4.4 ms |              6.5 ms |                                            5.3 ms |

This change is the private-brand variant with framed wrappers constructed at
their call sites. Measured directly against `main` and fully frameless wrappers,
it took 3.3 ms (frameless 3.2 ms, `main` 25.4 ms) for a string thrown into a
chain, and 4.4 ms (frameless 4.8, `main` 28.9) for `Error`s from three roots.
The WeakSet brand's per-wrapper bookkeeping cost 0.4–2.1 ms. Also framing the
first dependency wrapper would restore the reading selector's `get()` frame for
0.3–1.0 ms more than the WeakSet variant it was built on. That cost scales with
how many selectors read a failing root directly.

JavaScriptCore is unaffected by the V8 change. Failing write with both changes,
against `main`: chain 18.8 → 5.4 ms, diamond 20.7 → 6.3, fanout 20.9 → 6.0,
mixed 21.1 → 7.0, and mixed with three roots 17.6 → 5.9. A consumer that reads
every wrapper's stack pays the deferred JavaScriptCore work there: 2.2 → 12–15
ms. The failing write plus that read is still below `main`'s (chain: 18.8 + 2.2
ms before, 5.4 + 13.4 ms after). On V8, reading every stack drops from 16–21 ms
to about 2 ms.

Healthy writes and recovery are unchanged within the null-copy spread. For
reference, Jotai on the same graph takes 2.7–3.7 ms (Node) and 3.2–4.1 ms (Bun)
for the failing write. Jotai rethrows the dependency's own error without
wrappers, so it does less work and is not a floor for this design.

Memory, from instrumented runs without timing: retained heap in the failing
state above the healthy state is 5.2–6.4 → 0.3–0.5 MB on Node and 5.2–6.1 →
0.6–0.8 MB on Bun. V8 allocates about 7.7 MB per failing write instead of 9.8
MB; a healthy write allocates 6.8 MB. JavaScriptCore has no allocation counter.

Wrappers are counted two ways. Walking `cause` chains from subscribed outcomes
counts only reachable wrappers: 3,429 in `mixed`. Counting them as they are
sealed also includes the 558 dependency wrappers that fallbacks caught and
discarded: 3,987.

## Rejected

- **Sharing one wrapper per failed dependency across readers** changes identity
  and only helps fan-out. Each reader must still see its own getter wrapper.
- **Fewer or shallower wrappers** change the public cause chain that
  catch-and-fallback selectors and the packed-consumer contract inspect.
- **Read-only metadata on every engine** costs V8 about 400 ns per wrapper
  (`defineProperty` is slower there than `freeze`), a 10% slower failing write.
- **Lazily created wrappers** do not work: the dependency wrapper is thrown into
  application code, and each getter wrapper is the next dependency wrapper's
  cause.
- **Fully frameless V8 wrappers** leave a primitive throw with no frames
  anywhere, for no measurable gain over this change.

## Size certification

Pending owner approval. Measured on pinned Bun 1.4.0 against `main`
(`713e17c3`), which sits exactly at the core-retaining ceilings:

| Fixture                                | main raw / gzip | branch raw / gzip | Change      |
| -------------------------------------- | --------------- | ----------------- | ----------- |
| `atom-selector-store` (core-retaining) | 67,865 / 18,252 | 68,490 / 18,498   | +625 / +246 |

The JavaScriptCore change alone accounts for +287 / +123. Fully frameless V8
wrappers were +504 / +192. Constructing framed wrappers at their call sites, so
their stacks equal `main`'s, costs 47 / 17 of that more than doing it inside the
helper. The proposed allowances are 2,206 raw and 1,229 gzip, the exact
no-cushion overages. The `dist`, `packed`, `collection`, `query`,
`query-development`, `all-exports`, `inspect` and `external-atom` budgets move
to the measured values, and the runtime digest is recertified.
