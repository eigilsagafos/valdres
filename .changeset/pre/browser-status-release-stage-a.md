---
"@valdres/browser-online": minor
"@valdres/browser-focus": minor
"@valdres/browser-visibility": minor
---

**Breaking: online, focus and visibility are now read-only browser state.**

The previously published builds were made with `globalAtom`, `onMount` and
`setSelf`, which do not exist in the v1 core, so they cannot import against a
current core. Each package is rebuilt on the public `externalAtom` primitive.

- **Read-only.** `onlineAtom`, `focusAtom` and `visibilityAtom` are
  `ExternalAtom`s, and `isVisibleSelector` is a `Selector`. The browser owns
  these values, so `set`, `reset` and `update` reject them at compile time and
  throw `TypeError` at runtime. Code that wrote one of them, for example to fake
  a state in tests, now has to keep that state in its own atom. Export names and
  value domains are unchanged.
- **Meanings.**
  - `onlineAtom` is always `navigator.onLine`. The `online`/`offline` events
    only tell a store to read it again.
  - `visibilityAtom` is `document.visibilityState`, and any state other than
    `"visible"` reads `"hidden"`.
  - `focusAtom` describes **this window**, as its own `focus` and `blur` events
    announce, so focus inside a nested frame reads `false`. This was measured in
    Chromium only.
  - New: the `PageVisibility` type (`"visible" | "hidden"`), assignable both
    ways to the DOM's `DocumentVisibilityState`.
- **Lifecycle.**
  - Importing a package attaches nothing.
  - Online and visibility attach their listeners when a store tree first
    retains the source, directly or through a selector. They release them when
    that tree's last retaining subscriber leaves or the store is disposed.
    Child scopes share their root's listeners.
  - Focus shares one ref-counted `focus`/`blur` pair per document across all
    stores. While any store retains it, every store reads the value those
    events announced.
  - Reads without a subscription sample the browser and attach nothing.
  - Reads are not atomic across independent stores while a change is being
    delivered, and a change caused during delivery may coalesce.
- **Server rendering.** Each source has a fixed `getServerSnapshot`: online
  `true`, focus `true`, visibility `"visible"`. The same values are reported in
  runtimes without the browser API (Node, Bun, Deno, workers without a
  `document`). `useValue` renders the seed first and switches to the live value
  after hydration.
- **Minimum core.** The `valdres` peer range is now `^1.0.0-beta.39`, the
  first core with `externalAtom`. The previously published `1.0.0-beta.8`
  declared `^1.0.0-beta.19`, which admits cores it cannot run on.
- **Framework adapters.** `valdres-react` is the only adapter that can read an
  external atom today. Read these packages with `store.get` / `store.sub`
  elsewhere.
- **`@valdres/browser-presence` is not part of this release.** Its published
  `1.0.0-beta.7` and `1.0.0-beta.8` depend on `^1.0.0-beta.7` and
  `^1.0.0-beta.8` of focus and visibility, so a fresh install resolves these
  releases, and its selector composes them at runtime. Unlike the migrated
  presence, those builds stop reading focus while the page is hidden. Their
  declarations already fail full library checking (`skipLibCheck: false`)
  against the v1 core, checked at `1.0.0-beta.39` and `1.0.0-beta.42`; that
  predates this release. The migrated presence will ship in its own release,
  which will require these versions.
- **First release through the shared publish pipeline.** These packages were
  previously excluded from it, so this release is also where three fixes the
  certified packages already shipped reach them:
  - ESM declarations with explicit `.js` import specifiers;
  - published metadata for CommonJS `require(esm)` and legacy TypeScript
    resolution, including `main`, `types` and a declared Node.js floor;
  - no `workspace:` protocol left in published ranges.
