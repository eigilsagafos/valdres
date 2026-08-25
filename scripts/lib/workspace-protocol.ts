/**
 * The `workspace:` protocol check, in one place.
 *
 * Changesets does not rewrite the bare `workspace:^` shortcut, and
 * `changeset publish` shells out to `npm publish`, which has never understood
 * the protocol. A leftover range is therefore published verbatim and breaks
 * every consumer. Two gates gate that: verify-publish.ts inspects the prepacked
 * manifest, and first-publish.ts inspects the authored one before a new
 * package's name is reserved. They were checking the same three fields with the
 * same substring test, so the rule lives here and the callers only choose how
 * to report it.
 *
 * devDependencies are deliberately absent: prepack strips them, so they may use
 * `workspace:^` for ergonomics with non-publishable packages like
 * @valdres/test.
 */

export const PUBLISHED_DEPENDENCY_FIELDS = [
    "dependencies",
    "peerDependencies",
    "optionalDependencies",
] as const

export interface WorkspaceProtocolViolation {
    field: (typeof PUBLISHED_DEPENDENCY_FIELDS)[number]
    dependency: string
    range: string
}

export function findWorkspaceProtocolViolations(
    manifest: Record<string, unknown>,
): WorkspaceProtocolViolation[] {
    const violations: WorkspaceProtocolViolation[] = []

    for (const field of PUBLISHED_DEPENDENCY_FIELDS) {
        const dependencies = manifest[field]
        if (!dependencies || typeof dependencies !== "object") continue

        for (const [dependency, range] of Object.entries(dependencies)) {
            if (typeof range === "string" && range.includes("workspace:")) {
                violations.push({ field, dependency, range })
            }
        }
    }

    return violations
}
