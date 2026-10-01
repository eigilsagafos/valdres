import { expect, test } from "bun:test"

test("server rendering without a DOM registers and runs nothing", async () => {
    const child = Bun.spawn(
        ["bun", "run", `${import.meta.dir}/fixtures/ssr.tsx`],
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
    expect(stdout).toContain("SSR_OK")
})
