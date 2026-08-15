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

The repo is currently in `beta` prerelease mode (`bunx changeset pre exit` to graduate to stable).

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
| `atom lifecycle (create+100get+100set)` | 11.0µs | 143.8µs | 🟢 13.1× faster |
| `atom(1)` | 3ns | 55ns | 🟢 18.3× faster |
| `atomFamily: direct create + delete 500 members` | 1.11ms | 884.3µs | 🔴 1.3× slower |
| `atomFamily: direct set 500 new members` | 794.5µs | 613.2µs | 🔴 1.3× slower |
| `atomFamily: txn update 5,000 existing members` | 2.31ms | 6.76ms | 🟢 2.9× faster |
| `atomFamily(id)` | 200ns | 316ns | 🟢 1.6× faster |
| `atomFamily(id) cache hit` | 13ns | 7ns | 🔴 1.8× slower |
| `atomFamily(string) cache hit` | 23ns | 19ns | 🔴 1.2× slower |
| `create + dispose 1,000 root stores` | 500.6µs | 5.29ms | 🟢 10.6× faster |
| `createStore` | 276ns | 5.7µs | 🟢 20.7× faster |
| `get 1000 atoms` | 9.5µs | 232.7µs | 🟢 24.6× faster |
| `selector(fn)` | 7ns | 56ns | 🟢 7.7× faster |
| `selectorFamily: lookup 10,000 retained entries` | 541.1µs | 73.8µs | 🔴 7.3× slower |
| `selectorFamily(id)` | 220ns | 294ns | 🟢 1.3× faster |
| `selectorFamily(number) cache hit` | 33ns | 5ns | 🔴 6.6× slower |
| `selectorFamily(string) cache hit` | 56ns | 17ns | 🔴 3.3× slower |
| `set + read 10 selectors` | 5.8µs | 21.2µs | 🟢 3.7× faster |
| `set + read 100 selectorFamily entries` | 59.1µs | 202.3µs | 🟢 3.4× faster |
| `set + read 100 selectors` | 49.9µs | 205.0µs | 🟢 4.1× faster |
| `set + read through 5 chained selectors` | 3.8µs | 8.6µs | 🟢 2.3× faster |
| `set 1000 atoms` | 78.9µs | 544.1µs | 🟢 6.9× faster |
| `set(atom, curr => curr+1)` | 95ns | 1.9µs | 🟢 19.8× faster |
| `set(atom, value)` | 111ns | 1.1µs | 🟢 9.9× faster |
| `set(atom) with 10 subs` | 144ns | 1.7µs | 🟢 11.8× faster |
| `store.get(atom)` | 28ns | 204ns | 🟢 7.3× faster |
| `sub + unsub` | 305ns | 1.1µs | 🟢 3.7× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 87.0µs | 115.6µs | 🟢 1.3× faster |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 46.9µs | 66.6µs | 🟢 1.4× faster |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 390.0µs | 535.6µs | 🟢 1.4× faster |
| `subscribe + unsubscribe 100 shared selector pairs` | 552.0µs | 540.3µs | 🔴 1.0× slower |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in` | 484.5µs | 580.9µs | 🟢 1.2× faster |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in + mounted spine` | 1.11ms | 654.0µs | 🔴 1.7× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 75.0µs | 147.8µs | 🟢 2.0× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 74.7µs | 330.8µs | 🟢 4.4× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 718.0µs | 1.40ms | 🟢 1.9× faster |
| `txn: asymmetric DAG shared sink` | 23.3µs | 62.2µs | 🟢 2.7× faster |
| `txn: cross-atom 1000 selectors, set + read` | 919.6µs | 2.06ms | 🟢 2.2× faster |
| `txn: cross-atom 1000 selectors, with subs` | 913.2µs | 10.67ms | 🟢 11.7× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 2.73ms | 9.41ms | 🟢 3.4× faster |

#### Node.js (V8)

| Operation | valdres | Jotai | |
|:----------|--------:|------:|:--|
| `atom lifecycle (create+100get+100set)` | 27.2µs | 84.3µs | 🟢 3.1× faster |
| `atom(1)` | 20ns | 45ns | 🟢 2.3× faster |
| `atomFamily: direct create + delete 500 members` | 2.38ms | 1.05ms | 🔴 2.3× slower |
| `atomFamily: direct set 500 new members` | 2.31ms | 1.32ms | 🔴 1.7× slower |
| `atomFamily: txn update 5,000 existing members` | 3.23ms | 4.56ms | 🟢 1.4× faster |
| `atomFamily(id)` | 165ns | 222ns | 🟢 1.3× faster |
| `atomFamily(id) cache hit` | 61ns | 18ns | 🔴 3.4× slower |
| `atomFamily(string) cache hit` | 105ns | 18ns | 🔴 5.8× slower |
| `create + dispose 1,000 root stores` | 1.22ms | 950.2µs | 🔴 1.3× slower |
| `createStore` | 754ns | 859ns | 🟢 1.1× faster |
| `get 1000 atoms` | 16.1µs | 113.9µs | 🟢 7.1× faster |
| `selector(fn)` | 35ns | 53ns | 🟢 1.5× faster |
| `selectorFamily: lookup 10,000 retained entries` | 998.0µs | 318.4µs | 🔴 3.1× slower |
| `selectorFamily(id)` | 1.3µs | 388ns | 🔴 3.2× slower |
| `selectorFamily(number) cache hit` | 121ns | 10ns | 🔴 12.5× slower |
| `selectorFamily(string) cache hit` | 87ns | 8ns | 🔴 11.1× slower |
| `set + read 10 selectors` | 8.3µs | 14.8µs | 🟢 1.8× faster |
| `set + read 100 selectorFamily entries` | 84.2µs | 120.8µs | 🟢 1.4× faster |
| `set + read 100 selectors` | 81.2µs | 113.8µs | 🟢 1.4× faster |
| `set + read through 5 chained selectors` | 4.5µs | 7.9µs | 🟢 1.8× faster |
| `set 1000 atoms` | 86.4µs | 247.3µs | 🟢 2.9× faster |
| `set(atom, curr => curr+1)` | 239ns | 929ns | 🟢 3.9× faster |
| `set(atom, value)` | 241ns | 755ns | 🟢 3.1× faster |
| `set(atom) with 10 subs` | 298ns | 1.3µs | 🟢 4.4× faster |
| `store.get(atom)` | 18ns | 102ns | 🟢 5.8× faster |
| `sub + unsub` | 654ns | 784ns | 🟢 1.2× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 127.4µs | 90.7µs | 🔴 1.4× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 71.0µs | 75.0µs | 🟢 1.1× faster |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 589.0µs | 454.8µs | 🔴 1.3× slower |
| `subscribe + unsubscribe 100 shared selector pairs` | 787.2µs | 363.9µs | 🔴 2.2× slower |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in` | 734.0µs | 386.5µs | 🔴 1.9× slower |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in + mounted spine` | 1.37ms | 400.7µs | 🔴 3.4× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 112.2µs | 148.3µs | 🟢 1.3× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 93.8µs | 201.3µs | 🟢 2.1× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 919.8µs | 1.26ms | 🟢 1.4× faster |
| `txn: asymmetric DAG shared sink` | 20.6µs | 51.2µs | 🟢 2.5× faster |
| `txn: cross-atom 1000 selectors, set + read` | 1.20ms | 1.63ms | 🟢 1.4× faster |
| `txn: cross-atom 1000 selectors, with subs` | 808.4µs | 7.04ms | 🟢 8.7× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 2.55ms | 5.27ms | 🟢 2.1× faster |

<!-- BENCH:END -->
