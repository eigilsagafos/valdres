---
"valdres-lit": minor
---

Add `valdres-lit` — a Lit binding for valdres, built on `ReactiveController` and `@lit/context` (like `@lit/task`, it's controller-first).

- `AtomController(host, atom, store?)` — read/write an atom; `.value`, `.set(value | updater)`, `.reset()`. Writes are reflected synchronously, so resetting/setting an atom into an async (Promise) default surfaces the intervening `"pending"` state instead of jumping straight to the resolved value.
- `ValueController(host, state, store?)` — read any atom or selector; `.value`, plus `.status` (`"pending" | "ready" | "error"`) and `.error` for async state, so templates branch instead of catching a throw.
- `StoreProvider(host, store?)` — provide a store to descendants via context; auto-creates a `{ batchUpdates: true }` store when none is passed (matching the React/Solid/Vue/Angular providers), and warns only when an explicit non-batched store is supplied.
- `ScopeController(host, scopeId?)` — derive and provide a scoped store to a subtree.
- `valdresContext` — the raw `@lit/context` token for interop.

Ergonomic layers ship as subpath exports (Lit-style):

- `valdres-lit/decorators.js` — `@atom`, `@value`, `@provideStore`, `@consumeStore`, mirroring `@lit/context`'s `@provide`/`@consume`. **Bun caveat:** Bun's transpiler mismaps accessor-decorator temporaries across classes — and, when bundled, across modules — (oven-sh/bun#28316), so decorators require a non-Bun transpiler (Vite/tsc/esbuild — the normal Lit toolchains). Verified via a tsc-compiled test lane.
- `valdres-lit/watch.js` — a `watch(state, store?)` `AsyncDirective` that binds one template position; updates go through `setValue()` without re-rendering the host. The store resolves via context from the rendering host (retried each host render until a provider answers, and re-resolved on reconnect), or pass one explicitly.
- `valdres-lit/signals.js` — `toSignal(state, store)` mirrors valdres state as a TC39 `signal-polyfill` `Signal.State` (lazy store subscription via `watched`/`unwatched`), interoperating with `@lit-labs/signals`' `SignalWatcher` auto-tracking. `signal-polyfill` is an optional peer.

All controllers subscribe on connect and tear down on disconnect, and correctly re-subscribe / re-acquire across disconnect→reconnect (DOM re-parenting). As defense in depth, controllers never start a store subscription in a DOM-less environment (full `@lit-labs/ssr` support is not claimed or tested yet; `watch()` with an explicit store renders current synchronous values server-side).
