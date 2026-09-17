import { createInternalExternalAtom } from "../../src/v1-internal/committed-store-tree/external-atom"
import { describe, expect, test } from "bun:test"
import { createCommittedStoreTreeDomain } from "../../src/v1-internal/committed-store-tree/committed-store-tree"
import type {
    CommittedStoreTree,
    ExternalAtom,
} from "../../src/v1-internal/committed-store-tree/types"
import { ExternalReferenceModel } from "../v1-model/external-model"
import type {
    ExternalAction,
    ExternalCommand,
    ExternalOutcome,
    ExternalSample,
    ExternalSourceSpec,
} from "../v1-model/external-protocol"
import { value } from "../v1-model/protocol"

type Command = Extract<
    ExternalCommand,
    {
        kind:
            | "tree"
            | "scope"
            | "read"
            | "subscribe"
            | "unsubscribe"
            | "dispose"
            | "write"
            | "emit"
            | "invalidate"
    }
>
type Notification = Readonly<{
    subscription: string
    outcome: ExternalOutcome
}>
const number = (input: number): ExternalOutcome => ({
    kind: "value",
    value: value.number(input),
})
const key = (...parts: string[]) => parts.join("\0")

/** Direct-source adapter only: no production evaluator or model internals. */
class DirectSourceDriver {
    readonly domain = createCommittedStoreTreeDomain()
    readonly scopes = new Map<string, CommittedStoreTree>()
    readonly nodes = new Map<string, ExternalAtom<number>>()
    readonly snapshots = new Map<string, ExternalSample>()
    readonly listeners = new Map<string, Set<() => void>>()
    readonly generations = new Map<string, (() => void)[]>()
    readonly subscriptions = new Map<string, () => void>()
    readonly errors = new Map<string, Error>()
    readonly notifications: Notification[] = []
    readonly work = { samples: 0, attachments: 0, cleanups: 0 }
    #tree: string | undefined

    constructor(specs: readonly ExternalSourceSpec[]) {
        for (const spec of specs) {
            this.snapshots.set(spec.id, spec.snapshot)
            const listeners = new Set<() => void>()
            this.listeners.set(spec.id, listeners)
            this.nodes.set(
                spec.id,
                createInternalExternalAtom(this.domain, {
                    getSnapshot: () => {
                        this.work.samples++
                        const snapshot = this.snapshots.get(spec.id)!
                        if (snapshot.kind === "error") {
                            let error = this.errors.get(snapshot.identity)
                            if (error === undefined) {
                                error = new Error(snapshot.identity)
                                this.errors.set(snapshot.identity, error)
                            }
                            throw error
                        }
                        if (
                            snapshot.kind !== "value" ||
                            snapshot.value.kind !== "number"
                        )
                            throw new Error("Unsupported fixture snapshot")
                        return snapshot.value.value
                    },
                    subscribe: invalidate => {
                        if (this.#tree === undefined)
                            throw new Error("Missing direct admission tree")
                        this.work.attachments++
                        const generationKey = key(this.#tree, spec.id)
                        let generations = this.generations.get(generationKey)
                        if (generations === undefined)
                            this.generations.set(
                                generationKey,
                                (generations = []),
                            )
                        generations.push(invalidate)
                        this.#actions(spec.startup ?? [], invalidate)
                        listeners.add(invalidate)
                        return () => {
                            this.work.cleanups++
                            listeners.delete(invalidate)
                            this.#actions(spec.cleanup ?? [], invalidate)
                        }
                    },
                }),
            )
        }
    }

    execute(command: Command): ExternalOutcome | undefined {
        this.#tree = "tree" in command ? command.tree : undefined
        try {
            switch (command.kind) {
                case "tree":
                    this.scopes.set(
                        key(command.tree, command.root),
                        this.domain.createStoreTree(),
                    )
                    break
                case "scope":
                    this.scopes.set(
                        key(command.tree, command.scope),
                        this.scopes
                            .get(key(command.tree, command.parent))!
                            .scope(),
                    )
                    break
                case "write":
                    this.snapshots.set(command.source, command.snapshot)
                    break
                case "emit": {
                    const failures: unknown[] = []
                    for (const invalidate of [
                        ...this.listeners.get(command.source)!,
                    ]) {
                        try {
                            invalidate()
                        } catch (error) {
                            failures.push(error)
                        }
                    }
                    if (failures.length > 0) throw new AggregateError(failures)
                    break
                }
                case "invalidate":
                    this.generations
                        .get(key(command.tree, command.external))
                        ?.[command.generation - 1]?.()
                    break
                case "read":
                    return this.#read(command.tree, command.scope, command.node)
                case "subscribe": {
                    const scope = this.scopes.get(
                        key(command.tree, command.scope),
                    )!
                    this.subscriptions.set(
                        command.subscription,
                        scope.sub(this.nodes.get(command.node)!, () => {
                            this.notifications.push({
                                subscription: command.subscription,
                                outcome: this.#read(
                                    command.tree,
                                    command.scope,
                                    command.node,
                                ),
                            })
                        }),
                    )
                    break
                }
                case "unsubscribe":
                    this.subscriptions.get(command.subscription)?.()
                    break
                case "dispose":
                    this.scopes.get(key(command.tree, command.scope))!.dispose()
                    break
            }
        } finally {
            this.#tree = undefined
        }
    }

    #read(tree: string, scope: string, node: string): ExternalOutcome {
        try {
            return number(
                this.scopes.get(key(tree, scope))!.get(this.nodes.get(node)!),
            )
        } catch (error) {
            for (const [identity, known] of this.errors)
                if (error === known)
                    return { kind: "error", space: "source", identity }
            throw error
        }
    }

    #actions(actions: readonly ExternalAction[], invalidate: () => void): void {
        for (const action of actions) {
            if (action.kind === "write")
                this.snapshots.set(action.source, action.snapshot)
            else if (action.kind === "invalidate-self") invalidate()
            else throw new Error("Unsupported fixture source action")
        }
    }
}

class DifferentialCampaign {
    readonly runtime: DirectSourceDriver
    readonly oracle: ExternalReferenceModel
    readonly commands: Command[] = []
    readonly #targets = new Map<string, string>()

    constructor(
        readonly label: string,
        specs: readonly ExternalSourceSpec[],
    ) {
        this.runtime = new DirectSourceDriver(specs)
        this.oracle = new ExternalReferenceModel(
            specs,
            specs.map(spec => ({
                kind: "external",
                id: spec.id,
                source: spec.id,
            })),
        )
    }

    execute(command: Command): void {
        this.commands.push(command)
        if (command.kind === "subscribe")
            this.#targets.set(
                command.subscription,
                key(command.tree, command.scope, command.node),
            )
        const beforeOracle = this.oracle.trace.length
        const beforeRuntime = this.runtime.notifications.length
        const expected = this.oracle.execute(command)
        try {
            expect(expected.failures).toEqual([])
            expect({ outcome: this.runtime.execute(command) }).toEqual({
                outcome: expected.outcome,
            })
            const notifications = this.oracle.trace
                .slice(beforeOracle)
                .flatMap(event =>
                    event.kind === "notify"
                        ? [
                              {
                                  subscription: event.subscription,
                                  outcome: event.outcome,
                              },
                          ]
                        : [],
                )
            expect(
                this.#byTarget(this.runtime.notifications.slice(beforeRuntime)),
            ).toEqual(this.#byTarget(notifications))
            expect(this.runtime.work).toEqual({
                samples: this.oracle.work.liveSamples,
                attachments: this.oracle.work.adapterSubscriptions,
                cleanups: this.oracle.work.adapterCleanups,
            })
        } catch (cause) {
            const recent = this.commands.slice(-12)
            throw new Error(
                `${this.label}, command ${this.commands.length}: ${JSON.stringify(recent)}`,
                { cause },
            )
        }
    }

    #byTarget(notifications: readonly Notification[]) {
        // The core freezes subscription order within each target. Its changed
        // target order is first-reaching, while this independent oracle scans
        // all subscriptions. Do not turn its cross-scope scan into a contract.
        const grouped = new Map<string, Notification[]>()
        for (const notification of notifications) {
            const target = this.#targets.get(notification.subscription)!
            let group = grouped.get(target)
            if (group === undefined) grouped.set(target, (group = []))
            group.push(notification)
        }
        return [...grouped].sort(([left], [right]) =>
            left < right ? -1 : left > right ? 1 : 0,
        )
    }
}

describe("external lifecycle production/model differential", () => {
    test.each([0, 1, 9])(
        "startup catch-up, generation replacement, and revoke-before-cleanup (%s startup invalidations)",
        count => {
            const campaign = new DifferentialCampaign(`startup=${count}`, [
                {
                    id: "a",
                    snapshot: number(0),
                    startup: [
                        { kind: "write", source: "a", snapshot: number(2) },
                        ...Array.from({ length: count }, () => ({
                            kind: "invalidate-self" as const,
                        })),
                    ],
                    cleanup: [{ kind: "invalidate-self" }],
                },
            ])
            const commands: Command[] = [
                { kind: "tree", tree: "tree", root: "root" },
                {
                    kind: "scope",
                    tree: "tree",
                    parent: "root",
                    scope: "child",
                },
                {
                    kind: "subscribe",
                    tree: "tree",
                    scope: "root",
                    node: "a",
                    subscription: "first",
                },
                {
                    kind: "subscribe",
                    tree: "tree",
                    scope: "child",
                    node: "a",
                    subscription: "child",
                },
                { kind: "write", source: "a", snapshot: number(3) },
                { kind: "emit", source: "a" },
                { kind: "unsubscribe", subscription: "first" },
                { kind: "dispose", tree: "tree", scope: "child" },
                { kind: "write", source: "a", snapshot: number(4) },
                {
                    kind: "invalidate",
                    tree: "tree",
                    external: "a",
                    generation: 1,
                },
                {
                    kind: "subscribe",
                    tree: "tree",
                    scope: "root",
                    node: "a",
                    subscription: "replacement",
                },
                { kind: "write", source: "a", snapshot: number(5) },
                {
                    kind: "invalidate",
                    tree: "tree",
                    external: "a",
                    generation: 1,
                },
                { kind: "read", tree: "tree", scope: "root", node: "a" },
                {
                    kind: "invalidate",
                    tree: "tree",
                    external: "a",
                    generation: 2,
                },
                { kind: "dispose", tree: "tree", scope: "root" },
                { kind: "unsubscribe", subscription: "replacement" },
                { kind: "emit", source: "a" },
            ]
            for (const command of commands) campaign.execute(command)
            expect(campaign.runtime.work).toEqual({
                samples: 6,
                attachments: 2,
                cleanups: 2,
            })
        },
    )

    test.each(Array.from({ length: 24 }, (_, index) => index + 1))(
        "seed %s agrees through scope churn, independent trees, errors, and stale generations",
        seed => {
            let random = seed
            const next = () => {
                random ^= random << 13
                random ^= random >>> 17
                random ^= random << 5
                return random >>> 0
            }
            const campaign = new DifferentialCampaign(`seed=${seed}`, [
                { id: "a", snapshot: number(0) },
                { id: "b", snapshot: number(1) },
            ])
            const scopes: {
                tree: string
                id: string
                parent?: string
                live: boolean
            }[] = []
            const subscriptions: string[] = []
            let nextTree = 0,
                nextScope = 0,
                nextSubscription = 0
            const addTree = () => {
                const tree = `tree-${nextTree++}`
                campaign.execute({ kind: "tree", tree, root: "root" })
                scopes.push({ tree, id: "root", live: true })
            }
            addTree()
            addTree()
            for (let step = 0; step < 240; step++) {
                let live = scopes.filter(scope => scope.live)
                if (live.length === 0) {
                    addTree()
                    live = scopes.filter(scope => scope.live)
                }
                const scope = live[next() % live.length]!
                const source = next() % 2 === 0 ? "a" : "b"
                switch (next() % 10) {
                    case 0:
                    case 1: {
                        const snapshots = [
                            number(0),
                            number(-0),
                            number(Number.NaN),
                            number(Infinity),
                            number(next() % 7),
                            {
                                kind: "error" as const,
                                identity: `error-${next() % 3}`,
                            },
                        ]
                        campaign.execute({
                            kind: "write",
                            source,
                            snapshot: snapshots[next() % snapshots.length]!,
                        })
                        break
                    }
                    case 2:
                        campaign.execute({ kind: "emit", source })
                        break
                    case 3:
                        campaign.execute({
                            kind: "read",
                            tree: scope.tree,
                            scope: scope.id,
                            node: source,
                        })
                        break
                    case 4:
                    case 5: {
                        const subscription = `sub-${nextSubscription++}`
                        subscriptions.push(subscription)
                        campaign.execute({
                            kind: "subscribe",
                            tree: scope.tree,
                            scope: scope.id,
                            node: source,
                            subscription,
                        })
                        break
                    }
                    case 6:
                        campaign.execute({
                            kind: "unsubscribe",
                            subscription:
                                subscriptions[next() % subscriptions.length] ??
                                "never-subscribed",
                        })
                        break
                    case 7: {
                        const id = `scope-${nextScope++}`
                        campaign.execute({
                            kind: "scope",
                            tree: scope.tree,
                            parent: scope.id,
                            scope: id,
                        })
                        scopes.push({
                            tree: scope.tree,
                            id,
                            parent: scope.id,
                            live: true,
                        })
                        break
                    }
                    case 8: {
                        campaign.execute({
                            kind: "dispose",
                            tree: scope.tree,
                            scope: scope.id,
                        })
                        const disposed = new Set([scope.id])
                        for (const candidate of scopes) {
                            if (
                                candidate.tree === scope.tree &&
                                (disposed.has(candidate.id) ||
                                    (candidate.parent !== undefined &&
                                        disposed.has(candidate.parent)))
                            ) {
                                candidate.live = false
                                disposed.add(candidate.id)
                            }
                        }
                        if (scope.id === "root" && next() % 2 === 0) addTree()
                        break
                    }
                    case 9: {
                        const generations = campaign.runtime.generations.get(
                            key(scope.tree, source),
                        )
                        campaign.execute({
                            kind: "invalidate",
                            tree: scope.tree,
                            external: source,
                            generation:
                                1 + (next() % ((generations?.length ?? 0) + 1)),
                        })
                        break
                    }
                }
            }
            for (const scope of scopes)
                if (scope.id === "root" && scope.live)
                    campaign.execute({
                        kind: "dispose",
                        tree: scope.tree,
                        scope: "root",
                    })
            for (const subscription of subscriptions)
                campaign.execute({ kind: "unsubscribe", subscription })
            campaign.execute({ kind: "emit", source: "a" })
            campaign.execute({ kind: "emit", source: "b" })
            expect(campaign.runtime.work.attachments).toBe(
                campaign.runtime.work.cleanups,
            )
            expect(
                [...campaign.runtime.listeners.values()].map(set => set.size),
            ).toEqual([0, 0])
        },
    )
})
