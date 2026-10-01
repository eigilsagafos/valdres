import type { Modifier } from "@valdres/browser-keyboard"
import type { Shortcut } from "../types/Shortcut"
import { isAppleLike } from "./isAppleLike"

const MODIFIER_ALIASES: Readonly<Record<string, Modifier | "mod">> = {
    ctrl: "ctrl",
    control: "ctrl",
    shift: "shift",
    alt: "alt",
    option: "alt",
    meta: "meta",
    cmd: "meta",
    command: "meta",
    mod: "mod",
}

const KEY_ALIASES: Readonly<Record<string, string>> = {
    esc: "escape",
    space: " ",
    spacebar: " ",
    up: "arrowup",
    down: "arrowdown",
    left: "arrowleft",
    right: "arrowright",
    plus: "+",
    del: "delete",
    return: "enter",
}

const MODIFIER_KEYS: Readonly<Record<string, Modifier>> = {
    shift: "shift",
    control: "ctrl",
    alt: "alt",
    meta: "meta",
}

const ORDER: readonly Modifier[] = ["ctrl", "alt", "shift", "meta"]

const isLetter = (char: string) => char.toLowerCase() !== char.toUpperCase()

// "+" separates tokens; the plus key itself is written "+" alone or as the
// last token after a separator ("Mod++"). A trailing lone separator ("Ctrl+")
// leaves an empty trigger, which is rejected.
const tokenize = (text: string): string[] => {
    if (text === "+") return ["+"]
    if (text.endsWith("++")) return [...text.slice(0, -2).split("+"), "+"]
    return text.split("+")
}

/**
 * Parses `"Mod+Shift+Z"`, `"Escape"`, `"?"`, `"Alt+KeyK"`. The last token is the
 * trigger; every other token must be a modifier. `Mod` is Meta on Apple
 * platforms and Control elsewhere, resolved when parsed. Throws `SyntaxError`
 * for an empty shortcut, an unknown modifier, or Shift named together with a
 * symbol that already encodes it.
 */
export const parseShortcut = (text: string): Shortcut => {
    if (typeof text !== "string")
        throw new TypeError("A hotkey shortcut must be a string")
    const tokens = tokenize(text.trim())
    const raw = tokens.pop()
    if (raw === undefined || raw.trim() === "")
        throw new SyntaxError(`Empty hotkey: ${JSON.stringify(text)}`)
    const modifiers: Record<Modifier, boolean> = {
        ctrl: false,
        shift: false,
        alt: false,
        meta: false,
    }
    for (const token of tokens) {
        const alias = MODIFIER_ALIASES[token.trim().toLowerCase()]
        if (alias === undefined)
            throw new SyntaxError(
                `Unknown modifier ${JSON.stringify(token)} in hotkey ${JSON.stringify(text)}`,
            )
        modifiers[alias === "mod" ? (isAppleLike() ? "meta" : "ctrl") : alias] =
            true
    }
    const trimmed = raw.trim()
    const lower = trimmed.toLowerCase()
    const alias = KEY_ALIASES[lower]
    const key = alias ?? lower
    // Single characters are case-insensitive keys; longer tokens keep their
    // case so that code names ("KeyZ", "Digit1") match `KeyDown.code`.
    const trigger =
        alias !== undefined || [...trimmed].length === 1 ? key : trimmed
    const ignoreShift = [...key].length === 1 && key !== " " && !isLetter(key)
    if (ignoreShift && modifiers.shift)
        throw new SyntaxError(
            `Hotkey ${JSON.stringify(text)} names Shift, but ${JSON.stringify(trimmed)} already encodes it. Leave Shift out, or name the physical key, as in "Shift+Digit1".`,
        )
    const id = [
        ...ORDER.filter(modifier => modifiers[modifier]).map(
            modifier => modifier[0]!.toUpperCase() + modifier.slice(1),
        ),
        trigger === " " ? "Space" : trigger,
    ].join("+")
    return Object.freeze({
        id,
        trigger,
        key,
        modifiers: Object.freeze(modifiers),
        ignoreShift,
    })
}

/** Parses one shortcut or a list of alternatives. Throws on an empty list. */
export const parseShortcuts = (
    shortcut: string | readonly string[],
): readonly Shortcut[] => {
    const list = typeof shortcut === "string" ? [shortcut] : shortcut
    if (!Array.isArray(list) || list.length === 0)
        throw new TypeError("A hotkey needs at least one shortcut")
    return Object.freeze(list.map(parseShortcut))
}

/** The modifier a `KeyDown.key` value names, if it is one. */
export const modifierOfKey = (key: string): Modifier | undefined =>
    MODIFIER_KEYS[key.toLowerCase()]
