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
| `atom lifecycle (create+100get+100set)` | 13.6µs | 201.4µs | 🟢 14.8× faster |
| `atom(1)` | 2ns | 57ns | 🟢 23.7× faster |
| `atomFamily: direct create + delete 500 members` | 2.34ms | 1.19ms | 🔴 2.0× slower |
| `atomFamily: direct set 500 new members` | 1.22ms | 849.5µs | 🔴 1.4× slower |
| `atomFamily: txn update 5,000 existing members` | 2.79ms | 9.20ms | 🟢 3.3× faster |
| `atomFamily(id)` | 239ns | 289ns | 🟢 1.2× faster |
| `atomFamily(id) cache hit` | 17ns | 11ns | 🔴 1.5× slower |
| `atomFamily(string) cache hit` | 30ns | 24ns | 🔴 1.2× slower |
| `create + dispose 1,000 root stores` | 610.0µs | 5.00ms | 🟢 8.2× faster |
| `createStore` | 391ns | 5.5µs | 🟢 14.2× faster |
| `get 1000 atoms` | 13.1µs | 362.4µs | 🟢 27.7× faster |
| `selector(fn)` | 8ns | 61ns | 🟢 7.4× faster |
| `selectorFamily: lookup 10,000 retained entries` | 925.2µs | 90.6µs | 🔴 10.2× slower |
| `selectorFamily(id)` | 193ns | 219ns | 🟢 1.1× faster |
| `selectorFamily(number) cache hit` | 41ns | 8ns | 🔴 5.2× slower |
| `selectorFamily(string) cache hit` | 46ns | 20ns | 🔴 2.3× slower |
| `set + read 10 selectors` | 7.8µs | 32.4µs | 🟢 4.2× faster |
| `set + read 100 selectorFamily entries` | 88.5µs | 227.1µs | 🟢 2.6× faster |
| `set + read 100 selectors` | 67.1µs | 320.8µs | 🟢 4.8× faster |
| `set + read through 5 chained selectors` | 5.5µs | 15.2µs | 🟢 2.8× faster |
| `set 1000 atoms` | 97.3µs | 730.2µs | 🟢 7.5× faster |
| `set(atom, curr => curr+1)` | 131ns | 2.5µs | 🟢 19.4× faster |
| `set(atom, value)` | 150ns | 1.6µs | 🟢 10.3× faster |
| `set(atom) with 10 subs` | 209ns | 2.4µs | 🟢 11.6× faster |
| `store.get(atom)` | 40ns | 310ns | 🟢 7.8× faster |
| `sub + unsub` | 359ns | 1.7µs | 🟢 4.7× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 125.6µs | 123.1µs | 🔴 1.0× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 70.9µs | 69.1µs | 🔴 1.0× slower |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 526.0µs | 594.6µs | 🟢 1.1× faster |
| `subscribe + unsubscribe 100 shared selector pairs` | 728.3µs | 813.8µs | 🟢 1.1× faster |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in` | 602.9µs | 817.9µs | 🟢 1.4× faster |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in + mounted spine` | 1.44ms | 901.2µs | 🔴 1.6× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 113.9µs | 235.5µs | 🟢 2.1× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 98.9µs | 498.4µs | 🟢 5.0× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 1.12ms | 3.21ms | 🟢 2.9× faster |
| `txn: asymmetric DAG shared sink` | 30.0µs | 121.5µs | 🟢 4.1× faster |
| `txn: cross-atom 1000 selectors, set + read` | 1.33ms | 4.63ms | 🟢 3.5× faster |
| `txn: cross-atom 1000 selectors, with subs` | 1.10ms | 18.42ms | 🟢 16.8× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.42ms | 16.39ms | 🟢 4.8× faster |

#### Node.js (V8)

| Operation | valdres | Jotai | |
|:----------|--------:|------:|:--|
| `atom lifecycle (create+100get+100set)` | 35.2µs | 99.0µs | 🟢 2.8× faster |
| `atom(1)` | 24ns | 49ns | 🟢 2.0× faster |
| `atomFamily: direct create + delete 500 members` | 4.82ms | 2.07ms | 🔴 2.3× slower |
| `atomFamily: direct set 500 new members` | 2.78ms | 1.56ms | 🔴 1.8× slower |
| `atomFamily: txn update 5,000 existing members` | 4.11ms | 4.56ms | 🟢 1.1× faster |
| `atomFamily(id)` | 166ns | 225ns | 🟢 1.4× faster |
| `atomFamily(id) cache hit` | 131ns | 26ns | 🔴 5.0× slower |
| `atomFamily(string) cache hit` | 158ns | 26ns | 🔴 6.0× slower |
| `create + dispose 1,000 root stores` | 1.12ms | 729.0µs | 🔴 1.5× slower |
| `createStore` | 588ns | 675ns | 🟢 1.1× faster |
| `get 1000 atoms` | 20.2µs | 154.2µs | 🟢 7.6× faster |
| `selector(fn)` | 43ns | 54ns | 🟢 1.3× faster |
| `selectorFamily: lookup 10,000 retained entries` | 1.39ms | 377.5µs | 🔴 3.7× slower |
| `selectorFamily(id)` | 1.5µs | 222ns | 🔴 6.6× slower |
| `selectorFamily(number) cache hit` | 162ns | 14ns | 🔴 11.5× slower |
| `selectorFamily(string) cache hit` | 88ns | 11ns | 🔴 8.1× slower |
| `set + read 10 selectors` | 11.5µs | 16.9µs | 🟢 1.5× faster |
| `set + read 100 selectorFamily entries` | 117.5µs | 122.5µs | 🟢 1.0× faster |
| `set + read 100 selectors` | 117.0µs | 121.5µs | 🟢 1.0× faster |
| `set + read through 5 chained selectors` | 6.5µs | 9.2µs | 🟢 1.4× faster |
| `set 1000 atoms` | 114.8µs | 321.9µs | 🟢 2.8× faster |
| `set(atom, curr => curr+1)` | 318ns | 1.1µs | 🟢 3.3× faster |
| `set(atom, value)` | 312ns | 879ns | 🟢 2.8× faster |
| `set(atom) with 10 subs` | 404ns | 1.3µs | 🟢 3.3× faster |
| `store.get(atom)` | 23ns | 150ns | 🟢 6.4× faster |
| `sub + unsub` | 865ns | 943ns | 🟢 1.1× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 164.1µs | 97.9µs | 🔴 1.7× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 104.4µs | 51.7µs | 🔴 2.0× slower |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 791.1µs | 504.4µs | 🔴 1.6× slower |
| `subscribe + unsubscribe 100 shared selector pairs` | 1.03ms | 436.0µs | 🔴 2.4× slower |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in` | 914.5µs | 462.7µs | 🔴 2.0× slower |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in + mounted spine` | 1.72ms | 481.7µs | 🔴 3.6× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 136.6µs | 144.0µs | 🟢 1.1× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 89.7µs | 233.3µs | 🟢 2.6× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 1.34ms | 1.37ms | 🟢 1.0× faster |
| `txn: asymmetric DAG shared sink` | 26.6µs | 52.3µs | 🟢 2.0× faster |
| `txn: cross-atom 1000 selectors, set + read` | 1.61ms | 1.70ms | 🟢 1.1× faster |
| `txn: cross-atom 1000 selectors, with subs` | 998.4µs | 8.70ms | 🟢 8.7× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.09ms | 5.92ms | 🟢 1.9× faster |

<!-- BENCH:END -->
