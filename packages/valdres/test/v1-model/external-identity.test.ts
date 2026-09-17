import { expect, test } from "bun:test"
import { ExternalReferenceModel, sameExternalOutcome } from "./external-model"
import { externalModelBounds } from "./external-protocol"
import { value } from "./protocol"

const root = { tree: "tree", scope: "root" } as const
const number = (input: number) =>
    ({ kind: "value", value: value.number(input) }) as const

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
