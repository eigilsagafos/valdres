/**
 * The packages the release pipeline builds, prepacks, verifies and publishes.
 *
 * The list itself lives in `scripts/publishable-packages.json` rather than here
 * because `scripts/ci-publish.sh` is plain bash and has to read it too — a
 * `.ts` module would force the release script to spawn Bun just to learn which
 * directories to visit. One file, four readers: the publish script, the publish
 * verifier, the release build, and the tests that keep them consistent.
 *
 * A package on this list must be absent from `.changeset/config.json`'s
 * `ignore`, and vice versa: `changeset publish` publishes every non-ignored,
 * non-private package with an unpublished version, but only packages listed
 * here are prepacked. A package that is publishable-but-not-listed would ship
 * its workspace manifest, whose `exports` still points at `./src/index.ts`
 * while `files` ships only `dist`. `scripts/publishable-packages.test.ts`
 * asserts the two lists stay complementary.
 */
import { readFileSync } from "node:fs"
import { basename, dirname, join } from "node:path"

const ROOT = join(import.meta.dir, "..", "..")

/** Repository-relative directories, in release order. */
export const PUBLISHABLE_PACKAGE_DIRS: readonly string[] = JSON.parse(
    readFileSync(join(ROOT, "scripts", "publishable-packages.json"), "utf8"),
)

/**
 * The npm name a directory must declare, derived from the path.
 *
 * `packages/valdres` → `valdres`; `packages/@valdres/browser-contrast` →
 * `@valdres/browser-contrast`. The release script applies the same rule, which
 * is what lets it reject a directory whose manifest name drifted without
 * carrying a second copy of every name.
 */
export const expectedPackageName = (packageDir: string): string => {
    const base = basename(packageDir)
    const parent = basename(dirname(packageDir))
    return parent.startsWith("@") ? `${parent}/${base}` : base
}

/** Scoped npm names, in list order. */
export const publishablePackageNames = (): readonly string[] =>
    PUBLISHABLE_PACKAGE_DIRS.map(expectedPackageName)
