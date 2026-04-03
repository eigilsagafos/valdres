import type { Atom } from "../types/Atom"
import type { AtomFamily } from "../types/AtomFamily"
import type { StoreData } from "../types/StoreData"
import { deepFreeze } from "../utils/deepFreeze"
import { isProd } from "./isProd"

export const setValueInData = <Value extends unknown>(
    atom: Atom<Value> | AtomFamily<any, any>,
    value: Value,
    data: StoreData,
): Value => {
    if (atom.mutable || isProd()) {
        data.values.set(atom, value)
        return value
    } else {
        // Skip deepFreeze for primitives — they are immutable by nature
        const frozenValue = value !== null && typeof value === "object"
            ? deepFreeze(value)
            : value
        data.values.set(atom, frozenValue)
        return frozenValue
    }
}
