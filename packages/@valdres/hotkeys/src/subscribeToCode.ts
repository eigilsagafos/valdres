import type { Store } from "valdres"
import type { Options } from "./types/Options"
import type { KeyboardCode } from "./types/KeyboardCode"
import { eventByCodeAtom } from "./eventByCodeAtom"

export const subscribeToCode = (
    code: KeyboardCode | KeyboardCode[],
    callback: (event: KeyboardEvent) => void,
    opts: Options,
    store: Store,
) => {
    if (!Array.isArray(code)) code = [code]
    const atom = eventByCodeAtom(code)
    return store.sub(atom, () => {
        const event = store.get(atom)
        if (event?.type === "keydown" && opts.keydown) {
            callback(event)
        }
        if (event?.type === "keyup" && opts.keyup) {
            callback(event)
        }
    })
}
