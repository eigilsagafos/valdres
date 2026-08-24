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

The repo is currently in `beta` prerelease mode (`bunx changeset pre exit` to graduate to stable). While in prerelease mode, changesets that have already been versioned into a `beta` release move to `.changeset/pre/`, where they stay until the stable release consumes them — leave them alone unless a change genuinely no longer applies.

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
| `atom lifecycle (create+100get+100set)` | 12.0µs | 131.9µs | 🟢 11.0× faster |
| `atom(1)` | 2ns | 50ns | 🟢 21.2× faster |
| `atomFamily: direct create + delete 500 members` | 924.8µs | 812.8µs | 🔴 1.1× slower |
| `atomFamily: direct set 500 new members` | 580.0µs | 612.3µs | 🟢 1.1× faster |
| `atomFamily: txn update 5,000 existing members` | 1.62ms | 6.86ms | 🟢 4.2× faster |
| `atomFamily(id)` | 161ns | 269ns | 🟢 1.7× faster |
| `atomFamily(id) cache hit` | 17ns | 10ns | 🔴 1.6× slower |
| `atomFamily(string) cache hit` | 27ns | 21ns | 🔴 1.3× slower |
| `create + dispose 1,000 root stores` | 575.4µs | 3.98ms | 🟢 6.9× faster |
| `createStore` | 324ns | 4.1µs | 🟢 12.8× faster |
| `get 1000 atoms` | 11.7µs | 319.1µs | 🟢 27.3× faster |
| `selector(fn)` | 7ns | 56ns | 🟢 8.0× faster |
| `selectorFamily: lookup 10,000 retained entries` | 456.2µs | 73.3µs | 🔴 6.2× slower |
| `selectorFamily(id)` | 157ns | 167ns | 🟢 1.1× faster |
| `selectorFamily(number) cache hit` | 63ns | 7ns | 🔴 8.9× slower |
| `selectorFamily(string) cache hit` | 42ns | 18ns | 🔴 2.4× slower |
| `set + read 10 selectors` | 5.9µs | 15.8µs | 🟢 2.7× faster |
| `set + read 100 selectorFamily entries` | 58.7µs | 136.9µs | 🟢 2.3× faster |
| `set + read 100 selectors` | 49.1µs | 163.9µs | 🟢 3.3× faster |
| `set + read through 5 chained selectors` | 3.8µs | 8.1µs | 🟢 2.1× faster |
| `set 1000 atoms` | 96.7µs | 585.8µs | 🟢 6.1× faster |
| `set(atom, curr => curr+1)` | 84ns | 2.1µs | 🟢 24.7× faster |
| `set(atom, value)` | 130ns | 1.1µs | 🟢 8.2× faster |
| `set(atom) with 10 subs` | 161ns | 1.8µs | 🟢 10.9× faster |
| `store.get(atom)` | 40ns | 240ns | 🟢 6.0× faster |
| `sub + unsub` | 310ns | 1.2µs | 🟢 3.9× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 85.9µs | 112.7µs | 🟢 1.3× faster |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 44.5µs | 60.5µs | 🟢 1.4× faster |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 375.0µs | 468.8µs | 🟢 1.2× faster |
| `subscribe + unsubscribe 100 shared selector pairs` | 555.0µs | 610.0µs | 🟢 1.1× faster |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in` | 477.5µs | 627.7µs | 🟢 1.3× faster |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in + mounted spine` | 1.21ms | 724.4µs | 🔴 1.7× slower |
| `traversal: 20 leaves revisited 5x each` | 8.8µs | 42.3µs | 🟢 4.8× faster |
| `txn: 10 atoms × 10 selectors, set + read` | 86.9µs | 174.3µs | 🟢 2.0× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 72.3µs | 223.2µs | 🟢 3.1× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 811.5µs | 1.46ms | 🟢 1.8× faster |
| `txn: asymmetric DAG shared sink` | 21.3µs | 55.8µs | 🟢 2.6× faster |
| `txn: cross-atom 1000 selectors, set + read` | 940.0µs | 2.16ms | 🟢 2.3× faster |
| `txn: cross-atom 1000 selectors, with subs` | 801.4µs | 10.06ms | 🟢 12.5× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 2.05ms | 7.34ms | 🟢 3.6× faster |

#### Node.js (V8)

| Operation | valdres | Jotai | |
|:----------|--------:|------:|:--|
| `atom lifecycle (create+100get+100set)` | 35.2µs | 100.5µs | 🟢 2.9× faster |
| `atom(1)` | 25ns | 50ns | 🟢 2.0× faster |
| `atomFamily: direct create + delete 500 members` | 4.73ms | 789.2µs | 🔴 6.0× slower |
| `atomFamily: direct set 500 new members` | 2.90ms | 1.54ms | 🔴 1.9× slower |
| `atomFamily: txn update 5,000 existing members` | 4.76ms | 7.64ms | 🟢 1.6× faster |
| `atomFamily(id)` | 147ns | 241ns | 🟢 1.6× faster |
| `atomFamily(id) cache hit` | 131ns | 22ns | 🔴 6.1× slower |
| `atomFamily(string) cache hit` | 31ns | 11ns | 🔴 2.9× slower |
| `create + dispose 1,000 root stores` | 1.37ms | 616.4µs | 🔴 2.2× slower |
| `createStore` | 750ns | 862ns | 🟢 1.1× faster |
| `get 1000 atoms` | 20.2µs | 154.0µs | 🟢 7.6× faster |
| `selector(fn)` | 115ns | 113ns | 🔴 1.0× slower |
| `selectorFamily: lookup 10,000 retained entries` | 1.40ms | 375.4µs | 🔴 3.7× slower |
| `selectorFamily(id)` | 250ns | 460ns | 🟢 1.8× faster |
| `selectorFamily(number) cache hit` | 156ns | 15ns | 🔴 10.6× slower |
| `selectorFamily(string) cache hit` | 101ns | 11ns | 🔴 9.3× slower |
| `set + read 10 selectors` | 11.7µs | 13.8µs | 🟢 1.2× faster |
| `set + read 100 selectorFamily entries` | 118.3µs | 121.4µs | 🟢 1.0× faster |
| `set + read 100 selectors` | 114.4µs | 128.3µs | 🟢 1.1× faster |
| `set + read through 5 chained selectors` | 6.6µs | 9.6µs | 🟢 1.4× faster |
| `set 1000 atoms` | 115.1µs | 314.3µs | 🟢 2.7× faster |
| `set(atom, curr => curr+1)` | 318ns | 1.1µs | 🟢 3.5× faster |
| `set(atom, value)` | 317ns | 891ns | 🟢 2.8× faster |
| `set(atom) with 10 subs` | 414ns | 1.4µs | 🟢 3.3× faster |
| `store.get(atom)` | 21ns | 124ns | 🟢 6.0× faster |
| `sub + unsub` | 891ns | 904ns | 🟢 1.0× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 161.0µs | 94.8µs | 🔴 1.7× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 102.6µs | 51.5µs | 🔴 2.0× slower |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 792.0µs | 472.0µs | 🔴 1.7× slower |
| `subscribe + unsubscribe 100 shared selector pairs` | 1.02ms | 425.5µs | 🔴 2.4× slower |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in` | 915.9µs | 470.4µs | 🔴 1.9× slower |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in + mounted spine` | 1.70ms | 478.5µs | 🔴 3.6× slower |
| `traversal: 20 leaves revisited 5x each` | 10.2µs | 24.2µs | 🟢 2.4× faster |
| `txn: 10 atoms × 10 selectors, set + read` | 132.2µs | 158.3µs | 🟢 1.2× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 86.4µs | 232.4µs | 🟢 2.7× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 1.31ms | 1.40ms | 🟢 1.1× faster |
| `txn: asymmetric DAG shared sink` | 25.7µs | 51.5µs | 🟢 2.0× faster |
| `txn: cross-atom 1000 selectors, set + read` | 1.60ms | 1.89ms | 🟢 1.2× faster |
| `txn: cross-atom 1000 selectors, with subs` | 1.00ms | 9.60ms | 🟢 9.6× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.03ms | 6.36ms | 🟢 2.1× faster |

<!-- BENCH:END -->
