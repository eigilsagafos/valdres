import { initAtom } from "./initAtom"
import { initSelector } from "./initSelector"
import { isAtom } from "../utils/isAtom"
import { isSelector } from "../utils/isSelector"
import { isFamily } from "../utils/isFamily"
import type { State } from "../types/State"
import type { StoreData } from "../types/StoreData"
import type { Atom } from "../types/Atom"
import type { AtomFamily } from "../types/AtomFamily"

export const getState = <V>(
    state: State<V>,
    data: StoreData,
): V | Promise<V> => {
    if (data.values.has(state)) return data.values.get(state)
    if (isAtom(state)) return initAtom<V>(state as Atom<V>, data)
    if (isSelector(state)) return initSelector<V>(state, data)
    if (isFamily(state)) {
        const res = []
        for (const atom of (state as AtomFamily<V, any>)._map.values()) {
            res.push([atom.familyKey, getState(atom, data)])
        }
        // @ts-ignore
        return res
    }
    throw new Error("Invalid object passed to get")
}
