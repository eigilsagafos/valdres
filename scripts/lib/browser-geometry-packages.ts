/**
 * The browser-geometry lane: `@valdres/browser-window` and
 * `@valdres/browser-screen`, migrated from the removed `globalAtom` to
 * `externalAtom`.
 *
 * An explicit, closed list — never a glob over `packages/@valdres/*`, where
 * other browser packages still import `globalAtom`. Not media queries and not
 * page status, so they stay out of `lib/browser-media-packages.ts` and
 * `lib/browser-status-packages.ts`: each publishes one frozen, identity-cached
 * snapshot of several platform metrics, and screen attaches up to four kinds
 * of listener per store tree, one of them a resolution media query it
 * re-creates as the pixel ratio moves.
 *
 * Both are tested by `scripts/check-browser-geometry.ts` and the packed gate
 * `scripts/test-browser-geometry-packed-consumer.ts`, but NOT release-eligible:
 * still Changesets-ignored and off the publishable list.
 * `scripts/browser-geometry-packages.test.ts` holds that, so release
 * enablement has to flip `releaseEligible` deliberately, in one change.
 */
export const BROWSER_GEOMETRY_PACKAGES = [
    {
        name: "@valdres/browser-window",
        dir: "packages/@valdres/browser-window",
        atom: "windowSizeAtom",
        releaseEligible: false,
    },
    {
        name: "@valdres/browser-screen",
        dir: "packages/@valdres/browser-screen",
        atom: "screenAtom",
        releaseEligible: false,
    },
] as const

/**
 * The exact `valdres` peer range every package must declare. `externalAtom`
 * first shipped in `1.0.0-beta.39`. Checked by equality: the packed gate's
 * `satisfies` check alone would also accept the pre-migration
 * `^1.0.0-beta.19`.
 */
export const BROWSER_GEOMETRY_CORE_PEER_RANGE = "^1.0.0-beta.39"

/**
 * The published core + React pair at that floor, installed from the registry
 * by the packed gate so the floor is executed rather than inferred:
 * `valdres-react@1.0.0-beta.7` was published alongside core `1.0.0-beta.39`.
 */
export const BROWSER_GEOMETRY_FLOOR = {
    valdres: "1.0.0-beta.39",
    "valdres-react": "1.0.0-beta.7",
} as const

/**
 * The last published version of both packages, which predates the migration
 * and declares the `^1.0.0-beta.19` peer that admits cores without
 * `globalAtom`. Release enablement must publish past it.
 */
export const BROWSER_GEOMETRY_LEGACY_VERSION = "1.0.0-beta.8"
