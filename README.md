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
| `atom lifecycle (create+100get+100set)` | 12.5µs | 200.8µs | 🟢 16.1× faster |
| `atom(1)` | 3ns | 55ns | 🟢 19.8× faster |
| `atomFamily: txn update 5,000 existing members` | 2.71ms | 9.47ms | 🟢 3.5× faster |
| `atomFamily(id)` | 228ns | 269ns | 🟢 1.2× faster |
| `atomFamily(id) cache hit` | 16ns | 11ns | 🔴 1.5× slower |
| `atomFamily(string) cache hit` | 31ns | 24ns | 🔴 1.3× slower |
| `createStore` | 357ns | 5.4µs | 🟢 15.2× faster |
| `get 1000 atoms` | 12.3µs | 336.5µs | 🟢 27.4× faster |
| `selector(fn)` | 7ns | 59ns | 🟢 8.5× faster |
| `selectorFamily(id)` | 230ns | 402ns | 🟢 1.7× faster |
| `selectorFamily(string) cache hit` | 39ns | 19ns | 🔴 2.1× slower |
| `set + read 10 selectors` | 8.2µs | 33.4µs | 🟢 4.1× faster |
| `set + read 100 selectorFamily entries` | 89.6µs | 233.4µs | 🟢 2.6× faster |
| `set + read 100 selectors` | 74.9µs | 328.2µs | 🟢 4.4× faster |
| `set + read through 5 chained selectors` | 5.3µs | 15.4µs | 🟢 2.9× faster |
| `set 1000 atoms` | 116.8µs | 826.8µs | 🟢 7.1× faster |
| `set(atom, curr => curr+1)` | 147ns | 2.5µs | 🟢 17.2× faster |
| `set(atom, value)` | 141ns | 1.6µs | 🟢 11.4× faster |
| `set(atom) with 10 subs` | 222ns | 2.5µs | 🟢 11.3× faster |
| `store.get(atom)` | 40ns | 291ns | 🟢 7.3× faster |
| `sub + unsub` | 550ns | 1.6µs | 🟢 3.0× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 119.7µs | 124.4µs | 🟢 1.0× faster |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 66.4µs | 73.2µs | 🟢 1.1× faster |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 491.7µs | 602.0µs | 🟢 1.2× faster |
| `subscribe + unsubscribe 100 shared selector pairs` | 823.3µs | 818.6µs | 🔴 1.0× slower |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in` | 697.8µs | 816.9µs | 🟢 1.2× faster |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in + mounted spine` | 1.72ms | 910.4µs | 🔴 1.9× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 114.5µs | 242.1µs | 🟢 2.1× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 107.0µs | 523.5µs | 🟢 4.9× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 1.03ms | 3.45ms | 🟢 3.4× faster |
| `txn: asymmetric DAG shared sink` | 32.7µs | 132.4µs | 🟢 4.0× faster |
| `txn: cross-atom 1000 selectors, set + read` | 1.24ms | 4.94ms | 🟢 4.0× faster |
| `txn: cross-atom 1000 selectors, with subs` | 1.12ms | 20.04ms | 🟢 17.8× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.42ms | 18.33ms | 🟢 5.4× faster |

#### Node.js (V8)

| Operation | valdres | Jotai | |
|:----------|--------:|------:|:--|
| `atom lifecycle (create+100get+100set)` | 37.7µs | 107.1µs | 🟢 2.8× faster |
| `atom(1)` | 24ns | 55ns | 🟢 2.3× faster |
| `atomFamily: txn update 5,000 existing members` | 4.27ms | 5.56ms | 🟢 1.3× faster |
| `atomFamily(id)` | 150ns | 253ns | 🟢 1.7× faster |
| `atomFamily(id) cache hit` | 79ns | 24ns | 🔴 3.3× slower |
| `atomFamily(string) cache hit` | 149ns | 10ns | 🔴 14.3× slower |
| `createStore` | 525ns | 754ns | 🟢 1.4× faster |
| `get 1000 atoms` | 22.5µs | 154.0µs | 🟢 6.9× faster |
| `selector(fn)` | 55ns | 65ns | 🟢 1.2× faster |
| `selectorFamily(id)` | 179ns | 207ns | 🟢 1.2× faster |
| `selectorFamily(string) cache hit` | 55ns | 17ns | 🔴 3.2× slower |
| `set + read 10 selectors` | 12.4µs | 17.1µs | 🟢 1.4× faster |
| `set + read 100 selectorFamily entries` | 123.7µs | 121.7µs | 🔴 1.0× slower |
| `set + read 100 selectors` | 125.4µs | 124.0µs | 🔴 1.0× slower |
| `set + read through 5 chained selectors` | 6.8µs | 8.9µs | 🟢 1.3× faster |
| `set 1000 atoms` | 113.8µs | 337.2µs | 🟢 3.0× faster |
| `set(atom, curr => curr+1)` | 336ns | 1.1µs | 🟢 3.4× faster |
| `set(atom, value)` | 331ns | 1.0µs | 🟢 3.1× faster |
| `set(atom) with 10 subs` | 462ns | 1.4µs | 🟢 3.0× faster |
| `store.get(atom)` | 23ns | 141ns | 🟢 6.1× faster |
| `sub + unsub` | 974ns | 925ns | 🔴 1.1× slower |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 171.9µs | 100.8µs | 🔴 1.7× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 106.2µs | 52.3µs | 🔴 2.0× slower |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 816.9µs | 497.6µs | 🔴 1.6× slower |
| `subscribe + unsubscribe 100 shared selector pairs` | 1.08ms | 452.6µs | 🔴 2.4× slower |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in` | 982.8µs | 490.8µs | 🔴 2.0× slower |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in + mounted spine` | 1.78ms | 502.1µs | 🔴 3.5× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 148.8µs | 149.2µs | 🟢 1.0× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 99.3µs | 240.3µs | 🟢 2.4× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 1.41ms | 1.39ms | 🔴 1.0× slower |
| `txn: asymmetric DAG shared sink` | 29.3µs | 51.3µs | 🟢 1.8× faster |
| `txn: cross-atom 1000 selectors, set + read` | 1.71ms | 1.87ms | 🟢 1.1× faster |
| `txn: cross-atom 1000 selectors, with subs` | 1.05ms | 9.68ms | 🟢 9.2× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.19ms | 6.72ms | 🟢 2.1× faster |

<!-- BENCH:END -->
