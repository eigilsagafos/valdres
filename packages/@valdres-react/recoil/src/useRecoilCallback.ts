import { useCallback } from "react"
import { runCallback } from "./lib/runCallback"
import { useRecoilStore } from "./lib/useRecoilStore"
import type { CallbackInterface } from "./types/CallbackInterface"

/**
 * Recoil's `useRecoilCallback`. Writes made while the callback runs
 * synchronously apply together when it returns or throws; the snapshot is the
 * state when it was called and is readable until the callback first returns
 * or awaits. Without `deps` the callback is re-created every render, as in
 * Recoil.
 */
export const useRecoilCallback = <Args extends ReadonlyArray<unknown>, Return>(
    factory: (callbackInterface: CallbackInterface) => (...args: Args) => Return,
    deps?: ReadonlyArray<unknown>,
): ((...args: Args) => Return) => {
    const store = useRecoilStore()
    return useCallback(
        (...args: Args) => runCallback(store, factory, args),
        // Recoil passes `undefined` deps without them: a new callback each render.
        (deps === undefined || deps === null
            ? undefined
            : [...deps, store]) as unknown as readonly unknown[],
    ) as (...args: Args) => Return
}
