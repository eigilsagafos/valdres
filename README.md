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
| `atom lifecycle (create+100get+100set)` | 12.4µs | 132.8µs | 🟢 10.7× faster |
| `atom(1)` | 2ns | 50ns | 🟢 21.6× faster |
| `atomFamily: direct create + delete 500 members` | 1.00ms | 828.1µs | 🔴 1.2× slower |
| `atomFamily: direct set 500 new members` | 600.5µs | 662.4µs | 🟢 1.1× faster |
| `atomFamily: txn update 5,000 existing members` | 1.84ms | 7.38ms | 🟢 4.0× faster |
| `atomFamily(id)` | 261ns | 387ns | 🟢 1.5× faster |
| `atomFamily(id) cache hit` | 17ns | 10ns | 🔴 1.6× slower |
| `atomFamily(string) cache hit` | 27ns | 21ns | 🔴 1.3× slower |
| `create + dispose 1,000 root stores` | 627.7µs | 4.14ms | 🟢 6.6× faster |
| `createStore` | 348ns | 4.3µs | 🟢 12.4× faster |
| `get 1000 atoms` | 12.8µs | 270.8µs | 🟢 21.2× faster |
| `selector(fn)` | 8ns | 56ns | 🟢 7.1× faster |
| `selectorFamily: lookup 10,000 retained entries` | 211.1µs | 72.8µs | 🔴 2.9× slower |
| `selectorFamily(id)` | 250ns | 186ns | 🔴 1.3× slower |
| `selectorFamily(number) cache hit` | 10ns | 7ns | 🔴 1.4× slower |
| `selectorFamily(string) cache hit` | 26ns | 18ns | 🔴 1.5× slower |
| `set + read 10 selectors` | 6.3µs | 16.5µs | 🟢 2.6× faster |
| `set + read 100 selectorFamily entries` | 66.9µs | 135.9µs | 🟢 2.0× faster |
| `set + read 100 selectors` | 52.1µs | 162.9µs | 🟢 3.1× faster |
| `set + read through 5 chained selectors` | 4.1µs | 8.2µs | 🟢 2.0× faster |
| `set 1000 atoms` | 97.7µs | 575.7µs | 🟢 5.9× faster |
| `set(atom, curr => curr+1)` | 87ns | 2.2µs | 🟢 25.4× faster |
| `set(atom, value)` | 130ns | 1.1µs | 🟢 8.6× faster |
| `set(atom) with 10 subs` | 164ns | 2.5µs | 🟢 15.0× faster |
| `store.get(atom)` | 40ns | 240ns | 🟢 6.0× faster |
| `sub + unsub` | 287ns | 1.3µs | 🟢 4.5× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 89.0µs | 117.1µs | 🟢 1.3× faster |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 46.7µs | 61.3µs | 🟢 1.3× faster |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 394.1µs | 493.3µs | 🟢 1.3× faster |
| `subscribe + unsubscribe 100 shared selector pairs` | 507.1µs | 621.1µs | 🟢 1.2× faster |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in` | 349.6µs | 636.1µs | 🟢 1.8× faster |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in + mounted spine` | 1.30ms | 724.5µs | 🔴 1.8× slower |
| `traversal: 20 leaves revisited 5x each` | 5.9µs | 43.6µs | 🟢 7.4× faster |
| `txn: 10 atoms × 10 selectors, set + read` | 111.6µs | 177.9µs | 🟢 1.6× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 78.4µs | 230.2µs | 🟢 2.9× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 992.1µs | 1.38ms | 🟢 1.4× faster |
| `txn: asymmetric DAG shared sink` | 22.8µs | 56.2µs | 🟢 2.5× faster |
| `txn: cross-atom 1000 selectors, set + read` | 1.21ms | 2.12ms | 🟢 1.8× faster |
| `txn: cross-atom 1000 selectors, with subs` | 856.5µs | 10.74ms | 🟢 12.5× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 2.17ms | 7.46ms | 🟢 3.4× faster |

#### Node.js (V8)

| Operation | valdres | Jotai | |
|:----------|--------:|------:|:--|
| `atom lifecycle (create+100get+100set)` | 36.6µs | 95.5µs | 🟢 2.6× faster |
| `atom(1)` | 24ns | 51ns | 🟢 2.1× faster |
| `atomFamily: direct create + delete 500 members` | 4.53ms | 768.6µs | 🔴 5.9× slower |
| `atomFamily: direct set 500 new members` | 2.85ms | 1.52ms | 🔴 1.9× slower |
| `atomFamily: txn update 5,000 existing members` | 4.76ms | 4.77ms | 🟢 1.0× faster |
| `atomFamily(id)` | 156ns | 303ns | 🟢 1.9× faster |
| `atomFamily(id) cache hit` | 133ns | 14ns | 🔴 9.4× slower |
| `atomFamily(string) cache hit` | 159ns | 15ns | 🔴 10.5× slower |
| `create + dispose 1,000 root stores` | 1.45ms | 638.8µs | 🔴 2.3× slower |
| `createStore` | 821ns | 865ns | 🟢 1.1× faster |
| `get 1000 atoms` | 20.1µs | 150.5µs | 🟢 7.5× faster |
| `selector(fn)` | 55ns | 68ns | 🟢 1.2× faster |
| `selectorFamily: lookup 10,000 retained entries` | 113.2µs | 136.1µs | 🟢 1.2× faster |
| `selectorFamily(id)` | 1.5µs | 443ns | 🔴 3.4× slower |
| `selectorFamily(number) cache hit` | 133ns | 14ns | 🔴 9.4× slower |
| `selectorFamily(string) cache hit` | 30ns | 11ns | 🔴 2.8× slower |
| `set + read 10 selectors` | 13.7µs | 17.3µs | 🟢 1.3× faster |
| `set + read 100 selectorFamily entries` | 137.2µs | 122.6µs | 🔴 1.1× slower |
| `set + read 100 selectors` | 133.7µs | 124.6µs | 🔴 1.1× slower |
| `set + read through 5 chained selectors` | 7.3µs | 9.1µs | 🟢 1.2× faster |
| `set 1000 atoms` | 114.8µs | 313.7µs | 🟢 2.7× faster |
| `set(atom, curr => curr+1)` | 326ns | 1.1µs | 🟢 3.4× faster |
| `set(atom, value)` | 322ns | 927ns | 🟢 2.9× faster |
| `set(atom) with 10 subs` | 409ns | 1.3µs | 🟢 3.3× faster |
| `store.get(atom)` | 17ns | 114ns | 🟢 6.9× faster |
| `sub + unsub` | 870ns | 932ns | 🟢 1.1× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 167.5µs | 95.8µs | 🔴 1.7× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 93.3µs | 51.4µs | 🔴 1.8× slower |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 773.7µs | 474.2µs | 🔴 1.6× slower |
| `subscribe + unsubscribe 100 shared selector pairs` | 804.7µs | 426.9µs | 🔴 1.9× slower |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in` | 747.1µs | 454.6µs | 🔴 1.6× slower |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in + mounted spine` | 1.44ms | 475.8µs | 🔴 3.0× slower |
| `traversal: 20 leaves revisited 5x each` | 9.8µs | 24.1µs | 🟢 2.5× faster |
| `txn: 10 atoms × 10 selectors, set + read` | 198.9µs | 177.4µs | 🔴 1.1× slower |
| `txn: 10 atoms × 10 selectors, with subs` | 132.5µs | 368.2µs | 🟢 2.8× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 1.56ms | 1.26ms | 🔴 1.2× slower |
| `txn: asymmetric DAG shared sink` | 25.9µs | 53.1µs | 🟢 2.0× faster |
| `txn: cross-atom 1000 selectors, set + read` | 1.85ms | 1.74ms | 🔴 1.1× slower |
| `txn: cross-atom 1000 selectors, with subs` | 1.01ms | 8.88ms | 🟢 8.8× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.15ms | 5.86ms | 🟢 1.9× faster |

<!-- BENCH:END -->
