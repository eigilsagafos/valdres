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
| `atom lifecycle (create+100get+100set)` | 12.1µs | 259.8µs | 🟢 21.4× faster |
| `atom(1)` | 4ns | 55ns | 🟢 14.3× faster |
| `atomFamily(id)` | 178ns | 389ns | 🟢 2.2× faster |
| `atomFamily(id) cache hit` | 10ns | 11ns | 🟢 1.1× faster |
| `createStore` | 268ns | 5.3µs | 🟢 19.7× faster |
| `get 1000 atoms` | 11.1µs | 433.4µs | 🟢 39.0× faster |
| `selector(fn)` | 4ns | 59ns | 🟢 13.5× faster |
| `selectorFamily(id)` | 148ns | 212ns | 🟢 1.4× faster |
| `set + read 10 selectors` | 8.6µs | 37.8µs | 🟢 4.4× faster |
| `set + read 100 selectorFamily entries` | 72.9µs | 274.4µs | 🟢 3.8× faster |
| `set + read 100 selectors` | 68.8µs | 356.0µs | 🟢 5.2× faster |
| `set + read through 5 chained selectors` | 7.5µs | 18.7µs | 🟢 2.5× faster |
| `set 1000 atoms` | 116.3µs | 983.7µs | 🟢 8.5× faster |
| `set(atom, curr => curr+1)` | 150ns | 3.2µs | 🟢 21.1× faster |
| `set(atom, value)` | 250ns | 2.7µs | 🟢 10.7× faster |
| `set(atom) with 10 subs` | 185ns | 4.0µs | 🟢 21.6× faster |
| `store.get(atom)` | 40ns | 371ns | 🟢 9.3× faster |
| `sub + unsub` | 900ns | 3.7µs | 🟢 4.1× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 130.5µs | 138.3µs | 🟢 1.1× faster |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 73.6µs | 97.4µs | 🟢 1.3× faster |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 601.8µs | 652.3µs | 🟢 1.1× faster |
| `txn: 10 atoms × 10 selectors, set + read` | 78.7µs | 296.6µs | 🟢 3.8× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 95.2µs | 690.4µs | 🟢 7.3× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 743.5µs | 3.80ms | 🟢 5.1× faster |
| `txn: asymmetric DAG shared sink` | 34.7µs | 151.4µs | 🟢 4.4× faster |
| `txn: cross-atom 1000 selectors, set + read` | 892.7µs | 5.46ms | 🟢 6.1× faster |
| `txn: cross-atom 1000 selectors, with subs` | 1.10ms | 23.83ms | 🟢 21.6× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 8.46ms | 21.10ms | 🟢 2.5× faster |

#### Node.js (V8)

| Operation | valdres | Jotai | |
|:----------|--------:|------:|:--|
| `atom lifecycle (create+100get+100set)` | 31.9µs | 143.1µs | 🟢 4.5× faster |
| `atom(1)` | 25ns | 51ns | 🟢 2.0× faster |
| `atomFamily(id)` | 111ns | 241ns | 🟢 2.2× faster |
| `atomFamily(id) cache hit` | 4ns | 27ns | 🟢 6.1× faster |
| `createStore` | 194ns | 1.9µs | 🟢 9.8× faster |
| `get 1000 atoms` | 14.5µs | 207.8µs | 🟢 14.4× faster |
| `selector(fn)` | 43ns | 60ns | 🟢 1.4× faster |
| `selectorFamily(id)` | 170ns | 199ns | 🟢 1.2× faster |
| `set + read 10 selectors` | 7.4µs | 19.8µs | 🟢 2.7× faster |
| `set + read 100 selectorFamily entries` | 77.9µs | 129.8µs | 🟢 1.7× faster |
| `set + read 100 selectors` | 74.9µs | 131.9µs | 🟢 1.8× faster |
| `set + read through 5 chained selectors` | 4.9µs | 10.0µs | 🟢 2.0× faster |
| `set 1000 atoms` | 100.6µs | 467.6µs | 🟢 4.6× faster |
| `set(atom, curr => curr+1)` | 295ns | 1.5µs | 🟢 5.0× faster |
| `set(atom, value)` | 296ns | 1.3µs | 🟢 4.2× faster |
| `set(atom) with 10 subs` | 373ns | 1.7µs | 🟢 4.6× faster |
| `store.get(atom)` | 18ns | 164ns | 🟢 9.1× faster |
| `sub + unsub` | 817ns | 2.1µs | 🟢 2.6× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 135.0µs | 105.5µs | 🔴 1.3× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 72.6µs | 55.5µs | 🔴 1.3× slower |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 624.0µs | 519.1µs | 🔴 1.2× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 114.4µs | 170.5µs | 🟢 1.5× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 90.5µs | 252.1µs | 🟢 2.8× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 869.4µs | 1.40ms | 🟢 1.6× faster |
| `txn: asymmetric DAG shared sink` | 25.6µs | 55.4µs | 🟢 2.2× faster |
| `txn: cross-atom 1000 selectors, set + read` | 1.06ms | 1.96ms | 🟢 1.8× faster |
| `txn: cross-atom 1000 selectors, with subs` | 1.01ms | 12.64ms | 🟢 12.5× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.82ms | 9.35ms | 🟢 2.5× faster |

<!-- BENCH:END -->
