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
| `atom lifecycle (create+100get+100set)` | 9.2µs | 136.5µs | 🟢 14.9× faster |
| `atom(1)` | 3ns | 56ns | 🟢 18.8× faster |
| `atomFamily: txn update 5,000 existing members` | 2.40ms | 6.71ms | 🟢 2.8× faster |
| `atomFamily(id)` | 179ns | 275ns | 🟢 1.5× faster |
| `atomFamily(id) cache hit` | 13ns | 7ns | 🔴 1.8× slower |
| `atomFamily(string) cache hit` | 23ns | 20ns | 🔴 1.2× slower |
| `createStore` | 245ns | 5.4µs | 🟢 22.3× faster |
| `get 1000 atoms` | 8.8µs | 407.1µs | 🟢 46.4× faster |
| `selector(fn)` | 7ns | 56ns | 🟢 7.7× faster |
| `selectorFamily(id)` | 204ns | 299ns | 🟢 1.5× faster |
| `selectorFamily(string) cache hit` | 30ns | 14ns | 🔴 2.1× slower |
| `set + read 10 selectors` | 5.6µs | 20.1µs | 🟢 3.6× faster |
| `set + read 100 selectorFamily entries` | 57.4µs | 200.2µs | 🟢 3.5× faster |
| `set + read 100 selectors` | 49.9µs | 205.3µs | 🟢 4.1× faster |
| `set + read through 5 chained selectors` | 3.8µs | 8.5µs | 🟢 2.3× faster |
| `set 1000 atoms` | 80.6µs | 608.6µs | 🟢 7.5× faster |
| `set(atom, curr => curr+1)` | 93ns | 1.6µs | 🟢 17.6× faster |
| `set(atom, value)` | 111ns | 1.1µs | 🟢 9.8× faster |
| `set(atom) with 10 subs` | 139ns | 1.6µs | 🟢 11.5× faster |
| `store.get(atom)` | 28ns | 204ns | 🟢 7.3× faster |
| `sub + unsub` | 244ns | 1.3µs | 🟢 5.5× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 76.4µs | 109.0µs | 🟢 1.4× faster |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 44.5µs | 59.5µs | 🟢 1.3× faster |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 353.4µs | 521.3µs | 🟢 1.5× faster |
| `subscribe + unsubscribe 100 shared selector pairs` | 517.7µs | 529.5µs | 🟢 1.0× faster |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in` | 471.4µs | 561.9µs | 🟢 1.2× faster |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in + mounted spine` | 1.04ms | 615.0µs | 🔴 1.7× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 67.9µs | 212.2µs | 🟢 3.1× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 70.8µs | 321.9µs | 🟢 4.5× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 635.9µs | 2.01ms | 🟢 3.2× faster |
| `txn: asymmetric DAG shared sink` | 21.1µs | 82.6µs | 🟢 3.9× faster |
| `txn: cross-atom 1000 selectors, set + read` | 807.4µs | 2.13ms | 🟢 2.6× faster |
| `txn: cross-atom 1000 selectors, with subs` | 861.4µs | 12.33ms | 🟢 14.3× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 2.40ms | 8.97ms | 🟢 3.7× faster |

#### Node.js (V8)

| Operation | valdres | Jotai | |
|:----------|--------:|------:|:--|
| `atom lifecycle (create+100get+100set)` | 25.8µs | 83.5µs | 🟢 3.2× faster |
| `atom(1)` | 20ns | 43ns | 🟢 2.1× faster |
| `atomFamily: txn update 5,000 existing members` | 3.00ms | 4.31ms | 🟢 1.4× faster |
| `atomFamily(id)` | 142ns | 226ns | 🟢 1.6× faster |
| `atomFamily(id) cache hit` | 40ns | 10ns | 🔴 4.0× slower |
| `atomFamily(string) cache hit` | 114ns | 11ns | 🔴 10.2× slower |
| `createStore` | 574ns | 712ns | 🟢 1.2× faster |
| `get 1000 atoms` | 15.9µs | 116.4µs | 🟢 7.3× faster |
| `selector(fn)` | 31ns | 51ns | 🟢 1.6× faster |
| `selectorFamily(id)` | 1.2µs | 322ns | 🔴 3.7× slower |
| `selectorFamily(string) cache hit` | 15ns | 11ns | 🔴 1.4× slower |
| `set + read 10 selectors` | 8.1µs | 13.3µs | 🟢 1.6× faster |
| `set + read 100 selectorFamily entries` | 78.9µs | 107.5µs | 🟢 1.4× faster |
| `set + read 100 selectors` | 78.8µs | 99.5µs | 🟢 1.3× faster |
| `set + read through 5 chained selectors` | 4.4µs | 7.1µs | 🟢 1.6× faster |
| `set 1000 atoms` | 84.1µs | 247.1µs | 🟢 2.9× faster |
| `set(atom, curr => curr+1)` | 239ns | 875ns | 🟢 3.7× faster |
| `set(atom, value)` | 235ns | 729ns | 🟢 3.1× faster |
| `set(atom) with 10 subs` | 283ns | 1.2µs | 🟢 4.2× faster |
| `store.get(atom)` | 14ns | 99ns | 🟢 7.1× faster |
| `sub + unsub` | 631ns | 747ns | 🟢 1.2× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 122.2µs | 80.0µs | 🔴 1.5× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 70.0µs | 65.5µs | 🔴 1.1× slower |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 558.9µs | 399.8µs | 🔴 1.4× slower |
| `subscribe + unsubscribe 100 shared selector pairs` | 733.1µs | 355.1µs | 🔴 2.1× slower |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in` | 717.6µs | 377.9µs | 🔴 1.9× slower |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in + mounted spine` | 1.35ms | 392.5µs | 🔴 3.4× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 110.1µs | 135.7µs | 🟢 1.2× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 90.5µs | 184.6µs | 🟢 2.0× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 918.5µs | 1.09ms | 🟢 1.2× faster |
| `txn: asymmetric DAG shared sink` | 20.2µs | 42.7µs | 🟢 2.1× faster |
| `txn: cross-atom 1000 selectors, set + read` | 1.17ms | 1.48ms | 🟢 1.3× faster |
| `txn: cross-atom 1000 selectors, with subs` | 781.2µs | 6.65ms | 🟢 8.5× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 2.51ms | 4.89ms | 🟢 1.9× faster |

<!-- BENCH:END -->
