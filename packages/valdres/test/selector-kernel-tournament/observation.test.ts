import { expect, test } from "bun:test"
import { observer } from "../../../../scripts/selector-kernel-tournament/control-observer-runtime.mjs"
import { instrumentControl } from "../../../../scripts/selector-kernel-tournament/control-instrumentation.mjs"
import { readFileSync } from "node:fs"
import { ROOT } from "../../../../scripts/selector-kernel-tournament/inputs.mjs"

test("control observation anchors are exhaustive and reject source drift", () => {
    for (const relative of [
        "selector-evaluator/evaluate.ts",
        "committed-store-tree/scope-node.ts",
        "committed-store-tree/scratch-selector-host.ts",
        "committed-store-tree/committed-store-tree.ts",
    ]) {
        const path = ROOT + "/packages/valdres/src/v1-internal/" + relative
        const source = readFileSync(path, "utf8")
        expect(instrumentControl(source, path)).toContain("tournamentObserver")
        expect(() => instrumentControl("", path)).toThrow(
            "CONTROL-ADAPTER-ANCHOR",
        )
    }
})
test("record observation counts set deltas, equal publications and lifecycle clear once", () => {
    observer.reset()
    const host = {},
        selector = {},
        a = {},
        b = {},
        token = {},
        value = {
            get hostile() {
                throw Error("must never serialize application value")
            },
        }
    observer.coordinate(host, "scratch", undefined, 1)
    observer.label(selector, "selector")
    observer.label(a, "a")
    observer.label(b, "b")
    const record = (dependencies: object[]) => ({
        served: { token, outcome: { kind: "value", value } },
        dependencies: dependencies.map(node => ({ node })),
    })
    observer.install(host, selector, record([a, b]))
    observer.install(host, selector, record([b, a]))
    expect(observer.snapshot().common).toMatchObject({
        proposalsInstalled: 2,
        dependencyEdgesAdded: 2,
        dependencyEdgesRemoved: 0,
    })
    observer.clear(host, 2)
    observer.clear(host, 2)
    const result = observer.snapshot()
    expect(result.common.dependencyEdgesRemoved).toBe(2)
    expect(result.hosts[0].records).toHaveLength(0)
    expect(
        result.events.filter(e => e.type === "install")[0].outcome.value.kind,
    ).toBe("identity")
})
test("within-run identity normalization never traverses application objects", () => {
    observer.reset()
    const o = {
        get toJSON() {
            throw Error("no application serialization")
        },
    }
    expect(observer.valueToken(o)).toEqual(observer.valueToken(o))
    expect(observer.valueToken({})).not.toEqual(observer.valueToken(o))
    expect(observer.valueToken(NaN)).toEqual({ kind: "number", value: "NaN" })
    expect(observer.valueToken(-0)).not.toEqual(observer.valueToken(0))
})

test("counter-window reset preserves the installed graph for edge deltas", () => {
    observer.reset()
    const h = {},
        s = {},
        a = {},
        token = {}
    observer.coordinate(h, "root")
    const record = {
        served: { token, outcome: { kind: "value", value: 1 } },
        dependencies: [{ node: a }],
    }
    observer.install(h, s, record)
    observer.resetCounters()
    observer.install(h, s, record)
    expect(observer.snapshot().common).toMatchObject({
        proposalsInstalled: 1,
        dependencyEdgesAdded: 0,
        dependencyEdgesRemoved: 0,
    })
    observer.clear(h)
    expect(observer.snapshot().common.dependencyEdgesRemoved).toBe(1)
})
