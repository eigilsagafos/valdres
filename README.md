# Valdres

Valdres is a synchronous atom and selector state engine for JavaScript, with
React 18 and 19 bindings. `valdres@1.0.0-beta.24` and
`valdres-react@1.0.0-beta.5` are the first public builds of the new module-owned
runtime, scoped stores, atomic transactions, and lifecycle-free subscriptions.

The website currently documents the legacy beta. The install path and examples
below are the source of truth for the v1 beta while the site is being migrated.

```bash
npm install valdres@beta valdres-react@beta react
```

```tsx
import { atom, selector, store } from "valdres"
import { Provider, useUpdateAtom, useValue } from "valdres-react"

const countAtom = atom(0)
const doubledSelector = selector(get => get(countAtom) * 2)
const appStore = store()

function Counter() {
    const count = useValue(countAtom)
    const doubled = useValue(doubledSelector)
    const increment = useUpdateAtom(countAtom)
    return (
        <button onClick={() => increment(c => c + 1)}>
            {count} ×2 = {doubled}
        </button>
    )
}

const App = () => (
    <Provider store={appStore}>
        <Counter />
    </Provider>
)
```

Atoms and selectors are immutable capability handles identified by reference. A
Store owns their values and derived graph. `set` stores an exact value,
including functions; `update` applies an updater. Stores also provide
synchronous subscriptions, transactions, nested scopes, reset, and explicit
disposal.

## Opt-in structural equality

`Object.is` remains the default comparator. Import `deepEqual` from the separate
equality entry only where structurally equal replacements should retain the
previous reference and stop notifications or downstream propagation:

```ts
import { atom } from "valdres"
import { deepEqual } from "valdres/equality"

const documentAtom = atom({ blocks: [] }, { equal: deepEqual })
```

`deepEqual` recursively compares supported values using SameValueZero primitive
leaves, own enumerable string and symbol properties, and native identity for Map
keys and Set members. Non-binary objects require the same prototype. Matching
binary brands compare visible bytes across realms and ignore attached
properties. Functions, Promises, Errors, URLs, weak collections, other opaque
platform objects, and DOM nodes compare only by identity. Cyclic structures are
unsupported. Reached getters, Proxy traps, `valueOf`, and `toString` hooks can
run and throw.

Structural comparison walks the compared values, so use it deliberately on
allocation-heavy results where pruning redundant updates outweighs that work.
The separate `valdres/equality` entry keeps it out of ordinary root bundles.

## Inspect a Store

`valdres/inspect` creates an opt-in Store with a bounded structural flight
recorder. It belongs to the same runtime domain as ordinary Stores, so existing
atoms, selectors, scopes, and framework adapters work unchanged:

```ts
import { createInspectableStore } from "valdres/inspect"

const { store: appStore, inspect } = createInspectableStore()

inspect.span("drop interaction", () =>
    appStore.txn(transaction => {
        transaction.update(processAtom, updateProcess)
    }, "collapse process"),
)

const report = inspect.export()
inspect.reset()
```

The report correlates human labels with opaque operation, commit, evaluation,
session, and search IDs. It includes selector work, proposed topology changes,
cycle-search visits by host and call site, transient selector-host counts, and
propagation/notification totals. Completed summaries and details use separate
bounded rings with explicit overflow. Exports are immutable and JSON-safe;
application values, callbacks, errors, and live State handles are never
recorded. Labels are metadata, not identity.

Inspection adds recording and timing work only to the Store created by
`createInspectableStore`. The recorder stays outside the ordinary root entry and
ordinary consumer bundles remain within their existing size budget.
`store.txn(callback, name?)` accepts the optional label on every Store; ordinary
Stores validate and otherwise ignore it.

## Correlate React work

`valdres-react/inspect` binds the React adapter to an inspectable core. Use the
returned Provider and hooks only for the tree being measured:

```tsx
import { createInspectableStore } from "valdres/inspect"
import { createInspectableReact } from "valdres-react/inspect"

const core = createInspectableStore()
const react = createInspectableReact(core)
const editorStore = core.store.scope("editor")

function Editor() {
    const document = react.useValue(documentAtom)
    // render document
}

const app = (
    <react.Provider store={editorStore}>
        <Editor />
    </react.Provider>
)

const report = react.inspect.export()
react.inspect.reset()
```

Omit the Provider's `store` prop to use `core.store`, or pass a child scope from
the same inspector as shown above. Explicit Store arguments on the returned
hooks are also supported and must belong to that inspector.

The immutable composite export contains the exact core flight-recorder report
plus separately bounded React timelines. Subscriber rows retain the genuinely
active core IDs read through the recording-neutral
`core.inspect.capture(store, state?)` seam. Snapshot rows distinguish React's
synchronous subscriber check from later reads; they are reads, not component
render counts. Profiler rows are boundary callbacks on the same clock, while
their `commitTimeGroupId` is only a timestamp grouping key—not a unique commit
or a causal link to a Store operation.

Subscriber and snapshot timelines work in ordinary production React builds.
Profiler timing is present only in development or a profiling-enabled production
build. The recording/export retains no State values, props, children, callbacks,
errors, or component instances. This opt-in entry is absent from the ordinary
`valdres-react` root bundle and adds no capture work to ordinary hooks.

This is an intentional breaking beta cutover. Only `valdres` and `valdres-react`
are certified together. The Angular, Vue, Svelte, Solid, plugin, and
compatibility packages listed below remain on the legacy API and are unsupported
with `valdres@1.0.0-beta.24` or later until they are migrated. Their published
semver ranges may still allow npm to install this core, so do not mix those
packages with the new beta.

## Packages

The package tables below are auto-generated — do not hand-edit.

<!-- PACKAGES:START -->
### Core

| Package | Description |
|:--------|:------------|
| [`valdres`](https://valdres.dev/guides/introduction) | Fast atom-based state management for JavaScript. Inspired by Recoil and Jotai. |

### Framework adapters

| Package | Description |
|:--------|:------------|
| [`valdres-angular`](https://valdres.dev/guides/quick-start-angular) | Angular bindings for Valdres state management |
| [`valdres-react`](https://valdres.dev/guides/introduction) | React bindings for Valdres state management |
| [`valdres-solid`](https://valdres.dev/guides/quick-start-solid) | Solid.js bindings for Valdres state management |
| [`valdres-svelte`](https://valdres.dev/guides/quick-start-svelte) | Svelte 5 bindings for Valdres state management |
| [`valdres-vue`](https://valdres.dev/guides/quick-start-vue) | Vue 3 bindings for Valdres state management |

### Plugins (framework-agnostic)

| Package | Description |
|:--------|:------------|
| [`@valdres/bandwidth`](https://valdres.dev/react/plugins/bandwidth) | Reactive network throughput, latency, and jitter from a live measurement |
| [`@valdres/browser-color-scheme`](https://valdres.dev/react/plugins/browser-color-scheme) | Reactive prefers-color-scheme (dark / light) media query |
| [`@valdres/browser-contrast`](https://valdres.dev/react/plugins/browser-contrast) | Reactive prefers-contrast preference from the OS |
| [`@valdres/browser-device-motion`](https://valdres.dev/react/plugins/browser-device-motion) | Reactive device acceleration and rotation from DeviceMotionEvent |
| [`@valdres/browser-device-orientation`](https://valdres.dev/react/plugins/browser-device-orientation) | Reactive device tilt and compass heading from DeviceOrientationEvent |
| [`@valdres/browser-focus`](https://valdres.dev/react/plugins/browser-focus) | Reactive document focus state from the window focus/blur events |
| [`@valdres/browser-geolocation`](https://valdres.dev/react/plugins/browser-geolocation) | Reactive geolocation — position, accuracy, permission, and status |
| [`@valdres/browser-keyboard`](https://valdres.dev/react/plugins/browser-keyboard) | Reactive pressed-key state from keydown / keyup |
| [`@valdres/browser-online`](https://valdres.dev/react/plugins/browser-online) | Reactive online/offline status from navigator.onLine |
| [`@valdres/browser-presence`](https://valdres.dev/react/plugins/browser-presence) | Whether the user is present — tab visible and window focused |
| [`@valdres/browser-reduced-data`](https://valdres.dev/react/plugins/browser-reduced-data) | Reactive prefers-reduced-data media query |
| [`@valdres/browser-reduced-motion`](https://valdres.dev/react/plugins/browser-reduced-motion) | Reactive prefers-reduced-motion preference from matchMedia |
| [`@valdres/browser-reduced-transparency`](https://valdres.dev/react/plugins/browser-reduced-transparency) | Reactive prefers-reduced-transparency media query state |
| [`@valdres/browser-screen`](https://valdres.dev/react/plugins/browser-screen) | Reactive screen resolution and orientation from window.screen |
| [`@valdres/browser-screen-details`](https://valdres.dev/react/plugins/browser-screen-details) | Reactive multi-screen layout from the Window Management API |
| [`@valdres/browser-visibility`](https://valdres.dev/react/plugins/browser-visibility) | Reactive Page Visibility state (visible / hidden) |
| [`@valdres/browser-window`](https://valdres.dev/react/plugins/browser-window) | Reactive window inner size, tracked through resize events |
| [`@valdres/color-mode`](https://valdres.dev/react/plugins/color-mode) | Color mode (dark/light theme) state powered by Valdres |
| [`@valdres/hotkeys`](https://valdres.dev/react/plugins/hotkeys) | Hotkey state management powered by Valdres |
| [`@valdres/public-ip`](https://valdres.dev/react/plugins/public-ip) | Reactive public IP (v4/v6) with stale-while-revalidate |
| [`@valdres/redux-devtools`](https://valdres.dev/react/plugins/redux-devtools) | Connect a valdres store to the Redux DevTools browser extension |

### React extras

| Package | Description |
|:--------|:------------|
| [`@valdres-react/color-mode`](https://valdres.dev) | React color mode hooks powered by Valdres |
| [`@valdres-react/draggable`](https://valdres.dev) | React drag-and-drop powered by Valdres |
| [`@valdres-react/hotkeys`](https://valdres.dev) | React hotkey hooks powered by Valdres |
| [`@valdres-react/jotai`](https://valdres.dev/guides/migration) | Jotai API compatibility layer for Valdres |
| [`@valdres-react/panable`](https://valdres.dev) | React pan and zoom powered by Valdres |
| [`@valdres-react/recoil`](https://valdres.dev/guides/migration) | Recoil API compatibility layer for Valdres |
<!-- PACKAGES:END -->

## Development

```bash
bun install
bun test             # certified v1 core + React cohort
bun run test:all     # deferred legacy maintenance lane
bun run docs:dev     # legacy docs site at localhost:4321
```

## Releasing

Versioning and publishing is handled by
[Changesets](https://github.com/changesets/changesets). Each package versions
independently.

The future v1 stable release is governed by the hard gates and RC burn-in
checklist in [RELEASING.md](./RELEASING.md).

**When you open a PR that changes a publishable package:**

```bash
bunx changeset
```

Pick the affected packages, the bump type (patch/minor/major), and write a short
summary. Commit the generated `.changeset/*.md` file with your PR.

For PRs that touch publishable code but intentionally don't trigger a release
(refactors, internal cleanup, docs):

```bash
bunx changeset --empty
```

This still generates a `.changeset/*.md` file — commit it like a regular
changeset. The `Require changeset` check on ordinary feature PRs enforces that
any change to a publishable package ships with a changeset (empty or otherwise);
the generated Version Packages PR has already consumed those changesets.

When the PR merges to `main`, the `Publish` workflow opens (or updates) a
**Version Packages** PR that applies the pending changesets, bumps versions, and
updates CHANGELOGs. Merging that PR publishes the affected packages to npm.

To preview what publishing would do locally:

```bash
bun run verify-publish
```

The repo is currently in `beta` prerelease mode (`bunx changeset pre exit` to
graduate to stable). While in prerelease mode, changesets that have already been
versioned into a `beta` release move to `.changeset/pre/`. Certified core+React
histories are consumed by their stable release; ignored deferred histories
remain for their packages. Leave those files alone unless a change genuinely no
longer applies to its eventual release.

## Benchmarks

### Performance

The table below is the archived legacy-engine benchmark and does not describe
the `1.0.0-beta.24` runtime. New v1 numbers will replace it after the beta runs
in real applications, including ShiftX.

valdres is benchmarked against [Jotai](https://github.com/pmndrs/jotai) (and a
raw `Map` floor) on every PR via [Bencher](https://bencher.dev) — live,
always-current latency per operation under both Bun (JavaScriptCore) and Node.js
(V8):

**→ [bencher.dev/perf/valdres](https://bencher.dev/perf/valdres)**

[![store.get(atom) latency — valdres vs Jotai vs raw Map (Bun + Node)](https://api.bencher.dev/v0/projects/valdres/perf/img?branches=ca02205d-e4c5-4f8e-a227-9790cc6d7f7d&testbeds=6ed7a83d-343c-43c1-b270-225a1688718e%2C0c5502c7-6901-4334-a06c-110e7468d6bb&benchmarks=cc14bb7a-a64d-4e0c-a277-abde4e2f8449%2C7406c2e2-a4cc-4327-935a-2f7fbc9c41b7%2C741adc2f-32e7-47d6-9759-42cf16fc5c8a&measures=34bb7b72-22ec-45bd-bb99-0768d0e0319e&title=store.get%28atom%29+latency%3A+valdres+vs+jotai+vs+map)](https://bencher.dev/perf/valdres?branches=ca02205d-e4c5-4f8e-a227-9790cc6d7f7d&testbeds=6ed7a83d-343c-43c1-b270-225a1688718e%2C0c5502c7-6901-4334-a06c-110e7468d6bb&benchmarks=cc14bb7a-a64d-4e0c-a277-abde4e2f8449%2C7406c2e2-a4cc-4327-935a-2f7fbc9c41b7%2C741adc2f-32e7-47d6-9759-42cf16fc5c8a&measures=34bb7b72-22ec-45bd-bb99-0768d0e0319e&tab=plots&x_axis=date_time)

<sub>Live plot — `store.get(atom)` latency, valdres vs Jotai vs a raw `Map`
floor, on both runtimes. Auto-updates from `main`; click through to filter/zoom.
(Sparse until `main` accumulates a few runs.)</sub>

Every PR from the repo gets a comment flagging any latency regression vs `main`
(fork PRs are skipped — they can't read the upload key).

<!-- BENCH:START -->

### Performance vs Jotai

Latest `main` latency per operation (live, always-current numbers:
[bencher.dev/perf/valdres](https://bencher.dev/perf/valdres)). Auto-generated
from Bencher — do not hand-edit.

#### Bun (JavaScriptCore)

| Operation                                                                    | valdres |   Jotai |                 |
| :--------------------------------------------------------------------------- | ------: | ------: | :-------------- |
| `atom lifecycle (create+100get+100set)`                                      |  10.0µs |  97.6µs | 🟢 9.7× faster  |
| `atom(1)`                                                                    |     3ns |    47ns | 🟢 16.1× faster |
| `atomFamily: direct create + delete 500 members`                             | 591.9µs | 586.6µs | 🔴 1.0× slower  |
| `atomFamily: direct set 500 new members`                                     | 410.1µs | 441.2µs | 🟢 1.1× faster  |
| `atomFamily: txn update 5,000 existing members`                              |  1.34ms |  4.90ms | 🟢 3.6× faster  |
| `atomFamily(id)`                                                             |   173ns |   296ns | 🟢 1.7× faster  |
| `atomFamily(id) cache hit`                                                   |    13ns |     7ns | 🔴 2.0× slower  |
| `atomFamily(string) cache hit`                                               |    20ns |    16ns | 🔴 1.3× slower  |
| `create + dispose 1,000 root stores`                                         | 365.8µs |  4.50ms | 🟢 12.3× faster |
| `createStore`                                                                |   224ns |   4.7µs | 🟢 21.0× faster |
| `get 1000 atoms`                                                             |   9.0µs | 155.2µs | 🟢 17.2× faster |
| `selector(fn)`                                                               |     7ns |    48ns | 🟢 6.6× faster  |
| `selectorFamily: lookup 10,000 retained entries`                             | 135.7µs |  59.4µs | 🔴 2.3× slower  |
| `selectorFamily(id)`                                                         |   137ns |   213ns | 🟢 1.6× faster  |
| `selectorFamily(number) cache hit`                                           |     7ns |     5ns | 🔴 1.6× slower  |
| `selectorFamily(string) cache hit`                                           |    22ns |    14ns | 🔴 1.5× slower  |
| `set + read 10 selectors`                                                    |   5.0µs |  11.2µs | 🟢 2.3× faster  |
| `set + read 100 selectorFamily entries`                                      |  41.8µs |  96.3µs | 🟢 2.3× faster  |
| `set + read 100 selectors`                                                   |  40.7µs | 108.6µs | 🟢 2.7× faster  |
| `set + read through 5 chained selectors`                                     |   2.9µs |   5.7µs | 🟢 1.9× faster  |
| `set 1000 atoms`                                                             |  77.9µs | 392.3µs | 🟢 5.0× faster  |
| `set(atom, curr => curr+1)`                                                  |    69ns |   1.3µs | 🟢 19.5× faster |
| `set(atom, value)`                                                           |   100ns |   776ns | 🟢 7.8× faster  |
| `set(atom) with 10 subs`                                                     |   124ns |   1.3µs | 🟢 10.6× faster |
| `store.get(atom)`                                                            |    28ns |   161ns | 🟢 5.8× faster  |
| `sub + unsub`                                                                |   192ns |   871ns | 🟢 4.5× faster  |
| `sub+unsub on chain of 100 unsubscribed derived deps`                        |  63.7µs |  74.9µs | 🟢 1.2× faster  |
| `sub+unsub on chain of 50 unsubscribed derived deps`                         |  36.3µs |  43.6µs | 🟢 1.2× faster  |
| `sub+unsub on chain of 500 unsubscribed derived deps`                        | 271.6µs | 313.3µs | 🟢 1.2× faster  |
| `subscribe + unsubscribe 100 shared selector pairs`                          | 356.4µs | 421.8µs | 🟢 1.2× faster  |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in`                 | 283.6µs | 450.4µs | 🟢 1.6× faster  |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in + mounted spine` | 862.7µs | 489.7µs | 🔴 1.8× slower  |
| `traversal: 20 leaves revisited 5x each`                                     |   4.8µs |  27.2µs | 🟢 5.7× faster  |
| `txn: 10 atoms × 10 selectors, set + read`                                   |  60.9µs | 107.3µs | 🟢 1.8× faster  |
| `txn: 10 atoms × 10 selectors, with subs`                                    |  56.5µs | 153.7µs | 🟢 2.7× faster  |
| `txn: 10 atoms × 100 selectors, set + read`                                  | 558.1µs | 989.2µs | 🟢 1.8× faster  |
| `txn: asymmetric DAG shared sink`                                            |  16.2µs |  41.2µs | 🟢 2.5× faster  |
| `txn: cross-atom 1000 selectors, set + read`                                 | 689.2µs |  1.52ms | 🟢 2.2× faster  |
| `txn: cross-atom 1000 selectors, with subs`                                  | 568.3µs |  7.35ms | 🟢 12.9× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)`                         |  1.52ms |  5.45ms | 🟢 3.6× faster  |

#### Node.js (V8)

| Operation                                                                    | valdres |   Jotai |                 |
| :--------------------------------------------------------------------------- | ------: | ------: | :-------------- |
| `atom lifecycle (create+100get+100set)`                                      |  27.4µs |  92.1µs | 🟢 3.4× faster  |
| `atom(1)`                                                                    |    20ns |    43ns | 🟢 2.1× faster  |
| `atomFamily: direct create + delete 500 members`                             |  3.59ms |  2.08ms | 🔴 1.7× slower  |
| `atomFamily: direct set 500 new members`                                     |  2.63ms |  1.31ms | 🔴 2.0× slower  |
| `atomFamily: txn update 5,000 existing members`                              |  5.86ms | 10.03ms | 🟢 1.7× faster  |
| `atomFamily(id)`                                                             |   139ns |   311ns | 🟢 2.2× faster  |
| `atomFamily(id) cache hit`                                                   |    94ns |    28ns | 🔴 3.4× slower  |
| `atomFamily(string) cache hit`                                               |   118ns |    11ns | 🔴 10.5× slower |
| `create + dispose 1,000 root stores`                                         |  1.27ms | 632.6µs | 🔴 2.0× slower  |
| `createStore`                                                                |   798ns |   621ns | 🔴 1.3× slower  |
| `get 1000 atoms`                                                             |  16.0µs | 117.9µs | 🟢 7.4× faster  |
| `selector(fn)`                                                               |    37ns |    51ns | 🟢 1.4× faster  |
| `selectorFamily: lookup 10,000 retained entries`                             | 159.8µs | 213.8µs | 🟢 1.3× faster  |
| `selectorFamily(id)`                                                         |   1.3µs |   677ns | 🔴 1.9× slower  |
| `selectorFamily(number) cache hit`                                           |    18ns |     7ns | 🔴 2.5× slower  |
| `selectorFamily(string) cache hit`                                           |   122ns |    11ns | 🔴 11.6× slower |
| `set + read 10 selectors`                                                    |   9.0µs |  14.7µs | 🟢 1.6× faster  |
| `set + read 100 selectorFamily entries`                                      |  91.5µs | 114.7µs | 🟢 1.3× faster  |
| `set + read 100 selectors`                                                   |  88.5µs | 106.8µs | 🟢 1.2× faster  |
| `set + read through 5 chained selectors`                                     |   4.9µs |   7.6µs | 🟢 1.6× faster  |
| `set 1000 atoms`                                                             |  85.3µs | 241.5µs | 🟢 2.8× faster  |
| `set(atom, curr => curr+1)`                                                  |   234ns |   948ns | 🟢 4.1× faster  |
| `set(atom, value)`                                                           |   241ns |   793ns | 🟢 3.3× faster  |
| `set(atom) with 10 subs`                                                     |   290ns |   1.3µs | 🟢 4.4× faster  |
| `store.get(atom)`                                                            |    15ns |   120ns | 🟢 7.9× faster  |
| `sub + unsub`                                                                |   650ns |   759ns | 🟢 1.2× faster  |
| `sub+unsub on chain of 100 unsubscribed derived deps`                        | 121.1µs |  82.5µs | 🔴 1.5× slower  |
| `sub+unsub on chain of 50 unsubscribed derived deps`                         |  67.2µs |  67.2µs | 🟢 1.0× faster  |
| `sub+unsub on chain of 500 unsubscribed derived deps`                        | 564.1µs | 396.4µs | 🔴 1.4× slower  |
| `subscribe + unsubscribe 100 shared selector pairs`                          | 635.6µs | 353.1µs | 🔴 1.8× slower  |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in`                 | 605.7µs | 379.9µs | 🔴 1.6× slower  |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in + mounted spine` |  1.15ms | 393.3µs | 🔴 2.9× slower  |
| `traversal: 20 leaves revisited 5x each`                                     |   7.4µs |  22.8µs | 🟢 3.1× faster  |
| `txn: 10 atoms × 10 selectors, set + read`                                   | 121.6µs | 147.4µs | 🟢 1.2× faster  |
| `txn: 10 atoms × 10 selectors, with subs`                                    |  92.4µs | 189.1µs | 🟢 2.0× faster  |
| `txn: 10 atoms × 100 selectors, set + read`                                  |  1.03ms |  1.05ms | 🟢 1.0× faster  |
| `txn: asymmetric DAG shared sink`                                            |  19.7µs |  43.2µs | 🟢 2.2× faster  |
| `txn: cross-atom 1000 selectors, set + read`                                 |  1.29ms |  1.51ms | 🟢 1.2× faster  |
| `txn: cross-atom 1000 selectors, with subs`                                  | 778.1µs |  6.72ms | 🟢 8.6× faster  |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)`                         |  2.50ms |  4.94ms | 🟢 2.0× faster  |

<!-- BENCH:END -->
