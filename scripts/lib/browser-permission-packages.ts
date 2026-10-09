/**
 * The browser-permission lane: `@valdres/browser-device-motion`,
 * `-device-orientation`, `-geolocation` and `-screen-details`, migrated from
 * the removed `globalAtom` / `globalStore` to `externalAtom`.
 *
 * An explicit, closed list — never a glob over `packages/@valdres/*`, where
 * other browser packages still import `globalAtom`. These four share what the
 * other lanes do not: each sits behind a browser permission, so each has an
 * explicit trigger (`requestMotionPermission`, `requestOrientationPermission`,
 * `watchGeolocation`, `requestScreenDetails`) and asynchronous outcomes that
 * publish synchronous snapshots. Motion and orientation share one listener per
 * window; geolocation runs one native watch per Store that asks; screen
 * details shares the browser's one `ScreenDetails` object per window.
 *
 * Tested by the standalone `.github/workflows/browser-permission.yaml`, kept
 * out of ci.yaml, `scripts/verify.ts` and `publish.needs` until a later
 * integration change. Every package here is release-ignored: `releaseEligible`
 * is the single per-package claim `scripts/browser-permission-packages.test.ts`
 * checks against `.changeset/config.json` and
 * `scripts/publishable-packages.json`.
 */
export const BROWSER_PERMISSION_PACKAGES = [
    {
        name: "@valdres/browser-device-motion",
        dir: "packages/@valdres/browser-device-motion",
        releaseEligible: false,
    },
    {
        name: "@valdres/browser-device-orientation",
        dir: "packages/@valdres/browser-device-orientation",
        releaseEligible: false,
    },
    {
        name: "@valdres/browser-geolocation",
        dir: "packages/@valdres/browser-geolocation",
        releaseEligible: false,
    },
    {
        name: "@valdres/browser-screen-details",
        dir: "packages/@valdres/browser-screen-details",
        releaseEligible: false,
    },
] as const

/** The last published version of all four, which predates the migration. */
export const BROWSER_PERMISSION_LEGACY_VERSION = "1.0.0-beta.8"

/**
 * The exact `valdres` peer range every package must declare. `externalAtom`
 * first shipped in `1.0.0-beta.39`, and nothing newer is used. Checked by
 * equality: a `satisfies` check alone would also accept the pre-migration
 * `^1.0.0-beta.19`.
 */
export const BROWSER_PERMISSION_CORE_PEER_RANGE = "^1.0.0-beta.39"

/**
 * The published core + React pair at that floor, installed from the registry
 * by the packed gate so the floor is executed rather than inferred.
 */
export const BROWSER_PERMISSION_FLOOR = {
    valdres: "1.0.0-beta.39",
    "valdres-react": "1.0.0-beta.7",
} as const
