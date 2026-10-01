import { activateHotkeyScope, type HotkeyScope } from "@valdres/hotkeys"
import { useStore } from "valdres-react"
import { useIsomorphicLayoutEffect } from "./lib/useIsomorphicLayoutEffect"
import type { UseHotkeyScopeOptions } from "./types/UseHotkeyScopeOptions"

/**
 * Keeps `scope` active in the store from `options.store` or the nearest
 * `<Provider>` while the component is mounted and `active` is not false.
 * Activates in the commit phase; a render that is never committed activates
 * nothing.
 */
export const useHotkeyScope = (
    scope: HotkeyScope,
    options: UseHotkeyScopeOptions = {},
): void => {
    const store = useStore(options.store)
    const active = options.active ?? true
    useIsomorphicLayoutEffect(() => {
        if (!active) return
        return activateHotkeyScope(store, scope)
    }, [store, scope, active])
}
