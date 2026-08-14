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
| `atom lifecycle (create+100get+100set)` | 12.3µs | 199.9µs | 🟢 16.2× faster |
| `atom(1)` | 2ns | 54ns | 🟢 21.6× faster |
| `atomFamily: direct create + delete 500 members` | 2.75ms | 1.20ms | 🔴 2.3× slower |
| `atomFamily: direct set 500 new members` | 1.31ms | 849.5µs | 🔴 1.5× slower |
| `atomFamily: txn update 5,000 existing members` | 2.72ms | 9.29ms | 🟢 3.4× faster |
| `atomFamily(id)` | 213ns | 243ns | 🟢 1.1× faster |
| `atomFamily(id) cache hit` | 16ns | 11ns | 🔴 1.5× slower |
| `atomFamily(string) cache hit` | 30ns | 24ns | 🔴 1.3× slower |
| `createStore` | 351ns | 5.5µs | 🟢 15.6× faster |
| `get 1000 atoms` | 13.0µs | 763.8µs | 🟢 58.8× faster |
| `selector(fn)` | 6ns | 56ns | 🟢 9.2× faster |
| `selectorFamily(id)` | 211ns | 197ns | 🔴 1.1× slower |
| `selectorFamily(number) cache hit` | 39ns | 8ns | 🔴 5.0× slower |
| `selectorFamily(string) cache hit` | 48ns | 20ns | 🔴 2.4× slower |
| `set + read 10 selectors` | 8.4µs | 30.8µs | 🟢 3.7× faster |
| `set + read 100 selectorFamily entries` | 97.5µs | 222.9µs | 🟢 2.3× faster |
| `set + read 100 selectors` | 74.8µs | 340.9µs | 🟢 4.6× faster |
| `set + read through 5 chained selectors` | 6.0µs | 12.9µs | 🟢 2.1× faster |
| `set 1000 atoms` | 102.7µs | 763.8µs | 🟢 7.4× faster |
| `set(atom, curr => curr+1)` | 138ns | 2.6µs | 🟢 18.6× faster |
| `set(atom, value)` | 150ns | 1.6µs | 🟢 10.5× faster |
| `set(atom) with 10 subs` | 210ns | 2.4µs | 🟢 11.3× faster |
| `store.get(atom)` | 40ns | 291ns | 🟢 7.3× faster |
| `sub + unsub` | 419ns | 2.0µs | 🟢 4.8× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 125.0µs | 121.4µs | 🔴 1.0× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 68.2µs | 67.6µs | 🔴 1.0× slower |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 518.1µs | 581.7µs | 🟢 1.1× faster |
| `subscribe + unsubscribe 100 shared selector pairs` | 790.2µs | 798.4µs | 🟢 1.0× faster |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in` | 710.5µs | 804.3µs | 🟢 1.1× faster |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in + mounted spine` | 1.60ms | 884.7µs | 🔴 1.8× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 120.6µs | 344.2µs | 🟢 2.9× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 107.9µs | 538.6µs | 🟢 5.0× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 1.14ms | 3.32ms | 🟢 2.9× faster |
| `txn: asymmetric DAG shared sink` | 32.3µs | 129.7µs | 🟢 4.0× faster |
| `txn: cross-atom 1000 selectors, set + read` | 1.38ms | 4.90ms | 🟢 3.5× faster |
| `txn: cross-atom 1000 selectors, with subs` | 1.11ms | 18.16ms | 🟢 16.4× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.33ms | 16.51ms | 🟢 5.0× faster |

#### Node.js (V8)

| Operation | valdres | Jotai | |
|:----------|--------:|------:|:--|
| `atom lifecycle (create+100get+100set)` | 37.1µs | 105.7µs | 🟢 2.9× faster |
| `atom(1)` | 24ns | 38ns | 🟢 1.6× faster |
| `atomFamily: direct create + delete 500 members` | 7.64ms | 1.33ms | 🔴 5.7× slower |
| `atomFamily: direct set 500 new members` | 3.05ms | 1.59ms | 🔴 1.9× slower |
| `atomFamily: txn update 5,000 existing members` | 4.25ms | 7.63ms | 🟢 1.8× faster |
| `atomFamily(id)` | 252ns | 336ns | 🟢 1.3× faster |
| `atomFamily(id) cache hit` | 139ns | 14ns | 🔴 9.7× slower |
| `atomFamily(string) cache hit` | 145ns | 15ns | 🔴 9.7× slower |
| `createStore` | 622ns | 833ns | 🟢 1.3× faster |
| `get 1000 atoms` | 22.2µs | 154.1µs | 🟢 6.9× faster |
| `selector(fn)` | 50ns | 63ns | 🟢 1.3× faster |
| `selectorFamily(id)` | 1.3µs | 412ns | 🔴 3.1× slower |
| `selectorFamily(number) cache hit` | 186ns | 13ns | 🔴 14.2× slower |
| `selectorFamily(string) cache hit` | 93ns | 10ns | 🔴 8.9× slower |
| `set + read 10 selectors` | 12.7µs | 17.2µs | 🟢 1.4× faster |
| `set + read 100 selectorFamily entries` | 126.1µs | 134.8µs | 🟢 1.1× faster |
| `set + read 100 selectors` | 124.8µs | 123.6µs | 🔴 1.0× slower |
| `set + read through 5 chained selectors` | 6.8µs | 9.9µs | 🟢 1.4× faster |
| `set 1000 atoms` | 114.7µs | 334.4µs | 🟢 2.9× faster |
| `set(atom, curr => curr+1)` | 323ns | 1.1µs | 🟢 3.4× faster |
| `set(atom, value)` | 319ns | 924ns | 🟢 2.9× faster |
| `set(atom) with 10 subs` | 430ns | 1.3µs | 🟢 3.0× faster |
| `store.get(atom)` | 23ns | 146ns | 🟢 6.3× faster |
| `sub + unsub` | 964ns | 1.0µs | 🟢 1.0× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 167.7µs | 102.7µs | 🔴 1.6× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 107.1µs | 87.1µs | 🔴 1.2× slower |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 783.0µs | 508.3µs | 🔴 1.5× slower |
| `subscribe + unsubscribe 100 shared selector pairs` | 1.03ms | 447.3µs | 🔴 2.3× slower |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in` | 932.6µs | 483.1µs | 🔴 1.9× slower |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in + mounted spine` | 1.71ms | 502.9µs | 🔴 3.4× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 151.0µs | 161.3µs | 🟢 1.1× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 98.8µs | 260.2µs | 🟢 2.6× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 1.42ms | 1.45ms | 🟢 1.0× faster |
| `txn: asymmetric DAG shared sink` | 28.8µs | 51.5µs | 🟢 1.8× faster |
| `txn: cross-atom 1000 selectors, set + read` | 1.73ms | 1.91ms | 🟢 1.1× faster |
| `txn: cross-atom 1000 selectors, with subs` | 1.07ms | 9.63ms | 🟢 9.0× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.19ms | 6.55ms | 🟢 2.1× faster |

<!-- BENCH:END -->
