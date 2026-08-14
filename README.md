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
| `atom lifecycle (create+100get+100set)` | 12.5µs | 197.2µs | 🟢 15.7× faster |
| `atom(1)` | 6ns | 72ns | 🟢 11.7× faster |
| `atomFamily: direct create + delete 500 members` | 2.40ms | 1.15ms | 🔴 2.1× slower |
| `atomFamily: direct set 500 new members` | 1.20ms | 849.0µs | 🔴 1.4× slower |
| `atomFamily: txn update 5,000 existing members` | 2.98ms | 8.93ms | 🟢 3.0× faster |
| `atomFamily(id)` | 259ns | 373ns | 🟢 1.4× faster |
| `atomFamily(id) cache hit` | 18ns | 11ns | 🔴 1.6× slower |
| `atomFamily(string) cache hit` | 29ns | 24ns | 🔴 1.2× slower |
| `createStore` | 439ns | 6.6µs | 🟢 15.1× faster |
| `get 1000 atoms` | 13.3µs | 647.6µs | 🟢 48.7× faster |
| `selector(fn)` | 10ns | 76ns | 🟢 7.3× faster |
| `selectorFamily(id)` | 298ns | 338ns | 🟢 1.1× faster |
| `selectorFamily(number) cache hit` | 44ns | 7ns | 🔴 6.6× slower |
| `selectorFamily(string) cache hit` | 65ns | 19ns | 🔴 3.4× slower |
| `set + read 10 selectors` | 8.0µs | 29.7µs | 🟢 3.7× faster |
| `set + read 100 selectorFamily entries` | 90.2µs | 213.2µs | 🟢 2.4× faster |
| `set + read 100 selectors` | 72.7µs | 299.9µs | 🟢 4.1× faster |
| `set + read through 5 chained selectors` | 5.5µs | 12.2µs | 🟢 2.2× faster |
| `set 1000 atoms` | 93.4µs | 762.8µs | 🟢 8.2× faster |
| `set(atom, curr => curr+1)` | 144ns | 2.5µs | 🟢 17.7× faster |
| `set(atom, value)` | 136ns | 1.5µs | 🟢 10.9× faster |
| `set(atom) with 10 subs` | 218ns | 2.4µs | 🟢 10.8× faster |
| `store.get(atom)` | 30ns | 286ns | 🟢 9.5× faster |
| `sub + unsub` | 486ns | 1.9µs | 🟢 4.0× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 122.8µs | 131.4µs | 🟢 1.1× faster |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 64.9µs | 72.3µs | 🟢 1.1× faster |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 531.3µs | 615.6µs | 🟢 1.2× faster |
| `subscribe + unsubscribe 100 shared selector pairs` | 783.4µs | 802.7µs | 🟢 1.0× faster |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in` | 692.7µs | 807.3µs | 🟢 1.2× faster |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in + mounted spine` | 1.64ms | 889.2µs | 🔴 1.8× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 111.6µs | 312.9µs | 🟢 2.8× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 109.6µs | 463.9µs | 🟢 4.2× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 997.3µs | 3.00ms | 🟢 3.0× faster |
| `txn: asymmetric DAG shared sink` | 32.0µs | 117.8µs | 🟢 3.7× faster |
| `txn: cross-atom 1000 selectors, set + read` | 1.30ms | 4.47ms | 🟢 3.4× faster |
| `txn: cross-atom 1000 selectors, with subs` | 1.26ms | 17.73ms | 🟢 14.1× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.54ms | 16.54ms | 🟢 4.7× faster |

#### Node.js (V8)

| Operation | valdres | Jotai | |
|:----------|--------:|------:|:--|
| `atom lifecycle (create+100get+100set)` | 33.0µs | 103.9µs | 🟢 3.1× faster |
| `atom(1)` | 21ns | 66ns | 🟢 3.1× faster |
| `atomFamily: direct create + delete 500 members` | 4.94ms | 794.2µs | 🔴 6.2× slower |
| `atomFamily: direct set 500 new members` | 2.89ms | 1.59ms | 🔴 1.8× slower |
| `atomFamily: txn update 5,000 existing members` | 7.01ms | 4.70ms | 🔴 1.5× slower |
| `atomFamily(id)` | 224ns | 301ns | 🟢 1.3× faster |
| `atomFamily(id) cache hit` | 168ns | 15ns | 🔴 11.2× slower |
| `atomFamily(string) cache hit` | 165ns | 32ns | 🔴 5.1× slower |
| `createStore` | 736ns | 863ns | 🟢 1.2× faster |
| `get 1000 atoms` | 20.9µs | 138.3µs | 🟢 6.6× faster |
| `selector(fn)` | 47ns | 125ns | 🟢 2.7× faster |
| `selectorFamily(id)` | 1.9µs | 294ns | 🔴 6.4× slower |
| `selectorFamily(number) cache hit` | 177ns | 31ns | 🔴 5.7× slower |
| `selectorFamily(string) cache hit` | 131ns | 10ns | 🔴 13.4× slower |
| `set + read 10 selectors` | 10.6µs | 18.7µs | 🟢 1.8× faster |
| `set + read 100 selectorFamily entries` | 101.3µs | 127.1µs | 🟢 1.3× faster |
| `set + read 100 selectors` | 100.3µs | 134.4µs | 🟢 1.3× faster |
| `set + read through 5 chained selectors` | 5.8µs | 9.2µs | 🟢 1.6× faster |
| `set 1000 atoms` | 103.4µs | 316.8µs | 🟢 3.1× faster |
| `set(atom, curr => curr+1)` | 302ns | 1.1µs | 🟢 3.5× faster |
| `set(atom, value)` | 303ns | 886ns | 🟢 2.9× faster |
| `set(atom) with 10 subs` | 384ns | 1.4µs | 🟢 3.7× faster |
| `store.get(atom)` | 24ns | 118ns | 🟢 4.9× faster |
| `sub + unsub` | 892ns | 944ns | 🟢 1.1× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 160.4µs | 110.3µs | 🔴 1.5× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 96.1µs | 60.0µs | 🔴 1.6× slower |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 739.5µs | 549.4µs | 🔴 1.3× slower |
| `subscribe + unsubscribe 100 shared selector pairs` | 983.4µs | 435.3µs | 🔴 2.3× slower |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in` | 906.3µs | 463.7µs | 🔴 2.0× slower |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in + mounted spine` | 1.66ms | 484.9µs | 🔴 3.4× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 131.0µs | 161.9µs | 🟢 1.2× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 86.7µs | 262.4µs | 🟢 3.0× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 1.15ms | 1.40ms | 🟢 1.2× faster |
| `txn: asymmetric DAG shared sink` | 28.5µs | 55.3µs | 🟢 1.9× faster |
| `txn: cross-atom 1000 selectors, set + read` | 1.57ms | 1.94ms | 🟢 1.2× faster |
| `txn: cross-atom 1000 selectors, with subs` | 1.00ms | 9.20ms | 🟢 9.2× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.25ms | 6.78ms | 🟢 2.1× faster |

<!-- BENCH:END -->
