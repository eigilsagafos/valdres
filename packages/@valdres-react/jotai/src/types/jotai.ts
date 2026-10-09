/**
 * Jotai 3.0.1 public types (MIT, Copyright (c) 2020-2026 Poimandres), adapted
 * for this package.
 *
 * The only intentional difference: a read function's `options` has no
 * `signal`. `@valdres-react/jotai` cannot implement abort-on-supersession, so
 * typed code that destructures `signal` fails to compile instead of receiving
 * a signal that never aborts. See the package docs.
 */

export type Getter = <Value>(atom: Atom<Value>) => Value

export type Setter = <Value, Args extends unknown[], Result>(
    atom: WritableAtom<Value, Args, Result>,
    ...args: Args
) => Result

type SetAtom<Args extends unknown[], Result> = <A extends Args>(
    ...args: A
) => Result

// Intentionally empty: Jotai's `signal` is not provided (see above).
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type ReadOptions = {}

type Read<Value> = (get: Getter, options: ReadOptions) => Value

type Write<Args extends unknown[], Result> = (
    get: Getter,
    set: Setter,
    ...args: Args
) => Result

export type WithInitialValue<Value> = {
    init: Value
}

type OnUnmount = () => void

type OnMount<Args extends unknown[], Result> = <
    S extends SetAtom<Args, Result>,
>(
    setAtom: S,
) => OnUnmount | void

export interface Atom<Value> {
    toString: () => string
    read: Read<Value>
    debugLabel?: string
    /**
     * Jotai-library marker for private atoms. Accepted and ignored.
     * @private
     */
    debugPrivate?: boolean
}

export interface WritableAtom<Value, Args extends unknown[], Result>
    extends Atom<Value> {
    write: Write<Args, Result>
    onMount?: OnMount<Args, Result>
}

export type SetStateAction<Value> = Value | ((prev: Value) => Value)

export type PrimitiveAtom<Value> = WritableAtom<
    Value,
    [SetStateAction<Value>],
    void
>

export type ExtractAtomValue<AtomType> =
    AtomType extends Atom<infer Value> ? Value : never

export type ExtractAtomArgs<AtomType> =
    AtomType extends WritableAtom<unknown, infer Args, infer _Result>
        ? Args
        : never

export type ExtractAtomResult<AtomType> =
    AtomType extends WritableAtom<unknown, infer _Args, infer Result>
        ? Result
        : never

export interface Store {
    get: <Value>(atom: Atom<Value>) => Value
    set: <Value, Args extends unknown[], Result>(
        atom: WritableAtom<Value, Args, Result>,
        ...args: Args
    ) => Result
    sub: (atom: Atom<unknown>, listener: () => void) => () => void
}
