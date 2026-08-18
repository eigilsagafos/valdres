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
| `atom lifecycle (create+100get+100set)` | 14.6µs | 201.2µs | 🟢 13.8× faster |
| `atom(1)` | 2ns | 54ns | 🟢 21.6× faster |
| `atomFamily: direct create + delete 500 members` | 1.91ms | 1.20ms | 🔴 1.6× slower |
| `atomFamily: direct set 500 new members` | 1.37ms | 864.5µs | 🔴 1.6× slower |
| `atomFamily: txn update 5,000 existing members` | 2.88ms | 9.38ms | 🟢 3.3× faster |
| `atomFamily(id)` | 212ns | 232ns | 🟢 1.1× faster |
| `atomFamily(id) cache hit` | 16ns | 11ns | 🔴 1.4× slower |
| `atomFamily(string) cache hit` | 31ns | 24ns | 🔴 1.3× slower |
| `create + dispose 1,000 root stores` | 628.4µs | 5.05ms | 🟢 8.0× faster |
| `createStore` | 378ns | 5.5µs | 🟢 14.5× faster |
| `get 1000 atoms` | 10.6µs | 745.7µs | 🟢 70.0× faster |
| `selector(fn)` | 7ns | 56ns | 🟢 8.2× faster |
| `selectorFamily: lookup 10,000 retained entries` | 848.8µs | 106.3µs | 🔴 8.0× slower |
| `selectorFamily(id)` | 217ns | 206ns | 🔴 1.1× slower |
| `selectorFamily(number) cache hit` | 39ns | 8ns | 🔴 5.1× slower |
| `selectorFamily(string) cache hit` | 48ns | 20ns | 🔴 2.4× slower |
| `set + read 10 selectors` | 8.0µs | 30.6µs | 🟢 3.8× faster |
| `set + read 100 selectorFamily entries` | 86.8µs | 224.2µs | 🟢 2.6× faster |
| `set + read 100 selectors` | 73.0µs | 335.5µs | 🟢 4.6× faster |
| `set + read through 5 chained selectors` | 5.5µs | 12.3µs | 🟢 2.3× faster |
| `set 1000 atoms` | 100.3µs | 767.0µs | 🟢 7.6× faster |
| `set(atom, curr => curr+1)` | 152ns | 2.5µs | 🟢 16.5× faster |
| `set(atom, value)` | 140ns | 1.6µs | 🟢 11.1× faster |
| `set(atom) with 10 subs` | 202ns | 2.3µs | 🟢 11.6× faster |
| `store.get(atom)` | 31ns | 291ns | 🟢 9.4× faster |
| `sub + unsub` | 384ns | 1.9µs | 🟢 5.0× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 128.1µs | 120.9µs | 🔴 1.1× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 67.8µs | 67.7µs | 🔴 1.0× slower |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 519.4µs | 580.3µs | 🟢 1.1× faster |
| `subscribe + unsubscribe 100 shared selector pairs` | 780.9µs | 803.2µs | 🟢 1.0× faster |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in` | 656.9µs | 812.1µs | 🟢 1.2× faster |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in + mounted spine` | 1.38ms | 894.5µs | 🔴 1.5× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 137.4µs | 344.4µs | 🟢 2.5× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 108.6µs | 527.9µs | 🟢 4.9× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 1.08ms | 3.30ms | 🟢 3.1× faster |
| `txn: asymmetric DAG shared sink` | 30.8µs | 131.4µs | 🟢 4.3× faster |
| `txn: cross-atom 1000 selectors, set + read` | 1.31ms | 4.84ms | 🟢 3.7× faster |
| `txn: cross-atom 1000 selectors, with subs` | 1.13ms | 18.09ms | 🟢 15.9× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.35ms | 16.69ms | 🟢 5.0× faster |

#### Node.js (V8)

| Operation | valdres | Jotai | |
|:----------|--------:|------:|:--|
| `atom lifecycle (create+100get+100set)` | 36.1µs | 104.6µs | 🟢 2.9× faster |
| `atom(1)` | 24ns | 50ns | 🟢 2.0× faster |
| `atomFamily: direct create + delete 500 members` | 5.20ms | 2.59ms | 🔴 2.0× slower |
| `atomFamily: direct set 500 new members` | 3.15ms | 1.12ms | 🔴 2.8× slower |
| `atomFamily: txn update 5,000 existing members` | 4.81ms | 7.96ms | 🟢 1.7× faster |
| `atomFamily(id)` | 252ns | 365ns | 🟢 1.4× faster |
| `atomFamily(id) cache hit` | 68ns | 14ns | 🔴 4.7× slower |
| `atomFamily(string) cache hit` | 90ns | 15ns | 🔴 6.0× slower |
| `create + dispose 1,000 root stores` | 1.40ms | 656.2µs | 🔴 2.1× slower |
| `createStore` | 818ns | 621ns | 🔴 1.3× slower |
| `get 1000 atoms` | 22.3µs | 156.8µs | 🟢 7.0× faster |
| `selector(fn)` | 44ns | 105ns | 🟢 2.4× faster |
| `selectorFamily: lookup 10,000 retained entries` | 1.30ms | 266.6µs | 🔴 4.9× slower |
| `selectorFamily(id)` | 1.7µs | 417ns | 🔴 4.1× slower |
| `selectorFamily(number) cache hit` | 175ns | 14ns | 🔴 12.1× slower |
| `selectorFamily(string) cache hit` | 138ns | 10ns | 🔴 13.2× slower |
| `set + read 10 selectors` | 12.5µs | 18.1µs | 🟢 1.5× faster |
| `set + read 100 selectorFamily entries` | 126.9µs | 129.0µs | 🟢 1.0× faster |
| `set + read 100 selectors` | 123.9µs | 127.5µs | 🟢 1.0× faster |
| `set + read through 5 chained selectors` | 7.0µs | 9.8µs | 🟢 1.4× faster |
| `set 1000 atoms` | 117.5µs | 342.3µs | 🟢 2.9× faster |
| `set(atom, curr => curr+1)` | 330ns | 1.1µs | 🟢 3.3× faster |
| `set(atom, value)` | 333ns | 927ns | 🟢 2.8× faster |
| `set(atom) with 10 subs` | 424ns | 1.3µs | 🟢 3.1× faster |
| `store.get(atom)` | 21ns | 113ns | 🟢 5.5× faster |
| `sub + unsub` | 993ns | 983ns | 🔴 1.0× slower |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 169.9µs | 102.0µs | 🔴 1.7× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 106.8µs | 55.0µs | 🔴 1.9× slower |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 792.1µs | 560.0µs | 🔴 1.4× slower |
| `subscribe + unsubscribe 100 shared selector pairs` | 1.02ms | 443.6µs | 🔴 2.3× slower |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in` | 937.2µs | 476.1µs | 🔴 2.0× slower |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in + mounted spine` | 1.69ms | 497.0µs | 🔴 3.4× slower |
| `txn: 10 atoms × 10 selectors, set + read` | 143.8µs | 160.9µs | 🟢 1.1× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 93.5µs | 242.3µs | 🟢 2.6× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 1.37ms | 1.42ms | 🟢 1.0× faster |
| `txn: asymmetric DAG shared sink` | 28.4µs | 53.1µs | 🟢 1.9× faster |
| `txn: cross-atom 1000 selectors, set + read` | 1.67ms | 1.89ms | 🟢 1.1× faster |
| `txn: cross-atom 1000 selectors, with subs` | 1.05ms | 9.53ms | 🟢 9.1× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.07ms | 6.55ms | 🟢 2.1× faster |

<!-- BENCH:END -->
