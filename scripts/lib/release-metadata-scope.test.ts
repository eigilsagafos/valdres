import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
    assertGeneratedReleaseFiles,
    MAX_RELEASE_FILES,
    releaseMetadataPaths,
} from "./release-metadata-scope.mjs"

const policy = readFileSync(
    join(import.meta.dir, "..", "publishable-packages.json"),
    "utf8",
)
const packageDirs: string[] = JSON.parse(policy)

type File = { filename: string; previous_filename?: string }
const modified = (filename: string): File => ({ filename })
const renamed = (previous_filename: string, filename: string): File => ({
    filename,
    previous_filename,
})

const accepts = (files: File[], source = policy) =>
    expect(() => assertGeneratedReleaseFiles(files, source)).not.toThrow()
const rejects = (files: File[], message: string, source = policy) =>
    expect(() => assertGeneratedReleaseFiles(files, source)).toThrow(message)

describe("generated release metadata scope", () => {
    test("derives exactly a manifest and changelog per listed package", () => {
        expect([...releaseMetadataPaths(policy)].sort()).toEqual(
            packageDirs
                .flatMap(dir => [`${dir}/package.json`, `${dir}/CHANGELOG.md`])
                .sort(),
        )
    })

    test.each(packageDirs)("accepts release metadata for %s", dir => {
        accepts([
            modified(`${dir}/package.json`),
            modified(`${dir}/CHANGELOG.md`),
            modified("bun.lock"),
            modified(".changeset/pre.json"),
            renamed(
                ".changeset/quiet-rivers.md",
                ".changeset/pre/quiet-rivers.md",
            ),
        ])
    })

    test("accepts PR #406's changed-file list", () => {
        accepts([
            ...[
                "browser-keyboard-external-atom",
                "browser-keyboard-full-code-list",
                "browser-keyboard-last-keydown",
                "cheap-selector-failure-propagation",
                "selector-failure-recovery",
                "store-sub-settle",
            ].map(id =>
                renamed(`.changeset/${id}.md`, `.changeset/pre/${id}.md`),
            ),
            modified("bun.lock"),
            modified("packages/@valdres/browser-keyboard/CHANGELOG.md"),
            modified("packages/@valdres/browser-keyboard/package.json"),
            modified("packages/valdres/CHANGELOG.md"),
            modified("packages/valdres/package.json"),
        ])
    })

    test("accepts the Version Packages list once the hotkeys packages release", () => {
        accepts([
            ...[
                "browser-keyboard-native-keydown",
                "hotkeys-v1-dispatcher",
                "hotkeys-release-eligibility",
                "valdres-react-use-store-explicit",
            ].map(id =>
                renamed(`.changeset/${id}.md`, `.changeset/pre/${id}.md`),
            ),
            modified("bun.lock"),
            modified("packages/@valdres/browser-keyboard/CHANGELOG.md"),
            modified("packages/@valdres/browser-keyboard/package.json"),
            modified("packages/@valdres/hotkeys/CHANGELOG.md"),
            modified("packages/@valdres/hotkeys/package.json"),
            modified("packages/@valdres-react/hotkeys/CHANGELOG.md"),
            modified("packages/@valdres-react/hotkeys/package.json"),
            modified("packages/valdres-react/CHANGELOG.md"),
            modified("packages/valdres-react/package.json"),
        ])
    })

    test.each([
        ["runtime source", "packages/valdres/src/index.ts"],
        [
            "runtime file in a keyboard package",
            "packages/@valdres/browser-keyboard/src/index.ts",
        ],
        [
            "runtime file in a hotkeys package",
            "packages/@valdres/hotkeys/src/lib/registry.ts",
        ],
        [
            "runtime file in the React hotkeys package",
            "packages/@valdres-react/hotkeys/src/useHotkey.ts",
        ],
        ["hotkeys package README", "packages/@valdres/hotkeys/README.md"],
        ["built output", "packages/valdres/dist/index.js"],
        ["package README", "packages/valdres/README.md"],
        ["workflow", ".github/workflows/ci.yaml"],
        ["the release policy itself", "scripts/publishable-packages.json"],
        [
            "the release classifier itself",
            "scripts/lib/release-metadata-scope.mjs",
        ],
        ["Changesets config", ".changeset/config.json"],
        ["nested changeset", ".changeset/pre/nested/x.md"],
        ["root manifest", "package.json"],
        [
            "unlisted browser package",
            "packages/@valdres/browser-geolocation/package.json",
        ],
        [
            "unlisted color-mode package",
            "packages/@valdres/color-mode/CHANGELOG.md",
        ],
        ["unlisted framework adapter", "packages/valdres-vue/package.json"],
        ["prefix-sharing package", "packages/valdres-reactive/package.json"],
        ["case-folded path", "packages/valdres/Package.json"],
    ])("rejects %s", (_, path) => {
        rejects(
            [modified("packages/valdres/package.json"), modified(path)],
            `Refusing benchmark check for non-release files: ${path}`,
        )
    })

    test("rejects a disallowed rename source", () => {
        rejects(
            [
                modified("packages/valdres/package.json"),
                renamed(
                    "packages/valdres/src/store.ts",
                    ".changeset/pre/store.md",
                ),
            ],
            "non-release files: packages/valdres/src/store.ts",
        )
        rejects(
            [
                renamed(
                    "packages/@valdres/browser-geolocation/package.json",
                    "packages/@valdres/browser-keyboard/package.json",
                ),
            ],
            "non-release files: packages/@valdres/browser-geolocation/package.json",
        )
    })

    test("rejects malformed file entries", () => {
        rejects(
            [modified("packages/valdres/package.json"), {} as File],
            "non-release files",
        )
    })

    test("enforces the file-count limits", () => {
        rejects([], "Unexpected generated release file count: 0")
        const tooMany = Array.from({ length: MAX_RELEASE_FILES + 1 }, (_, i) =>
            modified(`.changeset/pre/c${i}.md`),
        )
        rejects(
            tooMany,
            `Unexpected generated release file count: ${MAX_RELEASE_FILES + 1}`,
        )
        accepts([
            modified("packages/valdres/package.json"),
            ...tooMany.slice(0, MAX_RELEASE_FILES - 1),
        ])
    })

    test("requires a listed package manifest", () => {
        rejects(
            [modified("bun.lock"), modified("packages/valdres/CHANGELOG.md")],
            "Generated release pull request has no package manifest",
        )
    })

    test.each([
        ["invalid JSON", "{", "not valid JSON"],
        ["an empty list", "[]", "non-empty array"],
        ["an object", '{"packages/valdres":true}', "non-empty array"],
        ["a glob", '["packages/**"]', "invalid directory"],
        ["a traversal", '["packages/../scripts"]', "invalid directory"],
        ["a path outside packages/", '[".github"]', "invalid directory"],
        ["a nested file path", '["packages/valdres/src"]', "invalid directory"],
        ["a non-string entry", "[1]", "invalid directory"],
        [
            "a duplicate",
            '["packages/valdres","packages/valdres"]',
            "more than once",
        ],
    ])("rejects a policy with %s", (_, source, message) => {
        rejects([modified("packages/valdres/package.json")], message, source)
    })
})
