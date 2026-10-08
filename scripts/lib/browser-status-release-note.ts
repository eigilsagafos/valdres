import { existsSync, readFileSync, readdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { BROWSER_STATUS_CORE_PEER_RANGE } from "./browser-status-packages"

/**
 * Stage A's migration note: the one changeset that carries the breaking
 * ownership and lifecycle notes for online, focus and visibility.
 *
 * The guard follows that note by id through its lifecycle rather than counting
 * every changeset that names these packages, so later patch and minor fixes,
 * fixes shared with other released packages, and Stage B's separate presence
 * release are all ordinary changesets:
 *
 * - pending: `.changeset/<id>.md`, and no CHANGELOG carries the note yet;
 * - consumed: the Version Packages PR moves it to `.changeset/pre/<id>.md`,
 *   and each package's CHANGELOG carries it exactly once;
 * - after prerelease exit: the stable `changeset version` re-applies and then
 *   deletes the consumed note, so the note is no longer required once every
 *   package has left the `1.0.0` prerelease line. The CHANGELOG entries are
 *   the durable evidence from then on.
 *
 * Exactly one copy may exist while required, it must be complete, and no other
 * changeset may carry the note's text.
 */
export const STAGE_A_NOTE_ID = "browser-status-release-stage-a"

export const STAGE_A_PACKAGES = [
    "@valdres/browser-online",
    "@valdres/browser-focus",
    "@valdres/browser-visibility",
] as const

/** Documentary in prerelease mode: patch, minor and major all give beta.9. */
export const STAGE_A_BUMP = "minor"

/** The note's opening line. Generated CHANGELOG entries keep it verbatim. */
export const STAGE_A_NOTE_MARKER =
    "**Breaking: online, focus and visibility are now read-only browser state.**"

/** Claims the note must make, so it cannot silently lose one. */
export const STAGE_A_REQUIRED_TEXT = [
    STAGE_A_NOTE_MARKER,
    "read-only",
    "getServerSnapshot",
    BROWSER_STATUS_CORE_PEER_RANGE,
    "@valdres/browser-presence",
] as const

/** The prerelease line the note belongs to. */
const STAGE_A_STABLE = "1.0.0"

export type ParsedChangeset = {
    releases: { name: string; type: string }[]
    summary: string
}

export type ReleaseNoteState = {
    /** Changeset contents by id: `x` is pending, `pre/x` is consumed. */
    changesets: ReadonlyMap<string, string>
    /** Manifest version and CHANGELOG contents per Stage A package. */
    packages: ReadonlyMap<string, { version: string; changelog: string }>
}

/**
 * The parser Changesets itself runs, resolved through the installed CLI so the
 * guard reads front matter exactly as `changeset version` will (any valid YAML
 * key style, `none` bumps, malformed files rejected).
 */
export const loadChangesetParser = async (
    root: string,
): Promise<(contents: string) => ParsedChangeset> => {
    const cli = dirname(Bun.resolveSync("@changesets/cli/package.json", root))
    const parse = await import(Bun.resolveSync("@changesets/parse", cli))
    return parse.parseChangesetFile
}

const PACKAGE_DIRS: Record<(typeof STAGE_A_PACKAGES)[number], string> = {
    "@valdres/browser-online": "packages/@valdres/browser-online",
    "@valdres/browser-focus": "packages/@valdres/browser-focus",
    "@valdres/browser-visibility": "packages/@valdres/browser-visibility",
}

export const readReleaseNoteState = (root: string): ReleaseNoteState => {
    const changesets = new Map<string, string>()
    for (const prefix of ["", "pre/"]) {
        const dir = join(root, ".changeset", prefix)
        if (!existsSync(dir)) continue
        for (const file of readdirSync(dir)) {
            if (!file.endsWith(".md") || file === "README.md") continue
            changesets.set(
                `${prefix}${file.slice(0, -3)}`,
                readFileSync(join(dir, file), "utf8"),
            )
        }
    }
    const packages = new Map<string, { version: string; changelog: string }>()
    for (const name of STAGE_A_PACKAGES) {
        const dir = join(root, PACKAGE_DIRS[name])
        const changelog = join(dir, "CHANGELOG.md")
        packages.set(name, {
            version: JSON.parse(readFileSync(join(dir, "package.json"), "utf8"))
                .version,
            changelog: existsSync(changelog)
                ? readFileSync(changelog, "utf8")
                : "",
        })
    }
    return { changesets, packages }
}

// Changesets prefixes each CHANGELOG entry with its commit and pull request and
// reflows the text, so the marker may wrap across lines there.
const flatten = (text: string) => text.replace(/\s+/g, " ")
const occurrences = (text: string, needle: string) =>
    flatten(text).split(flatten(needle)).length - 1

/** Every way the state breaks the note's lifecycle; empty when it holds. */
export const stageANoteProblems = (
    state: ReleaseNoteState,
    parse: (contents: string) => ParsedChangeset,
): string[] => {
    const problems: string[] = []
    const pending = state.changesets.get(STAGE_A_NOTE_ID)
    const consumed = state.changesets.get(`pre/${STAGE_A_NOTE_ID}`)

    if (pending !== undefined && consumed !== undefined)
        problems.push(`${STAGE_A_NOTE_ID} is both pending and consumed`)
    for (const [id, contents] of state.changesets) {
        if (id === STAGE_A_NOTE_ID || id === `pre/${STAGE_A_NOTE_ID}`) continue
        if (occurrences(contents, STAGE_A_NOTE_MARKER) > 0)
            problems.push(`${id} duplicates the Stage A migration note`)
    }

    const note = pending ?? consumed
    if (note !== undefined) {
        const { releases, summary } = parse(note)
        const named = releases.map(release => release.name).sort()
        if (
            JSON.stringify(named) !==
            JSON.stringify([...STAGE_A_PACKAGES].sort())
        )
            problems.push(
                `${STAGE_A_NOTE_ID} releases ${named.join(", ") || "nothing"}, not exactly ${STAGE_A_PACKAGES.join(", ")}`,
            )
        for (const release of releases)
            if (release.type !== STAGE_A_BUMP)
                problems.push(
                    `${STAGE_A_NOTE_ID} bumps ${release.name} ${release.type}, not ${STAGE_A_BUMP}`,
                )
        for (const required of STAGE_A_REQUIRED_TEXT)
            if (occurrences(summary, required) === 0)
                problems.push(
                    `${STAGE_A_NOTE_ID} no longer mentions ${required}`,
                )
    }

    for (const [name, { version, changelog }] of state.packages) {
        const released = occurrences(changelog, STAGE_A_NOTE_MARKER)
        if (pending !== undefined && released !== 0)
            problems.push(`${name} CHANGELOG already carries the pending note`)
        if (consumed !== undefined && released !== 1)
            problems.push(
                `${name} CHANGELOG carries the consumed note ${released} times, not once`,
            )
        if (note !== undefined) continue
        if (Bun.semver.order(version, STAGE_A_STABLE) < 0)
            problems.push(
                `${STAGE_A_NOTE_ID} is missing while ${name}@${version} is still a ${STAGE_A_STABLE} prerelease`,
            )
        else if (released === 0)
            problems.push(
                `${name}@${version} was released without the Stage A note`,
            )
    }
    return problems
}
