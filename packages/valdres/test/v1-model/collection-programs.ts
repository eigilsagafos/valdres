import {
    value,
    type Command,
    type ScopeId,
    type TransactionStep,
    type ValueToken,
} from "./protocol"

export interface CollectionProgram {
    readonly name: string
    readonly commands: readonly Command[]
}

export interface CollectionProgramCoverage {
    readonly reads: number
    readonly sets: number
    readonly updates: number
    readonly deletes: number
    readonly resets: number
    readonly transactions: number
    readonly attempts: number
    readonly aborts: number
    readonly scopes: number
    readonly subscriptions: number
    readonly disposals: number
}

const freezeProgram = (
    name: string,
    commands: readonly Command[],
): CollectionProgram =>
    Object.freeze({ name, commands: Object.freeze(commands) })

const baseCommands = (): Command[] => [
    { kind: "define-collection", collection: { id: "movies" } },
    { kind: "define-row", collection: "movies", row: "a", key: "a" },
    { kind: "define-row", collection: "movies", row: "b", key: "b" },
    { kind: "define-row", collection: "movies", row: "c", key: "c" },
    { kind: "create-tree", tree: "tree", root: "root" },
]

const read = (
    scope: ScopeId,
    target: Extract<Command, { kind: "read" }>["target"],
    as: string,
): Command => ({ kind: "read", tree: "tree", scope, target, as })

const mutate = (
    scope: ScopeId,
    mutation: Extract<Command, { kind: "mutate" }>["mutation"],
): Command => ({ kind: "mutate", tree: "tree", scope, mutation })

const transact = (
    entryScope: ScopeId,
    steps: readonly TransactionStep[],
): Command => ({ kind: "transact", tree: "tree", entryScope, steps })

const scope = (parent: ScopeId, id: ScopeId, name?: string): Command => ({
    kind: "create-scope",
    tree: "tree",
    parent,
    scope: id,
    ...(name === undefined ? {} : { name }),
})

const rowTarget = (row: string) => ({ kind: "row" as const, row })
const presenceTarget = (row: string) => ({ kind: "presence" as const, row })
const membershipTarget = () => ({
    kind: "collection" as const,
    collection: "movies",
})
const setRow = (row: string, next: ValueToken) => ({
    kind: "set-row" as const,
    row,
    value: next,
})
const updateRow = (row: string, next: ValueToken) => ({
    kind: "update-row" as const,
    row,
    updater: { kind: "replace" as const, value: next },
})
const deleteRow = (row: string) => ({ kind: "delete-row" as const, row })
const resetRow = (row: string) => ({ kind: "reset-row" as const, row })

export const deterministicCollectionPrograms: readonly CollectionProgram[] =
    Object.freeze([
        freezeProgram("V1M-COLLECTION-001", [
            ...baseCommands(),
            read("root", rowTarget("a"), "absent-row"),
            read("root", presenceTarget("a"), "absent-presence"),
            read("root", membershipTarget(), "empty-membership"),
            mutate("root", setRow("a", value.string("A"))),
            read("root", rowTarget("a"), "present-row"),
            read("root", presenceTarget("a"), "present-presence"),
            read("root", membershipTarget(), "one-row-membership"),
            {
                kind: "subscribe",
                tree: "tree",
                scope: "root",
                target: rowTarget("a"),
                subscription: "reusable",
            },
            { kind: "unsubscribe", subscription: "reusable" },
            {
                kind: "subscribe",
                tree: "tree",
                scope: "root",
                target: membershipTarget(),
                subscription: "reusable",
            },
            { kind: "unsubscribe", subscription: "reusable" },
            scope("root", "named", "stable"),
            scope("root", "named", "stable"),
            scope("root", "other", "stable"),
            { kind: "dispose", tree: "tree", scope: "named" },
            scope("root", "replacement", "stable"),
            read("replacement", membershipTarget(), "replacement-membership"),
        ]),
        freezeProgram("V1M-COLLECTION-002", [
            ...baseCommands(),
            mutate("root", setRow("a", value.string("A"))),
            mutate("root", setRow("b", value.string("B"))),
            read("root", membershipTarget(), "before-value-update"),
            mutate("root", updateRow("a", value.string("A2"))),
            read("root", membershipTarget(), "after-value-update"),
        ]),
        freezeProgram("V1M-COLLECTION-003", [
            ...baseCommands(),
            transact("root", [
                {
                    kind: "mutate",
                    cursor: "entry",
                    mutation: setRow("b", value.string("B")),
                },
                {
                    kind: "mutate",
                    cursor: "entry",
                    mutation: setRow("a", value.string("A")),
                },
                {
                    kind: "read",
                    cursor: "entry",
                    target: membershipTarget(),
                    as: "draft-order",
                },
            ]),
            mutate("root", deleteRow("b")),
            mutate("root", setRow("b", value.string("B2"))),
            read("root", membershipTarget(), "reborn-order"),
        ]),
        freezeProgram("V1M-COLLECTION-004", [
            ...baseCommands(),
            mutate("root", setRow("a", value.string("root-1"))),
            scope("root", "child"),
            mutate("child", deleteRow("a")),
            mutate("root", setRow("a", value.string("root-2"))),
            read("child", rowTarget("a"), "shielded"),
            mutate("child", resetRow("a")),
            read("child", rowTarget("a"), "reconnected"),
        ]),
        freezeProgram("V1M-COLLECTION-005", [
            ...baseCommands(),
            mutate("root", deleteRow("a")),
            mutate("root", setRow("a", value.undefined)),
            mutate(
                "root",
                setRow("a", value.identity("thenable", "row-promise")),
            ),
            mutate("root", {
                kind: "update-row",
                row: "a",
                updater: { kind: "fail", code: "MUST_NOT_RUN" },
            }),
            transact("root", [
                {
                    kind: "mutate",
                    cursor: "entry",
                    mutation: setRow("a", value.string("A")),
                },
                {
                    kind: "attempt",
                    steps: [
                        {
                            kind: "mutate",
                            cursor: "entry",
                            mutation: setRow("b", value.undefined),
                        },
                    ],
                },
            ]),
            read("root", membershipTarget(), "post-errors"),
        ]),
        freezeProgram("V1M-COLLECTION-006", [
            ...baseCommands(),
            scope("root", "child"),
            mutate("child", deleteRow("a")),
            transact("root", [
                {
                    kind: "resolve-cursor",
                    cursor: "child",
                    target: { kind: "scope", tree: "tree", scope: "child" },
                },
                { kind: "mutate", cursor: "child", mutation: resetRow("a") },
                {
                    kind: "mutate",
                    cursor: "entry",
                    mutation: setRow("a", value.string("A")),
                },
                {
                    kind: "read",
                    cursor: "child",
                    target: membershipTarget(),
                    as: "enabled-order",
                },
            ]),
        ]),
        freezeProgram("V1M-COLLECTION-007", [
            ...baseCommands(),
            mutate("root", setRow("a", value.string("A"))),
            scope("root", "child"),
            read("child", rowTarget("a"), "materialize-child-row"),
            read("child", membershipTarget(), "materialize-child-membership"),
            mutate("root", setRow("a", value.string("A2"))),
            mutate("child", setRow("a", value.string("A2"))),
        ]),
        freezeProgram("V1M-COLLECTION-008", [
            ...baseCommands(),
            scope("root", "child"),
            mutate("child", deleteRow("a")),
            transact("root", [
                {
                    kind: "resolve-cursor",
                    cursor: "child",
                    target: { kind: "scope", tree: "tree", scope: "child" },
                },
                { kind: "mutate", cursor: "child", mutation: resetRow("a") },
                { kind: "mutate", cursor: "child", mutation: resetRow("a") },
                {
                    kind: "mutate",
                    cursor: "entry",
                    mutation: setRow("b", value.string("B")),
                },
                {
                    kind: "mutate",
                    cursor: "entry",
                    mutation: setRow("a", value.string("A")),
                },
                {
                    kind: "read",
                    cursor: "child",
                    target: membershipTarget(),
                    as: "no-op-reset-order",
                },
            ]),
        ]),
        freezeProgram("V1M-COLLECTION-009", [
            ...baseCommands(),
            read("root", membershipTarget(), "committed-empty-1"),
            read("root", membershipTarget(), "committed-empty-2"),
            transact("root", [
                {
                    kind: "read",
                    cursor: "entry",
                    target: membershipTarget(),
                    as: "draft-empty-1",
                },
                {
                    kind: "read",
                    cursor: "entry",
                    target: membershipTarget(),
                    as: "draft-empty-2",
                },
            ]),
            transact("root", [
                {
                    kind: "mutate",
                    cursor: "entry",
                    mutation: setRow("a", value.string("A")),
                },
                {
                    kind: "read",
                    cursor: "entry",
                    target: membershipTarget(),
                    as: "aborted-membership",
                },
                { kind: "raise", code: "ABORT" },
            ]),
            read("root", membershipTarget(), "committed-after-abort"),
        ]),
        freezeProgram("V1M-COLLECTION-010", [
            ...baseCommands(),
            mutate("root", setRow("a", value.string("A"))),
            mutate("root", setRow("b", value.string("B"))),
            scope("root", "child"),
            mutate("child", setRow("a", value.string("child-A"))),
            mutate("root", deleteRow("a")),
            read("child", membershipTarget(), "cold-child-history"),
            read("child", rowTarget("a"), "cold-child-value"),
        ]),
        freezeProgram("V1M-COLLECTION-011", [
            ...baseCommands(),
            transact("root", [
                {
                    kind: "mutate",
                    cursor: "entry",
                    mutation: setRow("a", value.string("A")),
                },
                {
                    kind: "mutate",
                    cursor: "entry",
                    mutation: setRow("b", value.string("B")),
                },
                {
                    kind: "mutate",
                    cursor: "entry",
                    mutation: updateRow("a", value.string("A2")),
                },
                {
                    kind: "read",
                    cursor: "entry",
                    target: membershipTarget(),
                    as: "continuous-birth-order",
                },
            ]),
        ]),
        freezeProgram("V1M-COLLECTION-012", [
            ...baseCommands(),
            {
                kind: "define-atom",
                atom: {
                    id: "count",
                    fallback: { kind: "eager", value: value.number(0) },
                },
            },
            {
                kind: "define-atom",
                atom: {
                    id: "notification-fault",
                    fallback: { kind: "lazy-error", code: "NOTIFY_FAULT" },
                },
            },
            {
                kind: "subscribe",
                tree: "tree",
                scope: "root",
                target: membershipTarget(),
                subscription: "membership",
            },
            {
                kind: "subscribe",
                tree: "tree",
                scope: "root",
                target: rowTarget("b"),
                subscription: "row-b",
            },
            {
                kind: "subscribe",
                tree: "tree",
                scope: "root",
                target: rowTarget("a"),
                subscription: "row-a",
                observe: [
                    {
                        scope: "root",
                        target: { kind: "atom", atom: "notification-fault" },
                        as: "first-fault",
                    },
                ],
            },
            {
                kind: "subscribe",
                tree: "tree",
                scope: "root",
                target: { kind: "atom", atom: "count" },
                subscription: "count",
            },
            transact("root", [
                {
                    kind: "mutate",
                    cursor: "entry",
                    mutation: setRow("a", value.string("A")),
                },
                {
                    kind: "mutate",
                    cursor: "entry",
                    mutation: setRow("b", value.string("B")),
                },
                {
                    kind: "mutate",
                    cursor: "entry",
                    mutation: {
                        kind: "set-atom",
                        atom: "count",
                        value: value.number(1),
                    },
                },
            ]),
        ]),
        freezeProgram("V1M-COLLECTION-013", [
            ...baseCommands(),
            mutate("root", setRow("a", value.string("A"))),
            mutate("root", setRow("b", value.string("B"))),
            read("root", membershipTarget(), "baseline-order"),
            transact("root", [
                { kind: "mutate", cursor: "entry", mutation: deleteRow("a") },
                {
                    kind: "mutate",
                    cursor: "entry",
                    mutation: setRow("a", value.string("A")),
                },
                {
                    kind: "read",
                    cursor: "entry",
                    target: membershipTarget(),
                    as: "same-draft-reborn-order",
                },
            ]),
            read("root", membershipTarget(), "committed-reborn-order"),
        ]),
        freezeProgram("V1M-COLLECTION-014", [
            ...baseCommands(),
            mutate("root", setRow("a", value.string("A"))),
            mutate("root", setRow("b", value.string("B"))),
            scope("root", "child"),
            mutate("child", setRow("a", value.string("child-A"))),
            read("child", membershipTarget(), "child-baseline"),
            transact("root", [
                {
                    kind: "resolve-cursor",
                    cursor: "child",
                    target: { kind: "scope", tree: "tree", scope: "child" },
                },
                { kind: "mutate", cursor: "entry", mutation: deleteRow("a") },
                {
                    kind: "read",
                    cursor: "child",
                    target: membershipTarget(),
                    as: "shadowed-order",
                },
            ]),
        ]),
        freezeProgram("V1M-COLLECTION-015", [
            ...baseCommands(),
            mutate("root", setRow("a", value.string("A"))),
            read("root", membershipTarget(), "committed-baseline"),
            transact("root", [
                {
                    kind: "read",
                    cursor: "entry",
                    target: membershipTarget(),
                    as: "draft-baseline",
                },
                { kind: "mutate", cursor: "entry", mutation: deleteRow("a") },
                {
                    kind: "read",
                    cursor: "entry",
                    target: membershipTarget(),
                    as: "draft-absent",
                },
                {
                    kind: "mutate",
                    cursor: "entry",
                    mutation: setRow("a", value.string("A")),
                },
                {
                    kind: "read",
                    cursor: "entry",
                    target: membershipTarget(),
                    as: "draft-returned",
                },
            ]),
            read("root", membershipTarget(), "committed-returned"),
        ]),
    ])

const mulberry32 = (seed: number): (() => number) => {
    let state = seed >>> 0
    return () => {
        state = (state + 0x6d2b79f5) >>> 0
        let value = state
        value = Math.imul(value ^ (value >>> 15), value | 1)
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
        return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296
    }
}

export const generateCollectionProgram = (
    seed: number,
    steps: number,
): Readonly<{
    program: CollectionProgram
    coverage: CollectionProgramCoverage
}> => {
    if (!Number.isSafeInteger(steps) || steps < 1) {
        throw new TypeError(
            "Collection program steps must be a positive integer",
        )
    }
    const random = mulberry32(seed)
    const pick = <Value>(values: readonly Value[]): Value =>
        values[Math.floor(random() * values.length)] as Value
    const rows = ["a", "b", "c", "d"] as const
    const scopes = ["root", "child", "sibling", "nested"] as const
    const values = [
        value.number(0),
        value.number(1),
        value.number(2),
        value.string("x"),
        value.string("y"),
        value.bigint(9n),
    ] as const
    const commands: Command[] = [
        ...baseCommands(),
        { kind: "define-row", collection: "movies", row: "d", key: "d" },
        scope("root", "child", "child"),
        scope("root", "sibling"),
        scope("child", "nested"),
        {
            kind: "subscribe",
            tree: "tree",
            scope: "root",
            target: rowTarget("a"),
            subscription: "root-row-a",
        },
        {
            kind: "subscribe",
            tree: "tree",
            scope: "root",
            target: membershipTarget(),
            subscription: "root-membership",
        },
        {
            kind: "subscribe",
            tree: "tree",
            scope: "child",
            target: presenceTarget("b"),
            subscription: "child-presence-b",
        },
        {
            kind: "subscribe",
            tree: "tree",
            scope: "sibling",
            target: rowTarget("c"),
            subscription: "temporary-row-c",
        },
        { kind: "unsubscribe", subscription: "temporary-row-c" },
        transact("root", [
            {
                kind: "resolve-cursor",
                cursor: "named-child",
                target: {
                    kind: "child-name",
                    parentCursor: "entry",
                    name: "child",
                },
            },
            {
                kind: "read",
                cursor: "named-child",
                target: membershipTarget(),
                as: "seeded-named-child",
            },
        ]),
        transact("root", [
            { kind: "return", value: value.string("seeded-return") },
        ]),
        mutate("root", setRow("d", value.undefined)),
        mutate(
            "root",
            setRow("d", value.identity("thenable", "seeded-thenable")),
        ),
        mutate("root", updateRow("d", value.number(1))),
        transact("root", [
            {
                kind: "attempt",
                steps: [
                    {
                        kind: "mutate",
                        cursor: "entry",
                        mutation: setRow("d", value.undefined),
                    },
                ],
            },
            {
                kind: "mutate",
                cursor: "entry",
                mutation: setRow("a", value.number(0)),
            },
        ]),
        transact("root", [
            {
                kind: "mutate",
                cursor: "entry",
                mutation: setRow("c", value.string("aborted")),
            },
            { kind: "raise", code: "SEEDED_ABORT" },
        ]),
    ]
    const coverage = {
        reads: 1,
        sets: 5,
        updates: 1,
        deletes: 0,
        resets: 0,
        transactions: 4,
        attempts: 1,
        aborts: 1,
        scopes: 3,
        subscriptions: 4,
        disposals: 0,
    }

    for (let index = 0; index < steps; index++) {
        const choice = Math.floor(random() * 10)
        const targetScope = pick(scopes)
        const targetRow = pick(rows)
        const next = pick(values)
        if (choice === 0) {
            commands.push(
                read(targetScope, rowTarget(targetRow), `seed-${index}-row`),
            )
            coverage.reads++
        } else if (choice === 1) {
            commands.push(
                read(
                    targetScope,
                    presenceTarget(targetRow),
                    `seed-${index}-presence`,
                ),
            )
            coverage.reads++
        } else if (choice === 2) {
            commands.push(
                read(
                    targetScope,
                    membershipTarget(),
                    `seed-${index}-membership`,
                ),
            )
            coverage.reads++
        } else if (choice === 3) {
            commands.push(mutate(targetScope, setRow(targetRow, next)))
            coverage.sets++
        } else if (choice === 4) {
            commands.push(mutate(targetScope, updateRow(targetRow, next)))
            coverage.updates++
        } else if (choice === 5) {
            commands.push(mutate(targetScope, deleteRow(targetRow)))
            coverage.deletes++
        } else if (choice === 6) {
            commands.push(mutate(targetScope, resetRow(targetRow)))
            coverage.resets++
        } else if (choice === 7) {
            commands.push(
                transact("root", [
                    {
                        kind: "resolve-cursor",
                        cursor: "target",
                        target: {
                            kind: "scope",
                            tree: "tree",
                            scope: targetScope,
                        },
                    },
                    {
                        kind: "mutate",
                        cursor: "target",
                        mutation: setRow(targetRow, next),
                    },
                    {
                        kind: "read",
                        cursor: "target",
                        target: membershipTarget(),
                        as: `seed-${index}-draft-membership`,
                    },
                ]),
            )
            coverage.transactions++
            coverage.sets++
            coverage.reads++
        } else if (choice === 8) {
            commands.push(
                transact(targetScope, [
                    {
                        kind: "attempt",
                        steps: [
                            {
                                kind: "mutate",
                                cursor: "entry",
                                mutation: updateRow(targetRow, next),
                            },
                        ],
                    },
                    {
                        kind: "read",
                        cursor: "entry",
                        target: presenceTarget(targetRow),
                        as: `seed-${index}-post-attempt`,
                    },
                ]),
            )
            coverage.transactions++
            coverage.attempts++
            coverage.updates++
            coverage.reads++
        } else {
            commands.push(
                transact(targetScope, [
                    {
                        kind: "mutate",
                        cursor: "entry",
                        mutation: setRow(targetRow, next),
                    },
                    { kind: "raise", code: `SEEDED_ABORT_${index}` },
                ]),
            )
            coverage.transactions++
            coverage.aborts++
            coverage.sets++
        }
    }

    commands.push({ kind: "dispose", tree: "tree", scope: "nested" })
    coverage.disposals++
    commands.push(scope("child", "replacement", "replacement"))
    commands.push(
        read("replacement", membershipTarget(), "after-disposal-replacement"),
    )
    coverage.scopes++
    coverage.reads++
    return Object.freeze({
        program: freezeProgram(`seeded-v1-${seed >>> 0}-${steps}`, commands),
        coverage: Object.freeze(coverage),
    })
}
