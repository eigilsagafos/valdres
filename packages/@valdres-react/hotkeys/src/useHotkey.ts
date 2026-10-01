import type { HotkeyCommand } from "@valdres/hotkeys"
import {
    parseShortcuts,
    registerBinding,
    validateBindingConfig,
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
 * registers nothing. Invalid options — a non-finite priority, a scope not
 * made by `hotkeyScope` — throw during render and are never adopted. If an
 * error boundary then unmounts the component, unmounting disposes its binding,
 * previous configuration included.
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
    // Validated on every render, before any effect can adopt it: an invalid
    // update throws here and is never adopted by the registered binding (an
    // error boundary that unmounts the component then disposes the binding).
    const { store: _store, ...hotkeyOptions } = options
    const config: BindingConfig = { ...hotkeyOptions, command }
    validateBindingConfig(config)
    const latest = useRef<BindingConfig | null>(null)
    const handle = useRef<BindingHandle | null>(null)

    // Declared first, so on mount it runs before the registration below.
    useIsomorphicLayoutEffect(() => {
        latest.current = config
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
