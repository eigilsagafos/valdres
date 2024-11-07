import { atomFamily } from "valdres-react"

export type ModifierKeyType = "shift" | "meta" | "ctrl" | "alt" | "space"

export const isModifierKeyActiveAtom = atomFamily<ModifierKeyType, boolean>(
    false,
    {
        global: true,
        name: "@valdres-react/panable/isModifierKeyActiveAtom",
    },
)

const spaceAtom = isModifierKeyActiveAtom("space")
const altAtom = isModifierKeyActiveAtom("alt")
const shiftAtom = isModifierKeyActiveAtom("shift")
const metaAtom = isModifierKeyActiveAtom("meta")
const ctrlAtom = isModifierKeyActiveAtom("ctrl")

const handler = e => {
    const { altKey, ctrlKey, metaKey, shiftKey, type, code, key } = e

    if (code === "Space") {
        const spaceKey = type === "keydown"
        if (spaceAtom.currentValue !== spaceKey) {
            spaceAtom.setSelf(spaceKey)
        }
        isModifierKeyActiveAtom("space").setSelf(spaceKey)
    }
    if (altAtom.currentValue !== altKey) altAtom.setSelf(altKey)
    if (ctrlAtom.currentValue !== ctrlKey) ctrlAtom.setSelf(ctrlKey)
    if (shiftAtom.currentValue !== shiftKey) shiftAtom.setSelf(shiftKey)
    if (metaAtom.currentValue !== metaKey) metaAtom.setSelf(metaKey)
}

addEventListener("keydown", handler)
addEventListener("keyup", handler)
