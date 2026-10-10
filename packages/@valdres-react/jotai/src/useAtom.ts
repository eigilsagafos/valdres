import type {
    Atom,
    ExtractAtomArgs,
    ExtractAtomResult,
    ExtractAtomValue,
    PrimitiveAtom,
    SetStateAction,
    WritableAtom,
} from "./types/jotai"
import { useAtomValue } from "./useAtomValue"
import { useSetAtom } from "./useSetAtom"

type SetAtom<Args extends unknown[], Result> = (...args: Args) => Result
type Options = Parameters<typeof useAtomValue>[1]

// Port of Jotai 3.0.1's useAtom (MIT).
export function useAtom<Value, Args extends unknown[], Result>(
    atom: WritableAtom<Value, Args, Result>,
    options?: Options,
): [Awaited<Value>, SetAtom<Args, Result>]
export function useAtom<Value>(
    atom: PrimitiveAtom<Value>,
    options?: Options,
): [Awaited<Value>, SetAtom<[SetStateAction<Value>], void>]
export function useAtom<Value>(
    atom: Atom<Value>,
    options?: Options,
): [Awaited<Value>, never]
export function useAtom<
    AtomType extends WritableAtom<unknown, never[], unknown>,
>(
    atom: AtomType,
    options?: Options,
): [
    Awaited<ExtractAtomValue<AtomType>>,
    SetAtom<ExtractAtomArgs<AtomType>, ExtractAtomResult<AtomType>>,
]
export function useAtom<AtomType extends Atom<unknown>>(
    atom: AtomType,
    options?: Options,
): [Awaited<ExtractAtomValue<AtomType>>, never]
export function useAtom<Value, Args extends unknown[], Result>(
    atom: Atom<Value> | WritableAtom<Value, Args, Result>,
    options?: Options,
) {
    return [
        useAtomValue(atom, options),
        // Jotai's deliberate wrong type assertion: a read-only atom throws on write.
        useSetAtom(atom as WritableAtom<Value, Args, Result>, options),
    ]
}
