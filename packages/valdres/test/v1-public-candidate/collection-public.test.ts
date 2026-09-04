import { describe, expect, test } from "bun:test"
import {
    CallbackCapabilityError,
    InvalidCollectionKeyError,
    InvalidSynchronousCollectionValueError,
    MissingCollectionRowError,
    RuntimeMismatchError,
    UndefinedCollectionValueError,
    atom,
    collection,
    presence,
    selector,
    store,
    type State,
    type Store,
} from "../../src/index"
import {
    read,
    readHydrationSnapshot,
    subscribe,
} from "../../src/adapter-internals/v1"
import {
    createCollectionDefinition,
    getCollectionPresence,
} from "../../src/v1-internal/collection"
import { createCommittedStoreTreeDomain } from "../../src/v1-internal/committed-store-tree/committed-store-tree"
import * as v1Entry from "../../src/v1"

interface Session {
    readonly id: string
    readonly active: boolean
}

const thrownBy = (operation: () => unknown): unknown => {
    try {
        operation()
    } catch (error) {
        return error
    }
    throw new Error("Expected operation to throw")
}

const selectorReadLanes: ReadonlyArray<
    readonly [string, (target: Store, state: State<boolean>) => boolean]
> = [
    ["committed", (target, state) => target.get(state)],
    [
        "transaction scratch",
        (target, state) => target.txn(transaction => transaction.get(state)),
    ],
    ["hydration", (target, state) => readHydrationSnapshot(target, state)],
]

describe("v1 public collections", () => {
    test("keeps root collection error constructors identical and immutable", () => {
        const cases = [
            [InvalidCollectionKeyError, "VALDRES_INVALID_COLLECTION_KEY"],
            [
                InvalidSynchronousCollectionValueError,
                "VALDRES_INVALID_SYNCHRONOUS_COLLECTION_VALUE",
            ],
            [MissingCollectionRowError, "VALDRES_MISSING_COLLECTION_ROW"],
            [
                UndefinedCollectionValueError,
                "VALDRES_UNDEFINED_COLLECTION_VALUE",
            ],
        ] as const

        for (const [ErrorConstructor, code] of cases) {
            const error = new ErrorConstructor()
            expect(v1Entry[ErrorConstructor.name as keyof typeof v1Entry]).toBe(
                ErrorConstructor,
            )
            expect(error).toBeInstanceOf(Error)
            expect(error.constructor).toBe(ErrorConstructor)
            expect(error.name).toBe(ErrorConstructor.name)
            expect(error.code).toBe(code)
            expect(Object.isFrozen(error)).toBe(true)
        }
    })

    test("constructs canonical and rich-input rows with stable readonly identities", () => {
        const sessions = collection<string, Session>()
        const rich = collection<
            string,
            Session,
            { readonly tenant: string; readonly id: string }
        >({ encodeKey: input => `${input.tenant}:${input.id}` })

        expect(sessions("a")).toBe(sessions("a"))
        expect(rich({ tenant: "north", id: "a" })).toBe(
            rich({ tenant: "north", id: "a" }),
        )
        expect(sessions("a")).not.toBe(rich({ tenant: "north", id: "a" }))
        expect(Object.isFrozen(sessions)).toBe(true)
        expect(Object.isFrozen(sessions("a"))).toBe(true)
        expect(sessions("a")).toMatchObject({
            kind: "collection-row",
            key: "a",
        })
    })

    test("reads, mutates, scopes, subscribes, and hydrates rows and membership", () => {
        const sessions = collection<string, Session>()
        const first = sessions("first")
        const second = sessions("second")
        const firstPresence = presence(first)
        const target = store()
        const child = target.scope("child")
        const firstValue = Object.freeze({ id: "first", active: true })
        let rowCalls = 0
        let membershipCalls = 0
        let presenceCalls = 0

        target.sub(first, () => rowCalls++)
        target.sub(sessions, () => membershipCalls++)
        target.sub(firstPresence, () => presenceCalls++)

        expect(target.get(first)).toBeUndefined()
        expect(target.get(sessions)).toEqual([])
        expect(target.get(firstPresence)).toBe(false)
        target.set(first, firstValue)
        expect(target.get(first)).toBe(firstValue)
        expect(target.get(sessions)).toEqual([first])
        expect(target.get(firstPresence)).toBe(true)
        expect([rowCalls, membershipCalls, presenceCalls]).toEqual([1, 1, 1])

        target.update(first, current => ({ ...current, active: false }))
        target.set(second, { id: "second", active: true })
        expect(target.get(first)).toEqual({ id: "first", active: false })
        expect(target.get(sessions)).toEqual([first, second])

        child.delete(first)
        expect(child.get(first)).toBeUndefined()
        expect(child.get(sessions)).toEqual([second])
        child.reset(first)
        expect(child.get(first)).toEqual({ id: "first", active: false })

        expect(read(target, first)).toEqual({ id: "first", active: false })
        expect(read(target, sessions)).toBe(target.get(sessions))
        expect(readHydrationSnapshot(target, first)).toEqual({
            id: "first",
            active: false,
        })
        expect(readHydrationSnapshot(target, sessions)).toBe(
            target.get(sessions),
        )
        let adapterCalls = 0
        const unsubscribe = subscribe(target, sessions, () => adapterCalls++)
        target.delete(second)
        expect(adapterCalls).toBe(1)
        unsubscribe()
    })

    test("composes row, membership, and presence as ordinary Selector sources", () => {
        const sessions = collection<string, Session>()
        const row = sessions("a")
        const isPresent = presence(row)
        const summary = selector(get => ({
            row: get(row),
            rows: get(sessions),
            present: get(isPresent),
        }))
        const target = store()

        expect(target.get(summary)).toEqual({
            row: undefined,
            rows: [],
            present: false,
        })
        target.set(row, { id: "a", active: true })
        expect(target.get(summary)).toEqual({
            row: { id: "a", active: true },
            rows: [row],
            present: true,
        })
    })

    test("shares one atomic draft between Atom and row Transaction operations", () => {
        const count = atom(0)
        const sessions = collection<string, Session>()
        const row = sessions("a")
        const target = store()

        target.txn(transaction => {
            transaction.set(count, 1)
            transaction.set(row, { id: "a", active: true })
            transaction.update(row, current => ({
                ...current,
                active: false,
            }))
            expect(transaction.get(count)).toBe(1)
            expect(transaction.get(row)?.active).toBe(false)
            expect(transaction.get(sessions)).toEqual([row])
        })
        expect(target.get(count)).toBe(1)
        expect(target.get(row)?.active).toBe(false)

        expect(() =>
            target.txn(transaction => {
                transaction.set(count, 2)
                Reflect.apply(transaction.set, transaction, [row, undefined])
            }),
        ).toThrow(UndefinedCollectionValueError)
        expect(target.get(count)).toBe(1)
        expect(target.get(row)?.active).toBe(false)

        target.txn(transaction => transaction.delete(row))
        expect(target.get(row)).toBeUndefined()
    })

    test("uses scoped Transaction cursors for row set, delete, and reset", () => {
        const sessions = collection<string, Session>()
        const row = sessions("a")
        const target = store()
        const child = target.scope("child")
        const inherited = Object.freeze({ id: "a", active: true })
        target.set(row, inherited)

        target.txn(transaction => {
            const scoped = transaction.scope(child)
            scoped.delete(row)
            expect(scoped.get(row)).toBeUndefined()
            scoped.reset(row)
            expect(scoped.get(row)).toBe(inherited)
            scoped.set(row, { id: "a", active: false })
            expect(scoped.get(row)?.active).toBe(false)
        })
        expect(target.get(row)).toBe(inherited)
        expect(child.get(row)?.active).toBe(false)
    })

    test("stores function values exactly and invokes only row updaters", () => {
        const operations = collection<string, () => number>()
        const row = operations("operation")
        const target = store()
        let calls = 0
        const first = (): number => {
            calls++
            return 1
        }
        const second = (): number => {
            calls++
            return 2
        }

        target.txn(transaction => transaction.set(row, first))
        expect(target.get(row)).toBe(first)
        expect(calls).toBe(0)
        target.update(row, current => {
            expect(current).toBe(first)
            return second
        })
        expect(target.get(row)).toBe(second)
        expect(calls).toBe(0)
    })

    test("exports stable collection failures and rejects invalid mutation targets", () => {
        const sessions = collection<string, Session>()
        const row = sessions("a")
        const absent = sessions("absent")
        const target = store()
        const count = atom(0)
        const doubled = selector(get => get(count) * 2)

        expect(() =>
            Reflect.apply(target.set, target, [row, undefined]),
        ).toThrow(UndefinedCollectionValueError)
        expect(() =>
            Reflect.apply(target.set, target, [row, Promise.resolve({})]),
        ).toThrow(InvalidSynchronousCollectionValueError)
        expect(() => target.update(absent, value => value)).toThrow(
            MissingCollectionRowError,
        )
        expect(() => collection<number, Session>()(Number.NaN)).toThrow(
            InvalidCollectionKeyError,
        )
        expect(() =>
            Reflect.apply(collection, undefined, [{ indexes: {} }]),
        ).toThrow(TypeError)
        expect(() =>
            Reflect.apply(collection, undefined, [{ unknown: true }]),
        ).toThrow(TypeError)
        expect(() => Reflect.apply(target.delete, target, [count])).toThrow(
            TypeError,
        )
        expect(() => Reflect.apply(target.delete, target, [doubled])).toThrow(
            TypeError,
        )
        expect(() => Reflect.apply(target.delete, target, [sessions])).toThrow(
            TypeError,
        )
        expect(() =>
            Reflect.apply(target.delete, target, [
                { kind: "collection-row", key: "fake" },
            ]),
        ).toThrow(TypeError)
        expect(target.get(count)).toBe(0)
        expect(target.get(row)).toBeUndefined()
    })

    test("quarantines active selector gets captured by collection encoders", () => {
        for (const [lane, readState] of selectorReadLanes) {
            const source = atom(7)
            let capturedGet: (<Value>(state: State<Value>) => Value) | undefined
            let encoderFault: unknown
            let outerFault: unknown
            let encoderCalls = 0
            let attemptCapturedRead = true
            const rows = collection<string, Session, { readonly id: string }>({
                encodeKey: input => {
                    encoderCalls++
                    if (attemptCapturedRead) {
                        try {
                            capturedGet!(source)
                        } catch (error) {
                            encoderFault = error
                        }
                    }
                    return input.id
                },
            })
            const outer = selector(get => {
                capturedGet = get
                try {
                    return get(presence(rows({ id: lane })))
                } catch (error) {
                    outerFault = error
                    return false
                }
            })
            const target = store()

            const failure = thrownBy(() => readState(target, outer))
            expect(failure).toBeInstanceOf(CallbackCapabilityError)
            expect(encoderFault).toBe(failure)
            expect(outerFault).toBe(failure)
            expect(encoderCalls).toBe(1)

            attemptCapturedRead = false
            expect(readState(store(), outer)).toBe(false)
            expect(encoderCalls).toBe(2)
        }
    })

    test("preserves an earlier RuntimeMismatchError through a borrowed encoder get", () => {
        const foreignDomain = createCommittedStoreTreeDomain()
        const foreignSource = foreignDomain.atom(1)
        const source = atom(7)
        let capturedGet: (<Value>(state: State<Value>) => Value) | undefined
        let mismatchFault: unknown
        let borrowedGetFault: unknown
        let outerFault: unknown
        const rows = collection<string, Session, { readonly id: string }>({
            encodeKey: input => {
                try {
                    capturedGet!(source)
                } catch (error) {
                    borrowedGetFault = error
                }
                return input.id
            },
        })
        const outer = selector(get => {
            try {
                get(foreignSource as unknown as State<number>)
            } catch (error) {
                mismatchFault = error
            }
            capturedGet = get
            try {
                return get(presence(rows({ id: "member" })))
            } catch (error) {
                outerFault = error
                return false
            }
        })

        const failure = thrownBy(() => store().get(outer))
        expect(failure).toBeInstanceOf(RuntimeMismatchError)
        expect(mismatchFault).toBe(failure)
        expect(borrowedGetFault).toBe(failure)
        expect(outerFault).toBe(failure)
    })

    test("rejects foreign collection states before entering direct or Transaction work", () => {
        const foreignDomain = createCommittedStoreTreeDomain()
        const foreignRows = createCollectionDefinition<string, Session>(
            foreignDomain,
        )
        const foreignRow = foreignRows("a")
        const foreignPresence = getCollectionPresence(foreignDomain, foreignRow)
        const count = atom(0)
        const target = store()

        for (const state of [foreignRow, foreignRows, foreignPresence]) {
            expect(() => Reflect.apply(target.get, target, [state])).toThrow(
                RuntimeMismatchError,
            )
            expect(() =>
                target.txn(transaction =>
                    Reflect.apply(transaction.get, transaction, [state]),
                ),
            ).toThrow(RuntimeMismatchError)
        }
        expect(() =>
            Reflect.apply(target.set, target, [foreignRow, {}]),
        ).toThrow(RuntimeMismatchError)
        expect(() =>
            target.txn(transaction => {
                transaction.set(count, 1)
                Reflect.apply(transaction.set, transaction, [foreignRow, {}])
            }),
        ).toThrow(RuntimeMismatchError)
        expect(target.get(count)).toBe(0)
    })
})
