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
| `atom lifecycle (create+100get+100set)` | 12.8µs | 264.7µs | 🟢 20.7× faster |
| `atom(1)` | 3ns | 53ns | 🟢 18.1× faster |
| `atomFamily(id)` | 207ns | 252ns | 🟢 1.2× faster |
| `atomFamily(id) cache hit` | 17ns | 11ns | 🔴 1.5× slower |
| `createStore` | 283ns | 5.3µs | 🟢 18.7× faster |
| `get 1000 atoms` | 9.3µs | 394.5µs | 🟢 42.6× faster |
| `selector(fn)` | 4ns | 57ns | 🟢 14.8× faster |
| `selectorFamily(id)` | 137ns | 383ns | 🟢 2.8× faster |
| `set + read 10 selectors` | 10.6µs | 37.8µs | 🟢 3.6× faster |
| `set + read 100 selectorFamily entries` | 97.7µs | 265.2µs | 🟢 2.7× faster |
| `set + read 100 selectors` | 88.3µs | 346.8µs | 🟢 3.9× faster |
| `set + read through 5 chained selectors` | 7.5µs | 17.6µs | 🟢 2.3× faster |
| `set 1000 atoms` | 111.9µs | 981.9µs | 🟢 8.8× faster |
| `set(atom, curr => curr+1)` | 135ns | 3.3µs | 🟢 24.2× faster |
| `set(atom, value)` | 150ns | 2.8µs | 🟢 18.5× faster |
| `set(atom) with 10 subs` | 204ns | 4.3µs | 🟢 21.1× faster |
| `store.get(atom)` | 31ns | 371ns | 🟢 12.0× faster |
| `sub + unsub` | 371ns | 3.2µs | 🟢 8.7× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 132.9µs | 132.0µs | 🔴 1.0× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 105.7µs | 98.7µs | 🔴 1.1× slower |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 596.9µs | 639.0µs | 🟢 1.1× faster |
| `subscribe + unsubscribe 100 shared selector pairs` | 770.4µs | 1.14ms | 🟢 1.5× faster |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in` | 743.6µs | 1.10ms | 🟢 1.5× faster |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in + mounted spine` | 1.76ms | 1.37ms | 🔴 1.3× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 103.9µs | 276.4µs | 🟢 2.7× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 109.3µs | 621.1µs | 🟢 5.7× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 884.5µs | 3.69ms | 🟢 4.2× faster |
| `txn: asymmetric DAG shared sink` | 32.5µs | 152.7µs | 🟢 4.7× faster |
| `txn: cross-atom 1000 selectors, set + read` | 1.18ms | 5.33ms | 🟢 4.5× faster |
| `txn: cross-atom 1000 selectors, with subs` | 1.37ms | 22.88ms | 🟢 16.7× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 5.59ms | 20.16ms | 🟢 3.6× faster |

#### Node.js (V8)

| Operation | valdres | Jotai | |
|:----------|--------:|------:|:--|
| `atom lifecycle (create+100get+100set)` | 35.3µs | 144.2µs | 🟢 4.1× faster |
| `atom(1)` | 25ns | 49ns | 🟢 2.0× faster |
| `atomFamily(id)` | 117ns | 328ns | 🟢 2.8× faster |
| `atomFamily(id) cache hit` | 67ns | 13ns | 🔴 5.2× slower |
| `createStore` | 299ns | 1.6µs | 🟢 5.3× faster |
| `get 1000 atoms` | 15.4µs | 209.6µs | 🟢 13.6× faster |
| `selector(fn)` | 43ns | 184ns | 🟢 4.2× faster |
| `selectorFamily(id)` | 218ns | 352ns | 🟢 1.6× faster |
| `set + read 10 selectors` | 9.2µs | 20.7µs | 🟢 2.3× faster |
| `set + read 100 selectorFamily entries` | 92.3µs | 131.5µs | 🟢 1.4× faster |
| `set + read 100 selectors` | 90.3µs | 131.9µs | 🟢 1.5× faster |
| `set + read through 5 chained selectors` | 5.3µs | 9.8µs | 🟢 1.8× faster |
| `set 1000 atoms` | 102.3µs | 450.0µs | 🟢 4.4× faster |
| `set(atom, curr => curr+1)` | 319ns | 1.5µs | 🟢 4.8× faster |
| `set(atom, value)` | 335ns | 1.3µs | 🟢 3.9× faster |
| `set(atom) with 10 subs` | 395ns | 1.8µs | 🟢 4.4× faster |
| `store.get(atom)` | 19ns | 165ns | 🟢 8.8× faster |
| `sub + unsub` | 842ns | 2.1µs | 🟢 2.5× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 124.3µs | 109.9µs | 🔴 1.1× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 100.2µs | 57.8µs | 🔴 1.7× slower |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 553.7µs | 539.6µs | 🔴 1.0× slower |
| `subscribe + unsubscribe 100 shared selector pairs` | 851.8µs | 567.0µs | 🔴 1.5× slower |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in` | 770.8µs | 577.6µs | 🔴 1.3× slower |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in + mounted spine` | 1.36ms | 618.3µs | 🔴 2.2× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 148.0µs | 174.2µs | 🟢 1.2× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 104.9µs | 260.2µs | 🟢 2.5× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 1.06ms | 1.34ms | 🟢 1.3× faster |
| `txn: asymmetric DAG shared sink` | 28.7µs | 56.0µs | 🟢 2.0× faster |
| `txn: cross-atom 1000 selectors, set + read` | 1.29ms | 1.92ms | 🟢 1.5× faster |
| `txn: cross-atom 1000 selectors, with subs` | 1.19ms | 12.37ms | 🟢 10.4× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 4.79ms | 9.09ms | 🟢 1.9× faster |

<!-- BENCH:END -->
