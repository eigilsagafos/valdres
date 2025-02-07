import { eventHandler } from "./eventHandler"

export { currentCodeCombinationAtom } from "./currentCodeCombinationAtom"
export { currentKeyCombinationAtom } from "./currentKeyCombinationAtom"
export { DEFAULT_OPTIONS } from "./DEFAULT_OPTIONS"
export { eventByKeyAtom } from "./eventByKeyAtom"
export { eventByCodeAtom } from "./eventByCodeAtom"
export { eventHandler }
export { subscribeToCode } from "./subscribeToCode"
export { subscribeToCommand } from "./subscribeToCommand"
export { subscribeToHotkey } from "./subscribeToHotkey"
export { subscribeToKey } from "./subscribeToKey"

export type { KeyboardCode } from "../types/KeyboardCode"
export type { KeyboardCommand } from "../types/KeyboardCommand"
export type { Options } from "../types/Options"

export const registerListeners = () => {
    document.addEventListener("keydown", eventHandler)
    document.addEventListener("keyup", eventHandler)
}

if (document) {
    registerListeners()
}
