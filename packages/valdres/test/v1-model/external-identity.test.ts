import { expect, test } from "bun:test"
import { ExternalReferenceModel, sameExternalOutcome } from "./external-model"
import { externalModelBounds } from "./external-protocol"
import { value } from "./protocol"

const root = { tree: "tree", scope: "root" } as const
const number = (input: number) =>
    ({ kind: "value", value: value.number(input) }) as const

test("fresh callback faults with the same label publish and notify each time", () => {
    const model = new ExternalReferenceModel(
        [
            {
                id: "source",
                snapshot: number(0),
                sampleActions: [{ kind: "read", ...root, node: "external" }],
            },
        ],
        [{ kind: "external", id: "external", source: "source" }],
    )
    model.execute({ kind: "tree", tree: "tree", root: "root" })
    expect(
        model.execute({
            kind: "subscribe",
            ...root,
            node: "external",
            subscription: "sub",
        }).failures,
    ).toEqual([])
    model.clearTrace()
    const before = model.work.subscriberCalls
    for (let i = 0; i < 2; i++)
        model.execute({ kind: "emit", source: "source" })
    expect(model.work.subscriberCalls - before).toBe(2)
    const notifications = model.trace.filter(event => event.kind === "notify")
    expect(notifications).toHaveLength(2)
    const outcomes = notifications.map(event => event.outcome)
    for (const outcome of outcomes)
        expect(outcome).toMatchObject({
            kind: "error",
            space: "control",
            identity: "callback-capability",
        })
    expect(sameExternalOutcome(outcomes[0]!, outcomes[1]!)).toBe(false)
})

test("source invalid-snapshot text cannot suppress a generated error publication", () => {
    const model = new ExternalReferenceModel(
        [
            {
                id: "source",
                snapshot: { kind: "error", identity: "invalid-snapshot:1" },
            },
        ],
        [{ kind: "external", id: "external", source: "source" }],
    )
    model.execute({ kind: "tree", tree: "tree", root: "root" })
    model.execute({
        kind: "subscribe",
        ...root,
        node: "external",
        subscription: "sub",
    })
    const before = model.execute({
        kind: "read",
        ...root,
        node: "external",
    }).outcome!
    const publications = model.work.projectionPublications
    model.execute({
        kind: "write",
        source: "source",
        snapshot: { kind: "thenable", identity: "promise" },
    })
    model.execute({ kind: "emit", source: "source" })
    const after = model.execute({
        kind: "read",
        ...root,
        node: "external",
    }).outcome!
    expect(sameExternalOutcome(before, after)).toBe(false)
    expect(model.work.projectionPublications).toBe(publications + 1)
    expect(model.work.subscriberCalls).toBe(1)
    expect(before).toMatchObject({ identity: "invalid-snapshot:1" })
    expect(after).toMatchObject({ identity: "invalid-snapshot:1" })
})

test("source non-convergence text cannot suppress a terminal publication", () => {
    const model = new ExternalReferenceModel(
        [
            { id: "first", snapshot: number(0) },
            {
                id: "second",
                snapshot: { kind: "error", identity: "non-convergence:1" },
            },
        ],
        [
            { kind: "external", id: "a", source: "first" },
            { kind: "external", id: "b", source: "second" },
        ],
        { ...externalModelBounds, samples: 1 },
    )
    model.execute({ kind: "tree", tree: "tree", root: "root" })
    model.execute({
        kind: "subscribe",
        ...root,
        node: "a",
        subscription: "first-sub",
        callback: [{ kind: "emit", source: "second" }],
    })
    model.execute({
        kind: "subscribe",
        ...root,
        node: "b",
        subscription: "second-sub",
    })
    const before = model.execute({ kind: "read", ...root, node: "b" }).outcome!
    const publications = model.work.projectionPublications
    model.execute({ kind: "write", source: "first", snapshot: number(1) })
    model.execute({ kind: "emit", source: "first" })
    const after = model.execute({ kind: "read", ...root, node: "b" }).outcome!
    expect(sameExternalOutcome(before, after)).toBe(false)
    expect(after).toMatchObject({ identity: "non-convergence:1" })
    expect(model.work.projectionPublications).toBe(publications + 2)
    expect(
        model.trace
            .filter(event => event.kind === "notify")
            .map(event => event.subscription),
    ).toEqual(["first-sub", "second-sub"])
})

test("source control text cannot collide with a generated missing-server control", () => {
    const model = new ExternalReferenceModel(
        [
            {
                id: "source",
                snapshot: {
                    kind: "control",
                    identity: 'missing-server:["external"]',
                },
            },
        ],
        [{ kind: "external", id: "external", source: "source" }],
    )
    model.execute({ kind: "tree", tree: "tree", root: "root" })
    const source = model.execute({
        kind: "read",
        ...root,
        node: "external",
    }).outcome!
    const generated = model.execute({
        kind: "hydrate",
        ...root,
        node: "external",
    }).outcome!
    expect(source).toMatchObject({
        kind: "control",
        identity: 'missing-server:["external"]',
    })
    expect(generated).toMatchObject({
        kind: "control",
        identity: 'missing-server:["external"]',
    })
    expect(sameExternalOutcome(source, generated)).toBe(false)
    expect(model.work.projectionPublications).toBe(0)
})

test("fresh missing-server faults keep their labels but have distinct replayable identities", () => {
    const replay = () => {
        const model = new ExternalReferenceModel(
            [{ id: "source", snapshot: number(0) }],
            [{ kind: "external", id: "external", source: "source" }],
        )
        model.execute({ kind: "tree", tree: "tree", root: "root" })
        const read = () =>
            model.execute({ kind: "hydrate", ...root, node: "external" })
                .outcome!
        const first = read()
        const second = read()
        expect(first).toMatchObject({
            identity: 'missing-server:["external"]',
            occurrence: 1,
        })
        expect(second).toMatchObject({
            identity: 'missing-server:["external"]',
            occurrence: 2,
        })
        expect(sameExternalOutcome(first, second)).toBe(false)
        return model.trace
    }
    expect(replay()).toEqual(replay())
})

test("transaction capture and selector forwarding preserve a generated fault identity", () => {
    const model = new ExternalReferenceModel(
        [
            {
                id: "source",
                snapshot: number(0),
                sampleActions: [{ kind: "read", ...root, node: "external" }],
            },
        ],
        [
            { kind: "external", id: "external", source: "source" },
            { kind: "atom", id: "atom", value: value.number(0) },
            {
                kind: "selector",
                id: "selected",
                expression: { kind: "read", node: "external" },
            },
        ],
    )
    model.execute({ kind: "tree", tree: "tree", root: "root" })
    const result = model.execute({
        kind: "transaction",
        tree: "tree",
        steps: [
            { kind: "read", scope: "root", node: "external" },
            {
                kind: "set",
                scope: "root",
                atom: "atom",
                value: value.number(1),
            },
            { kind: "read", scope: "root", node: "selected" },
            { kind: "read", scope: "root", node: "external" },
        ],
    })
    expect(result.failures).toEqual([])
    expect(result.reads).toHaveLength(3)
    for (const outcome of result.reads!) expect(outcome).toBe(result.reads![0])
    expect(model.work.transactionCaptures).toBe(1)
    expect(model.work.liveSamples).toBe(1)
})

test("reused source errors remain stable while new model faults stay distinct", () => {
    const model = new ExternalReferenceModel(
        [
            {
                id: "source",
                snapshot: { kind: "error", identity: "callback-capability" },
            },
        ],
        [{ kind: "external", id: "external", source: "source" }],
    )
    model.execute({ kind: "tree", tree: "tree", root: "root" })
    model.execute({
        kind: "subscribe",
        ...root,
        node: "external",
        subscription: "sub",
    })
    const read = () =>
        model.execute({ kind: "read", ...root, node: "external" }).outcome!
    const before = read()
    model.execute({ kind: "emit", source: "source" })
    model.execute({ kind: "emit", source: "source" })
    expect(sameExternalOutcome(before, read())).toBe(true)
    expect(model.work.subscriberCalls).toBe(0)
    const reject = () =>
        model.execute({
            kind: "set",
            ...root,
            atom: "external",
            value: value.number(1),
        }).failures[0]!
    const first = reject()
    const second = reject()
    expect(first.identity).toBe("readonly")
    expect(second.identity).toBe(first.identity)
    expect(first.occurrence).toBeNumber()
    expect(second.occurrence).not.toBe(first.occurrence)
})
