import { setAtom } from "./lib/setAtom"
import type { Atom } from "./types/Atom"
import type { AtomOnSet } from "./types/AtomOnSet"
import type { StoreData } from "./types/StoreData"

type AtomOptions<Value = any> = {
    global?: boolean
    label?: string
    onInit?: (setSelf: (value: Value) => void, store: StoreData) => void
    onSet?: AtomOnSet<Value>
    onMount?: () => () => void
}

export const globalAtom = <Value = any, FamilyKey = undefined>(
    defaultValue: Value | (() => Value | Promise<Value>),
    options: AtomOptions<Value>,
) => {
    const stores = new Set<StoreData>()
    let value = defaultValue
    const onSet: AtomOnSet<Value> = (newValue, currentStore) => {
        value = newValue
        if (stores.size > 1) {
            for (const store of stores) {
                if (store.id !== currentStore.id) {
                    setAtom(newAtom, value, store, true)
                }
            }
        }
    }
    const newAtom: Atom<Value> = {
        defaultValue,
        ...options,
        onInit: (setSelf, store) => {
            // @ts-ignore @ts-todo
            setSelf(value)
            stores.add(store)
        },
        onSet,
        label: options?.label,
    }

    return newAtom
}

export const atom = <Value = any, FamilyKey = undefined>(
    defaultValue?: Value | (() => Value | Promise<Value>),
    options?: AtomOptions<Value>,
): Atom<Value, FamilyKey> => {
    if (!options) return { defaultValue }
    // @ts-ignore @ts-todo
    if (options.global) return globalAtom(defaultValue, options)
    return {
        defaultValue,
        ...options,
    } as Atom<Value, FamilyKey>
}
