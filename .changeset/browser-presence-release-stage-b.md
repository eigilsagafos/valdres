---
"@valdres/browser-presence": minor
---

**Breaking: presence now requires the migrated focus and visibility releases.**

`presenceSelector` is rebuilt on `@valdres/browser-focus` and
`@valdres/browser-visibility` `1.0.0-beta.9`, the first releases built on the
public `externalAtom` primitive. Its export name and meaning are unchanged: it
is `true` while the page is visible **and** this window is focused.

- **Dependencies.** Focus and visibility are now required at `^1.0.0-beta.9`.
  The previously published `1.0.0-beta.7` and `1.0.0-beta.8` declared
  `^1.0.0-beta.7` and `^1.0.0-beta.8`. Those ranges also admit the legacy,
  pre-migration focus/visibility `1.0.0-beta.8`, which cannot import against a
  current core.
- **Minimum core.** The `valdres` peer range is now `^1.0.0-beta.39`, the first
  core with `externalAtom`. The previously published `1.0.0-beta.8` declared
  `^1.0.0-beta.19`.
- **Read-only.** `presenceSelector` is a `Selector<boolean>`. The browser owns
  its inputs, so `set`, `reset` and `update` reject it at compile time and throw
  `TypeError` at runtime.
- **Lifecycle.** Presence owns no listener or source of its own. A store tree
  that retains it retains both inputs: the shared per-document focus pair and
  that tree's visibility listener. Both are released when the tree's last
  retaining subscriber leaves or the store is disposed. Child scopes share
  their root's. Reads without a subscription sample the browser and attach
  nothing.
- **Focus while hidden.** Both inputs are read on every evaluation. The focus
  source therefore stays attached while the page is hidden, and a `blur`
  announced while hidden is still reflected when the page becomes visible
  again. The previous builds short-circuited and stopped reading focus while
  the page was hidden.
- **Server rendering.** Presence reads `true` on the server and in runtimes
  without the browser API, from the fixed focus (`true`) and visibility
  (`"visible"`) seeds. `useValue` renders that seed first and switches to the
  live value after hydration.
- **Declarations.** The published declarations now type-check against the v1
  core with full library checking (`skipLibCheck: false`). The previous ones
  failed there with TS2314 on `Selector`.
- **Framework adapters.** `valdres-react` is the only adapter that can read the
  external atoms presence depends on today. Read it with `store.get` /
  `store.sub` elsewhere.
- **First release through the shared publish pipeline.** This release is also
  where three fixes the certified packages already shipped reach presence:
  - ESM declarations with explicit `.js` import specifiers;
  - published metadata for CommonJS `require(esm)` and legacy TypeScript
    resolution, including `main`, `types` and a declared Node.js floor;
  - no `workspace:` protocol left in published ranges.
