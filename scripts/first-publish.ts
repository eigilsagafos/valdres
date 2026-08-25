/**
 * Bootstraps a brand-new package on npm so the release workflow's OIDC
 * trusted publishing can take over.
 *
 * npm cannot create a package name over OIDC. A trusted publisher attaches to
 * a package that already exists — `npm trust` states the requirement outright
 * ("Package must exist"), and the npmjs.com form only appears on a published
 * package's settings page. So every new package needs exactly one locally
 * authenticated publish, after which CI owns all of its releases.
 *
 * Run this BEFORE the package merges to main. `changeset publish` publishes
 * any non-private workspace package whose local version is missing from the
 * registry — it does not need a changeset to decide that — so once the package
 * is on main, the next Version Packages merge tries to publish it over OIDC
 * and takes the release job down partway through a release.
 *
 *   bun run first-publish @valdres/browser-mouse --dry-run
 *   bun run first-publish @valdres/browser-mouse
 *   bun run first-publish @valdres/browser-mouse --placeholder
 *   bun run first-publish @valdres/browser-mouse --trust-only
 *
 * See RELEASING.md, "Bootstrapping a new package", for the full sequence.
 */

import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { withPrepacked } from "./lib/with-prepacked.ts"
import { findWorkspaceProtocolViolations } from "./lib/workspace-protocol.ts"
import {
    MINIMUM_NPM_TRUST_VERSION,
    PREPACK_EXPORT_REWRITE_EXEMPT,
    TRUSTED_PUBLISHER,
} from "./publish-metadata.ts"
import {
    readPublicPackages,
    REPO_ROOT,
    type PublicPackage,
} from "./public-packages.ts"

const USAGE = `
Usage: bun run first-publish <package-name-or-dir> [options]

  --placeholder   Publish a metadata-only stub instead of the real build, so
                  the first artifact users can install comes from CI with a
                  provenance attestation.
  --trust-only    Skip publishing; only register the trusted publisher. Use
                  when the package is already on npm.
  --tag <tag>     npm dist-tag for this publish. Defaults to the Changesets
                  prerelease tag, or "latest" outside prerelease mode.
  --no-latest     Do not additionally point "latest" at the bootstrap version.
  --skip-build    Reuse the existing dist/ output instead of rebuilding.
  --skip-trust    Publish only; register the trusted publisher separately.
  --dry-run       Run every check and pack the tarball without publishing.
  --help          Show this message.
`.trim()

export interface FirstPublishOptions {
    target: string
    placeholder: boolean
    trustOnly: boolean
    skipBuild: boolean
    skipTrust: boolean
    dryRun: boolean
    noLatest: boolean
    help: boolean
    tag?: string
}

export function parseFirstPublishArgs(argv: string[]): FirstPublishOptions {
    const options: FirstPublishOptions = {
        target: "",
        placeholder: false,
        trustOnly: false,
        skipBuild: false,
        skipTrust: false,
        dryRun: false,
        noLatest: false,
        help: false,
    }

    for (let index = 0; index < argv.length; index++) {
        const arg = argv[index]
        if (arg === "--help" || arg === "-h") options.help = true
        else if (arg === "--placeholder") options.placeholder = true
        else if (arg === "--trust-only") options.trustOnly = true
        else if (arg === "--skip-build") options.skipBuild = true
        else if (arg === "--skip-trust") options.skipTrust = true
        else if (arg === "--dry-run") options.dryRun = true
        else if (arg === "--no-latest") options.noLatest = true
        else if (arg === "--tag") {
            const value = argv[++index]
            if (!value || value.startsWith("--")) {
                throw new Error("--tag requires a value")
            }
            options.tag = value
        } else if (arg.startsWith("--")) {
            throw new Error(`Unknown option: ${arg}`)
        } else if (options.target) {
            throw new Error(`Unexpected extra argument: ${arg}`)
        } else {
            options.target = arg
        }
    }

    // --help is answerable on its own; everything below describes real work.
    if (options.help) return options

    if (!options.target) {
        throw new Error("Pass the package name or directory to bootstrap")
    }
    if (options.trustOnly && (options.placeholder || options.skipTrust)) {
        throw new Error(
            "--trust-only cannot be combined with --placeholder or --skip-trust",
        )
    }

    return options
}

/**
 * Manifest requirements a package must already satisfy before its name is
 * reserved on npm. Publishing is irreversible in practice — a bad first
 * version stays in the version list forever — so these are hard errors rather
 * than something to fix in a follow-up release.
 */
export function validatePublishManifest(
    manifest: Record<string, unknown>,
): string[] {
    const problems: string[] = []

    for (const field of ["name", "version", "description", "license"]) {
        if (typeof manifest[field] !== "string" || manifest[field] === "") {
            problems.push(`missing "${field}"`)
        }
    }

    // prepack rewrites each export target from `./src/…` to the built `./dist/…`
    // paths by string-splitting it, so every value must be a string. A package
    // authored with a condition map here passes `"." in exports` and then kills
    // prepack partway through with `v.split is not a function`.
    const exportsMap = manifest.exports
    if (
        !exportsMap ||
        typeof exportsMap !== "object" ||
        Array.isArray(exportsMap)
    ) {
        problems.push('missing an "exports" map')
    } else if (!("." in exportsMap)) {
        problems.push('"exports" has no "." entry')
    } else if (
        // Narrowing, not a cast: a missing name is already reported above.
        typeof manifest.name !== "string" ||
        !PREPACK_EXPORT_REWRITE_EXEMPT.includes(manifest.name)
    ) {
        for (const [subpath, target] of Object.entries(exportsMap)) {
            if (typeof target !== "string") {
                problems.push(
                    `exports["${subpath}"] must be a source path string, not a condition map — prepack builds the conditions`,
                )
            } else if (!target.startsWith("./src/")) {
                problems.push(
                    `exports["${subpath}"] must point into ./src/, got "${target}"`,
                )
            }
        }
    }

    if (!Array.isArray(manifest.files) || !manifest.files.includes("dist")) {
        problems.push('"files" must include "dist"')
    }

    const publishConfig = manifest.publishConfig as
        | { access?: string }
        | undefined
    if (publishConfig?.access !== "public") {
        problems.push('"publishConfig.access" must be "public"')
    }

    const repository = manifest.repository as { url?: string } | undefined
    if (typeof repository?.url !== "string") {
        problems.push('missing "repository.url"')
    }

    for (const violation of findWorkspaceProtocolViolations(manifest)) {
        problems.push(
            `${violation.field}.${violation.dependency} uses the workspace: protocol`,
        )
    }

    return problems
}

/**
 * npm rejects `npm publish` of a prerelease version unless a dist-tag is given
 * explicitly ("You must specify a tag using --tag when publishing a prerelease
 * version"), so there is no let-npm-decide default. Follow Changesets and use
 * the prerelease tag while the repo is in pre mode.
 */
export function resolvePublishTag(
    explicitTag: string | undefined,
    prereleaseTag: string | null,
): string {
    return explicitTag ?? prereleaseTag ?? "latest"
}

export function githubRepoFromUrl(url: string): string {
    const match = /github\.com[/:]([^/]+)\/(.+?)(?:\.git)?$/.exec(url)
    if (!match) {
        throw new Error(`Cannot derive owner/repo from repository url: ${url}`)
    }
    return `${match[1]}/${match[2]}`
}

/**
 * A stub carrying only registry metadata: no code, so nobody can accidentally
 * build against it, and the first installable artifact still comes from the
 * release workflow with a provenance attestation.
 */
export function placeholderManifest(
    manifest: Record<string, unknown>,
): Record<string, unknown> {
    return {
        name: manifest.name,
        version: manifest.version,
        description: `Placeholder release reserving the ${manifest.name} package name.`,
        license: manifest.license,
        author: manifest.author,
        homepage: manifest.homepage,
        repository: manifest.repository,
        publishConfig: manifest.publishConfig,
    }
}

export function resolvePackage(
    packages: PublicPackage[],
    target: string,
): PublicPackage {
    const normalized = target.replace(/\/+$/, "")
    const found = packages.find(
        pkg =>
            pkg.name === normalized ||
            pkg.dir === normalized ||
            pkg.dir === `packages/${normalized}`,
    )
    if (found) return found

    throw new Error(
        `${target} is not a publishable workspace package.\n` +
            "Check that its package.json exists, is covered by a root " +
            'workspaces glob, and is not marked "private".',
    )
}

function run(command: string, args: string[], cwd: string = REPO_ROOT) {
    console.log(`\n$ ${[command, ...args].join(" ")}`)
    const result = Bun.spawnSync([command, ...args], {
        cwd,
        stdio: ["inherit", "inherit", "inherit"],
    })
    if (result.exitCode !== 0) {
        throw new Error(
            `${command} ${args.join(" ")} exited with ${result.exitCode}`,
        )
    }
}

export interface CommandResult {
    exitCode: number
    stdout: string
    stderr: string
}

function capture(
    command: string,
    args: string[],
    cwd: string = REPO_ROOT,
): CommandResult {
    const result = Bun.spawnSync([command, ...args], { cwd })
    return {
        exitCode: result.exitCode,
        stdout: result.stdout.toString().trim(),
        stderr: result.stderr.toString().trim(),
    }
}

/**
 * Published versions, or null when the name is still free.
 *
 * npm reports an unknown package as E404, which is also what it reports for a
 * package you cannot read. Treating that as "free" is the safe direction: the
 * publish then fails with a permission error instead of this script deciding
 * on its own that someone else's package is available.
 */
export function readRegistryVersions(
    name: string,
    captureCommand: (
        command: string,
        args: string[],
    ) => CommandResult = capture,
): string[] | null {
    const result = captureCommand("npm", ["view", name, "versions", "--json"])
    if (result.exitCode !== 0) {
        const output = `${result.stderr}\n${result.stdout}`
        if (/E404|404 Not Found|is not in this registry/i.test(output)) {
            return null
        }
        throw new Error(`npm view ${name} failed:\n${output.trim()}`)
    }
    const parsed = JSON.parse(result.stdout || "[]")
    return Array.isArray(parsed) ? parsed : [parsed]
}

async function readPrereleaseTag(): Promise<string | null> {
    const file = Bun.file(`${REPO_ROOT}/.changeset/pre.json`)
    if (!(await file.exists())) return null
    const state = await file.json()
    return state.mode === "pre" && typeof state.tag === "string"
        ? state.tag
        : null
}

/**
 * The OIDC token's claims must match the registered publisher exactly, and a
 * renamed workflow or environment would only surface as an authorization
 * failure during a real release. Fail here instead.
 */
async function assertTrustedPublisherTarget() {
    const workflowPath = `${REPO_ROOT}/${TRUSTED_PUBLISHER.workflow}`
    const workflow = Bun.file(workflowPath)
    if (!(await workflow.exists())) {
        throw new Error(
            `${TRUSTED_PUBLISHER.workflow} does not exist. Update TRUSTED_PUBLISHER in scripts/publish-metadata.ts.`,
        )
    }
    const source = await workflow.text()
    if (!source.includes(`environment: ${TRUSTED_PUBLISHER.environment}`)) {
        throw new Error(
            `${TRUSTED_PUBLISHER.workflow} does not declare "environment: ${TRUSTED_PUBLISHER.environment}". Update TRUSTED_PUBLISHER in scripts/publish-metadata.ts.`,
        )
    }
}

async function publishRealPackage(pkg: PublicPackage, publishArgs: string[]) {
    const packageDir = join(REPO_ROOT, pkg.dir)

    await withPrepacked(packageDir, () => run("npm", publishArgs, packageDir), {
        run,
        scriptsDir: import.meta.dir,
    })
}

async function publishPlaceholder(
    pkg: PublicPackage,
    manifest: Record<string, unknown>,
    publishArgs: string[],
) {
    const stubDir = await mkdtemp(join(tmpdir(), "valdres-first-publish-"))
    try {
        await Bun.write(
            join(stubDir, "package.json"),
            `${JSON.stringify(placeholderManifest(manifest), null, 4)}\n`,
        )
        await Bun.write(
            join(stubDir, "README.md"),
            [
                `# ${pkg.name}`,
                "",
                "Placeholder release. This version exists only to reserve the",
                "package name so the valdres release workflow can publish real",
                "builds through npm trusted publishing (OIDC), which cannot",
                "create a package name that does not exist yet.",
                "",
                "Do not depend on this version.",
                "",
            ].join("\n"),
        )
        run("npm", publishArgs, stubDir)
    } finally {
        await rm(stubDir, { recursive: true, force: true })
    }
}

async function main() {
    let options: FirstPublishOptions
    try {
        options = parseFirstPublishArgs(process.argv.slice(2))
    } catch (error) {
        console.error(`${(error as Error).message}\n\n${USAGE}`)
        process.exit(1)
    }

    if (options.help) {
        console.log(USAGE)
        return
    }

    const packages = await readPublicPackages()
    const pkg = resolvePackage(packages, options.target)
    const manifest = await Bun.file(
        `${REPO_ROOT}/${pkg.dir}/package.json`,
    ).json()

    console.log(`Bootstrapping ${pkg.name}@${pkg.version} (${pkg.dir})`)
    if (options.dryRun) console.log("DRY RUN: nothing will be published")

    // ---- Preflight -------------------------------------------------------
    // Unconditional: even --skip-trust prints a `npm trust` command built from
    // these constants, and a command printed from stale values is worse than
    // no command at all.
    await assertTrustedPublisherTarget()

    if (!options.trustOnly) {
        const problems = validatePublishManifest(manifest)
        if (problems.length > 0) {
            console.error(
                `\n${pkg.dir}/package.json is not ready to publish:\n${problems
                    .map(problem => `  - ${problem}`)
                    .join("\n")}`,
            )
            process.exit(1)
        }
    }

    const npmVersion = capture("npm", ["--version"]).stdout
    if (
        !options.skipTrust &&
        !Bun.semver.satisfies(npmVersion, `>=${MINIMUM_NPM_TRUST_VERSION}`)
    ) {
        console.error(
            `\nnpm ${npmVersion} cannot run \`npm trust\` (needs >= ${MINIMUM_NPM_TRUST_VERSION}).\n` +
                "Run `npm install -g npm@latest`, or register the trusted publisher at\n" +
                `https://www.npmjs.com/package/${pkg.name}/access and rerun with --skip-trust.`,
        )
        process.exit(1)
    }

    // A dry run reaches the registry read-only, so it stays useful before you
    // go find the 2FA device. A real publish cannot.
    const whoami = capture("npm", ["whoami"])
    if (whoami.exitCode !== 0 && !options.dryRun) {
        console.error("\nNot logged in to npm. Run `npm login` first.")
        process.exit(1)
    }
    console.log(
        whoami.exitCode === 0
            ? `npm ${npmVersion}, authenticated as ${whoami.stdout}`
            : `npm ${npmVersion}, not logged in (\`npm login\` required before a real publish)`,
    )

    const publishedVersions = readRegistryVersions(pkg.name)
    if (publishedVersions && !options.trustOnly) {
        console.error(
            `\n${pkg.name} already exists on npm (${publishedVersions.length} version(s), latest local ${pkg.version}).\n` +
                "Nothing to bootstrap. If the trusted publisher is missing, rerun with --trust-only.",
        )
        process.exit(1)
    }
    if (!publishedVersions && options.trustOnly) {
        console.error(
            `\n${pkg.name} is not on npm yet, so no trusted publisher can be attached to it.\n` +
                "Run without --trust-only to publish the first version.",
        )
        process.exit(1)
    }

    // ---- Build and publish ----------------------------------------------
    const prereleaseTag = await readPrereleaseTag()

    if (!options.trustOnly) {
        if (options.placeholder) {
            console.log(
                "\nPlaceholder mode: publishing registry metadata only. The first" +
                    "\ninstallable build will come from CI with a provenance attestation.",
            )
        } else if (!options.skipBuild) {
            run("bun", ["run", "build"])
            run("bun", ["run", "build:types"])
        }

        const publishTag = resolvePublishTag(options.tag, prereleaseTag)
        const publishArgs = [
            "publish",
            "--access",
            "public",
            "--tag",
            publishTag,
        ]
        if (options.dryRun) publishArgs.push("--dry-run")

        if (options.placeholder) {
            await publishPlaceholder(pkg, manifest, publishArgs)
        } else {
            await publishRealPackage(pkg, publishArgs)
        }

        // npm sets only the tag it was given, so a package bootstrapped onto
        // `beta` has no `latest` — and a package with no `latest` fails a bare
        // `npm install <name>`. Every sibling package resolves through
        // `latest`, so create it here.
        //
        // Caveat worth knowing before you reach for --no-latest: Changesets
        // picks each release's dist-tag from registry state, including whether
        // `latest` exists and whether every published version is a prerelease
        // (getReleaseTag in @changesets/cli). Creating `latest` may therefore
        // change which tag CI publishes to next. The repo's own registry state
        // does not match a straight reading of that code — @valdres/bandwidth
        // satisfies the "only prereleases" branch yet its last release went to
        // `beta` — so treat the interaction as unverified and check the tags
        // after the first CI release, as RELEASING.md requires.
        if (!options.dryRun && !options.noLatest && publishTag !== "latest") {
            run("npm", [
                "dist-tag",
                "add",
                `${pkg.name}@${pkg.version}`,
                "latest",
            ])
        }
    }

    // ---- Trusted publisher ----------------------------------------------
    // --trust-only skips the manifest gate, so re-check the one field needed
    // here rather than dereferencing it blind.
    const repositoryUrl = (manifest.repository as { url?: string } | undefined)
        ?.url
    if (typeof repositoryUrl !== "string") {
        throw new Error(
            `${pkg.dir}/package.json has no "repository.url" to derive the GitHub repo from`,
        )
    }
    const repo = githubRepoFromUrl(repositoryUrl)
    const trustArgs = [
        "trust",
        "github",
        pkg.name,
        "--file",
        TRUSTED_PUBLISHER.workflow,
        "--repo",
        repo,
        "--env",
        TRUSTED_PUBLISHER.environment,
        "--allow-publish",
        "--yes",
    ]

    if (options.skipTrust) {
        console.log(
            `\nSkipping trusted publisher registration. Run this next:\n  npm ${trustArgs.join(" ")}`,
        )
    } else if (options.dryRun) {
        console.log(
            `\nDRY RUN: would register the trusted publisher with:\n  npm ${trustArgs.join(" ")}`,
        )
    } else {
        run("npm", trustArgs)
        run("npm", ["trust", "list", pkg.name])
    }

    // ---- Report ----------------------------------------------------------
    if (options.dryRun) {
        console.log("\nDry run complete. Rerun without --dry-run to publish.")
        return
    }

    const tags = capture("npm", ["view", pkg.name, "dist-tags", "--json"])
    console.log(`\ndist-tags for ${pkg.name}: ${tags.stdout}`)

    console.log(
        [
            "",
            "Done. Next:",
            `  1. Add a changeset for ${pkg.name} (bunx changeset) and open the pull request.`,
            "  2. Merge it — the main run opens a Version Packages pull request and publishes nothing.",
            "  3. Merge the Version Packages pull request. CI publishes over OIDC with provenance.",
            `  4. Verify the release: npm view ${pkg.name} dist-tags --json`,
            ...(options.placeholder
                ? [
                      `  5. Deprecate the placeholder: npm deprecate ${pkg.name}@${pkg.version} "placeholder release; use a published beta"`,
                      "     Do not unpublish it — removing the last version deletes the package and its trusted publisher.",
                  ]
                : []),
        ].join("\n"),
    )
}

if (import.meta.main) {
    try {
        await main()
    } catch (error) {
        console.error(`\n${(error as Error).message}`)
        process.exit(1)
    }
}
