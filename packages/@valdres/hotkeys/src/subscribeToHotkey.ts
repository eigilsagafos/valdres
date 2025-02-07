import type { Store } from "valdres"
import type { Options } from "../types/Options"
import { eventByKeyAtom } from "./eventByKeyAtom"
import { callbackHandler } from "./lib/callbackHandler"
import { parseHotkeysString } from "./lib/parseHotkeysString"

export const subscribeToHotkey = (
    hotkey: string,
    callback: (event: KeyboardEvent) => void,
    options: Options,
    store: Store,
) => {
    const combos = parseHotkeysString(hotkey)
    const unsubscribeArray = combos.map(key => {
        const atom = eventByKeyAtom(key)
        return store.sub(atom, () => {
            const event = store.get(atom)
            if (event) callbackHandler(event, callback, options)
        })
    })
    return () => unsubscribeArray.forEach(unsub => unsub())
}
