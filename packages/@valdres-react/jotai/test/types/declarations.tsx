/**
 * Compile-time contract of the public types (adapted from Jotai 3.0.1's type
 * tests). Checked from source by `typecheck:tests` and against the packed
 * declarations by the tarball consumer, which rewrites the import below.
 */
import {
    atom,
    createStore,
    getDefaultStore,
    Provider,
    useAtom,
    useAtomValue,
    useAtomValueRaw,
    useAtomValueRawSync,
    useSetAtom,
    useStore,
    type Atom,
    type ExtractAtomArgs,
    type ExtractAtomResult,
    type ExtractAtomValue,
    type Getter,
    type PrimitiveAtom,
    type SetStateAction,
    type Setter,
    type Store,
    type WritableAtom,
} from "../../src/index"

type Equal<A, B> =
    (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
        ? true
        : false
const expectType = <T extends true>(_: T) => {}

// Primitive atoms
const count = atom(0)
expectType<Equal<typeof count, PrimitiveAtom<number> & { init: number }>>(true)
const maybe = atom<string>()
expectType<Equal<ExtractAtomValue<typeof maybe>, string | undefined>>(true)
const action: SetStateAction<number> = previous => previous + 1
void action

// Derived atoms
const doubled = atom(get => get(count) * 2)
expectType<Equal<typeof doubled, Atom<number>>>(true)
const asyncDoubled = atom(async get => get(count) * 2)
expectType<Equal<ExtractAtomValue<typeof asyncDoubled>, Promise<number>>>(true)

// Writable derived atoms: arguments and results
const add = atom(null, (get: Getter, set: Setter, a: number, b: number) => {
    set(count, get(count) + a + b)
    return `${a + b}`
})
expectType<Equal<ExtractAtomArgs<typeof add>, [number, number]>>(true)
expectType<Equal<ExtractAtomResult<typeof add>, string>>(true)
const asyncWrite = atom(null, async (_get, set, value: number) => {
    set(count, value)
    return true
})
expectType<Equal<ExtractAtomResult<typeof asyncWrite>, Promise<boolean>>>(true)
const readWrite: WritableAtom<number, [string], void> = atom(
    get => get(count),
    (_get, set, text: string) => set(count, text.length),
)
void readWrite

// onMount receives a setter for the atom's own write arguments
count.onMount = setCount => {
    setCount(1)
    setCount(previous => previous + 1)
    // @ts-expect-error a primitive number atom does not accept a string
    setCount("one")
    return () => {}
}

// Stores
const store: Store = createStore()
const fromDefault: Store = getDefaultStore()
expectType<Equal<ReturnType<typeof store.get<number>>, number>>(true)
const sum: string = store.set(add, 1, 2)
const unsub: () => void = store.sub(count, () => {})
// @ts-expect-error write arguments are checked
store.set(add, "1", 2)
// @ts-expect-error read-only atoms are not writable
store.set(doubled, 1)
void [fromDefault, sum, unsub]

// Not supported: the read option `signal` is absent from the types.
atom((_get, options) => {
    // @ts-expect-error see the compatibility notes
    return options.signal
})

// React
export function Component() {
    const [value, setValue] = useAtom(count)
    expectType<Equal<typeof value, number>>(true)
    setValue(previous => previous + 1)
    const resolved = useAtomValue(asyncDoubled)
    expectType<Equal<typeof resolved, number>>(true)
    const raw = useAtomValueRaw(asyncDoubled)
    expectType<Equal<typeof raw, Promise<number>>>(true)
    const rawSync = useAtomValueRawSync(count, { store })
    expectType<Equal<typeof rawSync, number>>(true)
    const addNumbers = useSetAtom(add)
    const result: string = addNumbers(1, 2)
    const [, never] = useAtom(doubled)
    expectType<Equal<typeof never, never>>(true)
    const fromContext: Store = useStore({ store })
    useAtomValue(count, { store: fromContext })
    // @ts-expect-error useSetAtom requires a writable atom
    useSetAtom(doubled)
    void result
    return (
        <Provider store={store}>
            <Provider>{String(value)}</Provider>
        </Provider>
    )
}
