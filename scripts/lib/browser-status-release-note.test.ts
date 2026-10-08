/**
 * Lifecycle cases for Stage A's migration-note guard, on self-contained
 * fixture states: the real note is deleted after prerelease exit, so these
 * cases must not depend on it. The repository's own state is checked in
 * `scripts/browser-status-packages.test.ts`.
 */
import { describe, expect, test } from "bun:test"
import { join } from "node:path"
import {
    STAGE_A_NOTE_ID,
    STAGE_A_NOTE_MARKER,
    STAGE_A_PACKAGES,
    STAGE_A_REQUIRED_TEXT,
    loadChangesetParser,
    stageANoteProblems,
} from "./browser-status-release-note"

const ROOT = join(import.meta.dir, "..", "..")
const parse = await loadChangesetParser(ROOT)

const changeset = (releases: Record<string, string>, summary: string) =>
    `---\n${Object.entries(releases)
        .map(([name, type]) => `"${name}": ${type}`)
        .join("\n")}\n---\n\n${summary}\n`

/** A complete note: the three packages at minor, every required claim. */
const NOTE = changeset(
    Object.fromEntries(STAGE_A_PACKAGES.map(name => [name, "minor"])),
    STAGE_A_REQUIRED_TEXT.join("\n\n"),
)

const FOCUS_FIX = changeset({ "@valdres/browser-focus": "patch" }, "Fix focus.")
const ONLINE_FEATURE = changeset(
    { "@valdres/browser-online": "minor" },
    "Add a feature.",
)
const SHARED_FIX = changeset(
    {
        "@valdres/browser-visibility": "patch",
        "@valdres/browser-keyboard": "patch",
    },
    "Shared fix.",
)
const STAGE_B = changeset(
    { "@valdres/browser-presence": "minor" },
    "Presence is now built on the migrated focus and visibility.",
)

// As `changeset version` writes it: attributed, then reflowed mid-marker.
const ENTRY = `- [#1](https://github.com/eigilsagafos/valdres/pull/1) [\`abc1234\`](https://github.com/eigilsagafos/valdres/commit/abc1234) Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - ${STAGE_A_NOTE_MARKER.replace(" browser state", "\n    browser state")}`

const state = (
    changesets: Record<string, string>,
    { version = "1.0.0-beta.9", released = 1 } = {},
) => ({
    changesets: new Map(Object.entries(changesets)),
    packages: new Map(
        STAGE_A_PACKAGES.map(name => [
            name,
            {
                version,
                changelog: `# ${name}\n\n${`## ${version}\n\n${ENTRY}\n\n`.repeat(released)}`,
            },
        ]),
    ),
})

const PENDING = { version: "1.0.0-beta.8", released: 0 }
const problems = (s: ReturnType<typeof state>) => stageANoteProblems(s, parse)

describe("Stage A migration note", () => {
    describe("accepts", () => {
        test.each([
            ["pending", state({ [STAGE_A_NOTE_ID]: NOTE }, PENDING)],
            ["consumed", state({ [`pre/${STAGE_A_NOTE_ID}`]: NOTE })],
            [
                // The stable `changeset version` deletes consumed notes and
                // repeats them in the 1.0.0 entry.
                "released past prerelease exit, with CHANGELOG evidence",
                state({}, { version: "1.0.0", released: 2 }),
            ],
            [
                "a later patch fix",
                state({
                    [`pre/${STAGE_A_NOTE_ID}`]: NOTE,
                    "fix-focus": FOCUS_FIX,
                }),
            ],
            [
                "a later minor feature beside the pending note",
                state(
                    {
                        [STAGE_A_NOTE_ID]: NOTE,
                        "online-feature": ONLINE_FEATURE,
                    },
                    PENDING,
                ),
            ],
            [
                "a fix shared with another released package",
                state({
                    [`pre/${STAGE_A_NOTE_ID}`]: NOTE,
                    shared: SHARED_FIX,
                }),
            ],
            [
                "Stage B's separate presence release",
                state({
                    [`pre/${STAGE_A_NOTE_ID}`]: NOTE,
                    "stage-b": STAGE_B,
                }),
            ],
            [
                "single-quoted front matter keys",
                state(
                    {
                        [STAGE_A_NOTE_ID]: NOTE.replace(
                            /^"(@[^"]+)":/gm,
                            "'$1':",
                        ),
                    },
                    PENDING,
                ),
            ],
        ])("%s", (_, s) => {
            expect(problems(s)).toEqual([])
        })
    })

    describe("rejects", () => {
        test.each([
            ["a note missing before release", state({}, PENDING), "is missing"],
            [
                "a consumed note deleted in prerelease mode",
                state({}),
                "is missing",
            ],
            [
                "a stable release without CHANGELOG evidence",
                state({}, { version: "1.0.0", released: 0 }),
                "released without the Stage A note",
            ],
            [
                "both pending and consumed copies",
                state({
                    [STAGE_A_NOTE_ID]: NOTE,
                    [`pre/${STAGE_A_NOTE_ID}`]: NOTE,
                }),
                "both pending and consumed",
            ],
            [
                "the note duplicated under another id",
                state(
                    { [STAGE_A_NOTE_ID]: NOTE, "copy-of-note": NOTE },
                    PENDING,
                ),
                "copy-of-note duplicates",
            ],
            [
                "a single-quoted duplicate",
                state({
                    [`pre/${STAGE_A_NOTE_ID}`]: NOTE,
                    "pre/quoted": NOTE.replace(/^"(@[^"]+)":/gm, "'$1':"),
                }),
                "pre/quoted duplicates",
            ],
            [
                "a note that drops a package",
                state(
                    {
                        [STAGE_A_NOTE_ID]: NOTE.replace(
                            /^"@valdres\/browser-visibility": minor\n/m,
                            "",
                        ),
                    },
                    PENDING,
                ),
                "not exactly",
            ],
            [
                "a note that also releases presence",
                state(
                    {
                        [STAGE_A_NOTE_ID]: NOTE.replace(
                            /^---\n/,
                            '---\n"@valdres/browser-presence": minor\n',
                        ),
                    },
                    PENDING,
                ),
                "not exactly",
            ],
            [
                "a patch bump",
                state(
                    {
                        [STAGE_A_NOTE_ID]: NOTE.replace(
                            /: minor$/gm,
                            ": patch",
                        ),
                    },
                    PENDING,
                ),
                "not minor",
            ],
            [
                "a pending note some CHANGELOG already carries",
                state({ [STAGE_A_NOTE_ID]: NOTE }, { released: 1 }),
                "already carries the pending note",
            ],
            [
                "a consumed note no CHANGELOG carries",
                state({ [`pre/${STAGE_A_NOTE_ID}`]: NOTE }, { released: 0 }),
                "0 times",
            ],
            [
                "a consumed note released twice",
                state({ [`pre/${STAGE_A_NOTE_ID}`]: NOTE }, { released: 2 }),
                "2 times",
            ],
        ])("%s", (_, s, expected) => {
            const found = problems(s)
            expect(found.some(problem => problem.includes(expected))).toBe(true)
        })

        test.each(STAGE_A_REQUIRED_TEXT.map(text => [text]))(
            "a note that no longer mentions %s",
            text => {
                const found = problems(
                    state(
                        {
                            [STAGE_A_NOTE_ID]: NOTE.replaceAll(
                                text,
                                "<removed>",
                            ),
                        },
                        PENDING,
                    ),
                )
                expect(found).toContain(
                    `${STAGE_A_NOTE_ID} no longer mentions ${text}`,
                )
            },
        )

        test.each([
            [
                "an invalid bump type",
                '---\n"@valdres/browser-focus": huge\n---\n\nx',
            ],
            ["invalid YAML", '---\n"@valdres/browser-focus": [patch\n---\n\nx'],
        ])("%s, as Changesets would", (_, note) => {
            expect(() =>
                problems(state({ [STAGE_A_NOTE_ID]: note }, PENDING)),
            ).toThrow()
        })
    })
})
