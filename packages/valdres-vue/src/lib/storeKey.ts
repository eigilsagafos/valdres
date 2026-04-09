import type { InjectionKey } from "vue"
import type { Store } from "valdres"

export const StoreKey: InjectionKey<Store> = Symbol("valdres-store")
