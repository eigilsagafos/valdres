import type { Store } from "valdres"
import type { Options } from "./types/Options"
import type { KeyboardCode } from "./types/KeyboardCode"
import { eventByCodeAtom } from "./eventByCodeAtom"
import { callbackHandler } from "./lib/callbackHandler"

export const subscribeToCode = (
    code: KeyboardCode | KeyboardCode[],
    callback: (event: KeyboardEvent) => void,
    options: Options,
    store: Store,
) => {
    if (!Array.isArray(code)) code = [code]
    const atom = eventByCodeAtom(code)
    return store.sub(
        atom,
        () => {
            const event = store.get(atom)
            if (event) callbackHandler(event, callback, options)
        },
        false,
    )
}
