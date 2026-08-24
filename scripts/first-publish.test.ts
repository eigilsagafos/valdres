import { expect, test } from "bun:test"
import {
    githubRepoFromUrl,
    parseFirstPublishArgs,
    placeholderManifest,
    readRegistryVersions,
    resolvePackage,
    resolvePublishTag,
    validatePublishManifest,
    type CommandResult,
} from "./first-publish"
import {
    MINIMUM_NPM_TRUST_VERSION,
    PREPACK_EXPORT_REWRITE_EXEMPT,
    TRUSTED_PUBLISHER,
} from "./publish-metadata"
import { readPublicPackages, REPO_ROOT } from "./public-packages"

const VALID_MANIFEST = {
    name: "@valdres/browser-mouse",
    version: "1.0.0-beta.0",
    description: "Reactive pointer position",
    license: "MIT",
    exports: { ".": "./src/index.ts" },
    files: ["dist"],
    publishConfig: { access: "public" },
    repository: { url: "git+https://github.com/eigilsagafos/valdres.git" },
    peerDependencies: { valdres: "^1.0.0-beta.19" },
}

test("parses the target and every flag", () => {
    expect(parseFirstPublishArgs(["@valdres/browser-mouse"])).toEqual({
        target: "@valdres/browser-mouse",
        placeholder: false,
        trustOnly: false,
        skipBuild: false,
        skipTrust: false,
        dryRun: false,
        noLatest: false,
        help: false,
    })

    expect(
        parseFirstPublishArgs([
            "@valdres/browser-mouse",
            "--placeholder",
            "--dry-run",
            "--skip-build",
            "--no-latest",
            "--tag",
            "next",
        ]),
    ).toEqual({
        target: "@valdres/browser-mouse",
        placeholder: true,
        trustOnly: false,
        skipBuild: true,
        skipTrust: false,
        dryRun: true,
        noLatest: true,
        help: false,
        tag: "next",
    })
})

test("--help answers on its own, without a target", () => {
    expect(parseFirstPublishArgs(["--help"]).help).toBe(true)
    expect(parseFirstPublishArgs(["-h"]).help).toBe(true)
    // The combination rules describe real work, so --help skips them.
    expect(() =>
        parseFirstPublishArgs(["--help", "--trust-only", "--placeholder"]),
    ).not.toThrow()
})

test("always resolves an explicit dist-tag, which npm requires for prereleases", () => {
    expect(resolvePublishTag(undefined, "beta")).toBe("beta")
    expect(resolvePublishTag("next", "beta")).toBe("next")
    expect(resolvePublishTag(undefined, null)).toBe("latest")
    expect(resolvePublishTag("rc", null)).toBe("rc")
})

test("rejects malformed argument lists", () => {
    expect(() => parseFirstPublishArgs([])).toThrow(/Pass the package name/)
    expect(() => parseFirstPublishArgs(["a", "b"])).toThrow(/extra argument/)
    expect(() => parseFirstPublishArgs(["a", "--nope"])).toThrow(
        /Unknown option/,
    )
    expect(() => parseFirstPublishArgs(["a", "--tag"])).toThrow(
        /--tag requires a value/,
    )
    expect(() => parseFirstPublishArgs(["a", "--tag", "--dry-run"])).toThrow(
        /--tag requires a value/,
    )
    expect(() =>
        parseFirstPublishArgs(["a", "--trust-only", "--placeholder"]),
    ).toThrow(/cannot be combined/)
})

test("accepts a release-ready manifest", () => {
    expect(validatePublishManifest(VALID_MANIFEST)).toEqual([])
})

test("reports every manifest defect at once", () => {
    const problems = validatePublishManifest({
        name: "@valdres/browser-mouse",
        version: "1.0.0-beta.0",
        exports: {},
        files: ["src"],
        publishConfig: { access: "restricted" },
        dependencies: { valdres: "workspace:^" },
    })

    expect(problems).toEqual([
        'missing "description"',
        'missing "license"',
        '"exports" has no "." entry',
        '"files" must include "dist"',
        '"publishConfig.access" must be "public"',
        'missing "repository.url"',
        "dependencies.valdres uses the workspace: protocol",
    ])
})

test("rejects export shapes that would crash prepack partway through", () => {
    // prepack string-splits every export target to build the dist-shaped
    // condition map. A condition map here satisfies `"." in exports` but makes
    // prepack throw `v.split is not a function` *after* it has written
    // package.tmp.json, so the manifest gate has to catch it first.
    expect(
        validatePublishManifest({
            ...VALID_MANIFEST,
            exports: {
                ".": {
                    types: "./dist/types/index.d.ts",
                    default: "./dist/index.js",
                },
            },
        }),
    ).toEqual([
        'exports["."] must be a source path string, not a condition map — prepack builds the conditions',
    ])

    expect(
        validatePublishManifest({
            ...VALID_MANIFEST,
            exports: { ".": "./dist/index.js" },
        }),
    ).toEqual(['exports["."] must point into ./src/, got "./dist/index.js"'])

    // Subpath exports are checked too, not just the root.
    expect(
        validatePublishManifest({
            ...VALID_MANIFEST,
            exports: {
                ".": "./src/index.ts",
                "./extra": { default: "./x.js" },
            },
        }),
    ).toEqual([
        'exports["./extra"] must be a source path string, not a condition map — prepack builds the conditions',
    ])
})

test("exempts exactly the packages prepack leaves alone", () => {
    // valdres-svelte authors its own dist-pointing condition map and prepack
    // skips the rewrite for it, so the manifest gate must skip it too.
    const svelteShaped = {
        ...VALID_MANIFEST,
        exports: {
            ".": { types: "./dist/index.d.ts", svelte: "./dist/index.js" },
        },
    }

    for (const name of PREPACK_EXPORT_REWRITE_EXEMPT) {
        expect(validatePublishManifest({ ...svelteShaped, name })).toEqual([])
    }
    expect(
        validatePublishManifest({ ...svelteShaped, name: "valdres-vue" }),
    ).not.toEqual([])
})

test("catches the workspace: protocol in peer and optional dependencies", () => {
    expect(
        validatePublishManifest({
            ...VALID_MANIFEST,
            peerDependencies: { valdres: "workspace:^" },
            optionalDependencies: { extra: "workspace:*" },
        }),
    ).toEqual([
        "peerDependencies.valdres uses the workspace: protocol",
        "optionalDependencies.extra uses the workspace: protocol",
    ])
})

test("derives owner/repo from the repository url forms npm accepts", () => {
    expect(
        githubRepoFromUrl("git+https://github.com/eigilsagafos/valdres.git"),
    ).toBe("eigilsagafos/valdres")
    expect(githubRepoFromUrl("https://github.com/eigilsagafos/valdres")).toBe(
        "eigilsagafos/valdres",
    )
    expect(githubRepoFromUrl("git@github.com:eigilsagafos/valdres.git")).toBe(
        "eigilsagafos/valdres",
    )
    expect(() => githubRepoFromUrl("https://gitlab.com/a/b.git")).toThrow(
        /Cannot derive owner\/repo/,
    )
})

test("the npm trust floor is a range Bun.semver can evaluate", () => {
    // The version gate delegates to Bun.semver rather than hand-rolling a
    // comparison; this pins the constant to a shape it accepts.
    const range = `>=${MINIMUM_NPM_TRUST_VERSION}`
    expect(Bun.semver.satisfies(MINIMUM_NPM_TRUST_VERSION, range)).toBe(true)
    expect(Bun.semver.satisfies("11.9.9", range)).toBe(false)
    expect(Bun.semver.satisfies("12.0.0", range)).toBe(true)
})

test("treats an unknown package as free and a broken registry read as fatal", () => {
    const reply = (result: Partial<CommandResult>) => () => ({
        exitCode: 0,
        stdout: "",
        stderr: "",
        ...result,
    })

    expect(
        readRegistryVersions(
            "@valdres/browser-mouse",
            reply({ exitCode: 1, stderr: "npm error code E404" }),
        ),
    ).toBeNull()

    expect(
        readRegistryVersions(
            "@valdres/browser-geolocation",
            reply({ stdout: '["1.0.0-beta.0","1.0.0-beta.1"]' }),
        ),
    ).toEqual(["1.0.0-beta.0", "1.0.0-beta.1"])

    // npm prints a bare string when only one version exists.
    expect(readRegistryVersions("solo", reply({ stdout: '"1.0.0"' }))).toEqual([
        "1.0.0",
    ])

    // A network or auth failure must not read as "the name is available".
    expect(() =>
        readRegistryVersions(
            "@valdres/browser-mouse",
            reply({ exitCode: 1, stderr: "npm error code ENOTFOUND registry" }),
        ),
    ).toThrow(/npm view .* failed/)
})

test("the placeholder carries metadata only, never code or an exports map", () => {
    const stub = placeholderManifest(VALID_MANIFEST)

    expect(stub.name).toBe("@valdres/browser-mouse")
    expect(stub.version).toBe("1.0.0-beta.0")
    expect(stub.publishConfig).toEqual({ access: "public" })
    expect(stub.exports).toBeUndefined()
    expect(stub.files).toBeUndefined()
    expect(stub.peerDependencies).toBeUndefined()
    expect(stub.description).toMatch(/Placeholder/)
})

test("resolves a package by name, by directory, and by bare directory", () => {
    const packages = [
        {
            dir: "packages/@valdres/browser-mouse",
            name: "@valdres/browser-mouse",
            version: "1.0.0-beta.0",
        },
    ]

    for (const target of [
        "@valdres/browser-mouse",
        "packages/@valdres/browser-mouse",
        "packages/@valdres/browser-mouse/",
        "@valdres/browser-mouse/",
    ]) {
        expect(resolvePackage(packages, target)).toBe(packages[0])
    }

    expect(() => resolvePackage(packages, "@valdres/nope")).toThrow(
        /not a publishable workspace package/,
    )
})

test("the registered trusted publisher matches the release workflow", async () => {
    const workflow = await Bun.file(
        `${REPO_ROOT}/${TRUSTED_PUBLISHER.workflow}`,
    ).text()

    expect(workflow).toContain(`environment: ${TRUSTED_PUBLISHER.environment}`)
    expect(workflow).toContain("id-token: write")
    // The OIDC exchange needs a newer npm than the runner image ships, and
    // `npm trust` needs newer still; the workflow upgrades npm globally.
    expect(workflow).toContain("npm install -g npm@latest")
    expect(MINIMUM_NPM_TRUST_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
})

test("every shipped package would pass the first-publish manifest gate", async () => {
    const packages = await readPublicPackages(REPO_ROOT)
    const offenders: string[] = []

    for (const pkg of packages) {
        const manifest = await Bun.file(
            `${REPO_ROOT}/${pkg.dir}/package.json`,
        ).json()
        const problems = validatePublishManifest(manifest)
        if (problems.length > 0) {
            offenders.push(`${pkg.name}: ${problems.join(", ")}`)
        }
    }

    expect(offenders).toEqual([])
})
