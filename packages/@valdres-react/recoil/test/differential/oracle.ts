/**
 * Records the Recoil reference behavior the adapter is compared against.
 *
 * Installs the pinned reference — `recoil@0.7.7`, the final Recoil release, on
 * React 18.3.1 — into an isolated directory and runs every differential
 * scenario in its own process against it. Recoil keeps global batching state,
 * so one scenario's failure must not leak into the next.
 *
 * It also records that the same Recoil release cannot start on React 19.
 *
 *   bun run oracle            # fail if Recoil's behavior differs from the file
 *   bun run oracle --update   # rewrite recoil-0.7.7.json
 */
import { strict as assert } from "node:assert"
import { spawnSync } from "node:child_process"
import { isDeepStrictEqual } from "node:util"
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { scenarios } from "./scenarios"

const HERE = import.meta.dir
const ORACLE_FILE = join(HERE, "recoil-0.7.7.json")
const REFERENCE = { recoil: "0.7.7", react: "18.3.1" } as const
const HARNESS = {
    "@happy-dom/global-registrator": "20.0.5",
    "@testing-library/dom": "10.4.1",
    "@testing-library/react": "16.3.0",
    "happy-dom": "20.0.5",
}

const run = (
    label: string,
    command: readonly string[],
    cwd: string,
    env: Record<string, string> = {},
) => {
    const childEnv: Record<string, string | undefined> = { ...process.env, ...env }
    // Recoil's development checks (missing keys, duplicate keys) are part of
    // the reference behavior.
    delete childEnv.NODE_ENV
    const result = spawnSync(command[0]!, command.slice(1), {
        cwd,
        encoding: "utf8",
        env: childEnv,
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 120_000,
    })
    if (result.status !== 0)
        throw new Error(`${label} failed (${result.status})\n${result.stdout}\n${result.stderr}`)
    return result
}

const install = async (directory: string, react: string) => {
    await mkdir(directory, { recursive: true })
    await writeFile(
        join(directory, "package.json"),
        JSON.stringify({
            name: "valdres-recoil-oracle",
            private: true,
            type: "module",
            dependencies: {
                recoil: REFERENCE.recoil,
                react,
                "react-dom": react,
                ...HARNESS,
            },
        }),
    )
    run(`install React ${react}`, ["npm", "install", "--no-audit", "--no-fund", "--loglevel=error"], directory)
    for (const file of ["scenarios.ts", "runner.ts", "entry.ts"])
        await cp(join(HERE, file), join(directory, file))
}

const workspace = await mkdtemp(join(tmpdir(), "valdres-recoil-oracle-"))
try {
    const reference = join(workspace, "react-18")
    await install(reference, REFERENCE.react)
    const installed = JSON.parse(
        await readFile(join(reference, "node_modules/recoil/package.json"), "utf8"),
    ).version
    assert.equal(installed, REFERENCE.recoil)

    const observations: Record<string, unknown> = {}
    for (const [index, scenario] of scenarios.entries()) {
        const { stdout } = run(scenario.name, ["bun", "entry.ts"], reference, {
            LIB: "recoil",
            SCENARIO_INDEX: String(index),
        })
        const report = JSON.parse(stdout.trim().split("\n").at(-1)!)
        assert.equal(report.react, REFERENCE.react)
        Object.assign(observations, report.observations)
        console.log(`recorded ${scenario.name}`)
    }

    // The reference release predates React 19 and reads React internals that
    // React 19 removed: its first hook throws.
    const react19 = join(workspace, "react-19")
    await install(react19, "19.1.1")
    const probe = spawnSync(
        "bun",
        [
            "-e",
            `const { createElement: h } = await import("react")
const { renderToString } = await import("react-dom/server")
const { RecoilRoot, atom, useRecoilValue } = await import("recoil")
const a = atom({ key: "react19", default: 1 })
const Read = () => String(useRecoilValue(a))
renderToString(h(RecoilRoot, null, h(Read)))`,
        ],
        { cwd: react19, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    )
    assert.match(
        probe.stderr,
        /Cannot destructure property 'ReactCurrentDispatcher'/,
        "recoil@0.7.7 unexpectedly renders on React 19",
    )

    const recorded = {
        reference: {
            ...REFERENCE,
            react19:
                "recoil@0.7.7 throws on its first hook: Cannot destructure property 'ReactCurrentDispatcher' of React's removed internals",
        },
        observations,
    }
    if (process.argv.includes("--update")) {
        await writeFile(ORACLE_FILE, `${JSON.stringify(recorded, null, 4)}\n`)
        console.log(`wrote ${ORACLE_FILE}`)
    } else {
        const committed = JSON.parse(await readFile(ORACLE_FILE, "utf8"))
        assert.ok(
            isDeepStrictEqual(committed, recorded),
            "recoil-0.7.7.json no longer matches Recoil; inspect the diff and rerun with --update",
        )
        console.log("recoil-0.7.7.json matches the reference")
    }
} finally {
    await rm(workspace, { recursive: true, force: true })
}
