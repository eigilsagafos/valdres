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
| `atom lifecycle (create+100get+100set)` | 12.1µs | 126.5µs | 🟢 10.5× faster |
| `atom(1)` | 2ns | 49ns | 🟢 21.3× faster |
| `atomFamily: direct create + delete 500 members` | 955.9µs | 808.2µs | 🔴 1.2× slower |
| `atomFamily: direct set 500 new members` | 627.0µs | 578.4µs | 🔴 1.1× slower |
| `atomFamily: txn update 5,000 existing members` | 1.77ms | 7.17ms | 🟢 4.1× faster |
| `atomFamily(id)` | 199ns | 352ns | 🟢 1.8× faster |
| `atomFamily(id) cache hit` | 16ns | 10ns | 🔴 1.6× slower |
| `atomFamily(string) cache hit` | 26ns | 21ns | 🔴 1.3× slower |
| `create + dispose 1,000 root stores` | 607.4µs | 4.43ms | 🟢 7.3× faster |
| `createStore` | 303ns | 4.3µs | 🟢 14.0× faster |
| `get 1000 atoms` | 11.5µs | 219.1µs | 🟢 19.0× faster |
| `selector(fn)` | 7ns | 55ns | 🟢 7.4× faster |
| `selectorFamily: lookup 10,000 retained entries` | 450.5µs | 72.8µs | 🔴 6.2× slower |
| `selectorFamily(id)` | 256ns | 171ns | 🔴 1.5× slower |
| `selectorFamily(number) cache hit` | 63ns | 7ns | 🔴 9.2× slower |
| `selectorFamily(string) cache hit` | 42ns | 17ns | 🔴 2.4× slower |
| `set + read 10 selectors` | 5.4µs | 16.1µs | 🟢 3.0× faster |
| `set + read 100 selectorFamily entries` | 52.0µs | 131.1µs | 🟢 2.5× faster |
| `set + read 100 selectors` | 49.3µs | 160.0µs | 🟢 3.2× faster |
| `set + read through 5 chained selectors` | 3.6µs | 7.9µs | 🟢 2.2× faster |
| `set 1000 atoms` | 96.2µs | 569.4µs | 🟢 5.9× faster |
| `set(atom, curr => curr+1)` | 86ns | 2.1µs | 🟢 24.0× faster |
| `set(atom, value)` | 131ns | 1.1µs | 🟢 8.0× faster |
| `set(atom) with 10 subs` | 161ns | 1.8µs | 🟢 11.2× faster |
| `store.get(atom)` | 40ns | 230ns | 🟢 5.8× faster |
| `sub + unsub` | 280ns | 1.3µs | 🟢 4.6× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 91.1µs | 112.4µs | 🟢 1.2× faster |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 48.2µs | 59.9µs | 🟢 1.2× faster |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 390.2µs | 462.9µs | 🟢 1.2× faster |
| `subscribe + unsubscribe 100 shared selector pairs` | 667.2µs | 633.4µs | 🔴 1.1× slower |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in` | 518.2µs | 616.7µs | 🟢 1.2× faster |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in + mounted spine` | 1.22ms | 701.2µs | 🔴 1.7× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 83.6µs | 147.0µs | 🟢 1.8× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 75.5µs | 267.6µs | 🟢 3.5× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 796.4µs | 1.64ms | 🟢 2.1× faster |
| `txn: asymmetric DAG shared sink` | 21.8µs | 66.6µs | 🟢 3.1× faster |
| `txn: cross-atom 1000 selectors, set + read` | 968.3µs | 2.51ms | 🟢 2.6× faster |
| `txn: cross-atom 1000 selectors, with subs` | 831.8µs | 10.37ms | 🟢 12.5× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 2.20ms | 7.28ms | 🟢 3.3× faster |

#### Node.js (V8)

| Operation | valdres | Jotai | |
|:----------|--------:|------:|:--|
| `atom lifecycle (create+100get+100set)` | 34.6µs | 96.2µs | 🟢 2.8× faster |
| `atom(1)` | 24ns | 50ns | 🟢 2.1× faster |
| `atomFamily: direct create + delete 500 members` | 4.99ms | 2.07ms | 🔴 2.4× slower |
| `atomFamily: direct set 500 new members` | 3.00ms | 1.52ms | 🔴 2.0× slower |
| `atomFamily: txn update 5,000 existing members` | 4.20ms | 6.14ms | 🟢 1.5× faster |
| `atomFamily(id)` | 133ns | 273ns | 🟢 2.0× faster |
| `atomFamily(id) cache hit` | 134ns | 15ns | 🔴 9.2× slower |
| `atomFamily(string) cache hit` | 31ns | 10ns | 🔴 3.0× slower |
| `create + dispose 1,000 root stores` | 1.42ms | 707.2µs | 🔴 2.0× slower |
| `createStore` | 761ns | 768ns | 🟢 1.0× faster |
| `get 1000 atoms` | 20.4µs | 154.4µs | 🟢 7.6× faster |
| `selector(fn)` | 45ns | 176ns | 🟢 3.9× faster |
| `selectorFamily: lookup 10,000 retained entries` | 1.36ms | 204.6µs | 🔴 6.7× slower |
| `selectorFamily(id)` | 1.6µs | 691ns | 🔴 2.3× slower |
| `selectorFamily(number) cache hit` | 199ns | 14ns | 🔴 13.8× slower |
| `selectorFamily(string) cache hit` | 136ns | 14ns | 🔴 9.6× slower |
| `set + read 10 selectors` | 11.6µs | 17.5µs | 🟢 1.5× faster |
| `set + read 100 selectorFamily entries` | 115.2µs | 122.9µs | 🟢 1.1× faster |
| `set + read 100 selectors` | 117.0µs | 119.5µs | 🟢 1.0× faster |
| `set + read through 5 chained selectors` | 6.4µs | 9.2µs | 🟢 1.4× faster |
| `set 1000 atoms` | 113.4µs | 312.4µs | 🟢 2.8× faster |
| `set(atom, curr => curr+1)` | 321ns | 1.0µs | 🟢 3.3× faster |
| `set(atom, value)` | 320ns | 817ns | 🟢 2.6× faster |
| `set(atom) with 10 subs` | 428ns | 1.3µs | 🟢 3.1× faster |
| `store.get(atom)` | 20ns | 114ns | 🟢 5.7× faster |
| `sub + unsub` | 899ns | 915ns | 🟢 1.0× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 166.8µs | 94.3µs | 🔴 1.8× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 101.8µs | 50.7µs | 🔴 2.0× slower |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 758.0µs | 479.3µs | 🔴 1.6× slower |
| `subscribe + unsubscribe 100 shared selector pairs` | 1.02ms | 430.1µs | 🔴 2.4× slower |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in` | 902.8µs | 457.6µs | 🔴 2.0× slower |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in + mounted spine` | 1.68ms | 488.1µs | 🔴 3.4× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 178.4µs | 153.5µs | 🔴 1.2× slower |
| `txn: 10 atoms × 10 selectors, with subs` | 126.9µs | 354.0µs | 🟢 2.8× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 1.31ms | 1.40ms | 🟢 1.1× faster |
| `txn: asymmetric DAG shared sink` | 25.4µs | 51.9µs | 🟢 2.0× faster |
| `txn: cross-atom 1000 selectors, set + read` | 1.56ms | 1.89ms | 🟢 1.2× faster |
| `txn: cross-atom 1000 selectors, with subs` | 961.6µs | 9.54ms | 🟢 9.9× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 2.96ms | 6.14ms | 🟢 2.1× faster |

<!-- BENCH:END -->
