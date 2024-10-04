import type { AtomOnSet } from "./AtomOnSet"
import type { StoreData } from "./StoreData"

export type AtomOptions<Value = any> = {
    global?: boolean
    label?: string
    onInit?: (setSelf: (value: Value) => void, store: StoreData) => void
    onSet?: AtomOnSet<Value>
    onMount?: () => () => void
}
