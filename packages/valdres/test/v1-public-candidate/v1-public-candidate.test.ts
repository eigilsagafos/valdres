import { describe, expect, test } from "bun:test"
import {
    atom,
    selector,
    store,
    type Atom,
    type AtomOptions,
    type Selector,
    type SelectorOptions,
    type State,
    type Store,
    type Transaction,
} from "../../src/v1"

const thrownBy = (operation: () => unknown): unknown => {
    try {
        operation()
    } catch (error) {
        return error
    }
    throw new Error("Expected operation to throw")
}

describe("private v1 public-spelling candidate", () => {
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

        const result = target.txn(transaction => {
            transactionSeen = transaction
            transaction.update(count, current => current + 1)
            return transaction.get(state)
        })

        expect(result).toBe(2)
        expect(transactionSeen).toBeDefined()
    })
})
