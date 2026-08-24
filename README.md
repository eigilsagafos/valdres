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
| `atom lifecycle (create+100get+100set)` | 12.7µs | 134.5µs | 🟢 10.5× faster |
| `atom(1)` | 2ns | 48ns | 🟢 22.3× faster |
| `atomFamily: direct create + delete 500 members` | 1.12ms | 833.8µs | 🔴 1.3× slower |
| `atomFamily: direct set 500 new members` | 589.7µs | 637.6µs | 🟢 1.1× faster |
| `atomFamily: txn update 5,000 existing members` | 1.81ms | 7.18ms | 🟢 4.0× faster |
| `atomFamily(id)` | 205ns | 313ns | 🟢 1.5× faster |
| `atomFamily(id) cache hit` | 16ns | 10ns | 🔴 1.7× slower |
| `atomFamily(string) cache hit` | 28ns | 22ns | 🔴 1.3× slower |
| `create + dispose 1,000 root stores` | 494.3µs | 4.38ms | 🟢 8.9× faster |
| `createStore` | 276ns | 4.3µs | 🟢 15.5× faster |
| `get 1000 atoms` | 12.1µs | 261.4µs | 🟢 21.7× faster |
| `selector(fn)` | 6ns | 52ns | 🟢 8.3× faster |
| `selectorFamily: lookup 10,000 retained entries` | 428.9µs | 90.0µs | 🔴 4.8× slower |
| `selectorFamily(id)` | 137ns | 172ns | 🟢 1.3× faster |
| `selectorFamily(number) cache hit` | 38ns | 7ns | 🔴 5.8× slower |
| `selectorFamily(string) cache hit` | 41ns | 18ns | 🔴 2.3× slower |
| `set + read 10 selectors` | 6.8µs | 16.4µs | 🟢 2.4× faster |
| `set + read 100 selectorFamily entries` | 64.6µs | 141.8µs | 🟢 2.2× faster |
| `set + read 100 selectors` | 59.5µs | 162.9µs | 🟢 2.7× faster |
| `set + read through 5 chained selectors` | 4.2µs | 8.3µs | 🟢 2.0× faster |
| `set 1000 atoms` | 100.7µs | 606.2µs | 🟢 6.0× faster |
| `set(atom, curr => curr+1)` | 84ns | 2.1µs | 🟢 25.1× faster |
| `set(atom, value)` | 130ns | 1.1µs | 🟢 8.5× faster |
| `set(atom) with 10 subs` | 165ns | 1.7µs | 🟢 10.5× faster |
| `store.get(atom)` | 40ns | 231ns | 🟢 5.8× faster |
| `sub + unsub` | 365ns | 1.2µs | 🟢 3.4× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 91.6µs | 113.9µs | 🟢 1.2× faster |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 48.3µs | 60.3µs | 🟢 1.2× faster |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 383.6µs | 470.0µs | 🟢 1.2× faster |
| `subscribe + unsubscribe 100 shared selector pairs` | 600.3µs | 659.2µs | 🟢 1.1× faster |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in` | 534.9µs | 665.3µs | 🟢 1.2× faster |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in + mounted spine` | 1.36ms | 736.7µs | 🔴 1.9× slower |
| `traversal: 20 leaves revisited 5x each` | 9.1µs | 43.5µs | 🟢 4.8× faster |
| `txn: 10 atoms × 10 selectors, set + read` | 94.1µs | 179.4µs | 🟢 1.9× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 84.0µs | 264.8µs | 🟢 3.2× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 898.3µs | 1.46ms | 🟢 1.6× faster |
| `txn: asymmetric DAG shared sink` | 24.9µs | 56.3µs | 🟢 2.3× faster |
| `txn: cross-atom 1000 selectors, set + read` | 1.14ms | 2.25ms | 🟢 2.0× faster |
| `txn: cross-atom 1000 selectors, with subs` | 927.1µs | 10.95ms | 🟢 11.8× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 2.40ms | 7.75ms | 🟢 3.2× faster |

#### Node.js (V8)

| Operation | valdres | Jotai | |
|:----------|--------:|------:|:--|
| `atom lifecycle (create+100get+100set)` | 38.0µs | 103.4µs | 🟢 2.7× faster |
| `atom(1)` | 24ns | 51ns | 🟢 2.1× faster |
| `atomFamily: direct create + delete 500 members` | 5.23ms | 2.20ms | 🔴 2.4× slower |
| `atomFamily: direct set 500 new members` | 3.16ms | 1.60ms | 🔴 2.0× slower |
| `atomFamily: txn update 5,000 existing members` | 4.75ms | 6.01ms | 🟢 1.3× faster |
| `atomFamily(id)` | 124ns | 365ns | 🟢 2.9× faster |
| `atomFamily(id) cache hit` | 126ns | 14ns | 🔴 8.7× slower |
| `atomFamily(string) cache hit` | 33ns | 15ns | 🔴 2.2× slower |
| `create + dispose 1,000 root stores` | 1.40ms | 636.4µs | 🔴 2.2× slower |
| `createStore` | 828ns | 819ns | 🔴 1.0× slower |
| `get 1000 atoms` | 22.2µs | 153.7µs | 🟢 6.9× faster |
| `selector(fn)` | 106ns | 189ns | 🟢 1.8× faster |
| `selectorFamily: lookup 10,000 retained entries` | 1.44ms | 262.0µs | 🔴 5.5× slower |
| `selectorFamily(id)` | 1.7µs | 406ns | 🔴 4.2× slower |
| `selectorFamily(number) cache hit` | 185ns | 14ns | 🔴 12.9× slower |
| `selectorFamily(string) cache hit` | 80ns | 10ns | 🔴 7.7× slower |
| `set + read 10 selectors` | 12.6µs | 14.2µs | 🟢 1.1× faster |
| `set + read 100 selectorFamily entries` | 129.3µs | 122.5µs | 🔴 1.1× slower |
| `set + read 100 selectors` | 126.7µs | 128.1µs | 🟢 1.0× faster |
| `set + read through 5 chained selectors` | 6.9µs | 8.7µs | 🟢 1.3× faster |
| `set 1000 atoms` | 117.0µs | 333.9µs | 🟢 2.9× faster |
| `set(atom, curr => curr+1)` | 326ns | 1.2µs | 🟢 3.5× faster |
| `set(atom, value)` | 322ns | 909ns | 🟢 2.8× faster |
| `set(atom) with 10 subs` | 446ns | 1.4µs | 🟢 3.1× faster |
| `store.get(atom)` | 21ns | 112ns | 🟢 5.4× faster |
| `sub + unsub` | 988ns | 987ns | 🔴 1.0× slower |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 166.9µs | 100.0µs | 🔴 1.7× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 108.5µs | 53.2µs | 🔴 2.0× slower |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 757.7µs | 491.1µs | 🔴 1.5× slower |
| `subscribe + unsubscribe 100 shared selector pairs` | 1.03ms | 444.2µs | 🔴 2.3× slower |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in` | 910.4µs | 484.2µs | 🔴 1.9× slower |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in + mounted spine` | 1.66ms | 494.7µs | 🔴 3.4× slower |
| `traversal: 20 leaves revisited 5x each` | 11.2µs | 25.5µs | 🟢 2.3× faster |
| `txn: 10 atoms × 10 selectors, set + read` | 140.7µs | 159.5µs | 🟢 1.1× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 95.6µs | 242.1µs | 🟢 2.5× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 1.40ms | 1.44ms | 🟢 1.0× faster |
| `txn: asymmetric DAG shared sink` | 29.3µs | 50.9µs | 🟢 1.7× faster |
| `txn: cross-atom 1000 selectors, set + read` | 1.72ms | 1.95ms | 🟢 1.1× faster |
| `txn: cross-atom 1000 selectors, with subs` | 1.04ms | 9.57ms | 🟢 9.2× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.12ms | 6.64ms | 🟢 2.1× faster |

<!-- BENCH:END -->
