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
| `atom lifecycle (create+100get+100set)` | 11.9µs | 268.9µs | 🟢 22.6× faster |
| `atom(1)` | 3ns | 56ns | 🟢 21.0× faster |
| `atomFamily(id)` | 147ns | 389ns | 🟢 2.6× faster |
| `atomFamily(id) cache hit` | 10ns | 11ns | 🟢 1.1× faster |
| `createStore` | 300ns | 5.5µs | 🟢 18.3× faster |
| `get 1000 atoms` | 10.5µs | 399.1µs | 🟢 38.0× faster |
| `selector(fn)` | 5ns | 59ns | 🟢 11.8× faster |
| `selectorFamily(id)` | 137ns | 187ns | 🟢 1.4× faster |
| `set + read 10 selectors` | 10.1µs | 38.2µs | 🟢 3.8× faster |
| `set + read 100 selectorFamily entries` | 92.7µs | 277.4µs | 🟢 3.0× faster |
| `set + read 100 selectors` | 80.3µs | 362.8µs | 🟢 4.5× faster |
| `set + read through 5 chained selectors` | 8.5µs | 18.8µs | 🟢 2.2× faster |
| `set 1000 atoms` | 114.4µs | 972.9µs | 🟢 8.5× faster |
| `set(atom, curr => curr+1)` | 285ns | 3.7µs | 🟢 13.1× faster |
| `set(atom, value)` | 120ns | 4.3µs | 🟢 36.2× faster |
| `set(atom) with 10 subs` | 279ns | 4.1µs | 🟢 14.6× faster |
| `store.get(atom)` | 31ns | 371ns | 🟢 12.0× faster |
| `sub + unsub` | 514ns | 3.4µs | 🟢 6.7× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 127.4µs | 140.7µs | 🟢 1.1× faster |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 83.0µs | 106.4µs | 🟢 1.3× faster |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 553.5µs | 675.4µs | 🟢 1.2× faster |
| `txn: 10 atoms × 10 selectors, set + read` | 102.8µs | 302.0µs | 🟢 2.9× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 104.2µs | 662.4µs | 🟢 6.4× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 905.4µs | 5.62ms | 🟢 6.2× faster |
| `txn: asymmetric DAG shared sink` | 32.0µs | 180.9µs | 🟢 5.7× faster |
| `txn: cross-atom 1000 selectors, set + read` | 1.37ms | 6.15ms | 🟢 4.5× faster |
| `txn: cross-atom 1000 selectors, with subs` | 1.18ms | 29.80ms | 🟢 25.2× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 6.13ms | 22.08ms | 🟢 3.6× faster |

#### Node.js (V8)

| Operation | valdres | Jotai | |
|:----------|--------:|------:|:--|
| `atom lifecycle (create+100get+100set)` | 30.6µs | 146.5µs | 🟢 4.8× faster |
| `atom(1)` | 26ns | 52ns | 🟢 2.0× faster |
| `atomFamily(id)` | 169ns | 222ns | 🟢 1.3× faster |
| `atomFamily(id) cache hit` | 4ns | 27ns | 🟢 6.1× faster |
| `createStore` | 212ns | 2.1µs | 🟢 10.0× faster |
| `get 1000 atoms` | 15.2µs | 208.9µs | 🟢 13.7× faster |
| `selector(fn)` | 43ns | 63ns | 🟢 1.5× faster |
| `selectorFamily(id)` | 168ns | 194ns | 🟢 1.2× faster |
| `set + read 10 selectors` | 8.3µs | 20.8µs | 🟢 2.5× faster |
| `set + read 100 selectorFamily entries` | 79.8µs | 131.5µs | 🟢 1.6× faster |
| `set + read 100 selectors` | 82.3µs | 133.4µs | 🟢 1.6× faster |
| `set + read through 5 chained selectors` | 5.2µs | 10.3µs | 🟢 2.0× faster |
| `set 1000 atoms` | 101.7µs | 461.9µs | 🟢 4.5× faster |
| `set(atom, curr => curr+1)` | 300ns | 1.6µs | 🟢 5.3× faster |
| `set(atom, value)` | 281ns | 1.3µs | 🟢 4.8× faster |
| `set(atom) with 10 subs` | 380ns | 1.8µs | 🟢 4.7× faster |
| `store.get(atom)` | 19ns | 165ns | 🟢 8.8× faster |
| `sub + unsub` | 928ns | 2.6µs | 🟢 2.8× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 130.7µs | 110.6µs | 🔴 1.2× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 71.5µs | 57.8µs | 🔴 1.2× slower |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 597.7µs | 541.0µs | 🔴 1.1× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 129.8µs | 173.0µs | 🟢 1.3× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 92.6µs | 258.9µs | 🟢 2.8× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 932.7µs | 1.48ms | 🟢 1.6× faster |
| `txn: asymmetric DAG shared sink` | 26.9µs | 56.6µs | 🟢 2.1× faster |
| `txn: cross-atom 1000 selectors, set + read` | 1.15ms | 2.03ms | 🟢 1.8× faster |
| `txn: cross-atom 1000 selectors, with subs` | 1.06ms | 13.05ms | 🟢 12.3× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 4.76ms | 10.46ms | 🟢 2.2× faster |

<!-- BENCH:END -->
