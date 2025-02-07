import { subscribeToHotkey } from "@valdres/hotkeys"
import { useCallback, useEffect } from "react"
import { parseHookRestArgs } from "./lib/parseHookRestArgs"
import type { HookRestArgs } from "../types/HookRestArgs"
import { useStore } from "valdres-react"

export const useHotkeys = (
    hotkey: string,
    callback: () => void,
    ...args: HookRestArgs
) => {
    const [opts, deps] = parseHookRestArgs(args)

    const memoizedCallback = useCallback(callback, deps)
    const store = useStore()

    useEffect(
        () => subscribeToHotkey(hotkey, memoizedCallback, opts, store),
        [memoizedCallback, store, hotkey, ...deps],
    )
}
