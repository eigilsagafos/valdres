import { store } from "valdres"
import {
    init,
    pressedCodesSelector,
    pressedKeyValuesSelector,
    pressedKeysAtom,
    toggleKeyAtom,
    modifierSelector,
} from "@valdres/browser-keyboard"

const s = store()
init()

const $codes = document.getElementById("codes")!
const $keys = document.getElementById("keys")!
const $modifiers = document.getElementById("modifiers")!
const $capsLock = document.getElementById("capsLock")!
const $numLock = document.getElementById("numLock")!
const $target = document.getElementById("target")!

const formatTarget = (target: EventTarget | null) => {
    if (!target) return "(none)"
    const el = target as HTMLElement
    const tag = el.tagName?.toLowerCase() ?? "?"
    const id = el.id ? `#${el.id}` : ""
    const type = (el as HTMLInputElement).type
        ? `[type=${(el as HTMLInputElement).type}]`
        : ""
    return `${tag}${id}${type}`
}

const render = () => {
    const pressed = s.get(pressedKeysAtom)
    $codes.textContent = s.get(pressedCodesSelector).join(" + ") || "(none)"
    $keys.textContent =
        s.get(pressedKeyValuesSelector).join(" + ") || "(none)"

    const mods = (["shift", "ctrl", "alt", "meta"] as const)
        .filter(m => s.get(modifierSelector(m)))
        .join(" + ")
    $modifiers.textContent = mods || "(none)"

    const caps = s.get(toggleKeyAtom("CapsLock"))
    $capsLock.textContent = caps === null ? "unknown" : caps ? "ON" : "OFF"

    const num = s.get(toggleKeyAtom("NumLock"))
    $numLock.textContent = num === null ? "unknown" : num ? "ON" : "OFF"

    const lastKey = pressed[pressed.length - 1]
    $target.textContent = lastKey ? formatTarget(lastKey.target) : "(none)"
}

s.sub(pressedKeysAtom, render)
render()
