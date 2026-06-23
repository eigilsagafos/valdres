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
| `atom lifecycle (create+100get+100set)` | 6.5µs | 149.9µs | 🟢 23.0× faster |
| `atom(1)` | 1ns | 38ns | 🟢 27.4× faster |
| `atomFamily(id)` | 84ns | 193ns | 🟢 2.3× faster |
| `atomFamily(id) cache hit` | 5ns | 6ns | 🟢 1.3× faster |
| `createStore` | 148ns | 3.8µs | 🟢 25.9× faster |
| `get 1000 atoms` | 5.7µs | 318.1µs | 🟢 56.1× faster |
| `selector(fn)` | 3ns | 39ns | 🟢 14.6× faster |
| `selectorFamily(id)` | 111ns | 125ns | 🟢 1.1× faster |
| `set + read 10 selectors` | 6.0µs | 20.5µs | 🟢 3.4× faster |
| `set + read 100 selectorFamily entries` | 48.0µs | 180.4µs | 🟢 3.8× faster |
| `set + read 100 selectors` | 43.1µs | 152.0µs | 🟢 3.5× faster |
| `set + read through 5 chained selectors` | 3.8µs | 7.6µs | 🟢 2.0× faster |
| `set 1000 atoms` | 57.0µs | 515.8µs | 🟢 9.0× faster |
| `set(atom, curr => curr+1)` | 48ns | 2.0µs | 🟢 42.5× faster |
| `set(atom, value)` | 64ns | 2.9µs | 🟢 45.7× faster |
| `set(atom) with 10 subs` | 92ns | 2.5µs | 🟢 27.6× faster |
| `store.get(atom)` | 20ns | 191ns | 🟢 9.6× faster |
| `sub + unsub` | 152ns | 2.1µs | 🟢 13.6× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 66.4µs | 98.0µs | 🟢 1.5× faster |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 46.7µs | 52.9µs | 🟢 1.1× faster |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 301.3µs | 449.6µs | 🟢 1.5× faster |
| `txn: 10 atoms × 10 selectors, set + read` | 44.4µs | 195.3µs | 🟢 4.4× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 54.1µs | 330.4µs | 🟢 6.1× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 389.2µs | 1.85ms | 🟢 4.7× faster |
| `txn: asymmetric DAG shared sink` | 14.8µs | 62.4µs | 🟢 4.2× faster |
| `txn: cross-atom 1000 selectors, set + read` | 500.5µs | 2.41ms | 🟢 4.8× faster |
| `txn: cross-atom 1000 selectors, with subs` | 740.5µs | 13.11ms | 🟢 17.7× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.08ms | 10.25ms | 🟢 3.3× faster |

#### Node.js (V8)

| Operation | valdres | Jotai | |
|:----------|--------:|------:|:--|
| `atom lifecycle (create+100get+100set)` | 15.7µs | 80.4µs | 🟢 5.1× faster |
| `atom(1)` | 15ns | 25ns | 🟢 1.7× faster |
| `atomFamily(id)` | 188ns | 176ns | 🔴 1.1× slower |
| `atomFamily(id) cache hit` | 3ns | 13ns | 🟢 4.9× faster |
| `createStore` | 166ns | 778ns | 🟢 4.7× faster |
| `get 1000 atoms` | 8.8µs | 108.7µs | 🟢 12.4× faster |
| `selector(fn)` | 23ns | 26ns | 🟢 1.2× faster |
| `selectorFamily(id)` | 157ns | 186ns | 🟢 1.2× faster |
| `set + read 10 selectors` | 4.6µs | 11.1µs | 🟢 2.4× faster |
| `set + read 100 selectorFamily entries` | 49.3µs | 80.1µs | 🟢 1.6× faster |
| `set + read 100 selectors` | 51.8µs | 74.3µs | 🟢 1.4× faster |
| `set + read through 5 chained selectors` | 2.8µs | 5.9µs | 🟢 2.1× faster |
| `set 1000 atoms` | 53.6µs | 224.0µs | 🟢 4.2× faster |
| `set(atom, curr => curr+1)` | 133ns | 881ns | 🟢 6.6× faster |
| `set(atom, value)` | 137ns | 687ns | 🟢 5.0× faster |
| `set(atom) with 10 subs` | 158ns | 986ns | 🟢 6.2× faster |
| `store.get(atom)` | 9ns | 110ns | 🟢 11.8× faster |
| `sub + unsub` | 379ns | 1.3µs | 🟢 3.3× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 73.3µs | 58.6µs | 🔴 1.3× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 40.6µs | 73.4µs | 🟢 1.8× faster |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 325.0µs | 281.2µs | 🔴 1.2× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 50.6µs | 88.2µs | 🟢 1.7× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 47.0µs | 140.1µs | 🟢 3.0× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 489.1µs | 764.8µs | 🟢 1.6× faster |
| `txn: asymmetric DAG shared sink` | 14.2µs | 37.5µs | 🟢 2.7× faster |
| `txn: cross-atom 1000 selectors, set + read` | 617.7µs | 1.01ms | 🟢 1.6× faster |
| `txn: cross-atom 1000 selectors, with subs` | 583.8µs | 7.07ms | 🟢 12.1× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 2.71ms | 5.38ms | 🟢 2.0× faster |

<!-- BENCH:END -->
