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
| `atom lifecycle (create+100get+100set)` | 12.7µs | 200.5µs | 🟢 15.9× faster |
| `atom(1)` | 3ns | 54ns | 🟢 19.8× faster |
| `atomFamily: direct create + delete 500 members` | 2.18ms | 1.20ms | 🔴 1.8× slower |
| `atomFamily: direct set 500 new members` | 1.60ms | 868.5µs | 🔴 1.8× slower |
| `atomFamily: txn update 5,000 existing members` | 2.95ms | 9.61ms | 🟢 3.3× faster |
| `atomFamily(id)` | 215ns | 265ns | 🟢 1.2× faster |
| `atomFamily(id) cache hit` | 16ns | 11ns | 🔴 1.5× slower |
| `atomFamily(string) cache hit` | 31ns | 24ns | 🔴 1.3× slower |
| `createStore` | 353ns | 5.4µs | 🟢 15.3× faster |
| `get 1000 atoms` | 12.9µs | 359.7µs | 🟢 28.0× faster |
| `selector(fn)` | 7ns | 56ns | 🟢 8.5× faster |
| `selectorFamily(id)` | 231ns | 404ns | 🟢 1.7× faster |
| `selectorFamily(string) cache hit` | 40ns | 19ns | 🔴 2.1× slower |
| `set + read 10 selectors` | 8.3µs | 33.7µs | 🟢 4.0× faster |
| `set + read 100 selectorFamily entries` | 94.7µs | 237.4µs | 🟢 2.5× faster |
| `set + read 100 selectors` | 72.8µs | 326.1µs | 🟢 4.5× faster |
| `set + read through 5 chained selectors` | 5.9µs | 16.1µs | 🟢 2.7× faster |
| `set 1000 atoms` | 101.5µs | 769.7µs | 🟢 7.6× faster |
| `set(atom, curr => curr+1)` | 153ns | 2.6µs | 🟢 16.9× faster |
| `set(atom, value)` | 150ns | 1.6µs | 🟢 10.4× faster |
| `set(atom) with 10 subs` | 192ns | 2.5µs | 🟢 13.1× faster |
| `store.get(atom)` | 40ns | 291ns | 🟢 7.3× faster |
| `sub + unsub` | 437ns | 1.6µs | 🟢 3.7× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 121.0µs | 122.0µs | 🟢 1.0× faster |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 67.9µs | 69.0µs | 🟢 1.0× faster |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 500.2µs | 596.5µs | 🟢 1.2× faster |
| `subscribe + unsubscribe 100 shared selector pairs` | 833.6µs | 810.3µs | 🔴 1.0× slower |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in` | 761.8µs | 813.8µs | 🟢 1.1× faster |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in + mounted spine` | 1.60ms | 894.6µs | 🔴 1.8× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 159.7µs | 240.7µs | 🟢 1.5× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 108.6µs | 524.5µs | 🟢 4.8× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 1.08ms | 3.34ms | 🟢 3.1× faster |
| `txn: asymmetric DAG shared sink` | 31.8µs | 133.0µs | 🟢 4.2× faster |
| `txn: cross-atom 1000 selectors, set + read` | 1.28ms | 4.89ms | 🟢 3.8× faster |
| `txn: cross-atom 1000 selectors, with subs` | 1.13ms | 18.46ms | 🟢 16.3× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.41ms | 16.67ms | 🟢 4.9× faster |

#### Node.js (V8)

| Operation | valdres | Jotai | |
|:----------|--------:|------:|:--|
| `atom lifecycle (create+100get+100set)` | 38.1µs | 107.6µs | 🟢 2.8× faster |
| `atom(1)` | 24ns | 58ns | 🟢 2.4× faster |
| `atomFamily: direct create + delete 500 members` | 5.20ms | 2.29ms | 🔴 2.3× slower |
| `atomFamily: direct set 500 new members` | 3.12ms | 1.60ms | 🔴 2.0× slower |
| `atomFamily: txn update 5,000 existing members` | 5.34ms | 6.93ms | 🟢 1.3× faster |
| `atomFamily(id)` | 126ns | 250ns | 🟢 2.0× faster |
| `atomFamily(id) cache hit` | 132ns | 14ns | 🔴 9.1× slower |
| `atomFamily(string) cache hit` | 135ns | 14ns | 🔴 9.8× slower |
| `createStore` | 648ns | 812ns | 🟢 1.3× faster |
| `get 1000 atoms` | 22.6µs | 153.4µs | 🟢 6.8× faster |
| `selector(fn)` | 56ns | 60ns | 🟢 1.1× faster |
| `selectorFamily(id)` | 637ns | 469ns | 🔴 1.4× slower |
| `selectorFamily(string) cache hit` | 100ns | 14ns | 🔴 7.3× slower |
| `set + read 10 selectors` | 12.6µs | 17.5µs | 🟢 1.4× faster |
| `set + read 100 selectorFamily entries` | 126.0µs | 125.1µs | 🔴 1.0× slower |
| `set + read 100 selectors` | 124.4µs | 123.6µs | 🔴 1.0× slower |
| `set + read through 5 chained selectors` | 6.9µs | 9.0µs | 🟢 1.3× faster |
| `set 1000 atoms` | 114.8µs | 333.3µs | 🟢 2.9× faster |
| `set(atom, curr => curr+1)` | 339ns | 1.1µs | 🟢 3.2× faster |
| `set(atom, value)` | 351ns | 952ns | 🟢 2.7× faster |
| `set(atom) with 10 subs` | 442ns | 1.4µs | 🟢 3.1× faster |
| `store.get(atom)` | 37ns | 141ns | 🟢 3.8× faster |
| `sub + unsub` | 977ns | 936ns | 🔴 1.0× slower |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 170.3µs | 100.4µs | 🔴 1.7× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 106.1µs | 53.5µs | 🔴 2.0× slower |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 791.0µs | 512.1µs | 🔴 1.5× slower |
| `subscribe + unsubscribe 100 shared selector pairs` | 1.04ms | 448.5µs | 🔴 2.3× slower |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in` | 928.0µs | 478.7µs | 🔴 1.9× slower |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in + mounted spine` | 1.71ms | 500.5µs | 🔴 3.4× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 152.7µs | 164.1µs | 🟢 1.1× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 95.3µs | 257.7µs | 🟢 2.7× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 1.44ms | 1.43ms | 🔴 1.0× slower |
| `txn: asymmetric DAG shared sink` | 29.0µs | 51.2µs | 🟢 1.8× faster |
| `txn: cross-atom 1000 selectors, set + read` | 1.74ms | 1.92ms | 🟢 1.1× faster |
| `txn: cross-atom 1000 selectors, with subs` | 1.04ms | 9.60ms | 🟢 9.3× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.20ms | 6.66ms | 🟢 2.1× faster |

<!-- BENCH:END -->
