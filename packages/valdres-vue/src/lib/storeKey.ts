import type { InjectionKey } from "vue"
import type { Store } from "valdres"

export interface ValdresContext {
    current: Store
    stores: Record<string, Store>
}

export const ValdresKey: InjectionKey<ValdresContext> = Symbol("valdres")
