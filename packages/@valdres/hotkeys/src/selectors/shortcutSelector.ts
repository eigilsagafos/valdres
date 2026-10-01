import {
    lastKeyDownAtom,
    modifierSelector,
    type KeyDown,
    type Modifier,
} from "@valdres/browser-keyboard"
import { family, selector, type Selector } from "valdres"
import { modifierOfKey, parseShortcut } from "../lib/parseShortcut"

const MODIFIERS: readonly Modifier[] = ["ctrl", "shift", "alt", "meta"]

const byCanonicalId = family((id: string) => {
    const parsed = parseShortcut(id)
    return selector<KeyDown | null>(
        get => {
            const keyDown = get(lastKeyDownAtom)
            if (keyDown === null) return null
            if (
                keyDown.code !== parsed.trigger &&
                keyDown.key.toLowerCase() !== parsed.key
            )
                return null
            const own = modifierOfKey(keyDown.key)
            for (const modifier of MODIFIERS) {
                if (modifier === own) continue
                if (modifier === "shift" && parsed.ignoreShift) continue
                if (
                    get(modifierSelector(modifier)) !==
                    parsed.modifiers[modifier]
                )
                    return null
            }
            return keyDown
        },
        { name: `@valdres/hotkeys/shortcut/${parsed.id}` },
    )
})

/**
 * The latest keydown when it is `shortcut` — its trigger with exactly its
 * modifiers held — or `null`. Every spelling of one shortcut returns the same
 * selector. Pure state for display: it is not an event, and it becomes
 * non-null again whenever its inputs do, so never run a command from it; bind
 * one with `bindHotkey`.
 */
export const shortcutSelector = (shortcut: string): Selector<KeyDown | null> =>
    byCanonicalId(parseShortcut(shortcut).id)
