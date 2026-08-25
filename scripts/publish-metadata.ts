export const MINIMUM_NODE_VERSION = "22.12.0"
export const NODE_ENGINE_RANGE = `>=${MINIMUM_NODE_VERSION}`
/**
 * Packages whose `exports` map prepack must leave alone.
 *
 * valdres-svelte ships uncompiled source via @sveltejs/package and already
 * declares its final dist-pointing condition map, including the `svelte`
 * condition that the source→dist rewrite would drop. prepack skips the rewrite
 * for these, and first-publish.ts skips the matching "exports must be a
 * ./src/… string" manifest check, so the two cannot disagree about which
 * packages are exempt.
 */
export const PREPACK_EXPORT_REWRITE_EXEMPT: readonly string[] = [
    "valdres-svelte",
]

export const PUBLISH_EXPORT_CONDITION_ORDER = [
    "types",
    "development",
    "import",
    "default",
] as const
export const INSTANCE_GUARD_SIDE_EFFECTS = [
    "./dist/index.js",
    "./dist/development/index.js",
] as const

/**
 * The GitHub Actions identity npm accepts for trusted publishing (OIDC).
 *
 * Every published package needs a trusted publisher registered on npmjs.com
 * that matches the release job exactly. The OIDC token carries the workflow
 * path and the deployment environment as claims, so a drift in either one
 * fails the publish with an authorization error rather than a clear message.
 * scripts/first-publish.ts registers new packages from these values and
 * asserts the workflow still matches them.
 */
export const TRUSTED_PUBLISHER = {
    workflow: ".github/workflows/ci.yaml",
    environment: "npm-publish",
} as const

/** `npm trust` landed in this release; older CLIs must use the npmjs.com UI. */
export const MINIMUM_NPM_TRUST_VERSION = "11.10.0"
