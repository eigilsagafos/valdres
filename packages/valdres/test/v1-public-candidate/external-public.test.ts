import { describe, expect, test } from "bun:test"
import {
    atom,
    collection,
    externalAtom,
    family,
    selector,
    store,
    ExternalSourceOperationError,
    InvalidExternalCleanupError,
    InvalidSynchronousExternalSnapshotError,
    RuntimeMismatchError,
    ServerSnapshotUnavailableError,
    SubscriberNotificationError,
    type ExternalSource,
    type State,
} from "../../src/index"
import { readHydrationSnapshot } from "../../src/adapter-internals/v1"
import {
    createCommittedStoreTreeDomain,
    createDomainStore,
    createInternalStoreTreeInstrumentation,
} from "../../src/v1-internal/committed-store-tree/committed-store-tree"
import { createInternalExternalAtom } from "../../src/v1-internal/committed-store-tree/external-atom"
import { v1Domain } from "../../src/v1-internal/public-domain"

function thrown(operation: () => unknown): unknown {
    try {
        operation()
    } catch (error) {
        return error
    }
    throw new Error("Expected operation to throw")
}

const source = <Value>(value: Value): ExternalSource<Value> => ({
    getSnapshot: () => value,
    subscribe: () => () => {},
})

describe("public ExternalAtom definitions", () => {
    test("creates fresh frozen definitions without sampling or subscribing", () => {
        let samples = 0
        let starts = 0
        const shared = {
            getSnapshot() {
                samples++
                return 1
            },
            subscribe() {
                starts++
                return () => {}
            },
        }
        const first = externalAtom(shared, { name: "same name" })
        const second = externalAtom(shared, { name: "same name" })

        expect(first).not.toBe(second)
        expect(first.kind).toBe("external")
        expect(Object.isFrozen(first)).toBe(true)
        expect([samples, starts]).toEqual([0, 0])
        const target = store()
        const stopFirst = target.sub(first, () => {})
        const stopSecond = target.sub(second, () => {})
        expect(starts).toBe(2)
        stopFirst()
        stopSecond()
        target.dispose()
    })

    test("captures inherited methods once in order and preserves their receiver", () => {
        const captures: string[] = []
        const receivers: unknown[] = []
        let invalidator!: () => void
        let cleaned = 0
        const prototype = {
            get getSnapshot() {
                captures.push("getSnapshot")
                return function (this: { value: number }) {
                    receivers.push(this)
                    return this.value
                }
            },
            get getServerSnapshot() {
                captures.push("getServerSnapshot")
                return function (this: { server: number }) {
                    receivers.push(this)
                    return this.server
                }
            },
            get subscribe() {
                captures.push("subscribe")
                return function (this: object, listener: () => void) {
                    receivers.push(this)
                    invalidator = listener
                    return () => cleaned++
                }
            },
        }
        const structural = Object.assign(Object.create(prototype), {
            value: 1,
            server: 10,
        })
        const external = externalAtom<number>(structural)
        expect(captures).toEqual([
            "getSnapshot",
            "getServerSnapshot",
            "subscribe",
        ])
        for (const method of captures) {
            Object.defineProperty(structural, method, {
                value: () => {
                    throw new Error("re-read captured method")
                },
            })
        }
        const target = store()
        expect(target.get(external)).toBe(1)
        expect(readHydrationSnapshot(target, external)).toBe(10)
        let notifications = 0
        const stop = target.sub(external, () => notifications++)
        structural.value = 2
        invalidator()
        expect(target.get(external)).toBe(2)
        expect(notifications).toBe(1)
        expect(receivers.every(receiver => receiver === structural)).toBe(true)
        expect(captures).toHaveLength(3)
        stop()
        expect(cleaned).toBe(1)
        target.dispose()
    })

    test("rejects malformed sources, arity, and every unknown own option key", () => {
        for (const invalid of [
            null,
            undefined,
            1,
            "source",
            [],
            () => 1,
            {},
            { getSnapshot: 1, subscribe: () => () => {} },
            { getSnapshot: () => 1, subscribe: 1 },
            { ...source(1), getServerSnapshot: null },
        ]) {
            expect(thrown(() => externalAtom(invalid as never))).toBeInstanceOf(
                TypeError,
            )
        }
        expect(
            thrown(() => Reflect.apply(externalAtom, undefined, [])),
        ).toBeInstanceOf(TypeError)
        expect(
            thrown(() =>
                Reflect.apply(externalAtom, undefined, [source(1), {}, {}]),
            ),
        ).toBeInstanceOf(TypeError)
        for (const options of [
            null,
            [],
            "name",
            { name: 1 },
            { equal: Object.is },
            { subscribe: () => {} },
            { [Symbol("unknown")]: true },
            Object.defineProperty({}, "hidden", { value: true }),
        ]) {
            expect(
                thrown(() => externalAtom(source(1), options as never)),
            ).toBeInstanceOf(TypeError)
        }
        const emptyPrototype = Object.assign(Object.create(null), source(2))
        const target = store()
        expect(target.get(externalAtom<number>(emptyPrototype))).toBe(2)
        target.dispose()
    })

    test("rejects writes before invoking source methods or updater callbacks", () => {
        let samples = 0
        let updates = 0
        const external = externalAtom({
            getSnapshot() {
                samples++
                return 1
            },
            subscribe: () => () => {},
        })
        const target = store()
        const update = () => {
            updates++
            return 2
        }
        for (const operation of [
            () => target.set(external as never, 2),
            () => target.update(external as never, update),
            () => target.reset(external as never),
        ])
            expect(thrown(operation)).toBeInstanceOf(TypeError)
        target.txn(transaction => {
            for (const operation of [
                () => transaction.set(external as never, 2),
                () => transaction.update(external as never, update),
                () => transaction.reset(external as never),
            ])
                expect(thrown(operation)).toBeInstanceOf(TypeError)
        })
        expect([samples, updates]).toEqual([0, 0])
        target.dispose()
    })

    test("brands handles to their domain while leaving shared structural sources reusable", () => {
        const structural = source(3)
        const local = externalAtom(structural)
        const foreignDomain = createCommittedStoreTreeDomain()
        const foreign = createInternalExternalAtom(foreignDomain, structural)
        const target = store()
        const foreignStore = foreignDomain.createStoreTree()
        expect(target.get(local)).toBe(3)
        expect(foreignStore.get(foreign)).toBe(3)
        for (const operation of [
            () => target.get(foreign),
            () => target.sub(foreign, () => {}),
            () => target.set(foreign as never, 4),
            () => target.txn(transaction => transaction.get(foreign)),
            () => foreignStore.get(local),
            () => family((_key: string) => foreign)("foreign"),
        ])
            expect(thrown(operation)).toBeInstanceOf(RuntimeMismatchError)
        target.dispose()
        foreignStore.dispose()
    })
})

describe("ExternalAtom family admission", () => {
    test("accepts active factory construction and already published members", () => {
        const members = family((key: string) => externalAtom(source(key)))
        const first = members("first")
        const forwarded = family((_key: string) => first)
        const nested = family((key: string) => members(key))
        expect(members("first")).toBe(first)
        expect(forwarded("alias")).toBe(first)
        expect(nested("first")).toBe(first)
        const target = store()
        expect(target.get(first)).toBe("first")
        target.dispose()
    })

    test("rejects arbitrary pre-existing States and collection States", () => {
        const rows = collection<string, number>()
        const preexisting: readonly State<any>[] = [
            externalAtom(source(1)),
            atom(1),
            selector(() => 1),
            rows,
            rows("row"),
        ]
        for (const state of preexisting) {
            const members = Reflect.apply(family, undefined, [
                (_key: string) => state,
            ])
            expect(thrown(() => members("key"))).toBeInstanceOf(TypeError)
        }
        for (const create of [
            (_key: string) => collection<string, number>(),
            (_key: string) => collection<string, number>()("row"),
        ]) {
            const members = Reflect.apply(family, undefined, [create])
            expect(thrown(() => members("key"))).toBeInstanceOf(TypeError)
        }
        let leaked: ReturnType<typeof externalAtom<number>> | undefined
        const inner = family((_key: string) => {
            leaked = externalAtom(source(1))
            return atom(0)
        })
        const outer = family((key: string) => {
            inner(key)
            return leaked!
        })
        expect(thrown(() => outer("not-published"))).toBeInstanceOf(TypeError)
    })

    test("keeps family ownership and reacquisition accounting Atom-only", () => {
        const counters = createInternalStoreTreeInstrumentation()
        const target = createDomainStore(v1Domain, counters)
        const externalMembers = family((key: string) =>
            externalAtom(source(key.length)),
        )
        const external = externalMembers("external")
        const derivedMembers = family((key: string) =>
            selector(get => get(externalMembers(key))),
        )
        const ownedMembers = family((key: string) => atom(key.length))
        const owned = ownedMembers("owned")
        const counts = () => [
            counters.read("familyOwnerRetentionSetsCreated"),
            counters.read("familyOwnerRetains"),
            counters.read("familyOwnerReleases"),
        ]
        expect(target.get(external)).toBe(8)
        target.txn(transaction => expect(transaction.get(external)).toBe(8))
        const stop = target.sub(derivedMembers("external"), () => {})
        stop()
        expect(counts()).toEqual([0, 0, 0])
        target.set(owned, 7)
        expect(counts()).toEqual([1, 1, 0])
        target.reset(owned)
        expect(counts()).toEqual([1, 1, 1])
        target.dispose()
    })
})

describe("public ExternalAtom error boundaries", () => {
    test("preserves ordinary live and server errors as exact application objects", () => {
        const liveFailure = new Error("live snapshot failed")
        const serverFailure = new Error("server snapshot failed")
        let fail = true
        const external = externalAtom({
            getSnapshot() {
                if (fail) throw liveFailure
                return 7
            },
            getServerSnapshot() {
                throw serverFailure
            },
            subscribe: () => () => {},
        })
        const target = store()
        expect(thrown(() => target.get(external))).toBe(liveFailure)
        expect(thrown(() => readHydrationSnapshot(target, external))).toBe(
            serverFailure,
        )
        expect(Object.isFrozen(liveFailure)).toBe(false)
        expect(Object.isFrozen(serverFailure)).toBe(false)
        fail = false
        expect(target.get(external)).toBe(7)
        target.dispose()
    })

    for (const server of [false, true]) {
        for (const throws of [false, true]) {
            test(`contains ${throws ? "thrown" : "returned"} ${server ? "server" : "live"} thenables with one public error class`, () => {
                let contained = 0
                const thenable = {
                    then(_resolve: unknown, reject: (error: unknown) => void) {
                        contained++
                        reject("contained")
                    },
                }
                const read = () => {
                    if (throws) throw thenable
                    return thenable
                }
                const external = externalAtom({
                    getSnapshot: read,
                    getServerSnapshot: read,
                    subscribe: () => () => {},
                })
                const target = store()
                const error = thrown(() =>
                    server
                        ? readHydrationSnapshot(target, external)
                        : target.get(external),
                )
                expect(error).toBeInstanceOf(
                    InvalidSynchronousExternalSnapshotError,
                )
                expect(error).toMatchObject({
                    code: "VALDRES_INVALID_SYNCHRONOUS_EXTERNAL_SNAPSHOT",
                })
                expect(Object.isFrozen(error)).toBe(true)
                expect(contained).toBe(1)
                target.dispose()
            })
        }
    }

    test("makes a missing server snapshot fatal with exact frozen target-to-source handles", () => {
        let liveSamples = 0
        const external = externalAtom({
            getSnapshot() {
                liveSamples++
                return 1
            },
            subscribe: () => () => {},
        })
        const middle = selector(get => get(external))
        const outer = selector(get => {
            try {
                return get(middle)
            } catch {
                return 99
            }
        })
        const target = store()
        const error = thrown(() =>
            readHydrationSnapshot(target, outer),
        ) as ServerSnapshotUnavailableError
        expect(error).toBeInstanceOf(ServerSnapshotUnavailableError)
        expect(error.code).toBe("VALDRES_SERVER_SNAPSHOT_UNAVAILABLE")
        expect(error.dependencyPath).toEqual([outer, middle, external])
        error.dependencyPath.forEach((state, index) =>
            expect(state).toBe([outer, middle, external][index]),
        )
        expect(Object.isFrozen(error)).toBe(true)
        expect(Object.isFrozen(error.dependencyPath)).toBe(true)
        const direct = thrown(() =>
            readHydrationSnapshot(target, external),
        ) as ServerSnapshotUnavailableError
        expect(direct.dependencyPath).toEqual([external])
        expect(liveSamples).toBe(0)
        target.dispose()
    })

    test("preserves repeated notification failures and external source metadata", () => {
        let value = 0
        let invalidate!: () => void
        const applicationError = new Error("same failure occurrence")
        const external = externalAtom({
            getSnapshot: () => value,
            subscribe(listener) {
                invalidate = listener
                return () => {}
            },
        })
        const target = store()
        target.sub(external, () => {
            throw applicationError
        })
        target.sub(external, () => {
            throw applicationError
        })
        value = 1
        const error = thrown(invalidate) as SubscriberNotificationError
        expect(error).toBeInstanceOf(SubscriberNotificationError)
        expect(error).toMatchObject({
            committed: true,
            phase: "notifying",
            source: "external-invalidation",
        })
        expect(error.causes).toEqual([applicationError, applicationError])
        expect(error.cause).toBe(applicationError)
        expect(Object.isFrozen(error)).toBe(true)
        expect(Object.isFrozen(error.causes)).toBe(true)
        expect(Object.isFrozen(applicationError)).toBe(false)
        target.dispose()
    })

    test("exposes immutable setup aggregation and directly thrown cleanup metadata", () => {
        const setupFailure = new Error("subscribe failed")
        const broken = externalAtom({
            getSnapshot: () => 1,
            subscribe() {
                throw setupFailure
            },
        })
        const target = store()
        const aggregate = thrown(() =>
            target.sub(broken, () => {}),
        ) as ExternalSourceOperationError
        expect(aggregate).toBeInstanceOf(ExternalSourceOperationError)
        expect(aggregate).toMatchObject({
            committed: false,
            phase: "admitting",
            source: "external-startup",
        })
        expect(aggregate.causes).toEqual([setupFailure])
        expect(aggregate.cause).toBe(setupFailure)
        expect(aggregate.failures).toEqual([
            {
                cause: setupFailure,
                committed: false,
                phase: "admitting",
                source: "external-startup",
            },
        ])
        expect(Object.isFrozen(aggregate)).toBe(true)
        expect(Object.isFrozen(aggregate.causes)).toBe(true)
        expect(Object.isFrozen(aggregate.failures)).toBe(true)
        expect(Object.isFrozen(aggregate.failures[0])).toBe(true)
        const invalid = externalAtom({
            getSnapshot: () => 1,
            subscribe: (() => undefined) as never,
        })
        const cleanup = thrown(() => target.sub(invalid, () => {}))
        expect(cleanup).toBeInstanceOf(InvalidExternalCleanupError)
        expect(cleanup).toMatchObject({
            code: "VALDRES_INVALID_EXTERNAL_CLEANUP",
            committed: false,
            phase: "admitting",
            source: "external-startup",
        })
        expect(Object.isFrozen(cleanup)).toBe(true)
        target.dispose()
    })
})

describe("external error classification avoids application prototype hooks", () => {
    test.each(["setup", "cleanup"] as const)(
        "%s preserves a thrown Proxy without inspecting its prototype",
        phase => {
            let traps = 0
            const trapError = new Error("prototype trap must not run")
            const cause = new Proxy(
                {},
                {
                    getPrototypeOf() {
                        traps++
                        throw trapError
                    },
                },
            )
            const target = store()
            const external = externalAtom({
                getSnapshot: () => 1,
                subscribe() {
                    if (phase === "setup") throw cause
                    return () => {
                        throw cause
                    }
                },
            })
            try {
                const error = thrown(() => {
                    const stop = target.sub(external, () => {})
                    stop()
                }) as ExternalSourceOperationError
                expect(error).toBeInstanceOf(ExternalSourceOperationError)
                expect(error.cause).toBe(cause)
                expect(error.causes).toHaveLength(1)
                expect(error.causes[0]).toBe(cause)
                expect(error.failures[0]!.cause).toBe(cause)
                expect(error.phase).toBe(
                    phase === "setup" ? "admitting" : "cleanup",
                )
                expect(traps).toBe(0)
            } finally {
                target.dispose()
            }
        },
    )

    test("genuine mismatch and notification preserve ordered causes despite a hostile public hasInstance", () => {
        const target = store()
        const mode = atom(false)
        const alien = createCommittedStoreTreeDomain().atom(0)
        const unrelated = externalAtom(source(1))
        target.get(unrelated)
        let mismatch: unknown
        const selected = selector(get => {
            if (!get(mode)) return 0
            try {
                return get(alien)
            } catch (error) {
                mismatch = error
                throw error
            }
        })
        const notification = new Error("subscriber failure")
        const callbacks: string[] = []
        target.sub(selected, () => {
            callbacks.push("throwing")
            throw notification
        })
        target.sub(selected, () => {
            callbacks.push("last")
        })
        const original = Object.getOwnPropertyDescriptor(
            RuntimeMismatchError,
            Symbol.hasInstance,
        )
        let hooks = 0
        Object.defineProperty(RuntimeMismatchError, Symbol.hasInstance, {
            configurable: true,
            value() {
                hooks++
                throw new Error("hasInstance must not run")
            },
        })
        try {
            const error = thrown(() =>
                target.set(mode, true),
            ) as SubscriberNotificationError
            expect(error).toBeInstanceOf(SubscriberNotificationError)
            expect(error.source).toBe("owned-mutation")
            expect(error.cause).toBe(mismatch)
            expect(error.causes).toHaveLength(2)
            expect(error.causes[0]).toBe(mismatch)
            expect(error.causes[1]).toBe(notification)
            expect(callbacks).toEqual(["throwing", "last"])
            expect(hooks).toBe(0)
        } finally {
            if (original === undefined)
                Reflect.deleteProperty(RuntimeMismatchError, Symbol.hasInstance)
            else
                Object.defineProperty(
                    RuntimeMismatchError,
                    Symbol.hasInstance,
                    original,
                )
            target.dispose()
        }
        expect(mismatch).toBeInstanceOf(RuntimeMismatchError)
    })
})
