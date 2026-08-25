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
| `atom lifecycle (create+100get+100set)` | 12.1µs | 129.6µs | 🟢 10.7× faster |
| `atom(1)` | 2ns | 50ns | 🟢 21.4× faster |
| `atomFamily: direct create + delete 500 members` | 920.9µs | 800.7µs | 🔴 1.2× slower |
| `atomFamily: direct set 500 new members` | 566.7µs | 588.5µs | 🟢 1.0× faster |
| `atomFamily: txn update 5,000 existing members` | 1.70ms | 7.12ms | 🟢 4.2× faster |
| `atomFamily(id)` | 218ns | 317ns | 🟢 1.5× faster |
| `atomFamily(id) cache hit` | 17ns | 11ns | 🔴 1.6× slower |
| `atomFamily(string) cache hit` | 27ns | 21ns | 🔴 1.3× slower |
| `create + dispose 1,000 root stores` | 587.8µs | 4.02ms | 🟢 6.8× faster |
| `createStore` | 294ns | 4.1µs | 🟢 14.1× faster |
| `get 1000 atoms` | 12.2µs | 270.3µs | 🟢 22.2× faster |
| `selector(fn)` | 7ns | 54ns | 🟢 7.8× faster |
| `selectorFamily: lookup 10,000 retained entries` | 215.0µs | 73.1µs | 🔴 2.9× slower |
| `selectorFamily(id)` | 237ns | 172ns | 🔴 1.4× slower |
| `selectorFamily(number) cache hit` | 9ns | 7ns | 🔴 1.2× slower |
| `selectorFamily(string) cache hit` | 26ns | 18ns | 🔴 1.5× slower |
| `set + read 10 selectors` | 6.0µs | 15.4µs | 🟢 2.6× faster |
| `set + read 100 selectorFamily entries` | 61.2µs | 133.9µs | 🟢 2.2× faster |
| `set + read 100 selectors` | 51.4µs | 161.5µs | 🟢 3.1× faster |
| `set + read through 5 chained selectors` | 3.7µs | 7.8µs | 🟢 2.1× faster |
| `set 1000 atoms` | 97.3µs | 573.6µs | 🟢 5.9× faster |
| `set(atom, curr => curr+1)` | 85ns | 1.9µs | 🟢 22.4× faster |
| `set(atom, value)` | 130ns | 1.1µs | 🟢 8.2× faster |
| `set(atom) with 10 subs` | 162ns | 1.8µs | 🟢 11.3× faster |
| `store.get(atom)` | 40ns | 240ns | 🟢 6.0× faster |
| `sub + unsub` | 276ns | 1.2µs | 🟢 4.4× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 88.2µs | 112.8µs | 🟢 1.3× faster |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 45.8µs | 60.9µs | 🟢 1.3× faster |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 368.4µs | 470.2µs | 🟢 1.3× faster |
| `subscribe + unsubscribe 100 shared selector pairs` | 523.7µs | 607.6µs | 🟢 1.2× faster |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in` | 350.3µs | 625.3µs | 🟢 1.8× faster |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in + mounted spine` | 1.08ms | 708.7µs | 🔴 1.5× slower |
| `traversal: 20 leaves revisited 5x each` | 5.6µs | 42.0µs | 🟢 7.5× faster |
| `txn: 10 atoms × 10 selectors, set + read` | 88.2µs | 173.0µs | 🟢 2.0× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 74.7µs | 224.3µs | 🟢 3.0× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 858.3µs | 1.38ms | 🟢 1.6× faster |
| `txn: asymmetric DAG shared sink` | 21.6µs | 54.7µs | 🟢 2.5× faster |
| `txn: cross-atom 1000 selectors, set + read` | 1.01ms | 2.11ms | 🟢 2.1× faster |
| `txn: cross-atom 1000 selectors, with subs` | 833.2µs | 10.27ms | 🟢 12.3× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 2.09ms | 7.55ms | 🟢 3.6× faster |

#### Node.js (V8)

| Operation | valdres | Jotai | |
|:----------|--------:|------:|:--|
| `atom lifecycle (create+100get+100set)` | 35.5µs | 98.2µs | 🟢 2.8× faster |
| `atom(1)` | 24ns | 49ns | 🟢 2.0× faster |
| `atomFamily: direct create + delete 500 members` | 4.42ms | 782.4µs | 🔴 5.6× slower |
| `atomFamily: direct set 500 new members` | 2.92ms | 1.56ms | 🔴 1.9× slower |
| `atomFamily: txn update 5,000 existing members` | 4.15ms | 4.73ms | 🟢 1.1× faster |
| `atomFamily(id)` | 136ns | 243ns | 🟢 1.8× faster |
| `atomFamily(id) cache hit` | 134ns | 26ns | 🔴 5.2× slower |
| `atomFamily(string) cache hit` | 159ns | 30ns | 🔴 5.3× slower |
| `create + dispose 1,000 root stores` | 1.33ms | 638.3µs | 🔴 2.1× slower |
| `createStore` | 743ns | 704ns | 🔴 1.1× slower |
| `get 1000 atoms` | 20.1µs | 152.9µs | 🟢 7.6× faster |
| `selector(fn)` | 99ns | 100ns | 🟢 1.0× faster |
| `selectorFamily: lookup 10,000 retained entries` | 113.0µs | 201.3µs | 🟢 1.8× faster |
| `selectorFamily(id)` | 1.5µs | 222ns | 🔴 6.9× slower |
| `selectorFamily(number) cache hit` | 133ns | 14ns | 🔴 9.5× slower |
| `selectorFamily(string) cache hit` | 32ns | 11ns | 🔴 3.0× slower |
| `set + read 10 selectors` | 11.6µs | 17.5µs | 🟢 1.5× faster |
| `set + read 100 selectorFamily entries` | 116.9µs | 124.0µs | 🟢 1.1× faster |
| `set + read 100 selectors` | 115.0µs | 120.4µs | 🟢 1.0× faster |
| `set + read through 5 chained selectors` | 6.5µs | 9.1µs | 🟢 1.4× faster |
| `set 1000 atoms` | 116.3µs | 306.7µs | 🟢 2.6× faster |
| `set(atom, curr => curr+1)` | 316ns | 1.2µs | 🟢 3.6× faster |
| `set(atom, value)` | 315ns | 887ns | 🟢 2.8× faster |
| `set(atom) with 10 subs` | 410ns | 1.4µs | 🟢 3.3× faster |
| `store.get(atom)` | 21ns | 127ns | 🟢 6.1× faster |
| `sub + unsub` | 907ns | 957ns | 🟢 1.1× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 164.0µs | 97.5µs | 🔴 1.7× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 91.3µs | 52.8µs | 🔴 1.7× slower |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 742.4µs | 487.7µs | 🔴 1.5× slower |
| `subscribe + unsubscribe 100 shared selector pairs` | 778.7µs | 429.3µs | 🔴 1.8× slower |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in` | 750.0µs | 470.5µs | 🔴 1.6× slower |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in + mounted spine` | 1.47ms | 483.6µs | 🔴 3.0× slower |
| `traversal: 20 leaves revisited 5x each` | 9.9µs | 24.6µs | 🟢 2.5× faster |
| `txn: 10 atoms × 10 selectors, set + read` | 179.1µs | 159.8µs | 🔴 1.1× slower |
| `txn: 10 atoms × 10 selectors, with subs` | 133.5µs | 368.2µs | 🟢 2.8× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 1.33ms | 1.42ms | 🟢 1.1× faster |
| `txn: asymmetric DAG shared sink` | 26.3µs | 53.0µs | 🟢 2.0× faster |
| `txn: cross-atom 1000 selectors, set + read` | 1.62ms | 1.73ms | 🟢 1.1× faster |
| `txn: cross-atom 1000 selectors, with subs` | 987.4µs | 8.90ms | 🟢 9.0× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.09ms | 5.90ms | 🟢 1.9× faster |

<!-- BENCH:END -->
