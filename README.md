# Valdres

Valdres is a synchronous atom and selector state engine for JavaScript, with React 18 and 19 bindings. `valdres@1.0.0-beta.24` and `valdres-react@1.0.0-beta.5` are the first public builds of the new module-owned runtime, scoped stores, atomic transactions, and lifecycle-free subscriptions.

The website currently documents the legacy beta. The install path and examples below are the source of truth for the v1 beta while the site is being migrated.

```bash
npm install valdres@beta valdres-react@beta react
```

```tsx
import { atom, selector, store } from "valdres"
import { Provider, useUpdateAtom, useValue } from "valdres-react"

const countAtom = atom(0)
const doubledSelector = selector(get => get(countAtom) * 2)
const appStore = store()

function Counter() {
    const count = useValue(countAtom)
    const doubled = useValue(doubledSelector)
    const increment = useUpdateAtom(countAtom)
    return <button onClick={() => increment(c => c + 1)}>{count} ×2 = {doubled}</button>
}

const App = () => (
    <Provider store={appStore}>
        <Counter />
    </Provider>
)
```

Atoms and selectors are immutable capability handles identified by reference. A Store owns their values and derived graph. `set` stores an exact value, including functions; `update` applies an updater. Stores also provide synchronous subscriptions, transactions, nested scopes, reset, and explicit disposal.

This is an intentional breaking beta cutover. Only `valdres` and `valdres-react` are certified together. The Angular, Vue, Svelte, Solid, plugin, and compatibility packages listed below remain on the legacy API and are unsupported with `valdres@1.0.0-beta.24` or later until they are migrated. Their published semver ranges may still allow npm to install this core, so do not mix those packages with the new beta.

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
bun test             # certified v1 core + React cohort
bun run test:all     # deferred legacy maintenance lane
bun run docs:dev     # legacy docs site at localhost:4321
```

## Releasing

Versioning and publishing is handled by [Changesets](https://github.com/changesets/changesets). Each package versions independently.

The future v1 stable release is governed by the hard gates and RC burn-in checklist in [RELEASING.md](./RELEASING.md).

**When you open a PR that changes a publishable package:**

```bash
bunx changeset
```

Pick the affected packages, the bump type (patch/minor/major), and write a short summary. Commit the generated `.changeset/*.md` file with your PR.

For PRs that touch publishable code but intentionally don't trigger a release (refactors, internal cleanup, docs):

```bash
bunx changeset --empty
```

This still generates a `.changeset/*.md` file — commit it like a regular changeset. The `Require changeset` check on ordinary feature PRs enforces that any change to a publishable package ships with a changeset (empty or otherwise); the generated Version Packages PR has already consumed those changesets.

When the PR merges to `main`, the `Publish` workflow opens (or updates) a **Version Packages** PR that applies the pending changesets, bumps versions, and updates CHANGELOGs. Merging that PR publishes the affected packages to npm.

To preview what publishing would do locally:

```bash
bun run verify-publish
```

The repo is currently in `beta` prerelease mode (`bunx changeset pre exit` to graduate to stable). While in prerelease mode, changesets that have already been versioned into a `beta` release move to `.changeset/pre/`. Certified core+React histories are consumed by their stable release; ignored deferred histories remain for their packages. Leave those files alone unless a change genuinely no longer applies to its eventual release.

## Benchmarks

### Performance

The table below is the archived legacy-engine benchmark and does not describe the `1.0.0-beta.24` runtime. New v1 numbers will replace it after the beta runs in real applications, including ShiftX.

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
| `atom lifecycle (create+100get+100set)` | 13.1µs | 136.4µs | 🟢 10.5× faster |
| `atom(1)` | 2ns | 49ns | 🟢 22.3× faster |
| `atomFamily: direct create + delete 500 members` | 1.10ms | 860.2µs | 🔴 1.3× slower |
| `atomFamily: direct set 500 new members` | 629.7µs | 677.4µs | 🟢 1.1× faster |
| `atomFamily: txn update 5,000 existing members` | 1.93ms | 7.23ms | 🟢 3.8× faster |
| `atomFamily(id)` | 201ns | 350ns | 🟢 1.7× faster |
| `atomFamily(id) cache hit` | 16ns | 10ns | 🔴 1.7× slower |
| `atomFamily(string) cache hit` | 28ns | 22ns | 🔴 1.3× slower |
| `create + dispose 1,000 root stores` | 542.4µs | 4.22ms | 🟢 7.8× faster |
| `createStore` | 288ns | 4.3µs | 🟢 14.9× faster |
| `get 1000 atoms` | 12.9µs | 262.0µs | 🟢 20.3× faster |
| `selector(fn)` | 7ns | 53ns | 🟢 7.9× faster |
| `selectorFamily: lookup 10,000 retained entries` | 185.8µs | 89.3µs | 🔴 2.1× slower |
| `selectorFamily(id)` | 231ns | 185ns | 🔴 1.3× slower |
| `selectorFamily(number) cache hit` | 9ns | 7ns | 🔴 1.4× slower |
| `selectorFamily(string) cache hit` | 27ns | 18ns | 🔴 1.5× slower |
| `set + read 10 selectors` | 6.9µs | 16.6µs | 🟢 2.4× faster |
| `set + read 100 selectorFamily entries` | 74.4µs | 141.0µs | 🟢 1.9× faster |
| `set + read 100 selectors` | 59.6µs | 165.2µs | 🟢 2.8× faster |
| `set + read through 5 chained selectors` | 4.4µs | 8.5µs | 🟢 1.9× faster |
| `set 1000 atoms` | 107.1µs | 602.1µs | 🟢 5.6× faster |
| `set(atom, curr => curr+1)` | 89ns | 1.9µs | 🟢 21.5× faster |
| `set(atom, value)` | 130ns | 1.1µs | 🟢 8.7× faster |
| `set(atom) with 10 subs` | 167ns | 1.9µs | 🟢 11.1× faster |
| `store.get(atom)` | 40ns | 231ns | 🟢 5.8× faster |
| `sub + unsub` | 297ns | 1.3µs | 🟢 4.4× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 95.0µs | 115.7µs | 🟢 1.2× faster |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 50.8µs | 62.4µs | 🟢 1.2× faster |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 420.7µs | 486.1µs | 🟢 1.2× faster |
| `subscribe + unsubscribe 100 shared selector pairs` | 515.1µs | 652.6µs | 🟢 1.3× faster |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in` | 399.6µs | 662.4µs | 🟢 1.7× faster |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in + mounted spine` | 1.32ms | 737.6µs | 🔴 1.8× slower |
| `traversal: 20 leaves revisited 5x each` | 6.2µs | 43.8µs | 🟢 7.1× faster |
| `txn: 10 atoms × 10 selectors, set + read` | 121.9µs | 161.0µs | 🟢 1.3× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 84.7µs | 234.5µs | 🟢 2.8× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 1.03ms | 1.44ms | 🟢 1.4× faster |
| `txn: asymmetric DAG shared sink` | 24.6µs | 56.8µs | 🟢 2.3× faster |
| `txn: cross-atom 1000 selectors, set + read` | 1.27ms | 2.21ms | 🟢 1.7× faster |
| `txn: cross-atom 1000 selectors, with subs` | 949.6µs | 10.83ms | 🟢 11.4× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 2.39ms | 7.44ms | 🟢 3.1× faster |

#### Node.js (V8)

| Operation | valdres | Jotai | |
|:----------|--------:|------:|:--|
| `atom lifecycle (create+100get+100set)` | 37.3µs | 103.9µs | 🟢 2.8× faster |
| `atom(1)` | 24ns | 51ns | 🟢 2.1× faster |
| `atomFamily: direct create + delete 500 members` | 4.67ms | 767.0µs | 🔴 6.1× slower |
| `atomFamily: direct set 500 new members` | 1.37ms | 1.66ms | 🟢 1.2× faster |
| `atomFamily: txn update 5,000 existing members` | 4.71ms | 7.37ms | 🟢 1.6× faster |
| `atomFamily(id)` | 141ns | 349ns | 🟢 2.5× faster |
| `atomFamily(id) cache hit` | 132ns | 15ns | 🔴 9.0× slower |
| `atomFamily(string) cache hit` | 167ns | 15ns | 🔴 11.1× slower |
| `create + dispose 1,000 root stores` | 1.57ms | 643.6µs | 🔴 2.4× slower |
| `createStore` | 844ns | 657ns | 🔴 1.3× slower |
| `get 1000 atoms` | 22.4µs | 153.2µs | 🟢 6.8× faster |
| `selector(fn)` | 42ns | 53ns | 🟢 1.3× faster |
| `selectorFamily: lookup 10,000 retained entries` | 163.9µs | 266.7µs | 🟢 1.6× faster |
| `selectorFamily(id)` | 254ns | 443ns | 🟢 1.7× faster |
| `selectorFamily(number) cache hit` | 136ns | 15ns | 🔴 9.3× slower |
| `selectorFamily(string) cache hit` | 150ns | 14ns | 🔴 10.9× slower |
| `set + read 10 selectors` | 14.6µs | 17.6µs | 🟢 1.2× faster |
| `set + read 100 selectorFamily entries` | 146.5µs | 136.9µs | 🔴 1.1× slower |
| `set + read 100 selectors` | 141.3µs | 124.2µs | 🔴 1.1× slower |
| `set + read through 5 chained selectors` | 7.7µs | 9.7µs | 🟢 1.3× faster |
| `set 1000 atoms` | 115.9µs | 325.8µs | 🟢 2.8× faster |
| `set(atom, curr => curr+1)` | 323ns | 1.1µs | 🟢 3.4× faster |
| `set(atom, value)` | 326ns | 930ns | 🟢 2.9× faster |
| `set(atom) with 10 subs` | 432ns | 1.4µs | 🟢 3.1× faster |
| `store.get(atom)` | 18ns | 159ns | 🟢 8.9× faster |
| `sub + unsub` | 950ns | 977ns | 🟢 1.0× faster |
| `sub+unsub on chain of 100 unsubscribed derived deps` | 172.0µs | 102.7µs | 🔴 1.7× slower |
| `sub+unsub on chain of 50 unsubscribed derived deps` | 111.3µs | 85.4µs | 🔴 1.3× slower |
| `sub+unsub on chain of 500 unsubscribed derived deps` | 839.8µs | 515.5µs | 🔴 1.6× slower |
| `subscribe + unsubscribe 100 shared selector pairs` | 810.3µs | 461.2µs | 🔴 1.8× slower |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in` | 786.1µs | 493.1µs | 🔴 1.6× slower |
| `subscribe + unsubscribe 100 shared selector pairs + fan-in + mounted spine` | 1.43ms | 495.8µs | 🔴 2.9× slower |
| `traversal: 20 leaves revisited 5x each` | 8.8µs | 28.8µs | 🟢 3.3× faster |
| `txn: 10 atoms × 10 selectors, set + read` | 164.1µs | 164.4µs | 🟢 1.0× faster |
| `txn: 10 atoms × 10 selectors, with subs` | 97.1µs | 238.7µs | 🟢 2.5× faster |
| `txn: 10 atoms × 100 selectors, set + read` | 1.58ms | 1.43ms | 🔴 1.1× slower |
| `txn: asymmetric DAG shared sink` | 28.4µs | 52.2µs | 🟢 1.8× faster |
| `txn: cross-atom 1000 selectors, set + read` | 1.87ms | 1.93ms | 🟢 1.0× faster |
| `txn: cross-atom 1000 selectors, with subs` | 1.03ms | 9.59ms | 🟢 9.3× faster |
| `txn: large asymmetric DAG (1000 leaves × 50 chain)` | 3.12ms | 6.71ms | 🟢 2.2× faster |

<!-- BENCH:END -->
