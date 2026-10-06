// Transaction.resetAll(): seeded differential between the independent
// ReferenceModel (test/v1-model) and the public runtime. Compares every
// in-transaction membership read, and after each transaction every scope's
// membership order, row values and atom value. Covers repeated and nested
// clears, staged writes before/after clears, parent writes, mirroring and
// history-keeping descendants, and rollback. 2,000 "mixed" seeds: fewer let
// a planted removal of the first-event mirroring invalidation (B4) survive.
// 1,000 "sparse" seeds target explicit clears of never-owning scopes. A
// further 1,000 seeds read every scope after every step: committed results
// must not depend on which memberships were read or materialized.
import { describe, expect, test } from "bun:test"
import { atom, collection, store } from "../../src/index"
import {
    createReferenceModel,
    value,
    type ReadOutcome,
    type TransactionStep,
} from "../v1-model"

const rng = (seed: number) => {
    let state = seed >>> 0
    return (n: number) => {
        state = (Math.imul(state, 1103515245) + 12345) >>> 0
        return (state >>> 16) % n
    }
}

const SCOPES = [
    ["A", "root"],
    ["B", "A"],
    ["C", "A"],
    ["D", "B"],
] as const
const ROWS = ["a", "b", "c", "d", "e", "f"]

type Op =
    | { kind: "set"; row: string; v: string }
    | { kind: "delete"; row: string }
    | { kind: "reset"; row: string }
    | { kind: "set-atom"; v: number }
    | { kind: "reset-atom" }

/**
 * "mixed": random writes everywhere. "sparse": only root and A write before
 * the transactions, so B, C and D usually own nothing; transactions clear
 * often and write mostly presence-neutral values to present rows. This
 * targets explicit clears of never-owning scopes below restored ancestors,
 * in every clear order, and the uncleared-writer control.
 */
type Profile = "mixed" | "sparse"

const program = (seed: number, profile: Profile = "mixed") => {
    const rand = rng(seed)
    const scopes = ["root", ...SCOPES.map(([id]) => id)]
    const randomOp = (): Op => {
        if (profile === "sparse" && rand(10) < 7) {
            const row = ROWS[rand(4)]!
            return { kind: "set", row, v: row }
        }
        const r = rand(10)
        const row = ROWS[rand(ROWS.length)]!
        if (r < 4) return { kind: "set", row, v: `${row}${rand(3)}` }
        if (r < 6) return { kind: "delete", row }
        if (r < 8) return { kind: "reset", row }
        return r === 8
            ? { kind: "set-atom", v: rand(3) }
            : { kind: "reset-atom" }
    }
    const setup: Array<[string, Op]> = []
    for (let i = 0; i < 4; i++)
        setup.push(["root", { kind: "set", row: ROWS[i]!, v: ROWS[i]! }])
    for (let i = 0; i < 14; i++)
        setup.push([
            profile === "sparse"
                ? scopes[rand(2)]!
                : scopes[rand(scopes.length)]!,
            randomOp(),
        ])
    const transactions: Array<{
        steps: Array<
            | { kind: "op"; scope: string; op: Op }
            | { kind: "clear"; scope: string }
            | { kind: "read"; scope: string }
        >
        abort: boolean
    }> = []
    for (let t = 0; t < 3; t++) {
        const steps: (typeof transactions)[number]["steps"] = []
        for (let s = 0; s < 12; s++) {
            const r = rand(10)
            const target = scopes[rand(scopes.length)]!
            if (r < (profile === "sparse" ? 3 : 4))
                steps.push({ kind: "op", scope: target, op: randomOp() })
            else if (r < 7)
                steps.push({
                    kind: "clear",
                    scope: scopes[1 + rand(scopes.length - 1)]!,
                })
            else steps.push({ kind: "read", scope: target })
        }
        transactions.push({ steps, abort: rand(6) === 0 })
    }
    return { setup, transactions, scopes }
}

/** `readAll` additionally reads every scope's membership after every step,
 * which materializes memberships and warms draft memos; results must not
 * depend on what was read. */
const run = (seed: number, profile: Profile = "mixed", readAll = false) => {
    const { setup, transactions, scopes } = program(seed, profile)
    // ---- reference model
    const model = createReferenceModel()
    const okm = (command: Parameters<typeof model.execute>[0]) => {
        const result = model.execute(command)
        if (!result.ok)
            throw new Error(`model ${command.kind}: ${result.error}`)
        return result
    }
    okm({
        kind: "define-atom",
        atom: {
            id: "count",
            fallback: { kind: "eager", value: value.number(0) },
        },
    })
    okm({ kind: "define-collection", collection: { id: "rows" } })
    for (const row of ROWS)
        okm({ kind: "define-row", collection: "rows", row, key: row })
    okm({ kind: "create-tree", tree: "tree", root: "root" })
    for (const [id, parent] of SCOPES)
        okm({ kind: "create-scope", tree: "tree", parent, scope: id, name: id })
    const toMutation = (op: Op) =>
        op.kind === "set"
            ? ({
                  kind: "set-row",
                  row: op.row,
                  value: value.string(op.v),
              } as const)
            : op.kind === "delete"
              ? ({ kind: "delete-row", row: op.row } as const)
              : op.kind === "reset"
                ? ({ kind: "reset-row", row: op.row } as const)
                : op.kind === "set-atom"
                  ? ({
                        kind: "set-atom",
                        atom: "count",
                        value: value.number(op.v),
                    } as const)
                  : ({ kind: "reset-atom", atom: "count" } as const)

    // ---- runtime
    const rows = collection<string, string>()
    const count = atom(0)
    const root = store()
    const handles: Record<string, ReturnType<typeof store>> = { root }
    for (const [id, parent] of SCOPES) handles[id] = handles[parent]!.scope(id)
    const applyRuntime = (target: any, op: Op) => {
        if (op.kind === "set") target.set(rows(op.row), op.v)
        else if (op.kind === "delete") target.delete(rows(op.row))
        else if (op.kind === "reset") target.reset(rows(op.row))
        else if (op.kind === "set-atom") target.set(count, op.v)
        else target.reset(count)
    }
    for (const [scope, op] of setup) {
        const result = model.execute({
            kind: "mutate",
            tree: "tree",
            scope,
            mutation: toMutation(op),
        })
        let runtimeError: unknown
        try {
            applyRuntime(handles[scope], op)
        } catch (error) {
            runtimeError = error
        }
        expect(result.ok).toBe(runtimeError === undefined)
    }

    const snapshot = () =>
        Object.fromEntries(
            scopes.map(id => {
                const modelRows = (
                    model.execute({
                        kind: "read",
                        tree: "tree",
                        scope: id,
                        target: { kind: "collection", collection: "rows" },
                        as: "r",
                    }).outcome as Extract<ReadOutcome, { kind: "rows" }>
                ).rows
                const modelValues = ROWS.map(row => {
                    const outcome = model.execute({
                        kind: "read",
                        tree: "tree",
                        scope: id,
                        target: { kind: "row", row },
                        as: "v",
                    }).outcome!
                    return outcome.kind === "value"
                        ? (outcome.value as { value: string }).value
                        : null
                })
                const modelAtom = (
                    model.execute({
                        kind: "read",
                        tree: "tree",
                        scope: id,
                        target: { kind: "atom", atom: "count" },
                        as: "c",
                    }).outcome as { value: { value: number } }
                ).value.value
                const h = handles[id]!
                return [
                    id,
                    {
                        model: {
                            rows: modelRows.join(","),
                            values: modelValues,
                            atom: modelAtom,
                        },
                        runtime: {
                            rows: h
                                .get(rows)
                                .map(r => r.key)
                                .join(","),
                            values: ROWS.map(row => h.get(rows(row)) ?? null),
                            atom: h.get(count),
                        },
                    },
                ]
            }),
        )

    let compared = 0
    for (const transaction of transactions) {
        // model steps
        const steps: TransactionStep[] = scopes
            .filter(id => id !== "root")
            .map(
                id =>
                    ({
                        kind: "resolve-cursor",
                        cursor: id,
                        target: { kind: "scope", tree: "tree", scope: id },
                    }) as TransactionStep,
            )
        const cursorOf = (id: string) => (id === "root" ? "entry" : id)
        let readIndex = 0
        for (const step of transaction.steps) {
            if (step.kind === "op")
                steps.push({
                    kind: "attempt",
                    steps: [
                        {
                            kind: "mutate",
                            cursor: cursorOf(step.scope),
                            mutation: toMutation(step.op),
                        },
                    ],
                })
            else if (step.kind === "clear")
                steps.push({
                    kind: "reset-all",
                    cursor: cursorOf(step.scope),
                })
            else
                steps.push({
                    kind: "read",
                    cursor: cursorOf(step.scope),
                    target: { kind: "collection", collection: "rows" },
                    as: `read-${readIndex++}`,
                })
        }
        if (transaction.abort) steps.push({ kind: "raise", code: "ABORT" })
        model.clearEvents()
        const modelResult = model.execute({
            kind: "transact",
            tree: "tree",
            entryScope: "root",
            steps,
        })
        const modelReads = model.trace
            .filter(e => e.kind === "read")
            .map(e =>
                (
                    e as { outcome: Extract<ReadOutcome, { kind: "rows" }> }
                ).outcome.rows.join(","),
            )

        // runtime steps
        const runtimeReads: string[] = []
        let runtimeAborted = false
        try {
            root.txn(tx => {
                const cursors: Record<string, any> = { root: tx }
                for (const id of scopes)
                    if (id !== "root") cursors[id] = tx.scope(handles[id]!)
                for (const step of transaction.steps) {
                    if (step.kind === "op") {
                        // mirrors the model's `attempt`: a rejected write
                        // stages nothing and the transaction continues
                        try {
                            applyRuntime(cursors[step.scope], step.op)
                        } catch {}
                    } else if (step.kind === "clear")
                        cursors[step.scope].resetAll()
                    else
                        runtimeReads.push(
                            cursors[step.scope]
                                .get(rows)
                                .map((r: any) => r.key)
                                .join(","),
                        )
                    if (readAll) for (const id of scopes) cursors[id].get(rows)
                }
                if (transaction.abort) throw new Error("ABORT")
            })
        } catch (error) {
            runtimeAborted = (error as Error).message === "ABORT"
            if (!runtimeAborted) throw error
        }
        expect(runtimeAborted).toBe(transaction.abort)
        expect(modelResult.ok).toBe(!transaction.abort)
        expect(runtimeReads).toEqual(modelReads)
        const snap = snapshot()
        for (const id of scopes)
            expect(snap[id]!.runtime).toEqual(snap[id]!.model)
        compared += runtimeReads.length + scopes.length
    }
    return compared
}

describe("resetAll matches the ReferenceModel", () => {
    test("V1M-RESETALL-008 seeded runtime differential across nested scopes, staged writes, repeated clears and rollback", () => {
        let compared = 0
        for (const [profile, seeds, readAll] of [
            ["mixed", 2000, false],
            ["sparse", 1000, false],
            ["mixed", 500, true],
            ["sparse", 500, true],
        ] as const)
            for (let seed = 1; seed <= seeds; seed++) {
                try {
                    compared += run(seed, profile, readAll)
                } catch (error) {
                    throw new Error(
                        `${profile}${readAll ? " readAll" : ""} seed ${seed}: ${(error as Error).message}`,
                    )
                }
            }
        expect(compared).toBeGreaterThan(80_000)
    }, 30_000)
})
