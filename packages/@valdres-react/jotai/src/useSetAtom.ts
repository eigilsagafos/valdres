import { useCallback } from "react"
import type {
    ExtractAtomArgs,
    ExtractAtomResult,
    Store,
    WritableAtom,
} from "./types/jotai"
import { useStore } from "./useStore"

type SetAtom<Args extends unknown[], Result> = (...args: Args) => Result
type Options = { store?: Store }

// Port of Jotai 3.0.1's useSetAtom (MIT).
export function useSetAtom<Value, Args extends unknown[], Result>(
    atom: WritableAtom<Value, Args, Result>,
    options?: Options,
): SetAtom<Args, Result>
export function useSetAtom<
    AtomType extends WritableAtom<unknown, never[], unknown>,
>(
    atom: AtomType,
    options?: Options,
): SetAtom<ExtractAtomArgs<AtomType>, ExtractAtomResult<AtomType>>
export function useSetAtom<Value, Args extends unknown[], Result>(
    atom: WritableAtom<Value, Args, Result>,
    options?: Options,
) {
    const store = useStore(options)
    return useCallback(
        (...args: Args) => {
            // useAtom passes read-only atoms through a wrong type assertion.
            if (!("write" in atom)) throw new Error("not writable atom")
            return store.set(atom, ...args)
        },
        [store, atom],
    )
}
