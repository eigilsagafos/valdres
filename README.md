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
| `atom lifecycle (create+100get+100set)` | 13.4µs | 202.8µs | 🟢 15.1× faster |
| `atom(1)` | 2ns | 58ns | 🟢 24.3× faster |
| `atomFamily: direct create + delete 500 members` | 1.80ms | 1.26ms | 🔴 1.4× slower |
| `atomFamily: direct set 500 new members` | 1.26ms | 856.7µs | 🔴 1.5× slower |
| `atomFamily: txn update 5,000 existing members` | 2.86ms | 9.53ms | 🟢 3.3× faster |
| `atomFamily(id)` | 202ns | 327ns | 🟢 1.6× faster |
| `atomFamily(id) cache hit` | 17ns | 12ns | 🔴 1.5× slower |
| `atomFamily(string) cache hit` | 29ns | 24ns | 🔴 1.2× slower |
| `create + dispose 1,000 root stores` | 1.07ms | 5.16ms | 🟢 4.8× faster |
| `createStore` | 418ns | 5.5µs | 🟢 13.2× faster |
| `get 1000 atoms` | 13.0µs | 464.2µs | 🟢 35.7× faster |
| `selector(fn)` | 8ns | 62ns | 🟢 7.3× faster |
| `selectorFamily: lookup 10,000 retained entries` | 927.4µs | 91.2µs | 🔴 10.2× slower |
| `selectorFamily(id)` | 245ns | 235ns | 🔴 1.0× slower |
| `selectorFamily(number) cache hit` | 41ns | 7ns | 🔴 5.8× slower |
| `selectorFamily(string) cache hit` | 46ns | 20ns | 🔴 2.3× slower |
| `set + read 10 selectors` | 8.0µs | 32.3µs | 🟢 4.0× faster |
| `set + read 100 selectorFamily entries` | 88.3µs | 225.2µs | 🟢 2.6× faster |
| `set + read 100 selectors` | 65.2µs | 307.2µs | 🟢 4.7× faster |
| `set + read through 5 chained selectors` | 5.3µs | 14.8µs | 🟢 2.8× faster |
| `set 1000 atoms` | 95.3µs | 723.8µs | 🟢 7.6× faster |
| `set(atom, curr => curr+1)` | 132ns | 2.6µs | 🟢 19.5× faster |
| `set(atom, value)` | 140ns | 1.6µs | 🟢 11.2× faster |
| `set(atom) with 10 subs` | 217ns | 2.5µs | 🟢 11.3× faster |
| `store.get(atom)` | 40ns | 301ns | 🟢 7.5× faster |
| `sub + unsub` | 331ns | 1.6µs | 🟢 4.9× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 117.6µs | 125.8µs | 🟢 1.1× faster |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 62.6µs | 68.3µs | 🟢 1.1× faster |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 468.4µs | 596.7µs | 🟢 1.3× faster |
| `subscribe + unsubscribe 100 shared selector pairs` | 745.6µs | 857.4µs | 🟢 1.1× faster |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in` | 657.2µs | 833.1µs | 🟢 1.3× faster |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in + mounted spine` | 1.53ms | 930.4µs | 🔴 1.6× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 110.8µs | 239.5µs | 🟢 2.2× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 102.7µs | 491.2µs | 🟢 4.8× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 1.10ms | 3.24ms | 🟢 2.9× faster |
| `txn: asymmetric DAG shared sink` | 29.6µs | 122.6µs | 🟢 4.1× faster |
| `txn: cross-atom 1000 selectors, set + read` | 1.33ms | 4.70ms | 🟢 3.5× faster |
| `txn: cross-atom 1000 selectors, with subs` | 1.17ms | 19.30ms | 🟢 16.5× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.70ms | 16.95ms | 🟢 4.6× faster |

#### Node.js (V8)

| Operation | valdres | Jotai | |
|:----------|--------:|------:|:--|
| `atom lifecycle (create+100get+100set)` | 35.0µs | 104.5µs | 🟢 3.0× faster |
| `atom(1)` | 24ns | 56ns | 🟢 2.3× faster |
| `atomFamily: direct create + delete 500 members` | 4.74ms | 773.6µs | 🔴 6.1× slower |
| `atomFamily: direct set 500 new members` | 2.90ms | 1.50ms | 🔴 1.9× slower |
| `atomFamily: txn update 5,000 existing members` | 9.64ms | 4.54ms | 🔴 2.1× slower |
| `atomFamily(id)` | 189ns | 262ns | 🟢 1.4× faster |
| `atomFamily(id) cache hit` | 134ns | 17ns | 🔴 8.0× slower |
| `atomFamily(string) cache hit` | 153ns | 15ns | 🔴 10.1× slower |
| `create + dispose 1,000 root stores` | 1.20ms | 744.1µs | 🔴 1.6× slower |
| `createStore` | 602ns | 868ns | 🟢 1.4× faster |
| `get 1000 atoms` | 20.5µs | 153.0µs | 🟢 7.5× faster |
| `selector(fn)` | 52ns | 55ns | 🟢 1.1× faster |
| `selectorFamily: lookup 10,000 retained entries` | 1.42ms | 210.9µs | 🔴 6.7× slower |
| `selectorFamily(id)` | 1.4µs | 261ns | 🔴 5.5× slower |
| `selectorFamily(number) cache hit` | 178ns | 16ns | 🔴 11.3× slower |
| `selectorFamily(string) cache hit` | 106ns | 11ns | 🔴 9.9× slower |
| `set + read 10 selectors` | 11.6µs | 17.9µs | 🟢 1.5× faster |
| `set + read 100 selectorFamily entries` | 117.7µs | 124.5µs | 🟢 1.1× faster |
| `set + read 100 selectors` | 116.2µs | 123.5µs | 🟢 1.1× faster |
| `set + read through 5 chained selectors` | 6.5µs | 9.3µs | 🟢 1.4× faster |
| `set 1000 atoms` | 114.5µs | 318.2µs | 🟢 2.8× faster |
| `set(atom, curr => curr+1)` | 322ns | 1.1µs | 🟢 3.5× faster |
| `set(atom, value)` | 318ns | 891ns | 🟢 2.8× faster |
| `set(atom) with 10 subs` | 410ns | 1.3µs | 🟢 3.2× faster |
| `store.get(atom)` | 37ns | 150ns | 🟢 4.0× faster |
| `sub + unsub` | 882ns | 892ns | 🟢 1.0× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 164.3µs | 100.9µs | 🔴 1.6× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 103.2µs | 54.2µs | 🔴 1.9× slower |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 759.0µs | 492.4µs | 🔴 1.5× slower |
| `subscribe + unsubscribe 100 shared selector pairs` | 1.04ms | 432.8µs | 🔴 2.4× slower |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in` | 944.8µs | 469.3µs | 🔴 2.0× slower |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in + mounted spine` | 1.79ms | 485.2µs | 🔴 3.7× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 135.3µs | 150.7µs | 🟢 1.1× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 91.9µs | 254.2µs | 🟢 2.8× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 1.33ms | 1.43ms | 🟢 1.1× faster |
| `txn: asymmetric DAG shared sink` | 27.4µs | 51.6µs | 🟢 1.9× faster |
| `txn: cross-atom 1000 selectors, set + read` | 1.68ms | 1.90ms | 🟢 1.1× faster |
| `txn: cross-atom 1000 selectors, with subs` | 989.0µs | 9.71ms | 🟢 9.8× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.21ms | 6.55ms | 🟢 2.0× faster |

<!-- BENCH:END -->
