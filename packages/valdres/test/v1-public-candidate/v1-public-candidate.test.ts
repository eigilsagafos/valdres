import { describe, expect, test } from "bun:test"
import * as publicApi from "../../src/index"
import {
    atom,
    collection,
    selector,
    store,
    type Atom,
    type AtomOptions,
    type Selector,
    type SelectorOptions,
    type State,
    type Store,
    type SubscribeFn,
    type Transaction,
    type TransactionFn,
} from "../../src/index"

const thrownBy = (operation: () => unknown): unknown => {
    try {
        operation()
    } catch (error) {
        return error
    }
    throw new Error("Expected operation to throw")
}

describe("v1 public root", () => {
    test("exports only the implemented v1 runtime surface", () => {
        expect(Object.keys(publicApi).sort()).toEqual(
            [
                "CallbackCapabilityError",
                "InvalidAtomComparatorResultError",
                "InvalidCollectionKeyError",
                "InvalidSynchronousCollectionValueError",
                "InvalidSynchronousAtomValueError",
                "InvalidTransactionCallbackResultError",
                "InvalidTransactionTargetError",
                "MissingCollectionRowError",
                "RuntimeMismatchError",
                "ScopeNotFoundError",
                "SelectorCapabilityError",
                "SelectorCircularDependencyError",
                "StoreDisposedError",
                "StoreTreeMismatchError",
                "SubscriberNotificationError",
                "TransactionClosedError",
                "TransactionPhaseError",
                "UndefinedCollectionValueError",
                "atom",
                "collection",
                "family",
                "presence",
                "selector",
                "store",
            ].sort(),
        )
    })

    test("uses one module-owned runtime domain while isolating StoreTree values", () => {
        const count = atom(1)
        const doubled = selector(get => get(count) * 2)
        const first = store()
        const second = store()

        expect(first.get(doubled)).toBe(2)
        expect(second.get(doubled)).toBe(2)

        first.set(count, 4)

        expect(first.get(doubled)).toBe(8)
        expect(second.get(doubled)).toBe(2)
        expect(Object.isFrozen(count)).toBe(true)
        expect(Object.isFrozen(doubled)).toBe(true)
    })

    test("constructs eager and per-StoreTree lazy writable Atoms", () => {
        let initializerCalls = 0
        const eagerFunction = (): string => "eager"
        const eager = atom(eagerFunction)
        const lazy = atom.lazy(() => {
            initializerCalls++
            return 3
        })
        const first = store()
        const second = store()

        expect(first.get(eager)).toBe(eagerFunction)
        expect(initializerCalls).toBe(0)
        expect(first.get(lazy)).toBe(3)
        expect(first.get(lazy)).toBe(3)
        expect(initializerCalls).toBe(1)
        expect(second.get(lazy)).toBe(3)
        expect(initializerCalls).toBe(2)
        expect(Object.isFrozen(atom)).toBe(true)

        if (false) {
            // @ts-expect-error atom.lazy is a readonly constructor property.
            atom.lazy = () => atom(0)
        }
    })

    test("accepts only inert name and equality options", () => {
        const atomOptions: AtomOptions<number> = {
            name: "parity source",
            equal: (previous, next) => (previous & 1) === (next & 1),
        }
        const selectorOptions: SelectorOptions<{ parity: number }> = {
            name: "parity result",
            equal: (previous, next) => previous.parity === next.parity,
        }
        const source = atom<number>(0, atomOptions)
        const sameNamedSource = atom<number>(0, atomOptions)
        const parity = selector(
            get => ({ parity: get(source) & 1 }),
            selectorOptions,
        )
        const sameNamedParity = selector(
            get => ({ parity: get(source) & 1 }),
            selectorOptions,
        )
        const target = store()
        let sourceCalls = 0
        let parityCalls = 0
        target.sub(source, () => sourceCalls++)
        target.sub(parity, () => parityCalls++)

        expect(source).not.toBe(sameNamedSource)
        expect(parity).not.toBe(sameNamedParity)
        target.set(source, 2)
        expect(sourceCalls).toBe(0)
        expect(parityCalls).toBe(0)
        target.set(source, 3)
        expect(sourceCalls).toBe(1)
        expect(parityCalls).toBe(1)

        if (false) {
            // @ts-expect-error lifecycle callbacks are not v1 Atom options.
            atom(0, { onMount: () => undefined })
            // @ts-expect-error mutable is not a v1 Selector option.
            selector(() => 0, { mutable: true })
            // @ts-expect-error exact optional properties reject undefined names.
            atom(0, { name: undefined })
        }
    })

    test("keeps set exact and reserves invocation for update", () => {
        let storedFunctionCalls = 0
        const fallback = (): number => 1
        const replacement = (): number => {
            storedFunctionCalls++
            return 2
        }
        const operation = atom<() => number>(fallback)
        const count = atom(1)
        const target = store()

        target.set(operation, replacement)
        expect(target.get(operation)).toBe(replacement)
        expect(storedFunctionCalls).toBe(0)

        target.update(count, current => current + 4)
        expect(target.get(count)).toBe(5)
        target.reset(count)
        expect(target.get(count)).toBe(1)

        if (false) {
            // @ts-expect-error set receives an exact number, not an updater.
            target.set(count, current => current + 1)
        }
    })

    test("makes store strictly zero-argument and omits legacy subscription options", () => {
        expect(store.length).toBe(0)
        expect(
            thrownBy(() => Reflect.apply(store, undefined, ["root"])),
        ).toBeInstanceOf(TypeError)
        expect(
            thrownBy(() => Reflect.apply(store, undefined, [{ id: "root" }])),
        ).toBeInstanceOf(TypeError)

        const count = atom(0)
        const target = store()
        expect(target.sub.length).toBe(2)

        if (false) {
            // @ts-expect-error v1 store() has no positional identifier.
            store("root")
            // @ts-expect-error v1 store() has no option bag.
            store({ id: "root" })
            // @ts-expect-error v1 sub() has no legacy fire-immediately flag.
            target.sub(count, () => undefined, false)
        }
    })

    test("exposes stable readonly bound Store operation fields", () => {
        const count = atom(0)
        const target = store()
        const operations = [
            "get",
            "sub",
            "set",
            "update",
            "reset",
            "delete",
            "txn",
            "scope",
            "dispose",
        ] as const

        for (const operation of operations) {
            expect(target[operation]).toBe(target[operation])
            expect(
                Object.getOwnPropertyDescriptor(target, operation),
            ).toMatchObject({ writable: false, configurable: false })
        }

        const {
            get,
            set,
            update,
            reset,
            delete: deleteRow,
            txn,
            scope,
            sub,
        } = target
        set(count, 2)
        expect(get(count)).toBe(2)
        update(count, current => current + 1)
        expect(txn(transaction => transaction.get(count))).toBe(3)
        const unsubscribe = sub(count, () => undefined)
        unsubscribe()
        reset(count)
        expect(get(count)).toBe(0)
        expect(() => Reflect.apply(deleteRow, undefined, [count])).toThrow(
            TypeError,
        )
        expect(scope()).not.toBe(target)

        if (false) {
            // @ts-expect-error Store operation fields are readonly.
            target.txn = callback => callback({} as Transaction)
        }
    })

    test("exposes stable readonly bound Transaction operation fields", () => {
        const count = atom(0)
        const target = store()

        target.txn(transaction => {
            const operations: (keyof Transaction)[] = [
                "get",
                "set",
                "update",
                "reset",
                "delete",
                "scope",
            ]
            expect(Object.keys(transaction)).toEqual(operations)
            expect(Object.isFrozen(transaction)).toBe(true)
            for (const operation of operations) {
                expect(transaction[operation]).toBe(transaction[operation])
                expect(
                    Object.getOwnPropertyDescriptor(transaction, operation),
                ).toMatchObject({ writable: false, configurable: false })
            }

            const { get, set, update, reset, scope } = transaction
            set(count, 2)
            update(count, current => current + 1)
            expect(get(count)).toBe(3)
            reset(count)
            expect(get(count)).toBe(0)
            expect(scope(target)).toBeDefined()
        })
    })

    test("preserves named and anonymous scope identity rules", () => {
        const count = atom(0)
        const root = store()
        const named = root.scope("process")
        const repeated = root.scope("process")
        const anonymousA = root.scope()
        const anonymousB = root.scope()

        expect(repeated).toBe(named)
        expect(anonymousA).not.toBe(anonymousB)
        expect(named).not.toBe(root)
        expect(named.get(count)).toBe(0)
        named.set(count, 7)
        expect(named.get(count)).toBe(7)
        expect(root.get(count)).toBe(0)
    })

    test("unsubscribes idempotently and stops later notifications", () => {
        const count = atom(0)
        const target = store()
        let calls = 0
        const unsubscribe = target.sub(count, () => calls++)

        target.set(count, 1)
        expect(calls).toBe(1)
        unsubscribe()
        unsubscribe()
        target.set(count, 2)
        expect(calls).toBe(1)
    })

    test("disposes a StoreTree generation terminally", () => {
        const count = atom(0)
        const root = store()
        const child = root.scope("child")

        root.dispose()
        root.dispose()

        expect(thrownBy(() => root.get(count))).toMatchObject({
            name: "StoreDisposedError",
            code: "VALDRES_STORE_DISPOSED",
        })
        expect(thrownBy(() => child.get(count))).toMatchObject({
            name: "StoreDisposedError",
            code: "VALDRES_STORE_DISPOSED",
        })
    })

    test("exports the fixture-facing type relationships", () => {
        const count: Atom<number> = atom(0)
        const doubled: Selector<number> = selector(get => get(count) * 2)
        const state: State<number> = doubled
        const target: Store = store()
        let transactionSeen: Transaction | undefined
        const subscribe: SubscribeFn = target.sub
        const transaction: TransactionFn<number> = current => current.get(state)
        const sessions = collection<string, number>()
        const session = sessions("typed-subscription")

        const unsubscribe = subscribe(state, () => undefined)
        const unsubscribeRow = subscribe(session, () => undefined)
        const unsubscribeCollection = subscribe(sessions, () => undefined)
        unsubscribe()
        unsubscribeRow()
        unsubscribeCollection()
        const result = target.txn(current => {
            transactionSeen = current
            current.update(count, value => value + 1)
            return transaction(current)
        })

        expect(result).toBe(2)
        expect(transactionSeen).toBeDefined()
    })
})
