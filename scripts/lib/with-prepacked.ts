/**
 * Runs `action` with a package's manifest in its published (prepacked) shape,
 * then puts the authored manifest back.
 *
 * Three callers need this and each grew its own version: ci-publish.sh through
 * an EXIT trap, verify-publish.ts through an inline `finally`, and
 * first-publish.ts. Both TypeScript versions shared a bug. `prepack.ts` writes
 * `package.tmp.json` *before* the work that can throw, so a prepack that fails
 * partway — a `.` export that is a condition map rather than a string is enough
 * — leaves that backup behind. It is gitignored, so the tree looks clean while
 * the *next* prepack dies on "package.tmp.json already exists" with no clue
 * where it came from.
 *
 * Scope, so nobody reads more into this than it delivers: it unifies the two
 * TypeScript callers only. ci-publish.sh keeps its own bash implementation —
 * it prepacks every package, publishes once, then restores every package, which
 * is not a per-package scope — and that is the copy a real release runs. Its
 * EXIT trap also does not fire on SIGPIPE, so a `ci-publish.sh | head` can
 * still strand a backup.
 *
 * Restoration writes the captured original rather than shelling out to
 * postpublish.ts. It cannot itself fail partway, it needs no second process,
 * and it is still correct when prepack died between writing the backup and
 * rewriting the manifest. postpublish.ts remains the path CI takes, and
 * ci-publish.sh exercises it on every pull request.
 *
 * An error raised by `action` always wins over an error raised while cleaning
 * up: the publish that failed is the thing the caller needs to read about.
 */

import { join } from "node:path"
import { describeError } from "./describe-error.ts"

export type CommandRunner = (
    command: string,
    args: string[],
    cwd: string,
) => void

export interface WithPrepackedOptions {
    /** Overridden by first-publish (to echo commands) and by tests. */
    run?: CommandRunner
    /** Directory holding prepack.ts. Defaults to scripts/. */
    scriptsDir?: string
}

const runCommand: CommandRunner = (command, args, cwd) => {
    const result = Bun.spawnSync([command, ...args], {
        cwd,
        stdio: ["inherit", "inherit", "pipe"],
    })
    if (result.exitCode !== 0) {
        const stderr = result.stderr.toString().trim()
        throw new Error(
            `${command} ${args.join(" ")} exited with ${result.exitCode}${
                stderr ? `\n${stderr}` : ""
            }`,
        )
    }
}

export async function withPrepacked<T>(
    packageDir: string,
    action: () => T | Promise<T>,
    options: WithPrepackedOptions = {},
): Promise<T> {
    const run = options.run ?? runCommand
    const scriptsDir = options.scriptsDir ?? join(import.meta.dir, "..")
    const manifestPath = join(packageDir, "package.json")
    const backupPath = join(packageDir, "package.tmp.json")

    const original = await Bun.file(manifestPath).text()

    // Booleans rather than checking the captured values for undefined: `throw
    // undefined` is legal JavaScript, and a module whose whole job is not
    // losing errors should not use a value that can be thrown as its sentinel.
    // They also make the `result!` below sound — it is only read once the try
    // block completed.
    let result: T | undefined
    let actionFailed = false
    let actionError: unknown
    try {
        run("bun", ["run", join(scriptsDir, "prepack.ts")], packageDir)
        result = await action()
    } catch (error) {
        actionFailed = true
        actionError = error
    }

    let restoreFailed = false
    let restoreError: unknown
    try {
        const backup = Bun.file(backupPath)
        if (await backup.exists()) await backup.delete()
        if ((await Bun.file(manifestPath).text()) !== original) {
            await Bun.write(manifestPath, original)
        }
    } catch (error) {
        restoreFailed = true
        restoreError = error
    }

    if (actionFailed) {
        if (restoreFailed) {
            console.error(
                `Additionally, restoring ${manifestPath} failed: ${describeError(restoreError)}`,
            )
        }
        throw actionError
    }
    if (restoreFailed) throw restoreError

    return result!
}
