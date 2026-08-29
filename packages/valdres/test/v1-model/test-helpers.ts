import { expect } from "bun:test"
import {
    createReferenceModel,
    value,
    type AuditEvent,
    type Command,
    type ReadOutcome,
    type ReferenceModel,
    type ValueToken,
} from "./index"

export function atomModel(
    fallback: ValueToken = value.number(0),
): ReferenceModel {
    const model = createReferenceModel()
    ok(model, {
        kind: "define-atom",
        atom: { id: "count", fallback: { kind: "eager", value: fallback } },
    })
    ok(model, { kind: "create-tree", tree: "tree", root: "root" })
    return model
}

export function collectionModel(): ReferenceModel {
    const model = createReferenceModel()
    ok(model, { kind: "define-collection", collection: { id: "movies" } })
    ok(model, { kind: "define-row", collection: "movies", row: "a", key: "a" })
    ok(model, { kind: "define-row", collection: "movies", row: "b", key: "b" })
    ok(model, { kind: "define-row", collection: "movies", row: "c", key: "c" })
    ok(model, { kind: "create-tree", tree: "tree", root: "root" })
    return model
}

export function ok(model: ReferenceModel, command: Command): void {
    expect(model.execute(command)).toMatchObject({ ok: true })
}

export function read(
    model: ReferenceModel,
    scope: string,
    target: Extract<Command, { kind: "read" }>["target"],
    as = "read",
): ReadOutcome {
    const result = model.execute({
        kind: "read",
        tree: "tree",
        scope,
        target,
        as,
    })
    expect(result.ok).toBeTrue()
    return result.outcome!
}

export function readNumber(
    model: ReferenceModel,
    scope: string,
    atom = "count",
): number {
    const outcome = read(model, scope, { kind: "atom", atom })
    expect(outcome.kind).toBe("value")
    const token = (outcome as Extract<ReadOutcome, { kind: "value" }>).value
    expect(token.kind).toBe("number")
    return (token as Extract<ValueToken, { kind: "number" }>).value
}

export function rowValue(
    model: ReferenceModel,
    scope: string,
    row: string,
): ValueToken | undefined {
    const outcome = read(model, scope, { kind: "row", row })
    return outcome.kind === "value" ? outcome.value : undefined
}

export function rows(
    model: ReferenceModel,
    scope: string,
): Extract<ReadOutcome, { kind: "rows" }> {
    const outcome = read(model, scope, {
        kind: "collection",
        collection: "movies",
    })
    expect(outcome.kind).toBe("rows")
    return outcome as Extract<ReadOutcome, { kind: "rows" }>
}

export function lastCommit(
    model: ReferenceModel,
): Extract<AuditEvent, { kind: "commit" }> {
    const commit = model.audit.findLast(
        (event): event is Extract<AuditEvent, { kind: "commit" }> =>
            event.kind === "commit",
    )
    expect(commit).toBeDefined()
    return commit!
}
