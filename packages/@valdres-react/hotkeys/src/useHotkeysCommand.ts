import { subscribeToCommand, type KeyboardCommand } from "@valdres/hotkeys"
import { useCallback, useEffect } from "react"
import { useStore } from "valdres-react"
import { parseHookRestArgs } from "./lib/parseHookRestArgs"
import type { HookRestArgs } from "./types/HookRestArgs"

export const useHotkeysCommand = (
    command: KeyboardCommand,
    callback: () => {},
    ...args: HookRestArgs
) => {
    const [opts, deps] = parseHookRestArgs(args)
    const memoizedCallback = useCallback(callback, deps)
    const store = useStore()

    useEffect(
        () => subscribeToCommand(command, memoizedCallback, opts, store),
        [memoizedCallback, store, command, ...deps],
    )
}
