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
| `atom lifecycle (create+100get+100set)` | 7.6µs | 105.3µs | 🟢 13.8× faster |
| `atom(1)` | 2ns | 43ns | 🟢 19.8× faster |
| `atomFamily: direct create + delete 500 members` | 825.0µs | 671.1µs | 🔴 1.2× slower |
| `atomFamily: direct set 500 new members` | 590.5µs | 463.7µs | 🔴 1.3× slower |
| `atomFamily: txn update 5,000 existing members` | 1.92ms | 6.08ms | 🟢 3.2× faster |
| `atomFamily(id)` | 189ns | 288ns | 🟢 1.5× faster |
| `atomFamily(id) cache hit` | 10ns | 6ns | 🔴 1.6× slower |
| `atomFamily(string) cache hit` | 18ns | 16ns | 🔴 1.2× slower |
| `createStore` | 244ns | 4.8µs | 🟢 19.8× faster |
| `get 1000 atoms` | 5.7µs | 235.3µs | 🟢 41.3× faster |
| `selector(fn)` | 5ns | 45ns | 🟢 8.7× faster |
| `selectorFamily(id)` | 193ns | 268ns | 🟢 1.4× faster |
| `selectorFamily(number) cache hit` | 28ns | 4ns | 🔴 6.4× slower |
| `selectorFamily(string) cache hit` | 45ns | 13ns | 🔴 3.6× slower |
| `set + read 10 selectors` | 4.8µs | 17.0µs | 🟢 3.5× faster |
| `set + read 100 selectorFamily entries` | 44.4µs | 108.7µs | 🟢 2.4× faster |
| `set + read 100 selectors` | 42.4µs | 160.0µs | 🟢 3.8× faster |
| `set + read through 5 chained selectors` | 3.1µs | 6.5µs | 🟢 2.1× faster |
| `set 1000 atoms` | 64.1µs | 443.9µs | 🟢 6.9× faster |
| `set(atom, curr => curr+1)` | 65ns | 1.2µs | 🟢 19.0× faster |
| `set(atom, value)` | 89ns | 798ns | 🟢 9.0× faster |
| `set(atom) with 10 subs` | 127ns | 1.4µs | 🟢 10.8× faster |
| `store.get(atom)` | 24ns | 175ns | 🟢 7.3× faster |
| `sub + unsub` | 224ns | 894ns | 🟢 4.0× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 66.4µs | 88.9µs | 🟢 1.3× faster |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 39.4µs | 49.4µs | 🟢 1.3× faster |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 321.8µs | 432.8µs | 🟢 1.3× faster |
| `subscribe + unsubscribe 100 shared selector pairs` | 455.5µs | 458.4µs | 🟢 1.0× faster |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in` | 430.0µs | 486.9µs | 🟢 1.1× faster |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in + mounted spine` | 924.8µs | 550.9µs | 🔴 1.7× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 61.0µs | 121.0µs | 🟢 2.0× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 59.6µs | 260.0µs | 🟢 4.4× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 571.9µs | 1.10ms | 🟢 1.9× faster |
| `txn: asymmetric DAG shared sink` | 18.3µs | 53.9µs | 🟢 3.0× faster |
| `txn: cross-atom 1000 selectors, set + read` | 745.5µs | 1.71ms | 🟢 2.3× faster |
| `txn: cross-atom 1000 selectors, with subs` | 772.2µs | 10.06ms | 🟢 13.0× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 2.37ms | 8.30ms | 🟢 3.5× faster |

#### Node.js (V8)

| Operation | valdres | Jotai | |
|:----------|--------:|------:|:--|
| `atom lifecycle (create+100get+100set)` | 24.0µs | 71.3µs | 🟢 3.0× faster |
| `atom(1)` | 20ns | 43ns | 🟢 2.1× faster |
| `atomFamily: direct create + delete 500 members` | 3.25ms | 1.41ms | 🔴 2.3× slower |
| `atomFamily: direct set 500 new members` | 1.76ms | 1.03ms | 🔴 1.7× slower |
| `atomFamily: txn update 5,000 existing members` | 2.75ms | 3.19ms | 🟢 1.2× faster |
| `atomFamily(id)` | 193ns | 228ns | 🟢 1.2× faster |
| `atomFamily(id) cache hit` | 75ns | 14ns | 🔴 5.4× slower |
| `atomFamily(string) cache hit` | 100ns | 14ns | 🔴 7.3× slower |
| `createStore` | 650ns | 803ns | 🟢 1.2× faster |
| `get 1000 atoms` | 13.9µs | 102.5µs | 🟢 7.4× faster |
| `selector(fn)` | 27ns | 131ns | 🟢 4.9× faster |
| `selectorFamily(id)` | 927ns | 298ns | 🔴 3.1× slower |
| `selectorFamily(number) cache hit` | 98ns | 10ns | 🔴 9.5× slower |
| `selectorFamily(string) cache hit` | 70ns | 9ns | 🔴 7.6× slower |
| `set + read 10 selectors` | 7.6µs | 8.3µs | 🟢 1.1× faster |
| `set + read 100 selectorFamily entries` | 64.5µs | 82.0µs | 🟢 1.3× faster |
| `set + read 100 selectors` | 67.7µs | 71.2µs | 🟢 1.1× faster |
| `set + read through 5 chained selectors` | 4.3µs | 6.6µs | 🟢 1.5× faster |
| `set 1000 atoms` | 75.3µs | 201.3µs | 🟢 2.7× faster |
| `set(atom, curr => curr+1)` | 197ns | 745ns | 🟢 3.8× faster |
| `set(atom, value)` | 192ns | 585ns | 🟢 3.0× faster |
| `set(atom) with 10 subs` | 249ns | 885ns | 🟢 3.5× faster |
| `store.get(atom)` | 14ns | 94ns | 🟢 6.8× faster |
| `sub + unsub` | 623ns | 626ns | 🟢 1.0× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 103.8µs | 68.7µs | 🔴 1.5× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 61.8µs | 66.1µs | 🟢 1.1× faster |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 484.1µs | 351.7µs | 🔴 1.4× slower |
| `subscribe + unsubscribe 100 shared selector pairs` | 650.4µs | 299.1µs | 🔴 2.2× slower |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in` | 618.3µs | 321.4µs | 🔴 1.9× slower |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in + mounted spine` | 1.16ms | 336.2µs | 🔴 3.4× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 88.4µs | 92.7µs | 🟢 1.0× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 62.7µs | 169.2µs | 🟢 2.7× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 724.8µs | 750.3µs | 🟢 1.0× faster |
| `txn: asymmetric DAG shared sink` | 16.4µs | 39.0µs | 🟢 2.4× faster |
| `txn: cross-atom 1000 selectors, set + read` | 959.0µs | 1.05ms | 🟢 1.1× faster |
| `txn: cross-atom 1000 selectors, with subs` | 654.7µs | 5.57ms | 🟢 8.5× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 2.13ms | 4.19ms | 🟢 2.0× faster |

<!-- BENCH:END -->
