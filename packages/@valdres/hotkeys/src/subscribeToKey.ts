import type { Store } from "valdres"
import type { Options } from "../types/Options"
import { eventByKeyAtom } from "./eventByKeyAtom"
import { callbackHandler } from "./lib/callbackHandler"

export const subscribeToKey = (
    key: string | string[],
    callback: (event: KeyboardEvent) => void,
    options: Options,
    store: Store,
) => {
    if (!Array.isArray(key)) key = [key]
    const atom = eventByKeyAtom(key)
    return store.sub(atom, () => {
        const event = store.get(atom)
        if (event) callbackHandler(event, callback, options)
    })
}
