import { describe, expect, test } from "bun:test"
import {
    CallbackCapabilityError,
    RuntimeMismatchError,
    StoreDisposedError,
    createCommittedStoreTreeDomain,
    createInternalExternalAtom,
    createInternalStoreTreeInstrumentation,
} from "../../src/v1-internal/committed-store-tree/committed-store-tree"
import {
    InvalidSynchronousExternalSnapshotError,
    ServerSnapshotUnavailableError,
} from "../../src/v1-internal/committed-store-tree/external-atom"
import type { StateRead } from "../../src/v1-internal/committed-store-tree/types"
import { SelectorDependencyError } from "../../src/v1-internal/selector-evaluator/errors"

const thrownBy = (operation: () => unknown): unknown => {
    try {
        operation()
    } catch (error) {
        return error
    }
    throw new Error("Expected operation to throw")
}

const liveCounters = [
    "sourceEpoch",
    "routeAdds",
    "projectionPublications",
    "lifecycleEdgeVisits",
    "adapterSubscriptions",
    "adapterCleanups",
    "propagationSettlements",
    "subscriptionRegistrations",
    "notificationSnapshots",
    "subscriberCallbacksAttempted",
] as const

describe("internal ExternalAtom construction", () => {
    test("preserves inherited method receivers and captures methods once for distinct definitions", () => {
        const domain = createCommittedStoreTreeDomain()
        let subscriptions = 0
        class Source {
            live: Readonly<{ value: number }> = Object.freeze({ value: 1 })
            server: Readonly<{ value: number }> = Object.freeze({ value: -1 })
            getSnapshot() {
                return this.live
            }
            getServerSnapshot() {
                return this.server
            }
            subscribe() {
                subscriptions++
                return () => {}
            }
        }
        const source = new Source()
        const keys = Reflect.ownKeys(source)
        const options = { name: "same name" }
        const first = createInternalExternalAtom(domain, source, options)
        const second = createInternalExternalAtom(domain, source, options)
        const tree = domain.createStoreTree()
        source.getSnapshot = () => ({ value: 999 })
        source.getServerSnapshot = () => ({ value: -999 })

        expect(first).not.toBe(second)
        expect(first.kind).toBe("external")
        expect(Object.isFrozen(first)).toBe(true)
        expect(Object.isFrozen(source)).toBe(false)
        expect(
            Reflect.ownKeys(source).filter(key => typeof key === "symbol"),
        ).toEqual(keys.filter(key => typeof key === "symbol"))
        expect(tree.get(first)).toBe(source.live)
        expect(tree.get(second)).toBe(source.live)
        expect(domain.adapter.readHydrationSnapshot(tree, first)).toBe(
            source.server,
        )
        expect(domain.adapter.readHydrationSnapshot(tree, second)).toBe(
            source.server,
        )
        source.live = Object.freeze({ value: 2 })
        expect(tree.get(first)).toBe(source.live)
        expect(subscriptions).toBe(0)
    })

    test("rejects malformed arguments and every unsupported own option before source callbacks", () => {
        const domain = createCommittedStoreTreeDomain()
        let callbacks = 0
        const source = {
            getSnapshot() {
                callbacks++
                return 1
            },
            subscribe() {
                callbacks++
                return () => {}
            },
        }
        const construct = (...args: unknown[]) =>
            Reflect.apply(createInternalExternalAtom, undefined, [
                domain,
                ...args,
            ])
        for (const args of [
            [],
            [source, undefined, {}],
            [null],
            [undefined],
            [1],
            ["source"],
            [[]],
            [() => 1],
            [{}],
            [{ getSnapshot: () => 1 }],
            [{ ...source, getSnapshot: 1 }],
            [{ ...source, subscribe: undefined }],
            [{ ...source, getServerSnapshot: null }],
            [source, null],
            [source, []],
            [source, "options"],
            [source, { name: 1 }],
            [source, { equal: Object.is }],
            [source, { onMount() {} }],
            [source, { [Symbol("hidden")]: true }],
            [source, Object.defineProperty({}, "cache", { value: true })],
        ]) {
            expect(thrownBy(() => construct(...args))).toBeInstanceOf(TypeError)
        }
        const richerSource = { ...source, unrelated: true }
        const definition = createInternalExternalAtom(domain, richerSource)
        expect(definition.kind).toBe("external")
        expect(callbacks).toBe(0)
    })

    test("preserves property inspection exceptions and quarantines definition validation", () => {
        const domain = createCommittedStoreTreeDomain()
        const tree = domain.createStoreTree()
        const atom = domain.atom(0)
        const fault = new Error("source property")
        const source = {
            get getSnapshot(): () => number {
                throw fault
            },
            subscribe: () => () => {},
        }
        expect(thrownBy(() => createInternalExternalAtom(domain, source))).toBe(
            fault,
        )
        const guarded = {
            get getSnapshot() {
                tree.set(atom, 1)
                return () => 1
            },
            subscribe: () => () => {},
        }
        expect(
            thrownBy(() => createInternalExternalAtom(domain, guarded)),
        ).toBeInstanceOf(CallbackCapabilityError)
        expect(tree.get(atom)).toBe(0)
    })

    test("rejects external writes before update callbacks in Stores and Transactions", () => {
        const domain = createCommittedStoreTreeDomain()
        const tree = domain.createStoreTree()
        let samples = 0
        let updaters = 0
        const external = createInternalExternalAtom(domain, {
            getSnapshot() {
                samples++
                return 1
            },
            subscribe: () => () => {},
        })
        for (const operation of [
            () => tree.set(external as never, 2),
            () =>
                tree.update(external as never, () => {
                    updaters++
                    return 2
                }),
            () => tree.reset(external as never),
        ])
            expect(thrownBy(operation)).toBeInstanceOf(TypeError)
        tree.txn(transaction => {
            for (const operation of [
                () => transaction.set(external as never, 2),
                () =>
                    transaction.update(external as never, () => {
                        updaters++
                        return 2
                    }),
                () => transaction.reset(external as never),
            ])
                expect(thrownBy(operation)).toBeInstanceOf(TypeError)
            if (false) {
                // @ts-expect-error ExternalAtom is not writable.
                transaction.set(external, 2)
                // @ts-expect-error ExternalAtom is not writable.
                transaction.update(external, () => 2)
                // @ts-expect-error ExternalAtom is not writable.
                transaction.reset(external)
            }
        })
        expect([samples, updaters]).toEqual([0, 0])
        if (false) {
            // @ts-expect-error ExternalAtom is not writable.
            tree.set(external, 2)
            // @ts-expect-error ExternalAtom is not writable.
            tree.update(external, () => 2)
            // @ts-expect-error ExternalAtom is not writable.
            tree.reset(external)
        }
    })
})

describe("internal ExternalAtom transaction capture", () => {
    test("captures one source across direct, transitive, scoped, and scratch-generation reads", () => {
        const counters = createInternalStoreTreeInstrumentation()
        const domain = createCommittedStoreTreeDomain(counters)
        const tree = domain.createStoreTree()
        const child = tree.scope()
        const offset = domain.atom(0)
        child.set(offset, 50)
        let snapshot = 10
        let samples = 0
        let subscriptions = 0
        const external = createInternalExternalAtom(domain, {
            getSnapshot() {
                samples++
                return snapshot
            },
            subscribe() {
                subscriptions++
                return () => {}
            },
        })
        const derived = domain.selector(get => get(external) + get(offset))
        const before = liveCounters.map(counter => counters.read(counter))
        tree.txn(transaction => {
            expect(transaction.scope(child).get(derived)).toBe(60)
            snapshot = 20
            expect(transaction.get(external)).toBe(10)
            expect(transaction.get(derived)).toBe(10)
            transaction.set(offset, 1)
            expect(transaction.get(derived)).toBe(11)
            expect(transaction.scope(child).get(derived)).toBe(60)
            expect(transaction.scope(child).get(external)).toBe(10)
            expect(samples).toBe(1)
            expect(liveCounters.map(counter => counters.read(counter))).toEqual(
                before,
            )
        })
        expect(counters.read("transactionCaptures")).toBe(1)
        expect(counters.read("projectionPublications")).toBe(0)
        expect(subscriptions).toBe(0)
        expect(tree.get(external)).toBe(20)
        expect(samples).toBe(2)
    })

    test("pins ordinary errors across scopes and generations without caching them into the live tree", () => {
        const domain = createCommittedStoreTreeDomain()
        const tree = domain.createStoreTree()
        const child = tree.scope()
        const unrelated = domain.atom(0)
        const failure = new Error("offline")
        let failing = true
        let samples = 0
        const external = createInternalExternalAtom(domain, {
            getSnapshot() {
                samples++
                if (failing) throw failure
                return 7
            },
            subscribe: () => () => {},
        })
        const caught: unknown[] = []
        const recover = domain.selector(get => {
            try {
                return get(external)
            } catch (error) {
                caught.push((error as SelectorDependencyError).cause)
                return -1
            }
        })
        tree.txn(transaction => {
            expect(transaction.get(recover)).toBe(-1)
            failing = false
            expect(thrownBy(() => transaction.get(external))).toBe(failure)
            transaction.set(unrelated, 1)
            expect(thrownBy(() => transaction.scope(child).get(external))).toBe(
                failure,
            )
            expect(transaction.get(recover)).toBe(-1)
        })
        expect(caught).toEqual([failure, failure])
        expect(samples).toBe(1)
        expect(tree.get(external)).toBe(7)
        expect(samples).toBe(2)
    })

    for (const throwsThenable of [false, true]) {
        test(`contains a ${throwsThenable ? "thrown" : "returned"} thenable once for the entire transaction`, () => {
            const domain = createCommittedStoreTreeDomain()
            const tree = domain.createStoreTree()
            const child = tree.scope()
            const unrelated = domain.atom(0)
            let samples = 0
            let containments = 0
            const thenable = {
                then(
                    this: unknown,
                    resolve: unknown,
                    reject: (error: unknown) => void,
                ) {
                    expect(this).toBe(thenable)
                    expect(resolve).toBeUndefined()
                    containments++
                    reject(new Error("contained"))
                },
            }
            const external = createInternalExternalAtom(domain, {
                getSnapshot() {
                    samples++
                    if (throwsThenable) throw thenable
                    return thenable
                },
                subscribe: () => () => {},
            })
            const caught: unknown[] = []
            const recover = domain.selector(get => {
                try {
                    get(external)
                } catch (error) {
                    caught.push((error as SelectorDependencyError).cause)
                }
                return 0
            })
            tree.txn(transaction => {
                const first = thrownBy(() => transaction.get(external))
                expect(first).toBeInstanceOf(
                    InvalidSynchronousExternalSnapshotError,
                )
                expect(Object.isFrozen(first)).toBe(true)
                expect(transaction.get(recover)).toBe(0)
                transaction.set(unrelated, 1)
                expect(
                    thrownBy(() => transaction.scope(child).get(external)),
                ).toBe(first)
                expect(transaction.get(recover)).toBe(0)
                expect(caught).toEqual([first, first])
            })
            expect([samples, containments]).toEqual([1, 1])
        })
    }

    test("does not memoize caught runtime mismatches and preserves earlier draft intents", () => {
        const counters = createInternalStoreTreeInstrumentation()
        const local = createCommittedStoreTreeDomain(counters)
        const foreign = createCommittedStoreTreeDomain()
        const tree = local.createStoreTree()
        const atom = local.atom(0)
        let foreignInitializers = 0
        const foreignAtom = foreign.atomLazy(() => {
            foreignInitializers++
            return 8
        })
        let contaminated = true
        let samples = 0
        const faults: unknown[] = []
        const external = createInternalExternalAtom(local, {
            getSnapshot() {
                samples++
                if (contaminated) {
                    try {
                        tree.get(foreignAtom)
                    } catch (error) {
                        faults.push(error)
                    }
                }
                return 9
            },
            subscribe: () => () => {},
        })
        const catches = local.selector(get => {
            try {
                return get(external)
            } catch {
                return -1
            }
        })
        tree.txn(transaction => {
            transaction.set(atom, 3)
            const first = thrownBy(() => transaction.get(external))
            const second = thrownBy(() => transaction.get(catches))
            expect(first).toBe(faults[0])
            expect(second).toBe(faults[1])
            expect(first).toBeInstanceOf(RuntimeMismatchError)
            expect(second).toBeInstanceOf(RuntimeMismatchError)
            expect(first).not.toBe(second)
            contaminated = false
            expect(transaction.get(external)).toBe(9)
            expect(transaction.get(catches)).toBe(9)
        })
        expect(samples).toBe(3)
        expect(counters.read("liveSamples")).toBe(3)
        expect(counters.read("transactionCaptures")).toBe(1)
        expect(foreignInitializers).toBe(0)
        expect(tree.get(atom)).toBe(3)
    })
})

describe("internal ExternalAtom hydration observations", () => {
    test("memoizes each server identity and selector once with zero live graph side effects", () => {
        const counters = createInternalStoreTreeInstrumentation()
        const domain = createCommittedStoreTreeDomain(counters)
        const tree = domain.createStoreTree()
        const atom = domain.atom(1)
        let liveSamples = 0
        let serverSamples = 0
        let subscriptions = 0
        let childCalls = 0
        let parentCalls = 0
        const server = { request: "one" }
        const external = createInternalExternalAtom(domain, {
            getSnapshot() {
                liveSamples++
                return { request: "live" }
            },
            getServerSnapshot() {
                serverSamples++
                return server
            },
            subscribe() {
                subscriptions++
                return () => {}
            },
        })
        const child = domain.selector(get => {
            childCalls++
            return [get(external), get(atom)] as const
        })
        const parent = domain.selector(get => {
            parentCalls++
            return [get(child), get(child), get(external)] as const
        })
        const before = liveCounters.map(counter => counters.read(counter))
        const result = domain.adapter.readHydrationSnapshot(tree, parent)
        expect(result[0]).toBe(result[1])
        expect(result[0][0]).toBe(result[2])
        expect(result[2]).toBe(server)
        expect([
            liveSamples,
            serverSamples,
            subscriptions,
            childCalls,
            parentCalls,
        ]).toEqual([0, 1, 0, 1, 1])
        expect(liveCounters.map(counter => counters.read(counter))).toEqual(
            before,
        )
        expect(counters.read("transactionCaptures")).toBe(0)
        expect(Object.isFrozen(server)).toBe(false)
        tree.set(atom, 2)
        expect([childCalls, parentCalls]).toEqual([1, 1])
    })

    test("ignores live selector results and comparator baselines without overwriting them", () => {
        const domain = createCommittedStoreTreeDomain()
        const tree = domain.createStoreTree()
        const live: Readonly<{ label: string }> = Object.freeze({
            label: "live",
        })
        const server: Readonly<{ label: string }> = Object.freeze({
            label: "server",
        })
        let comparisons = 0
        const external = createInternalExternalAtom(domain, {
            getSnapshot: () => live,
            getServerSnapshot: () => server,
            subscribe: () => () => {},
        })
        const derived = domain.selector(get => ({ source: get(external) }), {
            equal() {
                comparisons++
                return true
            },
        })
        const liveResult = tree.get(derived)
        const hydrated = domain.adapter.readHydrationSnapshot(tree, derived)
        expect(hydrated.source).toBe(server)
        expect(hydrated).not.toBe(liveResult)
        expect(comparisons).toBe(0)
        expect(tree.get(derived)).toBe(liveResult)
        expect(comparisons).toBe(0)
    })

    test("reports the exact direct missing-reader path without calling the live reader", () => {
        const domain = createCommittedStoreTreeDomain()
        const tree = domain.createStoreTree()
        let liveSamples = 0
        const external = createInternalExternalAtom(
            domain,
            {
                getSnapshot() {
                    liveSamples++
                    return 1
                },
                subscribe: () => () => {},
            },
            { name: "must not appear in message" },
        )
        const error = thrownBy(() =>
            domain.adapter.readHydrationSnapshot(tree, external),
        ) as ServerSnapshotUnavailableError
        expect(error).toBeInstanceOf(ServerSnapshotUnavailableError)
        expect(error.code).toBe("VALDRES_SERVER_SNAPSHOT_UNAVAILABLE")
        expect(error.dependencyPath).toEqual([external])
        expect(Object.isFrozen(error)).toBe(true)
        expect(Object.isFrozen(error.dependencyPath)).toBe(true)
        expect(error.message).toBe("An external source has no server snapshot")
        expect(liveSamples).toBe(0)
    })

    test("keeps the first dynamically reached missing path fatal through caught selector failures", () => {
        const domain = createCommittedStoreTreeDomain()
        const tree = domain.createStoreTree()
        let liveSamples = 0
        const branch = createInternalExternalAtom(domain, {
            getSnapshot: () => false,
            getServerSnapshot: () => true,
            subscribe: () => () => {},
        })
        const missing = createInternalExternalAtom(domain, {
            getSnapshot() {
                liveSamples++
                return 3
            },
            subscribe: () => () => {},
        })
        let caught: unknown
        const inner = domain.selector(get => {
            if (!get(branch)) return 0
            try {
                return get(missing)
            } catch (error) {
                caught = error
                return -1
            }
        })
        const outer = domain.selector(get => {
            try {
                return get(inner)
            } catch {
                return -2
            }
        })
        expect(tree.get(outer)).toBe(0)
        const error = thrownBy(() =>
            domain.adapter.readHydrationSnapshot(tree, outer),
        ) as ServerSnapshotUnavailableError
        expect(caught).toBe(error)
        expect(error).toBeInstanceOf(ServerSnapshotUnavailableError)
        expect(error.dependencyPath).toEqual([outer, inner, missing])
        expect(liveSamples).toBe(0)
        expect(tree.get(outer)).toBe(0)
    })

    test("memoizes exact ordinary server errors within one disposable host and isolates later hosts", () => {
        const domain = createCommittedStoreTreeDomain()
        const tree = domain.createStoreTree()
        const failure = new Error("server offline")
        let samples = 0
        let failing = true
        const external = createInternalExternalAtom(domain, {
            getSnapshot: () => 100,
            getServerSnapshot() {
                samples++
                if (failing) throw failure
                return 2
            },
            subscribe: () => () => {},
        })
        const observed: unknown[] = []
        const recover = domain.selector(get => {
            for (let index = 0; index < 2; index++) {
                try {
                    get(external)
                } catch (error) {
                    observed.push((error as SelectorDependencyError).cause)
                }
            }
            return -1
        })
        expect(domain.adapter.readHydrationSnapshot(tree, recover)).toBe(-1)
        expect(samples).toBe(1)
        expect(observed).toEqual([failure, failure])
        expect(
            thrownBy(() =>
                domain.adapter.readHydrationSnapshot(tree, external),
            ),
        ).toBe(failure)
        failing = false
        expect(domain.adapter.readHydrationSnapshot(tree, external)).toBe(2)
        expect(samples).toBe(3)
        expect(tree.get(external)).toBe(100)
    })

    for (const throwsThenable of [false, true]) {
        test(`contains a ${throwsThenable ? "thrown" : "returned"} server thenable once without a Suspense wakeable`, () => {
            const domain = createCommittedStoreTreeDomain()
            const tree = domain.createStoreTree()
            let containments = 0
            let samples = 0
            const thenable = {
                then(_resolve: unknown, reject: (error: unknown) => void) {
                    containments++
                    reject("contained")
                },
            }
            const external = createInternalExternalAtom(domain, {
                getSnapshot: () => thenable,
                getServerSnapshot() {
                    samples++
                    if (throwsThenable) throw thenable
                    return thenable
                },
                subscribe: () => () => {},
            })
            const failures: unknown[] = []
            const recover = domain.selector(get => {
                for (let index = 0; index < 2; index++) {
                    try {
                        get(external)
                    } catch (error) {
                        failures.push((error as SelectorDependencyError).cause)
                    }
                }
                return 0
            })
            expect(domain.adapter.readHydrationSnapshot(tree, recover)).toBe(0)
            expect(failures[0]).toBeInstanceOf(
                InvalidSynchronousExternalSnapshotError,
            )
            expect(failures[0]).not.toBe(thenable)
            expect(failures[1]).toBe(failures[0])
            expect([samples, containments]).toEqual([1, 1])
        })
    }

    test("uses request-local ordinary scope state and resolves lazy fallback only once", () => {
        const counters = createInternalStoreTreeInstrumentation()
        const domain = createCommittedStoreTreeDomain(counters)
        const first = domain.createStoreTree()
        const child = first.scope()
        const second = domain.createStoreTree()
        const offset = domain.atom(0)
        first.set(offset, 1)
        child.set(offset, 2)
        second.set(offset, 3)
        let lazies = 0
        const lazy = domain.atomLazy(() => {
            lazies++
            return 10
        })
        const external = createInternalExternalAtom(domain, {
            getSnapshot: () => 100,
            getServerSnapshot: () => 4,
            subscribe: () => () => {},
        })
        const combined = domain.selector(
            get => get(offset) + get(lazy) + get(external),
        )
        expect(domain.adapter.readHydrationSnapshot(first, combined)).toBe(15)
        expect(domain.adapter.readHydrationSnapshot(child, combined)).toBe(16)
        expect(domain.adapter.readHydrationSnapshot(second, combined)).toBe(17)
        expect(lazies).toBe(2)
        expect(first.get(lazy)).toBe(10)
        expect(child.get(lazy)).toBe(10)
        expect(lazies).toBe(2)
        expect(counters.read("projectionPublications")).toBe(0)
        first.dispose()
        expect(
            thrownBy(() =>
                domain.adapter.readHydrationSnapshot(first, combined),
            ),
        ).toBeInstanceOf(StoreDisposedError)
    })

    test("quarantines live/server source operations and allows wholly foreign-domain reads", () => {
        const domain = createCommittedStoreTreeDomain()
        const foreign = createCommittedStoreTreeDomain()
        const tree = domain.createStoreTree()
        const other = foreign.createStoreTree()
        const atom = domain.atom(0)
        const foreignAtom = foreign.atom(4)
        const operations = [
            () => tree.get(atom),
            () => tree.set(atom, 1),
            () => tree.update(atom, () => 1),
            () => tree.reset(atom),
            () => tree.txn(() => {}),
            () => tree.sub(atom, () => {}),
            () => tree.scope(),
            () => tree.dispose(),
            () => domain.createStoreTree(),
            () => domain.adapter.read(tree, atom),
            () => domain.adapter.subscribe(tree, atom, () => {}),
            () => domain.adapter.readHydrationSnapshot(tree, atom),
        ]
        const rejected: unknown[] = []
        const read = () => {
            for (const operation of operations)
                rejected.push(thrownBy(operation))
            expect(domain.atom(1).kind).toBe("atom")
            return other.get(foreignAtom)
        }
        const external = createInternalExternalAtom(domain, {
            getSnapshot: read,
            getServerSnapshot: read,
            subscribe: () => () => {},
        })
        expect(tree.get(external)).toBe(4)
        expect(domain.adapter.readHydrationSnapshot(tree, external)).toBe(4)
        expect(rejected).toHaveLength(2 * operations.length)
        for (const failure of rejected)
            expect(failure).toBeInstanceOf(CallbackCapabilityError)
        expect(tree.get(atom)).toBe(0)
    })

    test("makes borrowed selector reads sticky capability faults during server sampling", () => {
        const counters = createInternalStoreTreeInstrumentation()
        const domain = createCommittedStoreTreeDomain(counters)
        const tree = domain.createStoreTree()
        const ordinary = domain.atom(3)
        let supplied!: StateRead
        let caught: unknown
        const external = createInternalExternalAtom(domain, {
            getSnapshot: () => 1,
            getServerSnapshot() {
                try {
                    supplied(ordinary)
                } catch (error) {
                    caught = error
                }
                return 2
            },
            subscribe: () => () => {},
        })
        const derived = domain.selector(get => {
            supplied = get
            try {
                return get(external)
            } catch {
                return -1
            }
        })
        const failure = thrownBy(() =>
            domain.adapter.readHydrationSnapshot(tree, derived),
        )
        expect(failure).toBe(caught)
        expect(failure).toBeInstanceOf(CallbackCapabilityError)
        expect(counters.read("projectionPublications")).toBe(0)
        expect(counters.read("sourceEpoch")).toBe(0)
        expect(tree.get(derived)).toBe(1)
    })
})
