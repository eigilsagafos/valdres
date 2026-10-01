import type { HotkeyCommand } from "@valdres/hotkeys"
import {
    parseShortcuts,
    registerBinding,
    type BindingConfig,
    type BindingHandle,
} from "@valdres/hotkeys/adapter-internals"
import { useMemo, useRef } from "react"
import { useStore } from "valdres-react"
import { useIsomorphicLayoutEffect } from "./lib/useIsomorphicLayoutEffect"
import type { UseHotkeyOptions } from "./types/UseHotkeyOptions"

// Joins alternatives into one dependency key; no shortcut contains it.
const SEPARATOR = "\u0000"

/**
 * Binds `shortcut` for as long as the component is mounted, in the store from
 * `options.store` or the nearest `<Provider>`. Registers in the commit phase,
 * once per store: later renders adopt the newest command, options and
 * shortcut in place, so they never re-register, never reset what has been
 * handled and never change precedence. A render that is never committed
 * registers nothing.
 */
export const useHotkey = (
    shortcut: string | readonly string[],
    command: HotkeyCommand,
    options: UseHotkeyOptions = {},
): void => {
    const store = useStore(options.store)
    const text =
        typeof shortcut === "string" ? shortcut : shortcut.join(SEPARATOR)
    // Parsing is pure, so a malformed shortcut throws during render.
    const shortcuts = useMemo(
        () => parseShortcuts(text.split(SEPARATOR)),
        [text],
    )
    const latest = useRef<BindingConfig | null>(null)
    const handle = useRef<BindingHandle | null>(null)

    // Declared first, so on mount it runs before the registration below.
    useIsomorphicLayoutEffect(() => {
        const { store: _store, ...hotkeyOptions } = options
        latest.current = { ...hotkeyOptions, command }
    })
    useIsomorphicLayoutEffect(() => {
        const registered = registerBinding(
            store,
            shortcuts,
            () => latest.current!,
        )
        handle.current = registered
        return () => {
            registered.dispose()
            handle.current = null
        }
        // Shortcut changes are applied in place by the next effect.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [store])
    useIsomorphicLayoutEffect(() => {
        handle.current?.setShortcuts(shortcuts)
    }, [shortcuts])
}
