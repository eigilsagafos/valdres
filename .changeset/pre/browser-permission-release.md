---
"@valdres/browser-device-motion": minor
"@valdres/browser-device-orientation": minor
"@valdres/browser-geolocation": minor
"@valdres/browser-screen-details": minor
---

**Breaking: motion, orientation, geolocation and screen details are now read-only browser state with explicit permission triggers.**

The previously published builds were made with `globalAtom`, `globalStore`,
`onMount` and `setSelf`, which do not exist in the v1 core, so they cannot
import against a current core. Each package is rebuilt on the public
`externalAtom`, `atom`, `selector` and `Store` APIs.

- **Read-only.** Every export is an `ExternalAtom` or a `Selector`: `set`,
  `reset` and `update` reject them at compile time and throw `TypeError` at
  runtime. `setSelf` / `resetSelf` are gone; keep test fakes in your own atoms.
  Status, value and error publish together as one snapshot per source, so they
  are never observed apart.
- **No implicit prompts.** Importing, reading, subscribing and server rendering
  never request a permission and never start a geolocation watch. The only
  triggers are `requestMotionPermission()`, `requestOrientationPermission()`,
  `requestScreenDetails()` and `watchGeolocation(store, options?)`. Each makes
  its native call synchronously, inside the caller's task, so a call made
  directly from a click handler reaches the browser during that click.
- **Geolocation (breaking).** Subscribing to `positionAtom` no longer starts a
  watch. `watchGeolocation(store, options?)` starts one and returns the
  function that stops it; `geolocationOptionsAtom` is removed. Watches belong to
  the exact Store passed: child scopes read their parent's watch until they
  start their own, siblings can share the same parent watch, and a child's own
  watch never changes what its parent or siblings read. Callers asking one Store
  for the same effective options share one reference-counted watch; different
  options in the same Store throw `GeolocationWatchConflictError`. Disposing the
  Store stops its watches, and reports from a stopped or replaced watch are
  ignored. New: `geolocationAtom` (`{ status, position, error }`),
  `GeolocationWatchOptions`, `GeolocationWatchConflictError`, and the
  `"insecure"` and `"denied"` statuses — a denial (code 1) is `"denied"`, distinct
  from the ordinary `"error"` (codes 2 and 3, the watch keeps running).
- **Motion and orientation.** `motionAtom`, `motionStatusAtom`,
  `orientationAtom` and `orientationStatusAtom` are now selectors over one
  shared listener per window, attached while a store subscribes and released
  with the last subscriber or on dispose. Statuses gain `"insecure"`.
  `permissionAtom` follows the Permissions API (`accelerometer` and
  `gyroscope`, where the engine knows them) and request answers.
  `request*Permission()` now resolves the current value, without asking, where
  the browser has no `requestPermission`. A reading with values is evidence
  of observed access: since browsers only deliver readings once access is
  granted, it may fill an unknown or `"prompt"` permission with `"granted"`
  (on iOS, which asks once for motion and orientation together, a grant
  obtained through one package reaches the other this way; the shared answer
  was observed on iOS 18.7 Safari), but it never overrides a recorded denial.
  Only a newer request, query answer or `change` event recovers from one.
- **Screen details.** New `screenDetailsAtom` (`{ status, screens,
  currentScreen, error }`) and `screenDetailsStatusAtom`; `screensAtom` is
  `readonly ScreenDetail[]`, and `ScreenDetail.orientationType` is a local
  union so DOM-less consumers type-check. Subscribing to the details also
  observes the `window-management` permission (a query, never a prompt), so a
  denial the browser reports drops the screens and turns the status
  `"denied"`; a denial reported after a request started wins over that
  request's grant.
- **Errors.** Once a native request has started, its promise settles only with
  the browser's outcome: `request*Permission()` never rejects, and
  `requestScreenDetails()` never throws and rejects only with the browser's own
  error. A store subscriber that throws while an outcome or a Permissions API
  answer is published is reported through `globalThis.reportError` (or thrown in
  a later task), like core's `onCommit` failures, after every store was
  notified — never as the request's rejection, a lost promise or an unhandled
  rejection, and the request is never retried. Native event listeners rethrow
  subscriber failures for the browser to report.
- **Permission reads may be stale while unobserved.** Permission atoms keep the
  newest answer the page saw; while no store subscribes, nothing observes the
  permission, and the next subscription queries again and corrects it.
- **Known limitation.** A Permissions API query that starts after a request
  (for example, a store that first subscribes to `screenPermissionAtom` while
  `requestScreenDetails()` is pending) may answer `"prompt"` and, being newer,
  outrank the request's grant in `screenPermissionAtom` until the browser fires
  its `change` event. Screen details stay `"ready"`; only the permission atom
  lags.
- **Server rendering.** Each source has a fixed server snapshot (`"idle"`
  statuses, `null` values, `"prompt"` permissions); `useValue` renders it first
  and switches to the live value after hydration.
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
