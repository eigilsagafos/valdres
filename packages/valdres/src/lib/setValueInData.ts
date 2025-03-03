import type { Atom } from "../types/Atom"
import type { StoreData } from "../types/StoreData"
import { deepFreeze } from "../utils/deepFreeze"
import { isProd } from "./isProd"

export const setValueInData = <Value = any>(
    atom: Atom<Value>,
    value: Value,
    data: StoreData,
): Value => {
    if (isProd()) {
        data.values.set(atom, value)
        return value
    } else {
        const frozenValue = deepFreeze(value)
        data.values.set(atom, frozenValue)
        return frozenValue
    }
}
