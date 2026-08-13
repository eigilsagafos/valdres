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
    AtomFamilySelector,
    AtomOnMount,
    AtomOnSet,
    AtomOptions,
    DehydratedState,
    EqualFunc,
    GlobalAtom,
    GlobalAtomFamily,
    ScopeFn,
    ScopedStore,
    Selector,
    SelectorFamily,
    SelectorOptions,
    Store,
    StoreOptions,
    SubscribeFn,
} from "valdres"

type Expect<T extends true> = T
type Equal<X, Y> =
    (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2
        ? true
        : false

test("atom() overloads resolve to the exported Atom / GlobalAtom names", () => {
    const plain = atom(0)
    const configured = atom(0, { name: "pts.atom.configured" })
    const global = atom(0, { name: "pts.atom.global", global: true })

    type _Plain = Expect<Equal<typeof plain, Atom<number>>>
    type _Configured = Expect<Equal<typeof configured, Atom<number>>>
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

test("atomFamily() overloads resolve to AtomFamily / GlobalAtomFamily and their members", () => {
    const items = atomFamily<number, [string]>(0)
    const globalItems = atomFamily<number, [string]>(0, {
        name: "pts.family.global",
        global: true,
    })

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
