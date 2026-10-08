/**
 * The browser-status lane: `@valdres/browser-online`, `-focus`, `-visibility`
 * and `-presence`, migrated from the removed `globalAtom` to `externalAtom`.
 *
 * An explicit, closed list — never a glob over `packages/@valdres/*`, where
 * other browser packages still import `globalAtom`. These are not media
 * queries, so they stay out of `lib/browser-media-packages.ts`: online and
 * visibility give each store tree its own listeners on `window` / `document`,
 * focus shares one ref-counted listener pair per document, and presence is a
 * selector over focus and visibility that owns no listener of its own.
 *
 * Listing a package here is a TESTING claim only. Release eligibility is
 * governed separately by `.changeset/config.json` and
 * `scripts/publishable-packages.json`, and all four are still ignored.
 */
export const BROWSER_STATUS_PACKAGES = [
    { name: "@valdres/browser-online", dir: "packages/@valdres/browser-online" },
    { name: "@valdres/browser-focus", dir: "packages/@valdres/browser-focus" },
    {
        name: "@valdres/browser-visibility",
        dir: "packages/@valdres/browser-visibility",
    },
    // Last: it composes the two before it.
    {
        name: "@valdres/browser-presence",
        dir: "packages/@valdres/browser-presence",
    },
] as const

/**
 * The exact `valdres` peer range every package must declare. `externalAtom`
 * first shipped in `1.0.0-beta.39`. Checked by equality: the packed gate's
 * `satisfies` check alone would also accept the pre-migration
 * `^1.0.0-beta.19`.
 */
export const BROWSER_STATUS_CORE_PEER_RANGE = "^1.0.0-beta.39"

/**
 * The published core + React pair at that floor, installed from the registry
 * by the packed gate so the floor is executed rather than inferred:
 * `valdres-react@1.0.0-beta.7` was published alongside core `1.0.0-beta.39`.
 */
export const BROWSER_STATUS_FLOOR = {
    valdres: "1.0.0-beta.39",
    "valdres-react": "1.0.0-beta.7",
} as const
