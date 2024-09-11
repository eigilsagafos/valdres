import { initAtom } from "./initAtom"
import { initSelector } from "./initSelector"
import { isAtom } from "../utils/isAtom"
import { isSelector } from "../utils/isSelector"
import type { State } from "../types/State"
import type { StoreData } from "../types/StoreData"
import { isFamily } from "../utils/isFamily"

export const getState = <V>(
    state: State<V>,
    data: StoreData,
): V | Promise<V> => {
    if (data.values.has(state)) return data.values.get(state)
    if (isAtom(state)) return initAtom<V>(state, data)
    if (isSelector(state)) return initSelector<V>(state, data)
    if (isFamily(state)) {
        const res = []
        for (const atom of state._map.values()) {
            res.push([atom.familyKey, getState(atom, data)])
        }
        return res
    }
    console.log("nsadf", isFamily(state), state, state._map)
    throw new Error("Invalid object passed to get")
}
