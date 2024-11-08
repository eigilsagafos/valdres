import type { Store } from "valdres"
import type { KeyboardCommand } from "./types/KeyboardCommand"
import type { Options } from "./types/Options"
import { macCommandMappings } from "./lib/macCommandMappings"
import { pcCommandMappings } from "./lib/pcCommandMappings"
import { isAppleLike } from "./lib/isAppleLike"
import { eventByKeyAtom } from "./eventByKeyAtom"
import { callbackHandler } from "./lib/callbackHandler"

const getSystemSpecificCommand = (command: KeyboardCommand) => {
    if (isAppleLike()) {
        return macCommandMappings[command]
    }
    return pcCommandMappings[command]
}

const parseHotkeysString = (string: string) => {
    const items = string.split(/,\s?/)
    return items.map(item => {
        return item.split(/\+(.[^+]*)/).filter(k => k)
    })
}

export const subscribeToCommand = (
    command: KeyboardCommand,
    callback: (event: KeyboardEvent) => void,
    options: Options,
    store: Store,
) => {
    const systemCommand = getSystemSpecificCommand(command)
    const combos = parseHotkeysString(systemCommand)
    const unsubscribeArray = combos.map(key => {
        const atom = eventByKeyAtom(key)
        return store.sub(atom, () => {
            const event = store.get(atom)
            if (event) callbackHandler(event, callback, options)
        })
    })
    return () => unsubscribeArray.forEach(unsub => unsub())
}
