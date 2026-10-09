/**
 * The adapter against the recorded Recoil 0.7.7 reference, on the
 * workspace's React. The packed-consumer gate repeats this on React 18 and 19
 * against the built package; `bun run test:oracle` re-records the reference.
 */
import { describe, expect, test } from "bun:test"
import * as React from "react"
import { act, cleanup, render } from "@testing-library/react"
import { renderToString } from "react-dom/server"
import * as adapter from "../src/index"
import { compareWithOracle } from "./differential/compare"
import oracle from "./differential/recoil-0.7.7.json"
import { runScenarios } from "./differential/runner"
import { scenarios } from "./differential/scenarios"

const env = {
    lib: adapter,
    React,
    render: render as never,
    act: act as never,
    cleanup,
    renderToString,
}

test("the oracle records every scenario and only those", () => {
    expect(Object.keys(oracle.observations)).toEqual(scenarios.map(s => s.name))
    expect(oracle.reference.recoil).toBe("0.7.7")
    expect(oracle.reference.react).toBe("18.3.1")
})

describe("differential against recoil@0.7.7", () => {
    for (const scenario of scenarios) {
        test(`${scenario.adapter.kind}: ${scenario.name}`, async () => {
            const observed = await runScenarios(env, [scenario])
            const recorded = {
                [scenario.name]: (oracle.observations as Record<string, unknown>)[scenario.name],
            }
            expect(compareWithOracle([scenario], recorded, observed)).toEqual([])
        })
    }
})
