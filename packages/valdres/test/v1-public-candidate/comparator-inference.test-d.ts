import {
    atom,
    deepEqual,
    selector,
    type Atom,
    type AtomOptions,
    type EqualFunc,
    type Selector,
    type SelectorOptions,
} from "../../src/index"

// Value is inferred from the initial value, initializer, or read function
// only. AtomOptions.equal and SelectorOptions.equal are checked against that
// Value and contextually typed by it, but never infer or widen it.

type Equal<Left, Right> =
    (<Value>() => Value extends Left ? 1 : 2) extends <
        Value,
    >() => Value extends Right ? 1 : 2
        ? true
        : false
// Equal<Atom<any>, Atom<unknown>> is false, but plain assignability passes for
// both, so any-ness is also asserted directly.
type IsAny<Value> = 0 extends 1 & Value ? true : false
type Expect<Condition extends true> = Condition
const assertType = <Condition extends true>(): void => {}
type Not<Condition extends boolean> = Condition extends true ? false : true
type AtomValue<Target> = Target extends Atom<infer Value> ? Value : never
type SelectorValue<Target> =
    Target extends Selector<infer Value> ? Value : never

declare const untyped: any
declare const opaque: unknown
interface Position {
    readonly x: number
    readonly y: number
}
declare const positions: readonly Position[]
type Mode = "light" | "dark" | null
declare const mode: Mode
type Handler = (event: string) => void
declare const handler: Handler

const broadEqual = (previous: unknown, next: unknown): boolean =>
    Object.is(previous, next)
const objectEqual = (previous: object, next: object): boolean =>
    previous === next
const positionEqual: EqualFunc<Position> = (previous, next) =>
    previous.x === next.x && previous.y === next.y
const count = atom(0)

// The reported regression: an `any` initial value stays `any` regardless of
// the comparator, for all three factories.
const anyAtom = atom(untyped)
const anyAtomDeep = atom(untyped, { equal: deepEqual })
const anyAtomBroad = atom(untyped, { equal: broadEqual })
const anyAtomNamed = atom(untyped, { name: "any", equal: deepEqual })
const anyLazy = atom.lazy(() => untyped)
const anyLazyDeep = atom.lazy(() => untyped, { equal: deepEqual })
const anyLazyBroad = atom.lazy(() => untyped, { equal: broadEqual })
const anySelector = selector(() => untyped.positions)
const anySelectorDeep = selector(() => untyped.positions, { equal: deepEqual })
const anySelectorBroad = selector(() => untyped.positions, {
    equal: broadEqual,
})

export type AnyCases = [
    Expect<IsAny<AtomValue<typeof anyAtom>>>,
    Expect<IsAny<AtomValue<typeof anyAtomDeep>>>,
    Expect<IsAny<AtomValue<typeof anyAtomBroad>>>,
    Expect<IsAny<AtomValue<typeof anyAtomNamed>>>,
    Expect<IsAny<AtomValue<typeof anyLazy>>>,
    Expect<IsAny<AtomValue<typeof anyLazyDeep>>>,
    Expect<IsAny<AtomValue<typeof anyLazyBroad>>>,
    Expect<IsAny<SelectorValue<typeof anySelector>>>,
    Expect<IsAny<SelectorValue<typeof anySelectorDeep>>>,
    Expect<IsAny<SelectorValue<typeof anySelectorBroad>>>,
    Expect<Equal<typeof anyAtomDeep, Atom<any>>>,
    Expect<Equal<typeof anyLazyDeep, Atom<any>>>,
    Expect<Equal<typeof anySelectorDeep, Selector<any>>>,
]

// A legitimately unknown value stays unknown and does not become any.
const unknownAtom = atom(opaque)
const unknownAtomDeep = atom(opaque, { equal: deepEqual })
const unknownLazyDeep = atom.lazy(() => opaque, { equal: deepEqual })
const unknownSelectorDeep = selector(() => opaque, { equal: broadEqual })

export type UnknownCases = [
    Expect<Equal<typeof unknownAtom, Atom<unknown>>>,
    Expect<Equal<typeof unknownAtomDeep, Atom<unknown>>>,
    Expect<Equal<typeof unknownLazyDeep, Atom<unknown>>>,
    Expect<Equal<typeof unknownSelectorDeep, Selector<unknown>>>,
    Expect<Not<IsAny<AtomValue<typeof unknownAtomDeep>>>>,
    Expect<Not<IsAny<AtomValue<typeof unknownLazyDeep>>>>,
    Expect<Not<IsAny<SelectorValue<typeof unknownSelectorDeep>>>>,
]

// Concrete objects, arrays, unions, and function values keep the type of the
// value source with and without a broad comparator.
const objectAtom = atom({ x: 1, y: 2 })
const objectAtomDeep = atom({ x: 1, y: 2 }, { equal: deepEqual })
const objectAtomShallow = atom({ x: 1, y: 2 }, { equal: objectEqual })
const objectLazyDeep = atom.lazy(() => ({ x: 1, y: 2 }), { equal: deepEqual })
const objectSelectorDeep = selector(get => ({ x: get(count), y: 0 }), {
    equal: deepEqual,
})
const arrayAtom = atom(positions)
const arrayAtomDeep = atom(positions, { equal: deepEqual })
const arrayLazyBroad = atom.lazy(() => positions, { equal: broadEqual })
const arraySelectorDeep = selector(() => positions, { equal: deepEqual })
const unionAtom = atom(mode)
const unionAtomDeep = atom(mode, { equal: deepEqual })
const unionLazyDeep = atom.lazy(() => mode, { equal: deepEqual })
const unionSelectorBroad = selector(() => mode, { equal: broadEqual })
const functionAtom = atom(handler)
const functionAtomDeep = atom(handler, { equal: deepEqual })
const functionAtomBroad = atom(handler, { equal: broadEqual })
const functionLazyDeep = atom.lazy(() => handler, { equal: deepEqual })
const functionSelectorDeep = selector(() => handler, { equal: deepEqual })
const numberAtom = atom(1, { equal: deepEqual })
const numberSelector = selector(get => get(count) * 2, { equal: deepEqual })

export type ConcreteCases = [
    Expect<Equal<typeof objectAtom, Atom<{ x: number; y: number }>>>,
    Expect<Equal<typeof objectAtomDeep, Atom<{ x: number; y: number }>>>,
    Expect<Equal<typeof objectAtomShallow, Atom<{ x: number; y: number }>>>,
    Expect<Equal<typeof objectLazyDeep, Atom<{ x: number; y: number }>>>,
    Expect<
        Equal<typeof objectSelectorDeep, Selector<{ x: number; y: number }>>
    >,
    Expect<Equal<typeof arrayAtom, Atom<readonly Position[]>>>,
    Expect<Equal<typeof arrayAtomDeep, Atom<readonly Position[]>>>,
    Expect<Equal<typeof arrayLazyBroad, Atom<readonly Position[]>>>,
    Expect<Equal<typeof arraySelectorDeep, Selector<readonly Position[]>>>,
    Expect<Equal<typeof unionAtom, Atom<Mode>>>,
    Expect<Equal<typeof unionAtomDeep, Atom<Mode>>>,
    Expect<Equal<typeof unionLazyDeep, Atom<Mode>>>,
    Expect<Equal<typeof unionSelectorBroad, Selector<Mode>>>,
    Expect<Equal<typeof functionAtom, Atom<Handler>>>,
    Expect<Equal<typeof functionAtomDeep, Atom<Handler>>>,
    Expect<Equal<typeof functionAtomBroad, Atom<Handler>>>,
    Expect<Equal<typeof functionLazyDeep, Atom<Handler>>>,
    Expect<Equal<typeof functionSelectorDeep, Selector<Handler>>>,
    Expect<Equal<typeof numberAtom, Atom<number>>>,
    Expect<Equal<typeof numberSelector, Selector<number>>>,
]

// Explicit type arguments stay authoritative and still accept broad and exact
// comparators.
const explicitAny = atom<any>(1, { equal: deepEqual })
const explicitUnknown = atom<unknown>(1, { equal: deepEqual })
const explicitUnion = atom<number | null>(null, { equal: deepEqual })
const explicitPosition = atom<Position>(
    { x: 0, y: 0 },
    { equal: positionEqual },
)
const explicitLazy = atom.lazy<readonly Position[]>(() => [], {
    equal: deepEqual,
})
const explicitSelector = selector<Mode>(() => null, { equal: broadEqual })
const explicitSelectorExact = selector<Position>(() => ({ x: 0, y: 0 }), {
    equal: positionEqual,
})

export type ExplicitCases = [
    Expect<IsAny<AtomValue<typeof explicitAny>>>,
    Expect<Equal<typeof explicitUnknown, Atom<unknown>>>,
    Expect<Equal<typeof explicitUnion, Atom<number | null>>>,
    Expect<Equal<typeof explicitPosition, Atom<Position>>>,
    Expect<Equal<typeof explicitLazy, Atom<readonly Position[]>>>,
    Expect<Equal<typeof explicitSelector, Selector<Mode>>>,
    Expect<Equal<typeof explicitSelectorExact, Selector<Position>>>,
]

// Inline comparator parameters are contextually typed by the inferred Value.
export const contextualAtom = atom(
    { x: 1, y: 2 },
    {
        equal: (previous, next) => {
            assertType<Equal<typeof previous, { x: number; y: number }>>()
            assertType<Equal<typeof next, { x: number; y: number }>>()
            return previous.x === next.x
        },
    },
)
export const contextualUnionAtom = atom(mode, {
    equal: (previous, next) => {
        assertType<Equal<typeof previous, Mode>>()
        return previous === next
    },
})
export const contextualAnyAtom = atom(untyped, {
    equal: (previous, next) => {
        assertType<IsAny<typeof previous>>()
        return previous === next
    },
})
export const contextualLazy = atom.lazy(() => positions, {
    equal: (previous, next) => {
        assertType<Equal<typeof previous, readonly Position[]>>()
        return previous.length === next.length
    },
})
export const contextualFunctionAtom = atom(handler, {
    equal: (previous, next) => {
        assertType<Equal<typeof previous, Handler>>()
        return previous === next
    },
})
export const contextualSelector = selector(get => get(count) * 2, {
    equal: (previous, next) => {
        assertType<Equal<typeof previous, number>>()
        return previous === next
    },
})
export const contextualExplicit = atom<number | null>(null, {
    equal: (previous, next) => {
        assertType<Equal<typeof previous, number | null>>()
        return previous === next
    },
})

// Literal initial values widen to their primitive exactly as without options.
const stringAtomDeep = atom("light", { equal: deepEqual })
const booleanAtomBroad = atom(true, { equal: broadEqual })
const literalLazyDeep = atom.lazy(() => "light", { equal: deepEqual })
const literalSelectorDeep = selector(() => 1, { equal: deepEqual })

export type LiteralCases = [
    Expect<Equal<typeof stringAtomDeep, Atom<string>>>,
    Expect<Equal<typeof booleanAtomBroad, Atom<boolean>>>,
    Expect<Equal<typeof literalLazyDeep, Atom<string>>>,
    Expect<Equal<typeof literalSelectorDeep, Selector<number>>>,
]

// A never-returning initializer or read function infers never with or without
// a comparator; a broad comparator no longer turns it into unknown. Name the
// type explicitly instead.
const throwing = (): never => {
    throw new Error("hydrate first")
}
const neverLazy = atom.lazy(() => throwing())
const neverLazyBroad = atom.lazy(() => throwing(), { equal: broadEqual })
const neverSelectorDeep = selector(() => throwing(), { equal: deepEqual })
const explicitNeverLazy = atom.lazy<unknown>(() => throwing(), {
    equal: broadEqual,
})

export type NeverCases = [
    Expect<Equal<typeof neverLazy, Atom<never>>>,
    Expect<Equal<typeof neverLazyBroad, Atom<never>>>,
    Expect<Equal<typeof neverSelectorDeep, Selector<never>>>,
    Expect<Equal<typeof explicitNeverLazy, Atom<unknown>>>,
]

// Named exact comparators and predeclared options objects still type-check
// when the read function is context-sensitive (`get => ...`), which
// TypeScript checks only after the other arguments.
const numberEqual = (previous: number, next: number): boolean =>
    previous === next
const parityOptions: SelectorOptions<{ parity: number }> = {
    equal: (previous, next) => previous.parity === next.parity,
}
const countOptions: AtomOptions<number> = { name: "count", equal: numberEqual }
const namedAtom = atom(0, { equal: numberEqual })
const optionsAtom = atom(0, countOptions)
const namedLazy = atom.lazy(() => 0, { equal: numberEqual })
const namedSelector = selector(get => get(count), { equal: numberEqual })
const exactSelector = selector(get => ({ x: get(count), y: 0 }), {
    equal: positionEqual,
})
const optionsSelector = selector(
    get => ({ parity: get(count) & 1 }),
    parityOptions,
)

export type NamedComparatorCases = [
    Expect<Equal<typeof namedAtom, Atom<number>>>,
    Expect<Equal<typeof optionsAtom, Atom<number>>>,
    Expect<Equal<typeof namedLazy, Atom<number>>>,
    Expect<Equal<typeof namedSelector, Selector<number>>>,
    Expect<Equal<typeof exactSelector, Selector<{ x: number; y: number }>>>,
    Expect<Equal<typeof optionsSelector, Selector<{ parity: number }>>>,
]

// Generic wrappers forward a comparator for their own type parameter.
export const defineAtom = <Value>(
    initial: Value,
    equal: EqualFunc<Value>,
): Atom<Value> => atom(initial, { equal })
export const defineLazyAtom = <Value>(
    initialize: () => Value,
    equal: EqualFunc<Value>,
): Atom<Value> => atom.lazy(initialize, { equal })
export const defineSelector = <Value>(
    read: () => Value,
    equal: EqualFunc<Value>,
): Selector<Value> => selector(read, { equal })

// Comparators that cannot accept every Value are rejected instead of
// narrowing Value to the comparator's parameter type.
const stringEqual = (previous: string, next: string): boolean =>
    previous === next
const nonNullModeEqual = (
    previous: "light" | "dark",
    next: "light" | "dark",
): boolean => previous === next
const literalOneEqual = (previous: 1, next: 1): boolean => previous === next

export const rejected = (): void => {
    // @ts-expect-error a string comparator cannot compare number values.
    atom(1, { equal: stringEqual })
    // @ts-expect-error a literal comparator does not narrow Value to 1.
    atom(1, { equal: literalOneEqual })
    // @ts-expect-error the comparator rejects the null arm of the union.
    atom(mode, { equal: nonNullModeEqual })
    atom(mode, {
        // @ts-expect-error inline parameter annotations cannot narrow Value.
        equal: (previous: "light", next: "light") => previous === next,
    })
    // @ts-expect-error an exact comparator cannot compare unknown values.
    atom(opaque, { equal: positionEqual })
    // @ts-expect-error a wider object comparator requires missing fields.
    atom({ x: 1 }, { equal: positionEqual })
    // @ts-expect-error a comparator for values cannot compare functions.
    atom(handler, { equal: stringEqual })
    // @ts-expect-error lazy initializers are checked the same way.
    atom.lazy(() => 1, { equal: stringEqual })
    // @ts-expect-error lazy unions are checked the same way.
    atom.lazy(() => mode, { equal: nonNullModeEqual })
    // @ts-expect-error a literal comparator does not narrow a lazy Value.
    atom.lazy(() => 1, { equal: literalOneEqual })
    // @ts-expect-error selector read results are checked the same way.
    selector(get => get(count), { equal: stringEqual })
    // @ts-expect-error a literal comparator does not narrow a selector Value.
    selector(get => get(count), { equal: literalOneEqual })
    // @ts-expect-error the comparator needs a field the read result lacks.
    selector(get => ({ x: get(count) }), { equal: positionEqual })
    // @ts-expect-error selector unions are checked the same way.
    selector(() => mode, { equal: nonNullModeEqual })
    atom<number | null>(null, {
        // @ts-expect-error explicit Value arguments still check the comparator.
        equal: (previous: number, next: number) => previous === next,
    })
    // @ts-expect-error explicit selector Value arguments still check it too.
    selector<Mode>(() => null, { equal: nonNullModeEqual })
}
