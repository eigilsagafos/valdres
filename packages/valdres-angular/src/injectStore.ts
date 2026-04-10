import { inject } from "@angular/core"
import type { Store } from "valdres"
import { VALDRES_STORE } from "./lib/VALDRES_STORE"

export const injectStore = (id?: string): Store => {
    const ctx = inject(VALDRES_STORE, { optional: true })
    if (!ctx) {
        throw new Error(
            "No valdres store provided. Call provideValdres() in your application providers.",
        )
    }
    if (id) {
        const store = ctx.stores[id]
        if (!store)
            throw new Error(
                `No store with id "${id}" found in ancestor chain`,
            )
        return store
    }
    return ctx.current
}
