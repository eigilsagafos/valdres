/**
 * Public type-surface contract.
 *
 * Every type reachable from an exported signature must have a NAME a consumer
 * can import — otherwise it can be observed but never annotated, and the only
 * way to write a typed wrapper is to re-derive it with `ReturnType`/`Parameters`
 * gymnastics against a private structural shape.
 *
 * This file imports the entire surface from the PACKAGE ROOT (`"valdres"`, not
 * a relative path), so it fails to compile the moment an export is dropped or
 * renamed, and pins the overload-resolution and serialization contracts that
 * the exported names describe.
 *
 * Runs in the `typecheck:types` lane (`tsconfig.types-test.json`); the runtime
 * assertions also run under `bun test`.
 */
import { expect, test } from "bun:test"
import {
    atom,
    atomFamily,
    dehydrate,
    globalAtom,
    globalAtomFamily,
    hydrate,
    isFamilyAtom,
    isFamilySelector,
    selector,
    selectorFamily,
    store,
} from "valdres"
import type {
    Atom,
    AtomDefaultValue,
    AtomFamily,
    AtomFamilyAtom,
    AtomFamilyDefaultValue,
    AtomFamilySelector,
    AtomOnMount,
    AtomOnSet,
    AtomOptions,
    BorrowedScopedStore,
    DehydratedState,
    EqualFunc,
    GlobalAtom,
    GlobalAtomFamily,
    GlobalAtomFamilyOptions,
    GlobalAtomOptions,
    ScopeFn,
    ScopedStore,
    ScopedTransaction,
    ScopedTransactionFn,
    Selector,
    SelectorFamily,
    SelectorOptions,
    Store,
    StoreOptions,
    SubscribeFn,
    Transaction,
} from "valdres"

type Expect<T extends true> = T
type Equal<X, Y> =
    (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2
        ? true
        : false

test("atom() overloads resolve to the exported Atom name; globalAtom() resolves to GlobalAtom", () => {
    const plain = atom(0)
    const configured = atom(0, { name: "pts.atom.configured" })

    type _Plain = Expect<Equal<typeof plain, Atom<number>>>
    type _Configured = Expect<Equal<typeof configured, Atom<number>>>

    if (false) {
        // `global: true` was removed from AtomOptions in favor of the
        // dedicated globalAtom() constructor (C6) — this must be a compile
        // error, not a silently-ignored option. Type-only: guarded so the
        // wrong-shaped call is checked but never runs.
        // @ts-expect-error `global` is not a valid AtomOptions key
        atom(0, { name: "pts.atom.legacyGlobal", global: true })

        // options.name is required — omitting the options object, or
        // omitting `name` within it, is a compile error.
        // @ts-expect-error missing the required options argument
        globalAtom(0)
        // @ts-expect-error missing the required name field
        globalAtom(0, {})
    }

    const global = globalAtom(0, { name: "pts.atom.global" })
    type _Global = Expect<Equal<typeof global, GlobalAtom<number>>>

    // The non-global overload's options bag IS the exported AtomOptions, so a
    // consumer can build one ahead of the atom() call.
    const options: AtomOptions<number> = {
        name: "pts.atom.fromOptions",
        equal: Object.is,
        mutable: true,
    }
    const fromOptions = atom(0, options)
    type _FromOptions = Expect<Equal<typeof fromOptions, Atom<number>>>

    // Likewise, globalAtom()'s options bag is the exported GlobalAtomOptions —
    // identical to AtomOptions, except `name` is required instead of optional.
    const globalOptions: GlobalAtomOptions<number> = {
        name: "pts.atom.globalFromOptions",
        equal: Object.is,
        mutable: true,
    }
    const globalFromOptions = globalAtom(0, globalOptions)
    type _GlobalFromOptions = Expect<
        Equal<typeof globalFromOptions, GlobalAtom<number>>
    >
    // @ts-expect-error name is required on GlobalAtomOptions
    const globalOptionsMissingName: GlobalAtomOptions<number> = {
        equal: Object.is,
    }

    // The default value accepts every AtomDefaultValue arm through the name.
    const lazyDefault: AtomDefaultValue<number> = () => Promise.resolve(1)
    const lazy = atom(lazyDefault)
    type _Lazy = Expect<Equal<typeof lazy, Atom<number>>>
    type _DefaultValue = Expect<
        Equal<Atom<number>["defaultValue"], AtomDefaultValue<number>>
    >

    expect(store().get(plain)).toBe(0)
    expect(global.getSelf()).toBe(0)
})

test("atomFamily() overloads resolve to AtomFamily; globalAtomFamily() resolves to GlobalAtomFamily", () => {
    // atomFamily()'s first parameter is nameable too — a wrapper forwarding a
    // default has to be able to annotate it without re-deriving the signature.
    const lazyDefault: AtomFamilyDefaultValue<number, [string]> = key =>
        key.length
    const fromDefault = atomFamily<number, [string]>(lazyDefault)
    type _FromDefault = Expect<
        Equal<typeof fromDefault, AtomFamily<number, [string]>>
    >

    const items = atomFamily<number, [string]>(0)

    if (false) {
        // `global: true` was removed from AtomFamilyOptions — dedicated
        // globalAtomFamily() constructor only, exercised below. Type-only:
        // guarded so the wrong-shaped call is checked but never runs.
        atomFamily<number, [string]>(0, {
            name: "pts.family.legacyGlobal",
            // @ts-expect-error `global` is not a valid AtomFamilyOptions key
            global: true,
        })

        // options.name is required — omitting the options object, or
        // omitting `name` within it, is a compile error.
        // @ts-expect-error missing the required options argument
        globalAtomFamily<number, [string]>(0)
        // @ts-expect-error missing the required name field
        globalAtomFamily<number, [string]>(0, {})
    }

    const globalItems = globalAtomFamily<number, [string]>(0, {
        name: "pts.family.global",
    })

    const globalFamilyOptions: GlobalAtomFamilyOptions<number, [string]> = {
        name: "pts.family.globalFromOptions",
        equal: (a, b) => a === b,
    }
    const globalItemsFromOptions = globalAtomFamily<number, [string]>(
        0,
        globalFamilyOptions,
    )
    type _GlobalItemsFromOptions = Expect<
        Equal<typeof globalItemsFromOptions, GlobalAtomFamily<number, [string]>>
    >

    type _Items = Expect<Equal<typeof items, AtomFamily<number, [string]>>>
    type _GlobalItems = Expect<
        Equal<typeof globalItems, GlobalAtomFamily<number, [string]>>
    >

    const member = items("a")
    const globalMember = globalItems("a")

    type _Member = Expect<
        Equal<typeof member, AtomFamilyAtom<number, [string]>>
    >
    // A global family's member is a family atom AND a global atom — the name
    // has to keep both halves, or setSelf/getSelf fall off the type.
    type _GlobalMember = Expect<
        Equal<
            typeof globalMember,
            AtomFamilyAtom<number, [string]> & GlobalAtom<number>
        >
    >

    expect(member.familyArgs).toEqual(["a"])
    expect(globalMember.getSelf()).toBe(0)
})

test("selector()/selectorFamily() overloads resolve to Selector / SelectorFamily", () => {
    const count = atom(1)
    const doubled = selector(get => get(count) * 2)
    type _Doubled = Expect<Equal<typeof doubled, Selector<number>>>

    const options: SelectorOptions<number> = {
        name: "pts.selector.fromOptions",
        equal: Object.is,
    }
    const fromOptions = selector(get => get(count) * 3, options)
    type _FromOptions = Expect<Equal<typeof fromOptions, Selector<number>>>
    type _SelectorOptions = Expect<
        Equal<
            Parameters<typeof selector<number>>[1],
            SelectorOptions<number> | undefined
        >
    >

    const scaled = selectorFamily<number, [number]>(
        factor => get => get(count) * factor,
    )
    type _Scaled = Expect<
        Equal<typeof scaled, SelectorFamily<number, [number]>>
    >

    const root = store()
    expect(root.get(doubled)).toBe(2)
    expect(root.get(fromOptions)).toBe(3)
    expect(root.get(scaled(10))).toBe(10)
})

test("the family type guards narrow to the exported member names", () => {
    const items = atomFamily<number, [string]>(0)
    const scaled = selectorFamily<number, [string]>(
        key => get => get(items(key)),
    )

    const atomState: any = items("a")
    const selectorState: any = scaled("a")

    if (isFamilyAtom<number, [string]>(atomState)) {
        type _Narrowed = Expect<
            Equal<typeof atomState, AtomFamilyAtom<number, [string]>>
        >
        expect(atomState.familyArgs).toEqual(["a"])
    } else {
        throw new Error("expected a family atom")
    }

    if (isFamilySelector<number, [string]>(selectorState)) {
        type _Narrowed = Expect<
            Equal<typeof selectorState, AtomFamilySelector<number, [string]>>
        >
        expect(selectorState.familyArgs).toEqual(["a"])
    } else {
        throw new Error("expected a family selector")
    }
})

test("store() options and the scope/subscribe surface are nameable", async () => {
    // Every option store() accepts, as one importable bag — including
    // batchUpdates, which had no exported name to annotate before.
    const options: StoreOptions = {
        id: "pts.store.configured",
        batchUpdates: true,
        enumerable: true,
        schemaValidation: false,
    }
    type _StoreOptionKeys = Expect<
        Equal<
            keyof StoreOptions,
            "id" | "batchUpdates" | "enumerable" | "schemaValidation"
        >
    >

    const root = store(options)
    type _Root = Expect<Equal<typeof root, Store>>

    // BOTH call forms must be writable from root exports alone. Annotating each
    // overload and assigning `store` to it is the actual guard: if either
    // signature reached for an internal alias (it used to name the private
    // `CreateStoreDataOptions` here), a consumer could observe the parameter but
    // never name it, which is the whole defect this surface test exists to catch.
    const positionalForm: (
        id?: string,
        options?: Omit<StoreOptions, "id">,
    ) => Store = store
    const optionsForm: (options?: StoreOptions) => Store = store

    // ...and the positional form really does reject `id` in the bag, so the
    // `Omit` above is pinned rather than merely satisfied by a wider type.
    // @ts-expect-error the positional form takes the id as its first argument
    store("pts.store.positional", { id: "duplicate" })

    const byId = positionalForm("pts.store.byId", { batchUpdates: false })
    const byOptions = optionsForm({ id: "pts.store.byOptions" })
    expect(byId.id).toBe("pts.store.byId")
    expect(byOptions.id).toBe("pts.store.byOptions")
    byId.dispose()
    byOptions.dispose()

    type _ScopeFn = Expect<Equal<Store["scope"], ScopeFn>>
    type _SubscribeFn = Expect<Equal<Store["sub"], SubscribeFn>>

    const scoped = root.scope("pts.scope")
    type _Scoped = Expect<Equal<typeof scoped, ScopedStore>>
    // ScopedStore is a Store plus the detach lease — a consumer holding one can
    // pass it anywhere a Store is expected.
    type _ScopedIsStore = Expect<ScopedStore extends Store ? true : false>
    // The callback form hands out the same scope minus lifecycle ownership, so
    // `unsetAll` is reachable there without taking a lease.
    const borrowed = root.scope("pts.scope", scope => scope)
    type _Borrowed = Expect<Equal<typeof borrowed, BorrowedScopedStore>>
    type _BorrowedHasUnsetAll = Expect<
        Equal<typeof borrowed.unsetAll, ScopedStore["unsetAll"]>
    >
    // ...and neither lifecycle control leaks into it.
    // @ts-expect-error a borrowed scope cannot be disposed
    borrowed.dispose
    // @ts-expect-error a borrowed scope cannot be detached
    borrowed.detach
    // `unsetAll` is a scope operation: a root store is not typed for it.
    // @ts-expect-error unsetAll is only on ScopedStore
    root.unsetAll
    // ...and the transaction surface makes the same distinction, so the one
    // operation that needs a scope cannot be reached from a root transaction.
    root.txn(txn => {
        type _RootTxn = Expect<Equal<typeof txn, Transaction>>
        // @ts-expect-error unsetAll is only on a scoped transaction
        txn.unsetAll
        txn.scope("pts.scope", scopedTxn => {
            type _ScopedTxn = Expect<Equal<typeof scopedTxn, ScopedTransaction>>
            scopedTxn.unsetAll()
        })
        // A scope's own transaction hands out the same scoped surface.
        const scopedFn: ScopedTransactionFn = scopedTxn => scopedTxn.unsetAll()
        scoped.txn(scopedFn)
        // A parent scope may itself be the root, so the same restriction holds.
        txn.scope("pts.scope", scopedTxn =>
            scopedTxn.parentScope(parentTxn => {
                // @ts-expect-error unsetAll is only on a scoped transaction
                parentTxn.unsetAll
            }),
        )
    })

    const count = atom(0)
    let notified = 0
    const unsubscribe: ReturnType<SubscribeFn> = scoped.sub(count, () => {
        notified++
    })

    scoped.set(count, 1)
    // `batchUpdates: true` from the options bag above: the write stages and the
    // subscriber fires when the batch commits, not on the `set` call.
    expect(notified).toBe(0)
    await Promise.resolve()
    expect(notified).toBe(1)

    unsubscribe()
    scoped.detach()
    root.dispose()
})

test("atom lifecycle hook types are nameable and receive the store and the state", () => {
    type _EqualFunc = Expect<Equal<Atom<number>["equal"], EqualFunc<number>>>
    type _AtomOnSet = Expect<
        Equal<NonNullable<Atom<number>["onSet"]>, AtomOnSet<number>>
    >
    type _AtomOnMount = Expect<
        Equal<NonNullable<Atom<number>["onMount"]>, AtomOnMount<number>>
    >
    // The fixed signature: no more `(store?: any, state?: any)`.
    type _OnMountStore = Expect<
        Equal<Parameters<AtomOnMount<number>>[0], Store>
    >
    type _OnMountState = Expect<
        Equal<
            Parameters<AtomOnMount<number>>[1],
            Atom<number> | Selector<number>
        >
    >
    type _OnMountReturn = Expect<
        Equal<ReturnType<AtomOnMount<number>>, void | (() => void)>
    >

    // Atom.onMount and Selector.onMount must stay the SAME type: Selector is
    // structurally assignable to Atom and the engine depends on it, so giving
    // each its own state type would break init and propagation.
    type _AtomAndSelectorHooksMatch = Expect<
        Equal<
            NonNullable<Atom<number>["onMount"]>,
            NonNullable<Selector<number>["onMount"]>
        >
    >

    // The escape hatch for the union that results: narrow `State` at the USE
    // site to reach fields only one side has. Parameters are contravariant, so
    // the narrowed hook still assigns into atom()'s options.
    const narrowed: AtomOnMount<number, Atom<number>> = (_store, state) => {
        void state.defaultValue // atom-only field, no narrowing needed
    }
    const narrowlyMounted = atom(0, { onMount: narrowed })
    type _Narrowed = Expect<Equal<typeof narrowlyMounted, Atom<number>>>

    let mountedIn: Store | undefined
    let mountedState: Atom<number> | Selector<number> | undefined
    let setValue: number | undefined
    let setStore: Store | undefined

    const onMount: AtomOnMount<number> = (mountStore, state) => {
        mountedIn = mountStore
        mountedState = state
        return () => {
            mountedIn = undefined
        }
    }
    const onSet: AtomOnSet<number> = (value, changedStore) => {
        setValue = value
        setStore = changedStore
    }
    const equal: EqualFunc<number> = (a, b) => a === b

    const tracked = atom(0, { onMount, onSet, equal })
    const root = store()
    const unsubscribe = root.sub(tracked, () => {})

    expect(mountedIn?.id).toBe(root.id)
    expect(mountedState).toBe(tracked)

    root.set(tracked, 5)
    expect(setValue).toBe(5)
    expect(setStore?.id).toBe(root.id)

    unsubscribe()
    expect(mountedIn).toBeUndefined()
    root.dispose()
})

test("DehydratedState round-trips through JSON", () => {
    const counter = atom(0, { name: "pts.rt.counter" })
    const items = atomFamily<string, [string]>("", { name: "pts.rt.items" })

    const source = store()
    source.set(counter, 42)
    source.set(items("a"), "alpha")

    const payload = dehydrate(source)
    type _DehydrateReturn = Expect<Equal<typeof payload, DehydratedState>>
    type _HydratePayload = Expect<
        Equal<Parameters<typeof hydrate>[1], DehydratedState>
    >

    // The wire shape is writable by hand: a consumer building or asserting on a
    // payload (SSR transfer, fixtures, tests) needs the tuple arity and the
    // optional wire-encoding marker to be part of the exported type.
    const handWritten: DehydratedState = {
        atoms: [
            ["pts.rt.counter", 42],
            ["pts.rt.encoded", "1970-01-01T00:00:00.000Z", 1],
        ],
        families: [["pts.rt.items", ["a"], "alpha"]],
    }
    expect(handWritten.atoms).toHaveLength(2)

    const wire: DehydratedState = JSON.parse(JSON.stringify(payload))
    const target = store()
    hydrate(target, wire)

    expect(target.get(counter)).toBe(42)
    expect(target.get(items("a"))).toBe("alpha")

    source.dispose()
    target.dispose()
})
