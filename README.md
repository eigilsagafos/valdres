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
| `atom lifecycle (create+100get+100set)` | 14.1µs | 195.0µs | 🟢 13.8× faster |
| `atom(1)` | 5ns | 70ns | 🟢 14.6× faster |
| `atomFamily: direct create + delete 500 members` | 1.46ms | 1.14ms | 🔴 1.3× slower |
| `atomFamily: direct set 500 new members` | 1.03ms | 842.3µs | 🔴 1.2× slower |
| `atomFamily: txn update 5,000 existing members` | 3.12ms | 8.71ms | 🟢 2.8× faster |
| `atomFamily(id)` | 205ns | 372ns | 🟢 1.8× faster |
| `atomFamily(id) cache hit` | 17ns | 11ns | 🔴 1.6× slower |
| `atomFamily(string) cache hit` | 32ns | 24ns | 🔴 1.4× slower |
| `create + dispose 1,000 root stores` | 1.21ms | 6.13ms | 🟢 5.1× faster |
| `createStore` | 446ns | 6.6µs | 🟢 14.7× faster |
| `get 1000 atoms` | 10.3µs | 645.9µs | 🟢 62.5× faster |
| `selector(fn)` | 10ns | 75ns | 🟢 7.6× faster |
| `selectorFamily: lookup 10,000 retained entries` | 673.9µs | 92.4µs | 🔴 7.3× slower |
| `selectorFamily(id)` | 222ns | 279ns | 🟢 1.3× faster |
| `selectorFamily(number) cache hit` | 42ns | 7ns | 🔴 6.3× slower |
| `selectorFamily(string) cache hit` | 68ns | 19ns | 🔴 3.5× slower |
| `set + read 10 selectors` | 7.5µs | 30.0µs | 🟢 4.0× faster |
| `set + read 100 selectorFamily entries` | 79.9µs | 214.7µs | 🟢 2.7× faster |
| `set + read 100 selectors` | 66.4µs | 297.6µs | 🟢 4.5× faster |
| `set + read through 5 chained selectors` | 5.2µs | 12.4µs | 🟢 2.4× faster |
| `set 1000 atoms` | 93.3µs | 739.8µs | 🟢 7.9× faster |
| `set(atom, curr => curr+1)` | 143ns | 2.4µs | 🟢 16.9× faster |
| `set(atom, value)` | 138ns | 1.5µs | 🟢 10.8× faster |
| `set(atom) with 10 subs` | 239ns | 2.3µs | 🟢 9.8× faster |
| `store.get(atom)` | 27ns | 282ns | 🟢 10.4× faster |
| `sub + unsub` | 407ns | 1.9µs | 🟢 4.6× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 119.1µs | 131.6µs | 🟢 1.1× faster |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 65.3µs | 74.3µs | 🟢 1.1× faster |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 510.3µs | 637.1µs | 🟢 1.2× faster |
| `subscribe + unsubscribe 100 shared selector pairs` | 733.3µs | 790.9µs | 🟢 1.1× faster |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in` | 672.2µs | 798.6µs | 🟢 1.2× faster |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in + mounted spine` | 1.53ms | 899.4µs | 🔴 1.7× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 102.3µs | 314.4µs | 🟢 3.1× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 97.6µs | 453.7µs | 🟢 4.6× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 933.3µs | 2.97ms | 🟢 3.2× faster |
| `txn: asymmetric DAG shared sink` | 28.0µs | 116.0µs | 🟢 4.1× faster |
| `txn: cross-atom 1000 selectors, set + read` | 1.18ms | 4.42ms | 🟢 3.8× faster |
| `txn: cross-atom 1000 selectors, with subs` | 1.20ms | 17.31ms | 🟢 14.4× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.27ms | 14.52ms | 🟢 4.4× faster |

#### Node.js (V8)

| Operation | valdres | Jotai | |
|:----------|--------:|------:|:--|
| `atom lifecycle (create+100get+100set)` | 34.1µs | 100.6µs | 🟢 2.9× faster |
| `atom(1)` | 21ns | 63ns | 🟢 3.0× faster |
| `atomFamily: direct create + delete 500 members` | 4.91ms | 789.9µs | 🔴 6.2× slower |
| `atomFamily: direct set 500 new members` | 2.84ms | 1.57ms | 🔴 1.8× slower |
| `atomFamily: txn update 5,000 existing members` | 3.86ms | 6.01ms | 🟢 1.6× faster |
| `atomFamily(id)` | 253ns | 356ns | 🟢 1.4× faster |
| `atomFamily(id) cache hit` | 75ns | 18ns | 🔴 4.2× slower |
| `atomFamily(string) cache hit` | 175ns | 17ns | 🔴 10.5× slower |
| `create + dispose 1,000 root stores` | 1.48ms | 956.9µs | 🔴 1.5× slower |
| `createStore` | 883ns | 901ns | 🟢 1.0× faster |
| `get 1000 atoms` | 21.0µs | 139.2µs | 🟢 6.6× faster |
| `selector(fn)` | 40ns | 108ns | 🟢 2.7× faster |
| `selectorFamily: lookup 10,000 retained entries` | 1.15ms | 258.7µs | 🔴 4.5× slower |
| `selectorFamily(id)` | 1.8µs | 278ns | 🔴 6.5× slower |
| `selectorFamily(number) cache hit` | 183ns | 14ns | 🔴 13.2× slower |
| `selectorFamily(string) cache hit` | 60ns | 10ns | 🔴 6.2× slower |
| `set + read 10 selectors` | 10.3µs | 18.7µs | 🟢 1.8× faster |
| `set + read 100 selectorFamily entries` | 102.2µs | 129.4µs | 🟢 1.3× faster |
| `set + read 100 selectors` | 109.0µs | 136.6µs | 🟢 1.3× faster |
| `set + read through 5 chained selectors` | 5.9µs | 9.5µs | 🟢 1.6× faster |
| `set 1000 atoms` | 106.6µs | 314.5µs | 🟢 3.0× faster |
| `set(atom, curr => curr+1)` | 318ns | 1.1µs | 🟢 3.5× faster |
| `set(atom, value)` | 310ns | 939ns | 🟢 3.0× faster |
| `set(atom) with 10 subs` | 398ns | 1.4µs | 🟢 3.6× faster |
| `store.get(atom)` | 21ns | 119ns | 🟢 5.6× faster |
| `sub + unsub` | 837ns | 913ns | 🟢 1.1× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 155.0µs | 111.5µs | 🔴 1.4× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 97.8µs | 60.6µs | 🔴 1.6× slower |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 741.0µs | 567.4µs | 🔴 1.3× slower |
| `subscribe + unsubscribe 100 shared selector pairs` | 1.02ms | 434.3µs | 🔴 2.4× slower |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in` | 904.2µs | 463.2µs | 🔴 2.0× slower |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in + mounted spine` | 1.64ms | 488.4µs | 🔴 3.4× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 130.4µs | 155.1µs | 🟢 1.2× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 84.4µs | 271.6µs | 🟢 3.2× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 1.20ms | 1.56ms | 🟢 1.3× faster |
| `txn: asymmetric DAG shared sink` | 25.8µs | 54.2µs | 🟢 2.1× faster |
| `txn: cross-atom 1000 selectors, set + read` | 1.45ms | 2.00ms | 🟢 1.4× faster |
| `txn: cross-atom 1000 selectors, with subs` | 1.01ms | 9.20ms | 🟢 9.1× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.08ms | 6.61ms | 🟢 2.1× faster |

<!-- BENCH:END -->
