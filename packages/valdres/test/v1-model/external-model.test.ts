import { describe, expect, test } from "bun:test"
import { ExternalReferenceModel } from "./external-model"
import { value } from "./protocol"
import {
    externalModelBounds,
    externalTransitions,
    type ExternalAction,
    type ExternalCommand,
    type ExternalNodeSpec,
    type ExternalOutcome,
    type ExternalSourceSpec,
} from "./external-protocol"

const number = (input: number): ExternalOutcome => ({
    kind: "value",
    value: value.number(input),
})
const source = (
    overrides: Partial<ExternalSourceSpec> = {},
): ExternalSourceSpec => ({
    id: "source",
    snapshot: number(0),
    serverSnapshot: number(-1),
    ...overrides,
})
const external: ExternalNodeSpec = {
    kind: "external",
    id: "ext",
    source: "source",
}
const tree: ExternalCommand = { kind: "tree", tree: "tree", root: "root" }
const read = (node = "ext", scope = "root"): ExternalCommand => ({
    kind: "read",
    tree: "tree",
    scope,
    node,
})
const subscribe = (
    subscription = "sub",
    node = "ext",
    callback: readonly ExternalAction[] = [],
    scope = "root",
): ExternalCommand => ({
    kind: "subscribe",
    tree: "tree",
    scope,
    node,
    subscription,
    callback,
})
const write = (input: number): ExternalCommand => ({
    kind: "write",
    source: "source",
    snapshot: number(input),
})
const emit: ExternalCommand = { kind: "emit", source: "source" }
function model(
    spec = source(),
    nodes: readonly ExternalNodeSpec[] = [external],
): ExternalReferenceModel {
    const instance = new ExternalReferenceModel([spec], nodes)
    expect(instance.execute(tree).failures).toEqual([])
    return instance
}
function notifications(instance: ExternalReferenceModel): string[] {
    return instance.trace.flatMap(event =>
        event.kind === "notify" ? [event.subscription] : [],
    )
}

describe("external projection reference model", () => {
    test("a warm callback failure during admission drain releases the inaccessible new subscription", () => {
        const instance = new ExternalReferenceModel(
            [
                source({
                    startup: [
                        {
                            kind: "write",
                            source: "source",
                            snapshot: number(1),
                        },
                    ],
                    cleanup: [{ kind: "fail", identity: "cleanup-secondary" }],
                }),
                source({ id: "warm-source" }),
            ],
            [external, { kind: "external", id: "warm", source: "warm-source" }],
        )
        instance.execute(tree)
        instance.execute(
            subscribe("warm-sub", "warm", [
                { kind: "fail", identity: "warm-callback" },
            ]),
        )
        const result = instance.execute(
            subscribe("new-sub", "ext", [
                { kind: "write", source: "warm-source", snapshot: number(2) },
                { kind: "emit", source: "warm-source" },
            ]),
        )
        expect(result.failures.map(failure => failure.identity)).toEqual([
            "warm-callback",
            "cleanup-secondary",
        ])
        expect(instance.inspect("tree", "ext")?.retains).toBe(0)
        expect(instance.inspect("tree", "ext")?.status).toBe("dormant")
        expect(instance.inspect("tree", "warm")?.status).toBe("active")
        expect(instance.work.adapterCleanups).toBe(1)
        expect(instance.phase("tree")).toBe("idle")
    })

    test("freezes the finite lifecycle table and internal engineering bounds", () => {
        expect(externalModelBounds).toEqual({
            rounds: 64,
            samples: 4096,
            deliveryDepth: 32,
            deliveryWork: 4096,
        })
        expect(externalTransitions.disposed).toEqual([])
        expect(externalTransitions.dormant).not.toContain("active")
        expect(Object.isFrozen(externalTransitions.active)).toBe(true)
        expect(
            () =>
                new ExternalReferenceModel([], [], {
                    ...externalModelBounds,
                    samples: 0,
                }),
        ).toThrow()
    })

    test("dormant reads sample without attaching; unchanged snapshots evaluate no selectors", () => {
        const instance = model(source(), [
            external,
            {
                kind: "selector",
                id: "double",
                expression: { kind: "sum", nodes: ["ext", "ext"] },
            },
        ])
        expect(instance.execute(read("double")).outcome).toEqual(number(0))
        expect(instance.work.liveSamples).toBe(1)
        expect(instance.work.selectorEvaluations).toBe(1)
        instance.execute(read("double"))
        expect(instance.work.liveSamples).toBe(2)
        expect(instance.work.selectorEvaluations).toBe(1)
        instance.execute(write(3))
        expect(instance.execute(read("double")).outcome).toEqual(number(6))
        expect(instance.work.selectorEvaluations).toBe(2)
        expect(instance.work.adapterSubscriptions).toBe(0)
        expect(instance.work.lifecycleEdgeVisits).toBe(0)
    })

    test("one shared projection across root and siblings, independent trees", () => {
        const instance = model()
        instance.execute({
            kind: "scope",
            tree: "tree",
            parent: "root",
            scope: "left",
        })
        instance.execute({
            kind: "scope",
            tree: "tree",
            parent: "root",
            scope: "right",
        })
        instance.execute(subscribe("left-sub", "ext", [], "left"))
        instance.execute(subscribe("right-sub", "ext", [], "right"))
        expect(instance.work.adapterSubscriptions).toBe(1)
        instance.execute({ kind: "tree", tree: "other", root: "root" })
        instance.execute({
            kind: "subscribe",
            tree: "other",
            scope: "root",
            node: "ext",
            subscription: "other-sub",
        })
        expect(instance.work.adapterSubscriptions).toBe(2)
        const samples = instance.work.liveSamples
        instance.execute(read("ext", "left"))
        instance.execute(read("ext", "right"))
        expect(instance.work.liveSamples).toBe(samples)
        instance.execute(write(2))
        instance.execute(emit)
        expect(notifications(instance)).toEqual([
            "left-sub",
            "right-sub",
            "other-sub",
        ])
        instance.execute({ kind: "dispose", tree: "tree", scope: "root" })
        expect(instance.work.adapterCleanups).toBe(1)
        expect(instance.inspect("other", "ext")?.status).toBe("active")
    })

    test.each([0, 1, 5])(
        "%i startup invalidations coalesce into one mandatory reread",
        count => {
            const startup: ExternalAction[] = [
                { kind: "write", source: "source", snapshot: number(2) },
                ...Array.from(
                    { length: count },
                    (): ExternalAction => ({ kind: "invalidate-self" }),
                ),
            ]
            const instance = model(source({ startup }))
            expect(instance.execute(subscribe()).failures).toEqual([])
            expect(instance.work.liveSamples).toBe(2)
            expect(instance.work.dirtyRounds).toBe(0)
            expect(notifications(instance)).toEqual(["sub"])
            expect(instance.execute(read()).outcome).toEqual(number(2))
            expect(instance.inspect("tree", "ext")?.status).toBe("active")
        },
    )

    test("startup callback invalidation drains but admission callback spends only one budget", () => {
        const instance = model(
            source({
                startup: [
                    { kind: "write", source: "source", snapshot: number(1) },
                ],
            }),
        )
        instance.execute(
            subscribe("sub", "ext", [
                { kind: "write", source: "source", snapshot: number(2) },
                { kind: "emit", source: "source" },
            ]),
        )
        expect(notifications(instance)).toEqual(["sub"])
        expect(instance.work.dirtyRounds).toBe(1)
        expect(instance.execute(read()).outcome).toEqual(number(2))
        expect(instance.phase("tree")).toBe("idle")
    })

    test.each(["invalid", "thenable"] as const)(
        "%s cleanup rolls back admission and preserves initial-read publication",
        cleanupResult => {
            const instance = model(
                source({
                    snapshot: number(3),
                    cleanupResult,
                    startup: [
                        {
                            kind: "write",
                            source: "source",
                            snapshot: number(7),
                        },
                    ],
                }),
            )
            const result = instance.execute(subscribe())
            expect(result.failures.map(failure => failure.identity)).toEqual([
                "invalid-cleanup",
            ])
            expect(instance.inspect("tree", "ext")).toMatchObject({
                status: "dormant",
                retains: 0,
                outcome: number(3),
            })
            expect(instance.work.adapterCleanups).toBe(0)
            expect(instance.work.thenableContainments).toBe(
                cleanupResult === "thenable" ? 1 : 0,
            )
            expect(instance.execute(read()).outcome).toEqual(number(7))
        },
    )

    test("startup callback failure releases its unreachable subscription and preserves cleanup errors", () => {
        const instance = model(
            source({
                startup: [
                    { kind: "write", source: "source", snapshot: number(1) },
                ],
                cleanup: [{ kind: "fail", identity: "cleanup-error" }],
            }),
        )
        const result = instance.execute(
            subscribe("sub", "ext", [
                { kind: "fail", identity: "callback-error" },
            ]),
        )
        expect(result.failures.map(failure => failure.identity)).toEqual([
            "callback-error",
            "cleanup-error",
        ])
        expect(instance.inspect("tree", "ext")).toMatchObject({
            status: "dormant",
            retains: 0,
            outcome: number(1),
        })
        expect(instance.work.adapterCleanups).toBe(1)
        expect(instance.phase("tree")).toBe("idle")
    })

    test("cleanup revokes before callbacks and stale generation cannot affect replacement", () => {
        const instance = model(
            source({ cleanup: [{ kind: "invalidate-self" }] }),
        )
        instance.execute(subscribe())
        instance.execute({ kind: "unsubscribe", subscription: "sub" })
        instance.execute(subscribe("replacement"))
        const samples = instance.work.liveSamples
        instance.execute(write(9))
        instance.execute({
            kind: "invalidate",
            tree: "tree",
            external: "ext",
            generation: 1,
        })
        expect(instance.work.liveSamples).toBe(samples)
        expect(instance.execute(read()).outcome).toEqual(number(0))
        instance.execute(emit)
        expect(instance.execute(read()).outcome).toEqual(number(9))
    })

    test("ordinary errors are current and retained reads retry only after invalidation", () => {
        const instance = model(
            source({ snapshot: { kind: "error", identity: "offline" } }),
        )
        expect(instance.execute(subscribe()).failures).toEqual([])
        expect(instance.execute(read()).outcome).toEqual({
            kind: "error",
            identity: "offline",
            space: "source",
        })
        instance.execute(write(5))
        expect(instance.execute(read()).outcome).toEqual({
            kind: "error",
            identity: "offline",
            space: "source",
        })
        instance.execute(emit)
        expect(instance.execute(read()).outcome).toEqual(number(5))
        expect(notifications(instance)).toEqual(["sub"])
    })

    test("same-error and NaN stability, signed-zero and distinct-error transitions", () => {
        const instance = model(source({ snapshot: number(NaN) }))
        instance.execute(subscribe())
        for (const snapshot of [
            number(NaN),
            number(-0),
            number(0),
            { kind: "error", identity: "e1" } as const,
            { kind: "error", identity: "e1" } as const,
            { kind: "error", identity: "e2" } as const,
            number(0),
        ]) {
            instance.execute({ kind: "write", source: "source", snapshot })
            instance.execute(emit)
        }
        expect(notifications(instance)).toHaveLength(5)
    })

    test.each([false, true])(
        "returned/thrown thenable (thrown=%s) is contained once per sample",
        thrown => {
            const instance = model(
                source({
                    snapshot: { kind: "thenable", identity: "promise", thrown },
                }),
            )
            const first = instance.execute(read()).outcome!
            expect(first.kind).toBe("error")
            expect(instance.work.thenableContainments).toBe(1)
            instance.execute(subscribe())
            expect(instance.work.thenableContainments).toBe(3)
            const cached = instance.execute(read()).outcome!
            expect(instance.execute(read()).outcome).toBe(cached)
            expect(instance.work.thenableContainments).toBe(3)
        },
    )

    test("transaction capture is once across scopes, direct/transitive reads and generations", () => {
        const instance = model(source(), [
            external,
            { kind: "atom", id: "local", value: value.number(0) },
            {
                kind: "selector",
                id: "sum",
                expression: { kind: "sum", nodes: ["ext", "local"] },
            },
        ])
        instance.execute({
            kind: "scope",
            tree: "tree",
            parent: "root",
            scope: "child",
        })
        const result = instance.execute({
            kind: "transaction",
            tree: "tree",
            steps: [
                { kind: "read", scope: "root", node: "ext" },
                { kind: "write", source: "source", snapshot: number(8) },
                { kind: "read", scope: "child", node: "sum" },
                {
                    kind: "set",
                    scope: "child",
                    atom: "local",
                    value: value.number(1),
                },
                { kind: "read", scope: "child", node: "sum" },
                { kind: "read", scope: "root", node: "ext" },
            ],
        })
        expect(result.reads).toEqual([
            number(0),
            number(0),
            number(1),
            number(0),
        ])
        expect(instance.work.transactionCaptures).toBe(1)
        expect(instance.work.liveSamples).toBe(1)
        expect(instance.work.projectionPublications).toBe(0)
        expect(instance.work.adapterSubscriptions).toBe(0)
        expect(instance.inspect("tree", "ext")).toBeUndefined()
    })

    test("ordinary transaction errors memoize while control faults can retry", () => {
        for (const kind of ["error", "control"] as const) {
            const instance = model(
                source({ snapshot: { kind, identity: "failure" } }),
            )
            const result = instance.execute({
                kind: "transaction",
                tree: "tree",
                steps: [
                    { kind: "read", scope: "root", node: "ext" },
                    { kind: "write", source: "source", snapshot: number(4) },
                    { kind: "read", scope: "root", node: "ext" },
                ],
            })
            expect(result.reads?.[1]).toEqual(
                kind === "error"
                    ? { kind, identity: "failure", space: "source" }
                    : number(4),
            )
            expect(instance.work.liveSamples).toBe(kind === "error" ? 1 : 2)
            expect(instance.work.transactionCaptures).toBe(1)
            expect(instance.work.projectionPublications).toBe(0)
        }
    })

    test("transaction observes recovery privately while retained committed outcome stays errored", () => {
        const instance = model(
            source({ snapshot: { kind: "error", identity: "offline" } }),
        )
        instance.execute(subscribe())
        instance.execute(write(4))
        expect(
            instance.execute({
                kind: "transaction",
                tree: "tree",
                steps: [{ kind: "read", scope: "root", node: "ext" }],
            }).reads,
        ).toEqual([number(4)])
        expect(instance.execute(read()).outcome).toEqual({
            kind: "error",
            identity: "offline",
            space: "source",
        })
    })

    test("hydration evaluates distinct server observations without live records or comparator reuse", () => {
        const instance = model(
            source({ snapshot: number(5), serverSnapshot: number(2) }),
            [
                external,
                {
                    kind: "selector",
                    id: "sum",
                    expression: { kind: "sum", nodes: ["ext", "ext"] },
                    equal: "always",
                },
            ],
        )
        expect(instance.execute(read("sum")).outcome).toEqual(number(10))
        const publications = instance.work.projectionPublications
        const liveSamples = instance.work.liveSamples
        expect(
            instance.execute({
                kind: "hydrate",
                tree: "tree",
                scope: "root",
                node: "sum",
            }).outcome,
        ).toEqual(number(4))
        expect(instance.work.serverSamples).toBe(1)
        expect(instance.work.liveSamples).toBe(liveSamples)
        expect(instance.work.projectionPublications).toBe(publications)
        expect(instance.work.adapterSubscriptions).toBe(0)
        expect(instance.execute(read("sum")).outcome).toEqual(number(10))
    })

    test("missing server path is dynamic, inclusive, and cannot be caught into success", () => {
        const instance = model({ id: "source", snapshot: number(3) }, [
            external,
            {
                kind: "selector",
                id: "inner",
                expression: {
                    kind: "catch",
                    node: "ext",
                    fallback: value.number(7),
                },
            },
            {
                kind: "selector",
                id: "outer",
                expression: { kind: "read", node: "inner" },
            },
        ])
        const result = instance.execute({
            kind: "hydrate",
            tree: "tree",
            scope: "root",
            node: "outer",
        })
        expect(result.outcome?.kind).toBe("control")
        expect(
            instance.trace.find(event => event.kind === "missing-server"),
        ).toEqual({ kind: "missing-server", path: ["outer", "inner", "ext"] })
        expect(instance.work.liveSamples).toBe(0)
        expect(instance.work.projectionPublications).toBe(0)
        expect(instance.inspect("tree", "ext")).toBeUndefined()
    })

    test("dynamic comparator-equal topology retains new external before releasing old", () => {
        const instance = new ExternalReferenceModel(
            [source(), { id: "other", snapshot: number(0) }],
            [
                external,
                { kind: "external", id: "right", source: "other" },
                { kind: "atom", id: "choose", value: value.boolean(true) },
                {
                    kind: "selector",
                    id: "selected",
                    expression: {
                        kind: "choose",
                        condition: "choose",
                        yes: "ext",
                        no: "right",
                    },
                    equal: "always",
                },
            ],
        )
        instance.execute(tree)
        instance.execute(subscribe("selected-sub", "selected"))
        instance.clearTrace()
        instance.execute({
            kind: "set",
            tree: "tree",
            scope: "root",
            atom: "choose",
            value: value.boolean(false),
        })
        expect(notifications(instance)).toEqual([])
        const transitions = instance.trace.filter(
            event => event.kind === "transition",
        )
        expect(
            transitions.map(event => `${event.external}:${event.to}`),
        ).toEqual([
            "right:attaching",
            "right:active",
            "ext:detaching",
            "ext:dormant",
        ])
    })

    test("frozen delivery all-fires despite callback errors and unsubscribe", () => {
        const instance = model()
        instance.execute(
            subscribe("first", "ext", [
                { kind: "unsubscribe", subscription: "second" },
                { kind: "fail", identity: "first-error" },
            ]),
        )
        instance.execute(
            subscribe("second", "ext", [
                { kind: "fail", identity: "second-error" },
            ]),
        )
        instance.execute(write(1))
        const result = instance.execute(emit)
        expect(notifications(instance)).toEqual(["first", "second"])
        expect(result.failures.map(failure => failure.identity)).toEqual([
            "first-error",
            "second-error",
        ])
        expect(instance.phase("tree")).toBe("idle")
    })

    test("subscriber dormant-read refusal is sticky through catch selector and samples nothing", () => {
        const instance = new ExternalReferenceModel(
            [source(), { id: "dormant", snapshot: number(9) }],
            [
                external,
                { kind: "external", id: "cold", source: "dormant" },
                {
                    kind: "selector",
                    id: "caught",
                    expression: {
                        kind: "catch",
                        node: "cold",
                        fallback: value.number(4),
                    },
                },
            ],
        )
        instance.execute(tree)
        instance.execute(
            subscribe("sub", "ext", [
                { kind: "read", tree: "tree", scope: "root", node: "caught" },
            ]),
        )
        instance.execute(write(1))
        const samples = instance.work.liveSamples
        const result = instance.execute(emit)
        expect(result.failures.map(failure => failure.identity)).toEqual([
            "dormant-read",
        ])
        expect(instance.work.liveSamples).toBe(samples + 1)
        expect(instance.inspect("tree", "cold")?.outcome).toBeUndefined()
        expect(instance.execute(read("caught")).outcome).toEqual(number(9))
    })

    test("finite feedback exhausts, remains attached and recovers on a later invalidation", () => {
        const instance = new ExternalReferenceModel([source()], [external], {
            ...externalModelBounds,
            rounds: 3,
        })
        instance.execute(tree)
        instance.execute(
            subscribe("feedback", "ext", [
                {
                    kind: "write",
                    source: "source",
                    snapshot: { kind: "thenable", identity: "feedback" },
                },
                { kind: "emit", source: "source" },
            ]),
        )
        instance.execute(subscribe("observer"))
        const generation = instance.inspect("tree", "ext")!.generation
        instance.execute(write(1))
        const result = instance.execute(emit)
        expect(
            result.failures.some(failure =>
                failure.identity.startsWith("non-convergence:"),
            ),
        ).toBe(true)
        expect(instance.work.dirtyRounds).toBe(3)
        expect(instance.work.nonConvergenceTerminations).toBe(1)
        expect(instance.inspect("tree", "ext")?.status).toBe("active")
        expect(instance.phase("tree")).toBe("idle")
        instance.execute({ kind: "unsubscribe", subscription: "feedback" })
        instance.execute(write(7))
        instance.execute(emit)
        expect(instance.execute(read()).outcome).toEqual(number(7))
        expect(instance.inspect("tree", "ext")?.generation).toBe(generation)
        expect(instance.work.adapterCleanups).toBe(0)
        expect(instance.work.adapterSubscriptions).toBe(1)
    })

    test("all-run disposal releases every source after cleanup failures", () => {
        const instance = new ExternalReferenceModel(
            [
                source({ cleanup: [{ kind: "fail", identity: "cleanup-a" }] }),
                { id: "other", snapshot: number(2), cleanupThenable: true },
            ],
            [external, { kind: "external", id: "right", source: "other" }],
        )
        instance.execute(tree)
        instance.execute(subscribe("a"))
        instance.execute(subscribe("b", "right"))
        const result = instance.execute({
            kind: "dispose",
            tree: "tree",
            scope: "root",
        })
        expect(result.failures.map(failure => failure.identity)).toEqual([
            "cleanup-a",
            "invalid-cleanup",
        ])
        expect(instance.work.adapterCleanups).toBe(2)
        expect(instance.inspect("tree", "ext")?.status).toBe("disposed")
        expect(instance.inspect("tree", "right")?.status).toBe("disposed")
        expect(instance.phase("tree")).toBe("idle")
    })

    test("external-free operations do no source or lifecycle work", () => {
        const instance = model(source(), [
            { kind: "atom", id: "a", value: value.number(1) },
            {
                kind: "selector",
                id: "s",
                expression: { kind: "read", node: "a" },
            },
        ])
        instance.execute(read("s"))
        instance.execute(subscribe("sub", "s"))
        instance.execute({
            kind: "set",
            tree: "tree",
            scope: "root",
            atom: "a",
            value: value.number(2),
        })
        instance.execute({ kind: "unsubscribe", subscription: "sub" })
        expect(instance.work.liveSamples).toBe(0)
        expect(instance.work.externalClosureVisits).toBe(0)
        expect(instance.work.lifecycleEdgeVisits).toBe(0)
        expect(instance.work.adapterSubscriptions).toBe(0)
    })

    test("dormant control faults publish nothing and cannot be swallowed by refresh", () => {
        const instance = model(source(), [
            external,
            {
                kind: "selector",
                id: "caught",
                expression: {
                    kind: "catch",
                    node: "ext",
                    fallback: value.number(77),
                },
            },
        ])
        instance.execute(read("caught"))
        const publications = instance.work.projectionPublications
        instance.execute({
            kind: "write",
            source: "source",
            snapshot: { kind: "control", identity: "mismatch" },
        })
        expect(instance.execute(read("caught")).outcome).toEqual({
            kind: "control",
            identity: "mismatch",
            space: "source",
        })
        expect(instance.work.projectionPublications).toBe(publications)
        expect(instance.inspect("tree", "ext")?.outcome).toEqual(number(0))
    })

    test("unrelated reads and writes never sample another dormant selector closure", () => {
        const instance = model(source(), [
            external,
            { kind: "atom", id: "local", value: value.number(0) },
            {
                kind: "selector",
                id: "derived",
                expression: { kind: "read", node: "ext" },
            },
        ])
        instance.execute(read("derived"))
        instance.execute(write(9))
        instance.execute(read("local"))
        instance.execute({
            kind: "set",
            tree: "tree",
            scope: "root",
            atom: "local",
            value: value.number(1),
        })
        expect(instance.work.liveSamples).toBe(1)
        expect(instance.work.selectorEvaluations).toBe(1)
    })

    test("retained control errors propagate and cannot be caught into selector success", () => {
        const instance = model(source(), [
            external,
            {
                kind: "selector",
                id: "derived",
                expression: { kind: "read", node: "ext" },
            },
            {
                kind: "selector",
                id: "caught",
                expression: {
                    kind: "catch",
                    node: "ext",
                    fallback: value.number(77),
                },
            },
        ])
        instance.execute(subscribe("derived-sub", "derived"))
        instance.execute({
            kind: "write",
            source: "source",
            snapshot: { kind: "control", identity: "mismatch" },
        })
        instance.execute(emit)
        expect(notifications(instance)).toEqual(["derived-sub"])
        expect(instance.execute(read("caught")).outcome).toEqual({
            kind: "control",
            identity: "mismatch",
            space: "source",
        })
    })

    test("transaction comparator uses the committed success while server host starts fresh", () => {
        const instance = model(source(), [
            external,
            {
                kind: "selector",
                id: "equal",
                expression: { kind: "read", node: "ext" },
                equal: "always",
            },
        ])
        instance.execute(read("equal"))
        instance.execute(write(2))
        expect(
            instance.execute({
                kind: "transaction",
                tree: "tree",
                steps: [{ kind: "read", scope: "root", node: "equal" }],
            }).reads,
        ).toEqual([number(0)])
        expect(
            instance.execute({
                kind: "hydrate",
                tree: "tree",
                scope: "root",
                node: "equal",
            }).outcome,
        ).toEqual(number(-1))
    })

    test("dynamic attachment catch-up settles before selecting subscriber callbacks", () => {
        const instance = new ExternalReferenceModel(
            [
                source(),
                {
                    id: "other",
                    snapshot: number(0),
                    startup: [
                        { kind: "write", source: "other", snapshot: number(5) },
                    ],
                },
            ],
            [
                external,
                { kind: "external", id: "right", source: "other" },
                { kind: "atom", id: "gate", value: value.boolean(true) },
                {
                    kind: "selector",
                    id: "selected",
                    expression: {
                        kind: "choose",
                        condition: "gate",
                        yes: "ext",
                        no: "right",
                    },
                },
            ],
        )
        instance.execute(tree)
        instance.execute(subscribe("selected-sub", "selected"))
        instance.execute({
            kind: "set",
            tree: "tree",
            scope: "root",
            atom: "gate",
            value: value.boolean(false),
        })
        expect(instance.trace.filter(event => event.kind === "notify")).toEqual(
            [
                {
                    kind: "notify",
                    subscription: "selected-sub",
                    outcome: number(5),
                },
            ],
        )
        expect(instance.execute(read("selected")).outcome).toEqual(number(5))
        expect(notifications(instance)).toHaveLength(1)
    })

    test("departed registrations remain in frozen snapshot and cleanup waits for it", () => {
        const instance = model(
            source({ cleanup: [{ kind: "fail", identity: "cleanup-error" }] }),
        )
        instance.execute(
            subscribe("first", "ext", [
                { kind: "unsubscribe", subscription: "first" },
                { kind: "unsubscribe", subscription: "second" },
            ]),
        )
        instance.execute(
            subscribe("second", "ext", [
                { kind: "read", tree: "tree", scope: "root", node: "ext" },
                { kind: "fail", identity: "second-error" },
            ]),
        )
        instance.execute(write(1))
        const result = instance.execute(emit)
        expect(notifications(instance)).toEqual(["first", "second"])
        expect(result.failures.map(failure => failure.identity)).toEqual([
            "second-error",
            "cleanup-error",
        ])
        expect(instance.inspect("tree", "ext")?.status).toBe("dormant")
    })

    test("attach control failure precedes rollback cleanup failure", () => {
        const instance = model(
            source({
                startup: [
                    {
                        kind: "write",
                        source: "source",
                        snapshot: { kind: "control", identity: "mismatch" },
                    },
                ],
                cleanup: [{ kind: "fail", identity: "cleanup-error" }],
            }),
        )
        const result = instance.execute(subscribe())
        expect(result.failures.map(failure => failure.identity)).toEqual([
            "mismatch",
            "cleanup-error",
        ])
        expect(result.failures[0]?.committed).toBe(false)
        expect(instance.inspect("tree", "ext")).toMatchObject({
            status: "dormant",
            retains: 0,
            outcome: number(0),
        })
    })

    test("partial-round exhaustion publishes completed samples and pending errors together", () => {
        const instance = new ExternalReferenceModel(
            [source(), { id: "other", snapshot: number(0) }],
            [
                external,
                { kind: "external", id: "right", source: "other" },
                { kind: "atom", id: "trigger", value: value.number(0) },
                {
                    kind: "selector",
                    id: "sum",
                    expression: { kind: "sum", nodes: ["ext", "right"] },
                },
            ],
            { ...externalModelBounds, samples: 1 },
        )
        instance.execute(tree)
        instance.execute(subscribe("sum-sub", "sum"))
        instance.execute(
            subscribe("trigger-sub", "trigger", [
                { kind: "write", source: "source", snapshot: number(1) },
                { kind: "write", source: "other", snapshot: number(2) },
                { kind: "emit", source: "source" },
                { kind: "emit", source: "other" },
            ]),
        )
        const result = instance.execute({
            kind: "set",
            tree: "tree",
            scope: "root",
            atom: "trigger",
            value: value.number(1),
        })
        expect(result.failures[0]?.identity).toStartWith("non-convergence:")
        expect(
            instance.trace.filter(
                event =>
                    event.kind === "notify" && event.subscription === "sum-sub",
            ),
        ).toHaveLength(1)
        expect(instance.inspect("tree", "ext")?.outcome).toEqual(number(1))
        expect(instance.inspect("tree", "right")?.outcome?.kind).toBe("error")
        expect(instance.phase("tree")).toBe("idle")
    })

    test("nested idle-tree failure is synchronous and hub still visits later listeners", () => {
        const instance = new ExternalReferenceModel(
            [
                source(),
                { id: "other", snapshot: number(0) },
                { id: "marker", snapshot: number(0) },
            ],
            [
                external,
                { kind: "external", id: "right", source: "other" },
                { kind: "external", id: "marker", source: "marker" },
            ],
        )
        instance.execute(tree)
        instance.execute({ kind: "tree", tree: "b", root: "root" })
        instance.execute({ kind: "tree", tree: "c", root: "root" })
        instance.execute(
            subscribe("a", "ext", [
                { kind: "write", source: "other", snapshot: number(2) },
                { kind: "emit", source: "other" },
                { kind: "write", source: "marker", snapshot: number(1) },
            ]),
        )
        instance.execute({
            kind: "subscribe",
            tree: "b",
            scope: "root",
            node: "right",
            subscription: "b",
            callback: [{ kind: "fail", identity: "nested-error" }],
        })
        instance.execute({
            kind: "subscribe",
            tree: "c",
            scope: "root",
            node: "right",
            subscription: "c",
        })
        instance.execute(write(1))
        expect(
            instance.execute(emit).failures.map(failure => failure.identity),
        ).toEqual(["nested-error"])
        expect(notifications(instance)).toEqual(["a", "b", "c"])
        expect(instance.execute(read("marker")).outcome).toEqual(number(0))
        expect(instance.phase("tree")).toBe("idle")
        expect(instance.phase("b")).toBe("idle")
    })

    test.each(["deliveryDepth", "deliveryWork"] as const)(
        "%s denied entry is retry-required, unpublished, and retried only by later invalidation",
        bound => {
            const instance = new ExternalReferenceModel(
                [source(), { id: "other", snapshot: number(0) }],
                [external, { kind: "external", id: "right", source: "other" }],
                { ...externalModelBounds, [bound]: 1 },
            )
            instance.execute(tree)
            instance.execute({ kind: "tree", tree: "b", root: "root" })
            instance.execute(
                subscribe("a", "ext", [
                    { kind: "write", source: "other", snapshot: number(2) },
                    { kind: "emit", source: "other" },
                ]),
            )
            instance.execute({
                kind: "subscribe",
                tree: "b",
                scope: "root",
                node: "right",
                subscription: "b",
            })
            instance.execute(write(1))
            expect(instance.execute(emit).failures[0]?.identity).toBe(
                "delivery-limit",
            )
            expect(instance.inspect("b", "right")).toMatchObject({
                status: "active",
                retryRequired: true,
                outcome: number(0),
            })
            instance.execute({
                kind: "read",
                tree: "b",
                scope: "root",
                node: "right",
            })
            expect(instance.inspect("b", "right")?.retryRequired).toBe(true)
            instance.execute({ kind: "emit", source: "other" })
            expect(instance.inspect("b", "right")).toMatchObject({
                retryRequired: false,
                outcome: number(2),
            })
        },
    )

    test.each(["deliveryDepth", "deliveryWork"] as const)(
        "%s retry markers follow accepted active invalidation and generation lifetime",
        bound => {
            const instance = new ExternalReferenceModel(
                [
                    source(),
                    { id: "other", snapshot: number(0) },
                    source({
                        id: "blocked",
                        sampleActions: [{ kind: "emit", source: "other" }],
                    }),
                ],
                [
                    external,
                    { kind: "external", id: "blocked", source: "blocked" },
                    { kind: "external", id: "right", source: "other" },
                    { kind: "atom", id: "trigger", value: value.number(0) },
                ],
                { ...externalModelBounds, [bound]: 1 },
            )
            instance.execute(tree)
            instance.execute({ kind: "tree", tree: "b", root: "root" })
            instance.execute(
                subscribe("a", "ext", [
                    { kind: "write", source: "other", snapshot: number(2) },
                    { kind: "emit", source: "other" },
                ]),
            )
            const attach = (subscription: string) =>
                instance.execute({
                    kind: "subscribe",
                    tree: "b",
                    scope: "root",
                    node: "right",
                    subscription,
                })
            attach("b")
            instance.execute({
                kind: "subscribe",
                tree: "b",
                scope: "root",
                node: "trigger",
                subscription: "trigger",
                callback: [{ kind: "emit", source: "other" }],
            })
            instance.execute(write(1))
            expect(instance.execute(emit).failures[0]?.identity).toBe(
                "delivery-limit",
            )
            expect(instance.inspect("b", "right")?.retryRequired).toBe(true)
            expect(instance.execute(read("blocked")).outcome).toMatchObject({
                kind: "error",
                identity: "callback-capability",
                space: "control",
            })
            expect(instance.inspect("b", "right")?.retryRequired).toBe(true)
            expect(
                instance.execute({
                    kind: "set",
                    tree: "b",
                    scope: "root",
                    atom: "trigger",
                    value: value.number(1),
                }).failures,
            ).toEqual([])
            expect(instance.inspect("b", "right")).toMatchObject({
                status: "active",
                retryRequired: false,
                outcome: number(2),
            })
            const generation = instance.inspect("b", "right")!.generation
            instance.execute({ kind: "unsubscribe", subscription: "b" })
            expect(instance.inspect("b", "right")?.retryRequired).toBe(false)
            expect(attach("replacement").failures).toEqual([])
            expect(instance.inspect("b", "right")!.generation).not.toBe(
                generation,
            )
            expect(instance.inspect("b", "right")?.retryRequired).toBe(false)

            instance.execute(write(2))
            expect(instance.execute(emit).failures[0]?.identity).toBe(
                "delivery-limit",
            )
            expect(instance.inspect("b", "right")?.retryRequired).toBe(true)
            // Even an unretried generation must surrender its pending marker.
            instance.execute({
                kind: "unsubscribe",
                subscription: "replacement",
            })
            expect(instance.inspect("b", "right")?.retryRequired).toBe(false)
            expect(attach("third").failures).toEqual([])
            expect(instance.inspect("b", "right")?.retryRequired).toBe(false)
        },
    )

    test("a dynamically chosen cached selector refreshes its dormant source closure", () => {
        const instance = new ExternalReferenceModel(
            [
                source({ snapshot: number(1) }),
                { id: "a", snapshot: number(10) },
                { id: "b", snapshot: number(20) },
            ],
            [
                external,
                { kind: "external", id: "a", source: "a" },
                { kind: "external", id: "b", source: "b" },
                {
                    kind: "selector",
                    id: "left",
                    expression: { kind: "read", node: "a" },
                },
                {
                    kind: "selector",
                    id: "right",
                    expression: { kind: "read", node: "b" },
                },
                {
                    kind: "selector",
                    id: "selected",
                    expression: {
                        kind: "choose",
                        condition: "ext",
                        yes: "left",
                        no: "right",
                    },
                },
            ],
        )
        instance.execute(tree)
        instance.execute(read("right"))
        instance.execute(read("selected"))
        instance.execute({ kind: "write", source: "b", snapshot: number(99) })
        instance.execute(write(0))
        instance.clearTrace()
        expect(instance.execute(read("selected")).outcome).toEqual(number(99))
        expect(
            instance.trace
                .filter(event => event.kind === "sample")
                .map(event => event.external),
        ).toEqual(["ext", "a", "b"])
    })

    test.each(["sampleActions", "serverActions"] as const)(
        "%s rejects same-domain invalidation before target sampling",
        callback => {
            const instance = new ExternalReferenceModel(
                [
                    source({ [callback]: [{ kind: "emit", source: "other" }] }),
                    { id: "other", snapshot: number(0) },
                ],
                [external, { kind: "external", id: "right", source: "other" }],
            )
            instance.execute(tree)
            instance.execute(subscribe("other-sub", "right"))
            instance.execute({
                kind: "write",
                source: "other",
                snapshot: number(8),
            })
            const result = instance.execute(
                callback === "sampleActions"
                    ? read()
                    : {
                          kind: "hydrate",
                          tree: "tree",
                          scope: "root",
                          node: "ext",
                      },
            )
            expect(result.outcome).toEqual({
                kind: "error",
                identity: "callback-capability",
                space: "control",
                occurrence: 1,
            })
            expect(instance.inspect("tree", "right")?.outcome).toEqual(
                number(0),
            )
            expect(notifications(instance)).toEqual([])
        },
    )

    test("setup and cleanup reject another live generation while departed invalidator is inert", () => {
        for (const callback of ["startup", "cleanup"] as const) {
            const instance = new ExternalReferenceModel(
                [
                    source({ [callback]: [{ kind: "emit", source: "other" }] }),
                    { id: "other", snapshot: number(0) },
                ],
                [external, { kind: "external", id: "right", source: "other" }],
            )
            instance.execute(tree)
            instance.execute(subscribe("other-sub", "right"))
            const admission = instance.execute(subscribe())
            const result =
                callback === "startup"
                    ? admission
                    : instance.execute({
                          kind: "unsubscribe",
                          subscription: "sub",
                      })
            expect(result.failures.map(failure => failure.identity)).toEqual([
                "callback-capability",
            ])
            expect(instance.inspect("tree", "right")?.status).toBe("active")
            expect(notifications(instance)).toEqual([])
        }
    })

    test.each([false, true])(
        "nested source delivery performs dynamic initial read before attach (failure=%s)",
        fails => {
            const instance = new ExternalReferenceModel(
                [
                    source(),
                    { id: "switch", snapshot: number(1) },
                    { id: "left", snapshot: number(10) },
                    {
                        id: "right",
                        snapshot: number(20),
                        startup: fails
                            ? [{ kind: "fail", identity: "attach-failed" }]
                            : [],
                    },
                ],
                [
                    external,
                    { kind: "external", id: "switch", source: "switch" },
                    { kind: "external", id: "left", source: "left" },
                    { kind: "external", id: "right", source: "right" },
                    {
                        kind: "selector",
                        id: "selected",
                        expression: {
                            kind: "choose",
                            condition: "switch",
                            yes: "left",
                            no: "right",
                        },
                    },
                ],
            )
            instance.execute(tree)
            instance.execute({ kind: "tree", tree: "b", root: "root" })
            instance.execute(
                subscribe("a", "ext", [
                    { kind: "write", source: "switch", snapshot: number(0) },
                    { kind: "emit", source: "switch" },
                ]),
            )
            instance.execute({
                kind: "subscribe",
                tree: "b",
                scope: "root",
                node: "selected",
                subscription: "b",
            })
            instance.clearTrace()
            instance.execute(write(1))
            const result = instance.execute(emit)
            expect(
                instance.trace.filter(
                    event =>
                        event.kind === "sample" && event.external === "right",
                ),
            ).toHaveLength(fails ? 1 : 2)
            expect(instance.inspect("b", "right")?.outcome).toEqual(number(20))
            expect(instance.phase("b")).toBe("idle")
            expect(result.failures.map(failure => failure.identity)).toEqual(
                fails ? ["attach-failed"] : [],
            )
        },
    )

    test("seeded direct-source campaigns agree with an independent scalar specification", () => {
        for (let seed = 1; seed <= 32; seed++) {
            let random = seed
            const next = (): number =>
                (random = (Math.imul(random, 1664525) + 1013904223) >>> 0)
            const instance = model()
            let sourceValue = 0
            let installed = 0
            let retained = false
            let expectedNotifications = 0
            for (let step = 0; step < 100; step++) {
                switch (next() % 5) {
                    case 0:
                        sourceValue = next() % 17
                        instance.execute(write(sourceValue))
                        break
                    case 1:
                        instance.execute(emit)
                        if (retained && !Object.is(installed, sourceValue)) {
                            installed = sourceValue
                            expectedNotifications++
                        }
                        break
                    case 2:
                        if (!retained) installed = sourceValue
                        expect(instance.execute(read()).outcome).toEqual(
                            number(installed),
                        )
                        break
                    case 3:
                        if (!retained) {
                            installed = sourceValue
                            instance.execute(subscribe())
                            retained = true
                        }
                        break
                    case 4:
                        instance.execute({
                            kind: "unsubscribe",
                            subscription: "sub",
                        })
                        retained = false
                        break
                }
                expect(instance.phase("tree")).toBe("idle")
                expect(notifications(instance)).toHaveLength(
                    expectedNotifications,
                )
                const projection = instance.inspect("tree", "ext")
                if (projection !== undefined)
                    expect(projection.retains).toBe(retained ? 1 : 0)
            }
        }
    })
})
