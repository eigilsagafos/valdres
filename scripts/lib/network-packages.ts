/**
 * The network lane: `@valdres/public-ip` and `@valdres/bandwidth`, migrated
 * from the removed `globalAtom` / `globalStore` and async atom initializers to
 * `externalAtom` state with explicit network operations.
 *
 * An explicit, closed list — never a glob over `packages/@valdres/*`. These two
 * share what the browser lanes do not: no browser listener at all, realm-owned
 * state shared by every Store, and network work that starts only from an
 * explicit call (`requestPublicIp`, `measureBandwidth`) with shared in-flight
 * operations, per-caller cancellation and newest-wins publication.
 *
 * Tested by ci.yaml's `network` job (`scripts/check-network.ts` and the packed
 * gate `scripts/test-network-packed-consumer.ts`), which `scripts/verify.ts`
 * runs. Neither package is release-eligible: `releaseEligible` is the single
 * per-package claim `scripts/network-packages.test.ts` checks against
 * `.changeset/config.json`, `scripts/publishable-packages.json` and
 * `publish.needs`.
 */
export const NETWORK_PACKAGES = [
    {
        name: "@valdres/public-ip",
        dir: "packages/@valdres/public-ip",
        releaseEligible: false,
    },
    {
        name: "@valdres/bandwidth",
        dir: "packages/@valdres/bandwidth",
        releaseEligible: false,
    },
] as const

/** The last published version of both, which predates the migration. */
export const NETWORK_LEGACY_VERSION = "1.0.0-beta.8"

/**
 * The exact `valdres` peer range both packages declare. They use
 * `externalAtom`, `selector` and the `ExternalSource` / `ExternalAtom` /
 * `Selector` types; `externalAtom` first shipped in `1.0.0-beta.39`. Checked by
 * equality: a `satisfies` check alone would also accept the pre-migration
 * `^1.0.0-beta.19`.
 */
export const NETWORK_CORE_PEER_RANGE = "^1.0.0-beta.39"

/**
 * The published core + React pair at that floor, installed from the registry
 * by the packed gate so the floor is executed rather than inferred.
 */
export const NETWORK_FLOOR = {
    valdres: "1.0.0-beta.39",
    "valdres-react": "1.0.0-beta.7",
} as const

/** The newest core without `externalAtom`, which the floor must exclude. */
export const NETWORK_BELOW_FLOOR = "1.0.0-beta.38"
