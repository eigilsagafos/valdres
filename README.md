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
| `atom lifecycle (create+100get+100set)` | 12.7µs | 200.4µs | 🟢 15.7× faster |
| `atom(1)` | 2ns | 54ns | 🟢 22.4× faster |
| `atomFamily: direct create + delete 500 members` | 2.03ms | 1.18ms | 🔴 1.7× slower |
| `atomFamily: direct set 500 new members` | 1.26ms | 844.6µs | 🔴 1.5× slower |
| `atomFamily: txn update 5,000 existing members` | 2.86ms | 9.26ms | 🟢 3.2× faster |
| `atomFamily(id)` | 208ns | 235ns | 🟢 1.1× faster |
| `atomFamily(id) cache hit` | 16ns | 11ns | 🔴 1.5× slower |
| `atomFamily(string) cache hit` | 33ns | 24ns | 🔴 1.4× slower |
| `createStore` | 345ns | 5.3µs | 🟢 15.5× faster |
| `get 1000 atoms` | 12.6µs | 761.5µs | 🟢 60.7× faster |
| `selector(fn)` | 6ns | 56ns | 🟢 8.9× faster |
| `selectorFamily(id)` | 242ns | 205ns | 🔴 1.2× slower |
| `selectorFamily(number) cache hit` | 40ns | 8ns | 🔴 5.1× slower |
| `selectorFamily(string) cache hit` | 48ns | 21ns | 🔴 2.4× slower |
| `set + read 10 selectors` | 8.4µs | 30.6µs | 🟢 3.7× faster |
| `set + read 100 selectorFamily entries` | 94.5µs | 220.0µs | 🟢 2.3× faster |
| `set + read 100 selectors` | 75.6µs | 344.2µs | 🟢 4.6× faster |
| `set + read through 5 chained selectors` | 5.9µs | 12.5µs | 🟢 2.1× faster |
| `set 1000 atoms` | 97.2µs | 765.4µs | 🟢 7.9× faster |
| `set(atom, curr => curr+1)` | 140ns | 2.4µs | 🟢 17.2× faster |
| `set(atom, value)` | 140ns | 1.7µs | 🟢 11.8× faster |
| `set(atom) with 10 subs` | 220ns | 2.4µs | 🟢 11.0× faster |
| `store.get(atom)` | 40ns | 291ns | 🟢 7.3× faster |
| `sub + unsub` | 699ns | 1.9µs | 🟢 2.8× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 127.4µs | 120.8µs | 🔴 1.1× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 69.0µs | 68.6µs | 🔴 1.0× slower |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 547.3µs | 579.6µs | 🟢 1.1× faster |
| `subscribe + unsubscribe 100 shared selector pairs` | 790.1µs | 786.8µs | 🔴 1.0× slower |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in` | 691.6µs | 809.3µs | 🟢 1.2× faster |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in + mounted spine` | 1.64ms | 877.8µs | 🔴 1.9× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 118.8µs | 347.9µs | 🟢 2.9× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 105.5µs | 538.3µs | 🟢 5.1× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 1.13ms | 3.33ms | 🟢 3.0× faster |
| `txn: asymmetric DAG shared sink` | 31.9µs | 130.4µs | 🟢 4.1× faster |
| `txn: cross-atom 1000 selectors, set + read` | 1.42ms | 4.93ms | 🟢 3.5× faster |
| `txn: cross-atom 1000 selectors, with subs` | 1.15ms | 18.12ms | 🟢 15.7× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.30ms | 16.53ms | 🟢 5.0× faster |

#### Node.js (V8)

| Operation | valdres | Jotai | |
|:----------|--------:|------:|:--|
| `atom lifecycle (create+100get+100set)` | 36.6µs | 104.8µs | 🟢 2.9× faster |
| `atom(1)` | 24ns | 52ns | 🟢 2.2× faster |
| `atomFamily: direct create + delete 500 members` | 4.24ms | 1.41ms | 🔴 3.0× slower |
| `atomFamily: direct set 500 new members` | 3.11ms | 1.62ms | 🔴 1.9× slower |
| `atomFamily: txn update 5,000 existing members` | 5.58ms | 6.23ms | 🟢 1.1× faster |
| `atomFamily(id)` | 255ns | 329ns | 🟢 1.3× faster |
| `atomFamily(id) cache hit` | 137ns | 14ns | 🔴 9.5× slower |
| `atomFamily(string) cache hit` | 165ns | 27ns | 🔴 6.1× slower |
| `createStore` | 629ns | 615ns | 🔴 1.0× slower |
| `get 1000 atoms` | 22.3µs | 154.6µs | 🟢 6.9× faster |
| `selector(fn)` | 52ns | 63ns | 🟢 1.2× faster |
| `selectorFamily(id)` | 259ns | 576ns | 🟢 2.2× faster |
| `selectorFamily(number) cache hit` | 164ns | 13ns | 🔴 12.6× slower |
| `selectorFamily(string) cache hit` | 92ns | 10ns | 🔴 8.9× slower |
| `set + read 10 selectors` | 12.5µs | 17.0µs | 🟢 1.4× faster |
| `set + read 100 selectorFamily entries` | 124.6µs | 124.1µs | 🔴 1.0× slower |
| `set + read 100 selectors` | 122.7µs | 124.3µs | 🟢 1.0× faster |
| `set + read through 5 chained selectors` | 6.8µs | 8.9µs | 🟢 1.3× faster |
| `set 1000 atoms` | 113.2µs | 334.4µs | 🟢 3.0× faster |
| `set(atom, curr => curr+1)` | 331ns | 1.1µs | 🟢 3.2× faster |
| `set(atom, value)` | 328ns | 912ns | 🟢 2.8× faster |
| `set(atom) with 10 subs` | 414ns | 1.3µs | 🟢 3.2× faster |
| `store.get(atom)` | 23ns | 150ns | 🟢 6.4× faster |
| `sub + unsub` | 965ns | 977ns | 🟢 1.0× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 168.2µs | 99.8µs | 🔴 1.7× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 106.1µs | 52.3µs | 🔴 2.0× slower |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 785.3µs | 509.8µs | 🔴 1.5× slower |
| `subscribe + unsubscribe 100 shared selector pairs` | 1.04ms | 445.9µs | 🔴 2.3× slower |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in` | 920.0µs | 479.0µs | 🔴 1.9× slower |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in + mounted spine` | 1.66ms | 506.0µs | 🔴 3.3× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 143.5µs | 157.0µs | 🟢 1.1× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 96.7µs | 255.2µs | 🟢 2.6× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 1.41ms | 1.40ms | 🔴 1.0× slower |
| `txn: asymmetric DAG shared sink` | 28.8µs | 51.9µs | 🟢 1.8× faster |
| `txn: cross-atom 1000 selectors, set + read` | 1.70ms | 1.92ms | 🟢 1.1× faster |
| `txn: cross-atom 1000 selectors, with subs` | 1.04ms | 9.44ms | 🟢 9.1× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.20ms | 6.49ms | 🟢 2.0× faster |

<!-- BENCH:END -->
