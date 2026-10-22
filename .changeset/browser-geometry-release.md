---
"@valdres/browser-window": minor
"@valdres/browser-screen": minor
---

**Breaking: the window size and screen are now read-only browser state, published as one frozen snapshot each.**

The previously published builds were made with `globalAtom`, `onMount` and
`setSelf`, which do not exist in the v1 core, so they cannot import against a
current core. Both packages are rebuilt on the public `externalAtom` API.

- **Read-only.** `windowSizeAtom` and `screenAtom` are `ExternalAtom`s: `set`,
  `reset` and `update` reject them at compile time and throw `TypeError` at
  runtime. `setSelf` / `resetSelf` are gone. An override (a forced width, a
  fixed render density) belongs in your own atom, composed with a selector;
  that keeps it local to each store tree.
- **One coherent snapshot.** `WindowSize` (inner and outer size) and
  `ScreenInfo` (size, available area, depth, `devicePixelRatio`, orientation)
  are each one frozen object, read together, so related values change
  together: a rotation is one publication whichever of its events arrives
  first. Snapshots are shared by every store and typed `readonly`.
- **Equality suppression.** An unchanged reading returns the same object, so
  an event that changes nothing usually notifies nobody. The one exception: the
  package keeps a single shared last snapshot, so another store's unsubscribed
  read of a passing value can make a subscribed store notify once with an
  equal-valued new object.
- **Listeners per store tree.** Listeners attach when a store tree first
  subscribes (directly or through a selector) and detach with its last
  subscriber or on `dispose`; child scopes share them. Importing and reading
  without a subscription attach nothing. The listeners were one per process
  before.
- **Outer size after a window resize.** Chromium dispatches `resize` before
  `outerWidth` / `outerHeight` reach the new window bounds. `windowSizeAtom`
  therefore measures at once and again on animation frames 2 to 4 after the
  last `resize`. Those re-measurements notify only when a size changed and are
  cancelled on unsubscribe or `dispose`. No timer polls: while frames are
  suspended (a hidden tab), the correction waits for them. The schedule was
  measured in Chromium 151, 154 and 155 only.
- **Screen events.** `screenAtom` listens to `resize`, `screen.orientation`
  `change`, Chromium's `screen` `change` and a `(resolution: Xdppx)` media query
  that follows the pixel ratio. The Safari 13 `MediaQueryList.addListener`
  fallback is gone.
- **Types.** `ScreenInfo.orientationType` is the new exported
  `ScreenOrientationType` (the same four strings, assignable both ways to the
  DOM's `OrientationType`), so consumers compiling without the DOM library
  type-check.
- **Failures.** A failing attachment is rolled back and surfaces as
  `ExternalSourceOperationError`. Every listener is still removed when one
  removal throws (`phase: "cleanup"`).
- **Server rendering.** Each source has a fixed, frozen server snapshot (zero
  sizes; for the screen, depth 24, ratio 1, `"landscape-primary"`). `useValue`
  renders it first and switches to the live value after hydration.
- **Minimum core.** The `valdres` peer range is now `^1.0.0-beta.39`, the first
  core with `externalAtom`. The previously published `1.0.0-beta.8` declared
  `^1.0.0-beta.19`, which admits cores it cannot run on.
- **Framework adapters.** `valdres-react` is the only adapter that can read an
  external atom today. Read these packages with `store.get` / `store.sub`
  elsewhere.
- **First release through the shared publish pipeline.** These packages were
  previously excluded from it, so this release is also where three fixes the
  certified packages already shipped reach them:
  - ESM declarations with explicit `.js` import specifiers;
  - published metadata for CommonJS `require(esm)` and legacy TypeScript
    resolution, including `main`, `types` and a declared Node.js floor;
  - no `workspace:` protocol left in published ranges.
