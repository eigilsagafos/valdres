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
| `atom lifecycle (create+100get+100set)` | 12.1µs | 194.0µs | 🟢 16.0× faster |
| `atom(1)` | 2ns | 53ns | 🟢 21.1× faster |
| `atomFamily: txn update 5,000 existing members` | 2.55ms | 9.10ms | 🟢 3.6× faster |
| `atomFamily(id)` | 192ns | 259ns | 🟢 1.3× faster |
| `atomFamily(id) cache hit` | 16ns | 11ns | 🔴 1.5× slower |
| `atomFamily(string) cache hit` | 32ns | 24ns | 🔴 1.3× slower |
| `createStore` | 323ns | 5.3µs | 🟢 16.5× faster |
| `get 1000 atoms` | 12.4µs | 730.5µs | 🟢 58.7× faster |
| `selector(fn)` | 6ns | 56ns | 🟢 8.7× faster |
| `selectorFamily(id)` | 229ns | 384ns | 🟢 1.7× faster |
| `selectorFamily(string) cache hit` | 39ns | 19ns | 🔴 2.1× slower |
| `set + read 10 selectors` | 8.0µs | 30.8µs | 🟢 3.9× faster |
| `set + read 100 selectorFamily entries` | 86.1µs | 221.0µs | 🟢 2.6× faster |
| `set + read 100 selectors` | 69.7µs | 330.8µs | 🟢 4.7× faster |
| `set + read through 5 chained selectors` | 5.2µs | 12.7µs | 🟢 2.4× faster |
| `set 1000 atoms` | 117.0µs | 813.6µs | 🟢 7.0× faster |
| `set(atom, curr => curr+1)` | 135ns | 2.5µs | 🟢 18.3× faster |
| `set(atom, value)` | 150ns | 1.5µs | 🟢 10.2× faster |
| `set(atom) with 10 subs` | 186ns | 2.3µs | 🟢 12.4× faster |
| `store.get(atom)` | 40ns | 291ns | 🟢 7.3× faster |
| `sub + unsub` | 372ns | 1.9µs | 🟢 5.1× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 112.2µs | 121.5µs | 🟢 1.1× faster |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 64.5µs | 66.6µs | 🟢 1.0× faster |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 480.0µs | 576.6µs | 🟢 1.2× faster |
| `subscribe + unsubscribe 100 shared selector pairs` | 763.8µs | 801.6µs | 🟢 1.0× faster |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in` | 673.9µs | 807.2µs | 🟢 1.2× faster |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in + mounted spine` | 1.54ms | 880.3µs | 🔴 1.7× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 104.7µs | 338.5µs | 🟢 3.2× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 107.6µs | 526.5µs | 🟢 4.9× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 995.9µs | 3.31ms | 🟢 3.3× faster |
| `txn: asymmetric DAG shared sink` | 32.7µs | 129.7µs | 🟢 4.0× faster |
| `txn: cross-atom 1000 selectors, set + read` | 1.19ms | 5.17ms | 🟢 4.4× faster |
| `txn: cross-atom 1000 selectors, with subs` | 1.15ms | 17.83ms | 🟢 15.5× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.26ms | 16.52ms | 🟢 5.1× faster |

#### Node.js (V8)

| Operation | valdres | Jotai | |
|:----------|--------:|------:|:--|
| `atom lifecycle (create+100get+100set)` | 36.8µs | 106.3µs | 🟢 2.9× faster |
| `atom(1)` | 25ns | 49ns | 🟢 2.0× faster |
| `atomFamily: txn update 5,000 existing members` | 7.92ms | 5.49ms | 🔴 1.4× slower |
| `atomFamily(id)` | 152ns | 257ns | 🟢 1.7× faster |
| `atomFamily(id) cache hit` | 166ns | 26ns | 🔴 6.3× slower |
| `atomFamily(string) cache hit` | 45ns | 11ns | 🔴 4.2× slower |
| `createStore` | 515ns | 661ns | 🟢 1.3× faster |
| `get 1000 atoms` | 22.7µs | 153.7µs | 🟢 6.8× faster |
| `selector(fn)` | 43ns | 57ns | 🟢 1.3× faster |
| `selectorFamily(id)` | 1.6µs | 273ns | 🔴 6.0× slower |
| `selectorFamily(string) cache hit` | 92ns | 15ns | 🔴 6.1× slower |
| `set + read 10 selectors` | 12.1µs | 16.4µs | 🟢 1.4× faster |
| `set + read 100 selectorFamily entries` | 121.9µs | 122.9µs | 🟢 1.0× faster |
| `set + read 100 selectors` | 118.3µs | 119.5µs | 🟢 1.0× faster |
| `set + read through 5 chained selectors` | 6.7µs | 9.4µs | 🟢 1.4× faster |
| `set 1000 atoms` | 118.0µs | 334.7µs | 🟢 2.8× faster |
| `set(atom, curr => curr+1)` | 336ns | 1.1µs | 🟢 3.1× faster |
| `set(atom, value)` | 329ns | 902ns | 🟢 2.7× faster |
| `set(atom) with 10 subs` | 425ns | 1.3µs | 🟢 3.1× faster |
| `store.get(atom)` | 24ns | 141ns | 🟢 5.9× faster |
| `sub + unsub` | 929ns | 904ns | 🔴 1.0× slower |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 166.9µs | 101.6µs | 🔴 1.6× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 106.1µs | 55.0µs | 🔴 1.9× slower |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 783.0µs | 510.2µs | 🔴 1.5× slower |
| `subscribe + unsubscribe 100 shared selector pairs` | 1.04ms | 458.9µs | 🔴 2.3× slower |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in` | 949.6µs | 500.7µs | 🔴 1.9× slower |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in + mounted spine` | 1.73ms | 523.2µs | 🔴 3.3× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 141.8µs | 146.7µs | 🟢 1.0× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 97.6µs | 255.0µs | 🟢 2.6× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 1.42ms | 1.40ms | 🔴 1.0× slower |
| `txn: asymmetric DAG shared sink` | 28.2µs | 49.9µs | 🟢 1.8× faster |
| `txn: cross-atom 1000 selectors, set + read` | 1.70ms | 1.87ms | 🟢 1.1× faster |
| `txn: cross-atom 1000 selectors, with subs` | 1.06ms | 9.29ms | 🟢 8.7× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.23ms | 6.58ms | 🟢 2.0× faster |

<!-- BENCH:END -->
