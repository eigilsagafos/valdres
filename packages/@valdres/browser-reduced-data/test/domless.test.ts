import { describe, expect, test } from "bun:test"

describe("DOM-less runtime", () => {
    test("imports, reads and subscribes in a fresh process with no window", async () => {
        const child = Bun.spawn(
            ["bun", "run", `${import.meta.dir}/fixtures/domless.ts`],
            { cwd: import.meta.dir, stdout: "pipe", stderr: "pipe" },
        )
        const [stdout, stderr, exitCode] = await Promise.all([
            new Response(child.stdout).text(),
            new Response(child.stderr).text(),
            child.exited,
        ])

        expect({ exitCode, stderr }).toEqual({ exitCode: 0, stderr: "" })
        expect(stdout).toContain("DOMLESS_OK")
    })
})
