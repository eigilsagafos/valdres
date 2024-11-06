import type { Store } from "valdres"
import type { Options } from "./types/Options"
import { eventByKeyAtom } from "./eventByKeyAtom"

export const subscribeToKey = (
    key: string | string[],
    callback: (event: KeyboardEvent) => void,
    opts: Options,
    store: Store,
) => {
    if (!Array.isArray(key)) key = [key]
    const atom = eventByKeyAtom(key)
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
