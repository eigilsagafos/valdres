import { expect, test } from "bun:test"

test("imports, binds and activates with no document or window", async () => {
    const child = Bun.spawn(
        ["bun", "run", `${import.meta.dir}/fixtures/domless.ts`],
        {
            cwd: import.meta.dir,
            stdout: "pipe",
            stderr: "pipe",
        },
    )
    const [stdout, stderr, exitCode] = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited,
    ])
    expect({ exitCode, stderr }).toEqual({ exitCode: 0, stderr: "" })
    expect(stdout).toContain("DOMLESS_OK")
})
