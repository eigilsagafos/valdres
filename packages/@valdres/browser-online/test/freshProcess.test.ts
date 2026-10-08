import { describe, expect, test } from "bun:test"

const runFixture = async (name: string) => {
    const child = Bun.spawn(
        ["bun", "run", `${import.meta.dir}/fixtures/${name}.ts`],
        { cwd: import.meta.dir, stdout: "pipe", stderr: "pipe" },
    )
    const [stdout, stderr, exitCode] = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited,
    ])
    return { stdout, stderr, exitCode }
}

describe("fresh processes", () => {
    test("imports, reads and subscribes with no window and no navigator.onLine", async () => {
        const { stdout, stderr, exitCode } = await runFixture("domless")
        expect({ exitCode, stderr }).toEqual({ exitCode: 0, stderr: "" })
        expect(stdout).toContain("DOMLESS_OK")
    })

    test("a worker-like global scope is observed through its own online/offline events", async () => {
        const { stdout, stderr, exitCode } = await runFixture("workerScope")
        expect({ exitCode, stderr }).toEqual({ exitCode: 0, stderr: "" })
        expect(stdout).toContain("WORKER_SCOPE_OK")
    })

    test("with a DOM, import and dormant reads attach nothing until a subscription", async () => {
        const { stdout, stderr, exitCode } = await runFixture("importInert")
        expect({ exitCode, stderr }).toEqual({ exitCode: 0, stderr: "" })
        expect(stdout).toContain("IMPORT_INERT_OK")
    })
})
