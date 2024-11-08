import { eventHandler } from "./src/eventHandler"

export { currentCodeCombinationAtom } from "./src/currentCodeCombinationAtom"
export { currentKeyCombinationAtom } from "./src/currentKeyCombinationAtom"
export { DEFAULT_OPTIONS } from "./src/DEFAULT_OPTIONS"
export { eventByKeyAtom } from "./src/eventByKeyAtom"
export { eventByCodeAtom } from "./src/eventByCodeAtom"
export { eventHandler }
export { subscribeToCode } from "./src/subscribeToCode"
export { subscribeToCommand } from "./src/subscribeToCommand"
export { subscribeToKey } from "./src/subscribeToKey"

export type { KeyboardCode } from "./src/types/KeyboardCode"
export type { KeyboardCommand } from "./src/types/KeyboardCommand"
export type { Options } from "./src/types/Options"

export const registerListeners = () => {
    document.addEventListener("keydown", eventHandler)
    document.addEventListener("keyup", eventHandler)
}

if (document) {
    registerListeners()
}
