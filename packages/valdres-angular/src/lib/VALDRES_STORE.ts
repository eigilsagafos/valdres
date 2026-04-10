import { InjectionToken } from "@angular/core"
import type { Store } from "valdres"

export interface ValdresContext {
    current: Store
    stores: Record<string, Store>
}

export const VALDRES_STORE = new InjectionToken<ValdresContext>("VALDRES_STORE")
