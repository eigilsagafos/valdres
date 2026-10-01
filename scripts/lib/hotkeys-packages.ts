/**
 * The hotkeys lane's release metadata: `@valdres/hotkeys` and its React
 * bindings, released together. Peer floors are checked by equality — a
 * `satisfies` check alone would also accept an older, wider floor.
 */
export const HOTKEYS_PACKAGES = [
    { name: "@valdres/hotkeys", dir: "packages/@valdres/hotkeys" },
    { name: "@valdres-react/hotkeys", dir: "packages/@valdres-react/hotkeys" },
] as const

/**
 * The exact peer ranges each package must declare, and why each floor is what
 * it is:
 * - `valdres` beta.41 is the first core with `store.sub(…, { settle })`.
 * - `@valdres/browser-keyboard` beta.10 and `valdres-react` beta.8 are the
 *   releases carrying the native keydown bridge and `useStore(store?)`.
 * - `@valdres/hotkeys` beta.8 is the first release of the v1 hotkeys API; the
 *   published beta.7 still carries the retired callback API.
 */
export const HOTKEYS_PEER_RANGES = {
    "@valdres/hotkeys": {
        "@valdres/browser-keyboard": "^1.0.0-beta.10",
        valdres: "^1.0.0-beta.41",
    },
    "@valdres-react/hotkeys": {
        "@valdres/hotkeys": "^1.0.0-beta.8",
        react: ">=18",
        valdres: "^1.0.0-beta.41",
        "valdres-react": "^1.0.0-beta.8",
    },
} as const

/** Published versions that predate what each floor requires. */
export const HOTKEYS_EXCLUDED_PEER_VERSIONS = {
    "@valdres/hotkeys": "1.0.0-beta.7",
    "@valdres/browser-keyboard": "1.0.0-beta.9",
    "valdres-react": "1.0.0-beta.7",
    valdres: "1.0.0-beta.40",
} as const

/** Both hotkeys packages must release at least this version together: the
 * first release of the v1 API. A plan or manifest leaving either one below it
 * would pair a v1 package with the legacy one. */
export const HOTKEYS_RELEASE_FLOOR = "1.0.0-beta.8"

/** One changeset, by repository path and its front-matter releases. */
export interface ChangesetEntry {
    readonly path: string
    readonly releases: Readonly<Record<string, string>>
}

const CHANGESET_PATH = /^\.changeset\/(?:pre\/)?([a-z0-9-]+)\.md$/

/** The `"name": bump` pairs in a changeset's front matter. */
export const parseChangesetReleases = (
    source: string,
): Record<string, string> => {
    const match = source.match(/^---\n([\s\S]*?)\n?---/)
    if (match === null) return {}
    return Object.fromEntries(
        [...match[1]!.matchAll(/^"([^"]+)":\s*(\w+)\s*$/gm)].map(entry => [
            entry[1]!,
            entry[2]!,
        ]),
    )
}

/**
 * Throws unless exactly one changeset, whether still pending (`.changeset/`)
 * or already consumed into a prerelease (`.changeset/pre/`), names a hotkeys
 * package as a major release — and that one names both as major. Patch and
 * minor changesets for the packages are unaffected. Returns the one entry.
 */
export const assertHotkeysReleaseNotes = (
    entries: readonly ChangesetEntry[],
): ChangesetEntry => {
    const names = HOTKEYS_PACKAGES.map(pkg => pkg.name) as string[]
    for (const entry of entries)
        if (!CHANGESET_PATH.test(entry.path))
            throw new Error(`Not a changeset path: ${entry.path}`)
    const breaking = entries.filter(entry =>
        names.some(name => entry.releases[name] === "major"),
    )
    if (breaking.length !== 1)
        throw new Error(
            `Expected exactly one breaking hotkeys changeset, found ${breaking.length}: ${breaking.map(entry => entry.path).join(", ") || "none"}`,
        )
    const [entry] = breaking as [ChangesetEntry]
    for (const name of names)
        if (entry.releases[name] !== "major")
            throw new Error(
                `${entry.path} must release ${name} as major, not ${entry.releases[name] ?? "omit it"}`,
            )
    return entry
}

/**
 * Throws unless every hotkeys package's release version — the planned version
 * where Changesets has one pending, otherwise its manifest version — is at
 * least {@link HOTKEYS_RELEASE_FLOOR}.
 */
export const assertHotkeysReleaseCohort = (
    plan: ReadonlyMap<string, string>,
    manifestVersions: Readonly<Record<string, string>>,
): Record<string, string> => {
    const versions: Record<string, string> = {}
    for (const { name } of HOTKEYS_PACKAGES) {
        const version = plan.get(name) ?? manifestVersions[name]
        if (version === undefined)
            throw new Error(`No release or manifest version for ${name}`)
        if (Bun.semver.order(version, HOTKEYS_RELEASE_FLOOR) < 0)
            throw new Error(
                `${name} would release ${version}, below ${HOTKEYS_RELEASE_FLOOR}: both hotkeys packages must release the v1 API together`,
            )
        versions[name] = version
    }
    return versions
}
