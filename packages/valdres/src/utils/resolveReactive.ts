import type { Reactive } from "../types/Reactive"
import type { StoreData } from "../types/StoreData"
import { isAtom } from "./isAtom"
import { isSelector } from "./isSelector"
import { getState } from "../lib/getState"

export const isReactive = (value: any): boolean =>
    typeof value === "object" && value !== null && (isAtom(value) || isSelector(value))

export const resolveReactive = <T>(
    value: Reactive<T>,
    data: StoreData,
): T => {
    if (typeof value === "object" && value !== null && (isAtom(value) || isSelector(value))) {
        if (data.values.has(value as any)) return data.values.get(value as any)
        return getState(value as any, data, new Set())
    }
    return value as T
}
