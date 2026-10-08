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
 * Every package listed here is tested by the `browser-status` job. Release
 * eligibility is a separate, per-package claim (`releaseEligible`) that
 * `scripts/browser-status-packages.test.ts` checks against
 * `.changeset/config.json` and `scripts/publishable-packages.json`.
 *
 * Stage A released online, focus and visibility as `1.0.0-beta.9`. Stage B
 * releases presence, whose plain-semver focus/visibility ranges were raised to
 * `BROWSER_STATUS_PRESENCE_DEPENDENCY_RANGE` by hand first: Changesets will not
 * raise them (`bumpVersionsWithWorkspaceProtocolOnly`), and the old
 * `^1.0.0-beta.8` admitted the legacy pre-migration builds.
 */
export const BROWSER_STATUS_PACKAGES = [
    {
        name: "@valdres/browser-online",
        dir: "packages/@valdres/browser-online",
        releaseEligible: true,
    },
    {
        name: "@valdres/browser-focus",
        dir: "packages/@valdres/browser-focus",
        releaseEligible: true,
    },
    {
        name: "@valdres/browser-visibility",
        dir: "packages/@valdres/browser-visibility",
        releaseEligible: true,
    },
    // Last: it composes the two before it.
    {
        name: "@valdres/browser-presence",
        dir: "packages/@valdres/browser-presence",
        releaseEligible: true,
    },
] as const

/**
 * The last published focus/visibility version that predates the migration.
 * Presence may only be release-eligible while its ranges exclude it.
 */
export const BROWSER_STATUS_LEGACY_VERSION = "1.0.0-beta.8"

/**
 * The exact range presence declares for focus and visibility: the first
 * migrated releases, published in Stage A. Checked by equality, and the packed
 * gate fails if it admits `BROWSER_STATUS_LEGACY_VERSION`.
 */
export const BROWSER_STATUS_PRESENCE_DEPENDENCY_RANGE = "^1.0.0-beta.9"

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
