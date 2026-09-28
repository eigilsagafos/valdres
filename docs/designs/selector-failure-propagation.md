# Selector failure propagation cost

Status: implemented as two independent changes, each pending owner approval
because each changes an observable property of the wrapper errors on one engine.
The size allowance below is also pending approval.

## Problem

A selector that throws fails every subscribed dependent. Each failing dependent
gets its own `SelectorGetterError`, whose `cause` is the
`SelectorDependencyError` its getter received, whose `cause` is the dependency's
own error outcome. One throw under 2,000 subscribed dependents in 20 layers
therefore creates 4,001 library errors (2,001 getter and 2,000 dependency
wrappers) and a cause chain 41 wrappers deep. ShiftX reported the same shape: 3
root throws, 3,981 wrappers, and a failing collapse costing 56 ms against 36 ms
without the throws.

The wrapper count follows from the public error shape: each wrapper carries a
different `selector` or `dependency`, and a selector that catches the dependency
error sees its own wrapper. The cost does not. Measured on Bun 1.4.0 and Node
24.16 with `packages/valdres/test/performance/failure-propagation`:

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

Failing write, one root throw, 2,000 subscribed dependents (median of three
processes, each the p50 of 30 interleaved rounds):

| Topology | Bun base | Bun healthy | Node base | Node healthy | Jotai (Bun / Node) |
| -------- | -------: | ----------: | --------: | -----------: | -----------------: |
| chain    |  18.8 ms |      2.6 ms |   28.3 ms |       2.7 ms |       3.8 / 3.0 ms |
| mixed    |  21.1 ms |      3.7 ms |   31.0 ms |       3.4 ms |       4.0 / 3.3 ms |

Jotai rethrows the dependency's own error without wrappers, so it is the floor
for this workload.

## Changes

Both changes apply only to the two propagation wrappers. Every other selector
and runtime error is frozen as before. The engine is detected once, by the shape
of `Object.getOwnPropertyDescriptor(new Error(), "stack")`.

1. **Lazy stacks where freezing computes them (JavaScriptCore).** Wrappers make
   `message`, `code`, `name`, `selector` or `dependency`, and `cause`
   non-writable and non-configurable, and make the error non-extensible, instead
   of freezing it. The engine computes a stack only when it is read. Where
   `stack` is not an own data property, wrappers are still frozen.
2. **No captured frames where construction captures them (V8).** Wrappers are
   constructed with `Error.stackTraceLimit` set to 0 and restored in `finally`.
   The limit is suspended only while it is an own writable data property, and
   only around the wrapper constructor, which runs no application code.

## Observable changes

- On JavaScriptCore (Bun, Safari), `Object.isFrozen(wrapper)` is `false`, and
  the engine's own `stack`, `line`, `column` and `sourceURL` stay writable and
  configurable. The wrapper's metadata stays read-only and it cannot gain
  properties.
- On V8 (Chrome, Node), a wrapper's `stack` is its name and message with no
  frames. The thrown value at the end of the `cause` chain keeps its stack, and
  `selector` and `dependency` still identify the path.

Unchanged: error classes and codes, messages, `selector`, `dependency`, cause
chains, identity (repeated reads return the same wrapper, and each failing
dependent still gets its own), catch behavior, the thrown value itself, which is
inspected no further than the existing thenable and classification checks, and
the number and order of evaluations, notifications and reported failures.

## Results

Same workload with both changes:

| Topology | Bun    | Node   | Bun, reading every wrapper stack afterwards |
| -------- | ------ | ------ | ------------------------------------------- |
| chain    | 5.4 ms | 3.5 ms | 13.4 ms (base 2.2 ms)                       |
| diamond  | 6.3 ms | 5.5 ms | 13.6 ms (base 2.2 ms)                       |
| fanout   | 6.0 ms | 3.8 ms | 15.0 ms (base 2.3 ms)                       |
| mixed    | 7.0 ms | 5.0 ms | 12.1 ms (base 2.1 ms)                       |

Healthy writes and recovery are unchanged within the noise of an identical null
build (±4% on failing writes). A consumer that reads every wrapper's stack pays
the deferred JavaScriptCore work there; failing write plus that read is still
below the baseline (chain: 18.8 + 2.2 ms before, 5.4 + 13.4 ms after). On V8,
reading every stack drops from 21 ms to 2.4 ms.

Retained heap in the failing state, above the healthy state: Bun 6.3 → 0.9 MB,
Node 6.5 → 0.5 MB (chain). V8 allocates 7.6 MB per failing write instead of 9.8
MB (6.8 MB for a healthy write). JavaScriptCore has no allocation counter.

## Rejected

- **Sharing one wrapper per failed dependency across readers** changes identity
  and only helps fan-out; each reader must still see its own getter wrapper.
- **Fewer or shallower wrappers** change the public cause chain that
  catch-and-fallback selectors and the packed-consumer contract inspect.
- **Read-only metadata on every engine** costs V8 about 400 ns per wrapper
  (`defineProperty` is slower there than `freeze`), a 10% slower failing write.
- **Lazily created wrappers** do not work: the dependency wrapper is thrown into
  application code, and each getter wrapper is the next dependency wrapper's
  cause.

## Size certification

Pending owner approval. Measured on pinned Bun 1.4.0 against `main`
(`713e17c3`), which sits exactly at the core-retaining ceilings:

| Fixture                                | main raw / gzip | branch raw / gzip | Change      |
| -------------------------------------- | --------------- | ----------------- | ----------- |
| `atom-selector-store` (core-retaining) | 67,865 / 18,252 | 68,369 / 18,444   | +504 / +192 |

The lazy-stack change alone accounts for +287 / +123. The proposed allowances
are 2,085 raw and 1,175 gzip, the exact no-cushion overages. The `dist`,
`packed`, `collection`, `query`, `query-development`, `all-exports`, `inspect`
and `external-atom` budgets move to the measured values, and the runtime digest
is recertified.
