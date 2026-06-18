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
| `atom lifecycle (create+100get+100set)` | 12.4µs | 260.6µs | 🟢 21.1× faster |
| `atom(1)` | 2ns | 56ns | 🟢 22.9× faster |
| `atomFamily(id)` | 108ns | 379ns | 🟢 3.5× faster |
| `atomFamily(id) cache hit` | 10ns | 11ns | 🟢 1.1× faster |
| `createStore` | 285ns | 5.7µs | 🟢 20.1× faster |
| `get 1000 atoms` | 10.7µs | 398.9µs | 🟢 37.2× faster |
| `selector(fn)` | 5ns | 60ns | 🟢 12.9× faster |
| `selectorFamily(id)` | 264ns | 301ns | 🟢 1.1× faster |
| `set + read 10 selectors` | 9.3µs | 45.8µs | 🟢 4.9× faster |
| `set + read 100 selectorFamily entries` | 78.9µs | 359.6µs | 🟢 4.6× faster |
| `set + read 100 selectors` | 68.9µs | 358.8µs | 🟢 5.2× faster |
| `set + read through 5 chained selectors` | 8.8µs | 19.8µs | 🟢 2.3× faster |
| `set 1000 atoms` | 111.0µs | 1.42ms | 🟢 12.8× faster |
| `set(atom, curr => curr+1)` | 146ns | 3.2µs | 🟢 21.8× faster |
| `set(atom, value)` | 123ns | 5.2µs | 🟢 42.1× faster |
| `set(atom) with 10 subs` | 208ns | 3.9µs | 🟢 18.6× faster |
| `store.get(atom)` | 31ns | 371ns | 🟢 12.0× faster |
| `sub + unsub` | 783ns | 4.2µs | 🟢 5.3× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 132.5µs | 142.0µs | 🟢 1.1× faster |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 77.7µs | 74.9µs | 🔴 1.0× slower |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 582.9µs | 644.1µs | 🟢 1.1× faster |
| `txn: 10 atoms × 10 selectors, set + read` | 82.2µs | 292.8µs | 🟢 3.6× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 95.2µs | 587.5µs | 🟢 6.2× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 796.3µs | 3.65ms | 🟢 4.6× faster |
| `txn: asymmetric DAG shared sink` | 26.9µs | 157.0µs | 🟢 5.8× faster |
| `txn: cross-atom 1000 selectors, set + read` | 941.5µs | 5.41ms | 🟢 5.7× faster |
| `txn: cross-atom 1000 selectors, with subs` | 1.13ms | 24.75ms | 🟢 21.8× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 4.64ms | 21.20ms | 🟢 4.6× faster |

#### Node.js (V8)

| Operation | valdres | Jotai | |
|:----------|--------:|------:|:--|
| `atom lifecycle (create+100get+100set)` | 32.8µs | 140.6µs | 🟢 4.3× faster |
| `atom(1)` | 25ns | 51ns | 🟢 2.1× faster |
| `atomFamily(id)` | 118ns | 243ns | 🟢 2.1× faster |
| `atomFamily(id) cache hit` | 4ns | 26ns | 🟢 5.9× faster |
| `createStore` | 198ns | 1.7µs | 🟢 8.7× faster |
| `get 1000 atoms` | 15.0µs | 207.1µs | 🟢 13.8× faster |
| `selector(fn)` | 41ns | 57ns | 🟢 1.4× faster |
| `selectorFamily(id)` | 209ns | 199ns | 🔴 1.0× slower |
| `set + read 10 selectors` | 7.7µs | 19.4µs | 🟢 2.5× faster |
| `set + read 100 selectorFamily entries` | 76.3µs | 129.2µs | 🟢 1.7× faster |
| `set + read 100 selectors` | 74.9µs | 129.3µs | 🟢 1.7× faster |
| `set + read through 5 chained selectors` | 4.8µs | 9.9µs | 🟢 2.1× faster |
| `set 1000 atoms` | 106.5µs | 455.0µs | 🟢 4.3× faster |
| `set(atom, curr => curr+1)` | 300ns | 1.5µs | 🟢 5.0× faster |
| `set(atom, value)` | 299ns | 1.2µs | 🟢 4.1× faster |
| `set(atom) with 10 subs` | 375ns | 1.7µs | 🟢 4.6× faster |
| `store.get(atom)` | 19ns | 162ns | 🟢 8.6× faster |
| `sub + unsub` | 792ns | 2.1µs | 🟢 2.7× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 131.7µs | 106.0µs | 🔴 1.2× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 70.5µs | 56.1µs | 🔴 1.3× slower |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 604.6µs | 526.1µs | 🔴 1.1× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 126.4µs | 175.6µs | 🟢 1.4× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 89.7µs | 257.0µs | 🟢 2.9× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 894.0µs | 1.37ms | 🟢 1.5× faster |
| `txn: asymmetric DAG shared sink` | 24.8µs | 54.4µs | 🟢 2.2× faster |
| `txn: cross-atom 1000 selectors, set + read` | 1.05ms | 1.92ms | 🟢 1.8× faster |
| `txn: cross-atom 1000 selectors, with subs` | 1.01ms | 12.52ms | 🟢 12.4× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.86ms | 9.98ms | 🟢 2.6× faster |

<!-- BENCH:END -->
