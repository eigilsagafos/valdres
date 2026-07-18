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
| `atom lifecycle (create+100get+100set)` | 13.0µs | 267.3µs | 🟢 20.6× faster |
| `atom(1)` | 3ns | 53ns | 🟢 20.9× faster |
| `atomFamily(id)` | 187ns | 377ns | 🟢 2.0× faster |
| `atomFamily(id) cache hit` | 10ns | 11ns | 🟢 1.1× faster |
| `createStore` | 390ns | 5.6µs | 🟢 14.3× faster |
| `get 1000 atoms` | 9.6µs | 411.4µs | 🟢 42.9× faster |
| `selector(fn)` | 4ns | 60ns | 🟢 13.7× faster |
| `selectorFamily(id)` | 133ns | 179ns | 🟢 1.3× faster |
| `set + read 10 selectors` | 13.8µs | 41.2µs | 🟢 3.0× faster |
| `set + read 100 selectorFamily entries` | 105.5µs | 273.9µs | 🟢 2.6× faster |
| `set + read 100 selectors` | 96.9µs | 360.9µs | 🟢 3.7× faster |
| `set + read through 5 chained selectors` | 7.7µs | 17.5µs | 🟢 2.3× faster |
| `set 1000 atoms` | 125.3µs | 1.02ms | 🟢 8.2× faster |
| `set(atom, curr => curr+1)` | 213ns | 3.1µs | 🟢 14.4× faster |
| `set(atom, value)` | 115ns | 5.4µs | 🟢 46.5× faster |
| `set(atom) with 10 subs` | 212ns | 3.9µs | 🟢 18.4× faster |
| `store.get(atom)` | 31ns | 371ns | 🟢 12.0× faster |
| `sub + unsub` | 756ns | 3.2µs | 🟢 4.2× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 127.5µs | 137.5µs | 🟢 1.1× faster |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 98.6µs | 100.3µs | 🟢 1.0× faster |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 582.9µs | 645.8µs | 🟢 1.1× faster |
| `subscribe + unsubscribe 100 shared selector pairs` | 748.9µs | 1.13ms | 🟢 1.5× faster |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in` | 688.9µs | 1.12ms | 🟢 1.6× faster |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in + mounted spine` | 1.61ms | 1.38ms | 🔴 1.2× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 110.7µs | 295.8µs | 🟢 2.7× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 112.8µs | 672.9µs | 🟢 6.0× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 971.8µs | 4.05ms | 🟢 4.2× faster |
| `txn: asymmetric DAG shared sink` | 33.9µs | 156.6µs | 🟢 4.6× faster |
| `txn: cross-atom 1000 selectors, set + read` | 1.19ms | 5.32ms | 🟢 4.5× faster |
| `txn: cross-atom 1000 selectors, with subs` | 1.35ms | 22.04ms | 🟢 16.3× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 5.64ms | 19.85ms | 🟢 3.5× faster |

#### Node.js (V8)

| Operation | valdres | Jotai | |
|:----------|--------:|------:|:--|
| `atom lifecycle (create+100get+100set)` | 33.8µs | 146.3µs | 🟢 4.3× faster |
| `atom(1)` | 25ns | 49ns | 🟢 2.0× faster |
| `atomFamily(id)` | 103ns | 240ns | 🟢 2.3× faster |
| `atomFamily(id) cache hit` | 4ns | 26ns | 🟢 6.0× faster |
| `createStore` | 290ns | 1.6µs | 🟢 5.5× faster |
| `get 1000 atoms` | 15.1µs | 210.4µs | 🟢 13.9× faster |
| `selector(fn)` | 43ns | 63ns | 🟢 1.5× faster |
| `selectorFamily(id)` | 156ns | 192ns | 🟢 1.2× faster |
| `set + read 10 selectors` | 9.3µs | 19.3µs | 🟢 2.1× faster |
| `set + read 100 selectorFamily entries` | 93.9µs | 130.5µs | 🟢 1.4× faster |
| `set + read 100 selectors` | 90.0µs | 131.9µs | 🟢 1.5× faster |
| `set + read through 5 chained selectors` | 5.4µs | 10.0µs | 🟢 1.8× faster |
| `set 1000 atoms` | 105.4µs | 463.0µs | 🟢 4.4× faster |
| `set(atom, curr => curr+1)` | 300ns | 1.5µs | 🟢 5.0× faster |
| `set(atom, value)` | 284ns | 1.3µs | 🟢 4.5× faster |
| `set(atom) with 10 subs` | 375ns | 1.8µs | 🟢 4.7× faster |
| `store.get(atom)` | 19ns | 160ns | 🟢 8.5× faster |
| `sub + unsub` | 824ns | 2.1µs | 🟢 2.5× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 126.6µs | 107.8µs | 🔴 1.2× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 100.8µs | 56.6µs | 🔴 1.8× slower |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 578.3µs | 528.7µs | 🔴 1.1× slower |
| `subscribe + unsubscribe 100 shared selector pairs` | 889.5µs | 583.4µs | 🔴 1.5× slower |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in` | 798.7µs | 597.3µs | 🔴 1.3× slower |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in + mounted spine` | 1.47ms | 613.7µs | 🔴 2.4× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 151.9µs | 176.1µs | 🟢 1.2× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 103.3µs | 256.0µs | 🟢 2.5× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 1.04ms | 1.37ms | 🟢 1.3× faster |
| `txn: asymmetric DAG shared sink` | 28.5µs | 55.4µs | 🟢 1.9× faster |
| `txn: cross-atom 1000 selectors, set + read` | 1.27ms | 1.97ms | 🟢 1.5× faster |
| `txn: cross-atom 1000 selectors, with subs` | 1.20ms | 12.41ms | 🟢 10.4× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 4.89ms | 9.43ms | 🟢 1.9× faster |

<!-- BENCH:END -->
