import { afterEach, expect, test } from "bun:test"
import { writeFileSync } from "node:fs"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { withPrepacked, type CommandRunner } from "./with-prepacked"

const AUTHORED = `${JSON.stringify({ name: "pkg", exports: "./src" }, null, 4)}\n`
const PREPACKED = `${JSON.stringify({ name: "pkg", exports: "./dist" }, null, 4)}\n`

const temporaryDirs: string[] = []

async function packageDir() {
    const dir = await mkdtemp(join(tmpdir(), "with-prepacked-"))
    temporaryDirs.push(dir)
    await Bun.write(join(dir, "package.json"), AUTHORED)
    return dir
}

/**
 * Stands in for prepack.ts, writing the backup before the work that can fail —
 * the ordering that makes cleanup necessary. Writes synchronously because
 * CommandRunner models a spawnSync call.
 */
function fakePrepack(options: { throwAfterBackup?: boolean } = {}) {
    const calls: Array<{ argv: string[]; cwd: string }> = []
    const run: CommandRunner = (command, args, cwd) => {
        calls.push({ argv: [command, ...args], cwd })
        if (!args.some(arg => arg.endsWith("prepack.ts"))) return
        writeFileSync(join(cwd, "package.tmp.json"), AUTHORED)
        if (options.throwAfterBackup) throw new Error("prepack blew up")
        writeFileSync(join(cwd, "package.json"), PREPACKED)
    }
    return { run, calls }
}

async function read(dir: string, file: string) {
    const handle = Bun.file(join(dir, file))
    return (await handle.exists()) ? await handle.text() : null
}

afterEach(async () => {
    await Promise.all(
        temporaryDirs
            .splice(0)
            .map(dir => rm(dir, { recursive: true, force: true })),
    )
})

test("the action sees the prepacked manifest and the authored one comes back", async () => {
    const dir = await packageDir()
    const { run } = fakePrepack()

    const seen = await withPrepacked(
        dir,
        async () => await read(dir, "package.json"),
        { run },
    )

    expect(seen).toBe(PREPACKED)
    expect(await read(dir, "package.json")).toBe(AUTHORED)
    expect(await read(dir, "package.tmp.json")).toBeNull()
})

test("a failing action still restores, and its error is what propagates", async () => {
    const dir = await packageDir()
    const { run } = fakePrepack()

    await expect(
        withPrepacked(
            dir,
            () => {
                throw new Error("npm publish exited with 1")
            },
            { run },
        ),
    ).rejects.toThrow("npm publish exited with 1")

    expect(await read(dir, "package.json")).toBe(AUTHORED)
    expect(await read(dir, "package.tmp.json")).toBeNull()
})

test("a prepack that dies after writing its backup leaves nothing behind", async () => {
    // The regression this module exists for: package.tmp.json is gitignored, so
    // a leftover copy is invisible to git status and the next prepack fails
    // with "package.tmp.json already exists".
    const dir = await packageDir()
    const { run } = fakePrepack({ throwAfterBackup: true })

    await expect(
        withPrepacked(dir, () => "unreachable", { run }),
    ).rejects.toThrow("prepack blew up")

    expect(await read(dir, "package.json")).toBe(AUTHORED)
    expect(await read(dir, "package.tmp.json")).toBeNull()
})

test("the action never runs when prepack fails", async () => {
    const dir = await packageDir()
    const { run } = fakePrepack({ throwAfterBackup: true })
    let ran = false

    await expect(
        withPrepacked(
            dir,
            () => {
                ran = true
            },
            { run },
        ),
    ).rejects.toThrow("prepack blew up")

    expect(ran).toBe(false)
})

test("prepack runs in the package directory, not the caller's cwd", async () => {
    const dir = await packageDir()
    const { run, calls } = fakePrepack()

    await withPrepacked(dir, () => undefined, {
        run,
        scriptsDir: "/scripts",
    })

    expect(calls).toEqual([
        { argv: ["bun", "run", "/scripts/prepack.ts"], cwd: dir },
    ])
})

test("returns the action's value", async () => {
    const dir = await packageDir()
    const { run } = fakePrepack()

    expect(await withPrepacked(dir, () => 42, { run })).toBe(42)
})

test("a thrown undefined is still a failure, not a silent success", async () => {
    // `throw undefined` is legal JavaScript, so a captured-value-is-undefined
    // sentinel would report this action as having succeeded.
    const dir = await packageDir()
    const { run } = fakePrepack()
    let settled = "pending"

    await withPrepacked(
        dir,
        () => {
            throw undefined
        },
        { run },
    ).then(
        () => (settled = "resolved"),
        () => (settled = "rejected"),
    )

    expect(settled).toBe("rejected")
    expect(await read(dir, "package.json")).toBe(AUTHORED)
})

test("a restore that fails surfaces on its own", async () => {
    const dir = await packageDir()
    const { run } = fakePrepack()

    // Deleting the package directory from inside the action leaves nothing to
    // restore, which is the only way to fail the cleanup without mocking fs.
    await expect(
        withPrepacked(
            dir,
            async () => {
                await rm(dir, { recursive: true, force: true })
            },
            { run },
        ),
    ).rejects.toThrow()
})

test("a failing action outranks a failing restore", async () => {
    const dir = await packageDir()
    const { run } = fakePrepack()

    await expect(
        withPrepacked(
            dir,
            async () => {
                await rm(dir, { recursive: true, force: true })
                throw new Error("npm publish exited with 1")
            },
            { run },
        ),
    ).rejects.toThrow("npm publish exited with 1")
})
