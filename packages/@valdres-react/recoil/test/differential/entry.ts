/**
 * Process entry for an isolated install: runs the scenarios against `LIB`
 * (`recoil` or `@valdres-react/recoil`) with whatever React that install
 * provides, and prints the observations as JSON on the last stdout line.
 * `SCENARIO_INDEX` runs one scenario, so a Recoil failure (it keeps global
 * batching state) cannot leak into the next scenario's observation.
 */
import { GlobalRegistrator } from "@happy-dom/global-registrator"

GlobalRegistrator.register()
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

const lib = await import(process.env.LIB ?? "recoil")
const React = await import("react")
const testing = await import("@testing-library/react")
const server = await import("react-dom/server")
const { scenarios } = await import("./scenarios")
const { runScenarios } = await import("./runner")

const observations = await runScenarios(
    {
        lib,
        React,
        render: testing.render as any,
        act: testing.act as any,
        cleanup: testing.cleanup,
        renderToString: server.renderToString,
    },
    process.env.SCENARIO_INDEX === undefined
        ? scenarios
        : [scenarios[Number(process.env.SCENARIO_INDEX)]!],
)
// A rendered error can leave a happy-dom timer behind; exit once reported.
await new Promise(resolve =>
    process.stdout.write(
        `\n${JSON.stringify({ react: React.version, observations })}\n`,
        resolve,
    ),
)
process.exit(0)
