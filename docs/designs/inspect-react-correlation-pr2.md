# React inspection correlation — PR2 decisions

Status: implementation record for a stacked follow-up to the inspectable Store
flight recorder. PR2 is not merge-ready until core beta.26 has been published.

## Goal

Place Valdres operation/commit/search evidence and the React work a user feels
on one diagnostic clock, without changing the ordinary `valdres-react` entry or
inventing Store-to-React causality that React's public APIs cannot prove.

## Selected choices

1. **React-only slice.** PR2 adds `valdres-react/inspect`. Value serialization
   and OpenTelemetry export remain separate later slices.
2. **Recording-neutral core capture.** The opt-in `StoreInspector` gains
   `capture(store, state?)`. It returns only recorder-relative time, safe
   references, and genuinely active span/operation/commit/session/evaluation/
   search IDs. It records no row and retains no application value, but may
   assign safe reference IDs in the recorder's weak identity cache. It rejects
   Stores that do not belong to that inspector.
3. **Independent timelines.** Subscriber callbacks, client/server snapshot
   reads, and Profiler boundary callbacks are recorded independently on the core
   recorder's clock. Subscriber rows retain exact active core IDs. Client
   snapshot rows say whether the read happened synchronously on the subscriber
   callback's stack. No queue or nearest-event heuristic claims that a Store
   commit caused a React commit.
4. **Separate bounded React report.** Profiler callbacks use one bounded summary
   ring and subscriber/snapshot reads use another; `export()` returns the exact
   core report alongside them. The recording/export stores no props, children,
   component instances, callbacks, errors, State values, or State handles.
5. **One opt-in binding factory.** `createInspectableReact(core)` returns a
   bound Provider, instrumented `useValue`/`useAtom`, writer hooks with
   unchanged Store behavior, and a composite inspector. ShiftX can swap its
   existing state facade once instead of adding an inspection Context read to
   every ordinary hook. The Provider and explicit hook override may select any
   child Store owned by the same inspector; the inspected root is the default.
6. **Shared split build.** Root and inspect entries share one private
   `StoreContext` chunk. This permits root/inspect interop while keeping all
   recorder code unreachable from an ordinary root-only consumer.
7. **One coordinated controller.** Composite export/reset owns both recorders.
   An externally reset core recording starts a new React recording boundary
   rather than silently cross-linking two core recordings.
8. **Bounded evidence.** Profiler summaries and subscriber/snapshot details use
   independent rings. Overflow remains explicit and event totals remain exact,
   while overflow can discard individual rows and therefore their per-event
   correlation IDs.

## Implemented report shape

The composite export is `valdres.react.inspect` schema version 1 and embeds the
exact immutable core export. Subscriber and client/server snapshot details
contain value-free start/end captures, result status, duration, Provider
identity, subscriber-stack context, and hydration-cache status. Profiler rows
are boundary callbacks, not unique React commits. Adjacent callbacks sharing
React's `commitTime` receive a `commitTimeGroupId`, explicitly a heuristic
grouping key because reduced timer precision can merge separate commits.

Subscriber and snapshot timelines remain complete in an ordinary production
build even when React emits no Profiler callbacks; the report exposes whether a
Profiler callback was observed. Snapshot rows count reads and consistency
checks, not component renders. With one top-level inspected Provider, Profiler
callback count is the practical ShiftX render-boundary signal when a profiling
build supplies it.

## Alternatives retained for review

- A Profiler-only wrapper was rejected. `onRender` normally runs after the core
  interval has closed, so it cannot recover exact IDs; React also disables
  Profiler timing in its default production build. Subscriber and snapshot
  timelines remain useful in ordinary production builds.
- Subscriber-to-commit batch queues were rejected. Production React may emit no
  Profiler callback, and concurrent, aborted, nested, or layout-effect work has
  no public causal token a queue could close against soundly.
- Nearest-event inference was rejected. React can batch several Store commits,
  delay concurrent work, render for unrelated state, or expose colliding clock
  values. Consumers may inspect temporal overlap but must not call it causality.
- A generic public `inspect.event(fields)` escape hatch was rejected. The core
  capture method is read-only and fixed-schema, and React data remains in the
  separately versioned React report.
- Separate root and inspect bundles were considered, but they duplicate the
  private Store Context. A split graph preserves identity and must be paired
  with a root-only bundle-size/reachability gate.

## Deferred value capture

Per-State serializers would revise PR1's `no application values` contract, run
user code on the measured path, need independent byte/count budgets, and reopen
the unresolved snapshot/onChange/enumeration migration. If later evidence needs
values, design a separate opt-in attachment with explicit serializers and its
own overflow/fault model.

## Deferred OpenTelemetry export

Any OpenTelemetry integration should consume a completed immutable report and an
application-owned tracer. Valdres should not import an SDK, exporter, network
transport, or collector policy. That mapper comes only after the combined core
and React schemas settle.

## Release staging

Develop PR2 stacked on PR1, but do not add final Changesets or publish-guard
metadata until core beta.26 is versioned and live. Then rebase onto current
`origin/main`, add core and React minor Changesets, raise the React peer floor,
and publish the capture seam plus `valdres-react/inspect` as the next
coordinated core/React beta pair. The exact beta numbers are selected from the
live queue at that point; no temporary release tuple is added while PR2 is
stacked.
