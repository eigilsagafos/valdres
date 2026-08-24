# Valdres

Reactive state management for **React, Vue, Svelte, Solid, and Angular** — one store, shared across frameworks. Inspired by Recoil and Jotai. The framework-agnostic core also runs in plain JavaScript, Node, and workers.

**Docs: [valdres.dev](https://valdres.dev)** · AI-readable: [llms.txt](https://valdres.dev/llms.txt) (every page is also available as markdown — append `.md` to any URL)

```bash
npm install valdres valdres-react   # or valdres-vue / -svelte / -solid / -angular
```

```tsx
import { atom, selector } from "valdres"
import { Provider, useAtom, useValue } from "valdres-react"

const countAtom = atom(0)
const doubledSelector = selector(get => get(countAtom) * 2)

function Counter() {
    const [count, setCount] = useAtom(countAtom)
    const doubled = useValue(doubledSelector)
    return <button onClick={() => setCount(c => c + 1)}>{count} ×2 = {doubled}</button>
}

const App = () => (
    <Provider>
        <Counter />
    </Provider>
)
```

Atoms and selectors are identified by reference (no string keys), families are first-class, transactions batch updates, and scoped stores fork state for edit-and-cancel flows. The same atoms work in every framework — and in the [plugin packages](#plugins-framework-agnostic) that wrap browser APIs (geolocation, keyboard, visibility, …) as reactive state.

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
bun test            # all packages
bun run docs:dev    # docs site at localhost:4321
```

## Releasing

Versioning and publishing is handled by [Changesets](https://github.com/changesets/changesets). Each package versions independently.

The 1.0 release is governed by the hard gates and RC burn-in checklist in [RELEASING.md](./RELEASING.md).

**When you open a PR that changes a publishable package:**

```bash
bunx changeset
```

Pick the affected packages, the bump type (patch/minor/major), and write a short summary. Commit the generated `.changeset/*.md` file with your PR.

For PRs that touch publishable code but intentionally don't trigger a release (refactors, internal cleanup, docs):

```bash
bunx changeset --empty
```

This still generates a `.changeset/*.md` file — commit it like a regular changeset. The `Require changeset` check on each PR enforces that any change to a publishable package ships with a changeset (empty or otherwise).

When the PR merges to `main`, the `Publish` workflow opens (or updates) a **Version Packages** PR that applies the pending changesets, bumps versions, and updates CHANGELOGs. Merging that PR publishes the affected packages to npm.

To preview what publishing would do locally:

```bash
bun run verify-publish
```

The repo is currently in `beta` prerelease mode (`bunx changeset pre exit` to graduate to stable). While in prerelease mode, changesets that have already been versioned into a `beta` release move to `.changeset/pre/`, where they stay until the stable release consumes them — leave them alone unless a change genuinely no longer applies.

## Benchmarks

### Performance

valdres is benchmarked against [Jotai](https://github.com/pmndrs/jotai) (and a raw `Map` floor) on every PR via [Bencher](https://bencher.dev) — live, always-current latency per operation under both Bun (JavaScriptCore) and Node.js (V8):

**→ [bencher.dev/perf/valdres](https://bencher.dev/perf/valdres)**

[![store.get(atom) latency — valdres vs Jotai vs raw Map (Bun + Node)](https://api.bencher.dev/v0/projects/valdres/perf/img?branches=ca02205d-e4c5-4f8e-a227-9790cc6d7f7d&testbeds=6ed7a83d-343c-43c1-b270-225a1688718e%2C0c5502c7-6901-4334-a06c-110e7468d6bb&benchmarks=cc14bb7a-a64d-4e0c-a277-abde4e2f8449%2C7406c2e2-a4cc-4327-935a-2f7fbc9c41b7%2C741adc2f-32e7-47d6-9759-42cf16fc5c8a&measures=34bb7b72-22ec-45bd-bb99-0768d0e0319e&title=store.get%28atom%29+latency%3A+valdres+vs+jotai+vs+map)](https://bencher.dev/perf/valdres?branches=ca02205d-e4c5-4f8e-a227-9790cc6d7f7d&testbeds=6ed7a83d-343c-43c1-b270-225a1688718e%2C0c5502c7-6901-4334-a06c-110e7468d6bb&benchmarks=cc14bb7a-a64d-4e0c-a277-abde4e2f8449%2C7406c2e2-a4cc-4327-935a-2f7fbc9c41b7%2C741adc2f-32e7-47d6-9759-42cf16fc5c8a&measures=34bb7b72-22ec-45bd-bb99-0768d0e0319e&tab=plots&x_axis=date_time)

<sub>Live plot — `store.get(atom)` latency, valdres vs Jotai vs a raw `Map` floor, on both runtimes. Auto-updates from `main`; click through to filter/zoom. (Sparse until `main` accumulates a few runs.)</sub>

Every PR from the repo gets a comment flagging any latency regression vs `main` (fork PRs are skipped — they can't read the upload key).

<!-- BENCH:START -->
### Performance vs Jotai

Latest `main` latency per operation (live, always-current numbers: [bencher.dev/perf/valdres](https://bencher.dev/perf/valdres)). Auto-generated from Bencher — do not hand-edit.

#### Bun (JavaScriptCore)

| Operation | valdres | Jotai | |
|:----------|--------:|------:|:--|
| `atom lifecycle (create+100get+100set)` | 8.7µs | 77.8µs | 🟢 8.9× faster |
| `atom(1)` | 2ns | 37ns | 🟢 17.3× faster |
| `atomFamily: direct create + delete 500 members` | 448.5µs | 491.3µs | 🟢 1.1× faster |
| `atomFamily: direct set 500 new members` | 289.2µs | 370.3µs | 🟢 1.3× faster |
| `atomFamily: txn update 5,000 existing members` | 1.21ms | 3.83ms | 🟢 3.2× faster |
| `atomFamily(id)` | 166ns | 273ns | 🟢 1.6× faster |
| `atomFamily(id) cache hit` | 10ns | 6ns | 🔴 1.7× slower |
| `atomFamily(string) cache hit` | 17ns | 14ns | 🔴 1.2× slower |
| `create + dispose 1,000 root stores` | 358.3µs | 3.89ms | 🟢 10.9× faster |
| `createStore` | 184ns | 4.0µs | 🟢 22.0× faster |
| `get 1000 atoms` | 8.1µs | 130.8µs | 🟢 16.2× faster |
| `selector(fn)` | 5ns | 38ns | 🟢 7.2× faster |
| `selectorFamily: lookup 10,000 retained entries` | 248.9µs | 56.8µs | 🔴 4.4× slower |
| `selectorFamily(id)` | 178ns | 240ns | 🟢 1.3× faster |
| `selectorFamily(number) cache hit` | 38ns | 4ns | 🔴 9.9× slower |
| `selectorFamily(string) cache hit` | 29ns | 12ns | 🔴 2.5× slower |
| `set + read 10 selectors` | 3.8µs | 9.4µs | 🟢 2.5× faster |
| `set + read 100 selectorFamily entries` | 33.4µs | 81.0µs | 🟢 2.4× faster |
| `set + read 100 selectors` | 32.4µs | 88.4µs | 🟢 2.7× faster |
| `set + read through 5 chained selectors` | 2.3µs | 5.0µs | 🟢 2.2× faster |
| `set 1000 atoms` | 66.1µs | 331.9µs | 🟢 5.0× faster |
| `set(atom, curr => curr+1)` | 62ns | 1.0µs | 🟢 16.5× faster |
| `set(atom, value)` | 80ns | 606ns | 🟢 7.6× faster |
| `set(atom) with 10 subs` | 119ns | 1.0µs | 🟢 8.7× faster |
| `store.get(atom)` | 24ns | 138ns | 🟢 5.8× faster |
| `sub + unsub` | 169ns | 696ns | 🟢 4.1× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 49.5µs | 60.7µs | 🟢 1.2× faster |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 27.0µs | 35.8µs | 🟢 1.3× faster |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 205.3µs | 271.3µs | 🟢 1.3× faster |
| `subscribe + unsubscribe 100 shared selector pairs` | 391.2µs | 359.0µs | 🔴 1.1× slower |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in` | 328.6µs | 396.3µs | 🟢 1.2× faster |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in + mounted spine` | 858.9µs | 425.4µs | 🔴 2.0× slower |
| `traversal: 20 leaves revisited 5x each` | 5.4µs | 22.5µs | 🟢 4.1× faster |
| `txn: 10 atoms × 10 selectors, set + read` | 43.8µs | 87.5µs | 🟢 2.0× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 43.6µs | 130.3µs | 🟢 3.0× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 431.6µs | 820.9µs | 🟢 1.9× faster |
| `txn: asymmetric DAG shared sink` | 13.4µs | 34.2µs | 🟢 2.6× faster |
| `txn: cross-atom 1000 selectors, set + read` | 514.1µs | 1.27ms | 🟢 2.5× faster |
| `txn: cross-atom 1000 selectors, with subs` | 514.9µs | 6.10ms | 🟢 11.8× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 1.55ms | 4.67ms | 🟢 3.0× faster |

#### Node.js (V8)

| Operation | valdres | Jotai | |
|:----------|--------:|------:|:--|
| `atom lifecycle (create+100get+100set)` | 24.7µs | 74.0µs | 🟢 3.0× faster |
| `atom(1)` | 20ns | 44ns | 🟢 2.2× faster |
| `atomFamily: direct create + delete 500 members` | 3.53ms | 1.40ms | 🔴 2.5× slower |
| `atomFamily: direct set 500 new members` | 1.76ms | 1.00ms | 🔴 1.8× slower |
| `atomFamily: txn update 5,000 existing members` | 2.96ms | 3.80ms | 🟢 1.3× faster |
| `atomFamily(id)` | 157ns | 219ns | 🟢 1.4× faster |
| `atomFamily(id) cache hit` | 85ns | 14ns | 🔴 6.0× slower |
| `atomFamily(string) cache hit` | 46ns | 9ns | 🔴 5.0× slower |
| `create + dispose 1,000 root stores` | 1.21ms | 830.0µs | 🔴 1.5× slower |
| `createStore` | 742ns | 807ns | 🟢 1.1× faster |
| `get 1000 atoms` | 14.1µs | 93.3µs | 🟢 6.6× faster |
| `selector(fn)` | 25ns | 50ns | 🟢 2.0× faster |
| `selectorFamily: lookup 10,000 retained entries` | 783.5µs | 155.6µs | 🔴 5.0× slower |
| `selectorFamily(id)` | 907ns | 495ns | 🔴 1.8× slower |
| `selectorFamily(number) cache hit` | 46ns | 8ns | 🔴 5.5× slower |
| `selectorFamily(string) cache hit` | 70ns | 9ns | 🔴 7.7× slower |
| `set + read 10 selectors` | 7.3µs | 12.0µs | 🟢 1.6× faster |
| `set + read 100 selectorFamily entries` | 67.9µs | 80.3µs | 🟢 1.2× faster |
| `set + read 100 selectors` | 65.0µs | 71.2µs | 🟢 1.1× faster |
| `set + read through 5 chained selectors` | 4.4µs | 6.8µs | 🟢 1.5× faster |
| `set 1000 atoms` | 76.8µs | 196.7µs | 🟢 2.6× faster |
| `set(atom, curr => curr+1)` | 196ns | 735ns | 🟢 3.7× faster |
| `set(atom, value)` | 195ns | 601ns | 🟢 3.1× faster |
| `set(atom) with 10 subs` | 241ns | 1.0µs | 🟢 4.2× faster |
| `store.get(atom)` | 12ns | 94ns | 🟢 7.9× faster |
| `sub + unsub` | 603ns | 706ns | 🟢 1.2× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 100.8µs | 67.7µs | 🔴 1.5× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 56.8µs | 61.8µs | 🟢 1.1× faster |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 469.4µs | 348.2µs | 🔴 1.3× slower |
| `subscribe + unsubscribe 100 shared selector pairs` | 633.0µs | 302.9µs | 🔴 2.1× slower |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in` | 621.4µs | 330.0µs | 🔴 1.9× slower |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in + mounted spine` | 1.12ms | 338.6µs | 🔴 3.3× slower |
| `traversal: 20 leaves revisited 5x each` | 7.2µs | 21.5µs | 🟢 3.0× faster |
| `txn: 10 atoms × 10 selectors, set + read` | 85.1µs | 84.3µs | 🔴 1.0× slower |
| `txn: 10 atoms × 10 selectors, with subs` | 61.4µs | 140.7µs | 🟢 2.3× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 720.4µs | 724.5µs | 🟢 1.0× faster |
| `txn: asymmetric DAG shared sink` | 16.1µs | 39.7µs | 🟢 2.5× faster |
| `txn: cross-atom 1000 selectors, set + read` | 945.8µs | 1.01ms | 🟢 1.1× faster |
| `txn: cross-atom 1000 selectors, with subs` | 642.8µs | 5.49ms | 🟢 8.5× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 2.07ms | 4.07ms | 🟢 2.0× faster |

<!-- BENCH:END -->
