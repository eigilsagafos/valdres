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
| `atom lifecycle (create+100get+100set)` | 14.2µs | 137.9µs | 🟢 9.7× faster |
| `atom(1)` | 2ns | 49ns | 🟢 22.2× faster |
| `atomFamily: direct create + delete 500 members` | 1.05ms | 858.8µs | 🔴 1.2× slower |
| `atomFamily: direct set 500 new members` | 612.9µs | 674.4µs | 🟢 1.1× faster |
| `atomFamily: txn update 5,000 existing members` | 2.02ms | 7.36ms | 🟢 3.6× faster |
| `atomFamily(id)` | 214ns | 334ns | 🟢 1.6× faster |
| `atomFamily(id) cache hit` | 16ns | 10ns | 🔴 1.7× slower |
| `atomFamily(string) cache hit` | 28ns | 22ns | 🔴 1.3× slower |
| `create + dispose 1,000 root stores` | 560.2µs | 4.28ms | 🟢 7.6× faster |
| `createStore` | 296ns | 4.4µs | 🟢 14.8× faster |
| `get 1000 atoms` | 12.6µs | 268.9µs | 🟢 21.3× faster |
| `selector(fn)` | 6ns | 54ns | 🟢 8.3× faster |
| `selectorFamily: lookup 10,000 retained entries` | 195.7µs | 91.8µs | 🔴 2.1× slower |
| `selectorFamily(id)` | 181ns | 201ns | 🟢 1.1× faster |
| `selectorFamily(number) cache hit` | 9ns | 7ns | 🔴 1.4× slower |
| `selectorFamily(string) cache hit` | 28ns | 17ns | 🔴 1.6× slower |
| `set + read 10 selectors` | 6.9µs | 16.5µs | 🟢 2.4× faster |
| `set + read 100 selectorFamily entries` | 67.8µs | 143.3µs | 🟢 2.1× faster |
| `set + read 100 selectors` | 59.1µs | 165.6µs | 🟢 2.8× faster |
| `set + read through 5 chained selectors` | 4.1µs | 8.5µs | 🟢 2.1× faster |
| `set 1000 atoms` | 107.1µs | 609.5µs | 🟢 5.7× faster |
| `set(atom, curr => curr+1)` | 85ns | 2.0µs | 🟢 23.5× faster |
| `set(atom, value)` | 130ns | 1.2µs | 🟢 8.9× faster |
| `set(atom) with 10 subs` | 181ns | 1.9µs | 🟢 10.7× faster |
| `store.get(atom)` | 40ns | 231ns | 🟢 5.8× faster |
| `sub + unsub` | 353ns | 1.5µs | 🟢 4.2× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 95.9µs | 117.0µs | 🟢 1.2× faster |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 49.6µs | 60.4µs | 🟢 1.2× faster |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 418.6µs | 484.0µs | 🟢 1.2× faster |
| `subscribe + unsubscribe 100 shared selector pairs` | 681.1µs | 667.1µs | 🔴 1.0× slower |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in` | 421.1µs | 669.9µs | 🟢 1.6× faster |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in + mounted spine` | 1.26ms | 739.4µs | 🔴 1.7× slower |
| `traversal: 20 leaves revisited 5x each` | 5.9µs | 44.8µs | 🟢 7.5× faster |
| `txn: 10 atoms × 10 selectors, set + read` | 101.6µs | 179.8µs | 🟢 1.8× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 89.3µs | 265.9µs | 🟢 3.0× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 1.46ms | 1.46ms | 🟢 1.0× faster |
| `txn: asymmetric DAG shared sink` | 31.1µs | 64.3µs | 🟢 2.1× faster |
| `txn: cross-atom 1000 selectors, set + read` | 1.22ms | 2.50ms | 🟢 2.1× faster |
| `txn: cross-atom 1000 selectors, with subs` | 929.6µs | 11.57ms | 🟢 12.5× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 2.31ms | 7.98ms | 🟢 3.4× faster |

#### Node.js (V8)

| Operation | valdres | Jotai | |
|:----------|--------:|------:|:--|
| `atom lifecycle (create+100get+100set)` | 38.0µs | 103.7µs | 🟢 2.7× faster |
| `atom(1)` | 24ns | 50ns | 🟢 2.1× faster |
| `atomFamily: direct create + delete 500 members` | 4.94ms | 791.7µs | 🔴 6.2× slower |
| `atomFamily: direct set 500 new members` | 3.17ms | 717.8µs | 🔴 4.4× slower |
| `atomFamily: txn update 5,000 existing members` | 4.91ms | 6.98ms | 🟢 1.4× faster |
| `atomFamily(id)` | 271ns | 362ns | 🟢 1.3× faster |
| `atomFamily(id) cache hit` | 141ns | 27ns | 🔴 5.3× slower |
| `atomFamily(string) cache hit` | 145ns | 15ns | 🔴 9.7× slower |
| `create + dispose 1,000 root stores` | 1.51ms | 642.4µs | 🔴 2.3× slower |
| `createStore` | 815ns | 869ns | 🟢 1.1× faster |
| `get 1000 atoms` | 22.2µs | 154.7µs | 🟢 7.0× faster |
| `selector(fn)` | 42ns | 73ns | 🟢 1.7× faster |
| `selectorFamily: lookup 10,000 retained entries` | 166.2µs | 226.3µs | 🟢 1.4× faster |
| `selectorFamily(id)` | 1.7µs | 393ns | 🔴 4.4× slower |
| `selectorFamily(number) cache hit` | 137ns | 27ns | 🔴 5.1× slower |
| `selectorFamily(string) cache hit` | 31ns | 10ns | 🔴 3.0× slower |
| `set + read 10 selectors` | 12.8µs | 18.3µs | 🟢 1.4× faster |
| `set + read 100 selectorFamily entries` | 128.0µs | 126.6µs | 🔴 1.0× slower |
| `set + read 100 selectors` | 125.5µs | 139.6µs | 🟢 1.1× faster |
| `set + read through 5 chained selectors` | 7.0µs | 9.1µs | 🟢 1.3× faster |
| `set 1000 atoms` | 120.6µs | 333.3µs | 🟢 2.8× faster |
| `set(atom, curr => curr+1)` | 326ns | 1.1µs | 🟢 3.4× faster |
| `set(atom, value)` | 331ns | 921ns | 🟢 2.8× faster |
| `set(atom) with 10 subs` | 432ns | 1.4µs | 🟢 3.2× faster |
| `store.get(atom)` | 21ns | 115ns | 🟢 5.5× faster |
| `sub + unsub` | 974ns | 984ns | 🟢 1.0× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 173.3µs | 100.7µs | 🔴 1.7× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 136.1µs | 56.9µs | 🔴 2.4× slower |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 846.6µs | 595.3µs | 🔴 1.4× slower |
| `subscribe + unsubscribe 100 shared selector pairs` | 803.3µs | 450.1µs | 🔴 1.8× slower |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in` | 779.7µs | 483.7µs | 🔴 1.6× slower |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in + mounted spine` | 1.47ms | 493.7µs | 🔴 3.0× slower |
| `traversal: 20 leaves revisited 5x each` | 8.2µs | 25.9µs | 🟢 3.2× faster |
| `txn: 10 atoms × 10 selectors, set + read` | 144.3µs | 155.6µs | 🟢 1.1× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 95.6µs | 232.4µs | 🟢 2.4× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 1.39ms | 1.43ms | 🟢 1.0× faster |
| `txn: asymmetric DAG shared sink` | 28.9µs | 52.4µs | 🟢 1.8× faster |
| `txn: cross-atom 1000 selectors, set + read` | 1.70ms | 1.93ms | 🟢 1.1× faster |
| `txn: cross-atom 1000 selectors, with subs` | 1.03ms | 9.56ms | 🟢 9.3× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.22ms | 6.61ms | 🟢 2.1× faster |

<!-- BENCH:END -->
