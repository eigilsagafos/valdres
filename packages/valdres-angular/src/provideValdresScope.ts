import { inject, DestroyRef, type Provider } from "@angular/core"
import { VALDRES_STORE } from "./lib/VALDRES_STORE"
import { hydrate } from "./lib/hydrate"
import type { InitializeCallback } from "./types/InitializeCallback"

const generateId = () => (Math.random() + 1).toString(36).substring(7)

export interface ValdresScopeOptions {
    scopeId?: string
    initialize?: InitializeCallback
}

export const provideValdresScope = (
    options: ValdresScopeOptions = {},
): Provider[] => {
    return [
        {
            provide: VALDRES_STORE,
            useFactory: () => {
                const parentCtx = inject(VALDRES_STORE, {
                    skipSelf: true,
                    optional: true,
                })
                if (!parentCtx) {
                    throw new Error(
                        "No valdres store provided. provideValdresScope() must be nested under provideValdres().",
                    )
                }

                const destroyRef = inject(DestroyRef)
                const scopeId = options.scopeId ?? generateId()
                const scopeCreated =
                    !parentCtx.current.data.scopes?.has(scopeId)
                const scopedStore = parentCtx.current.scope(scopeId)

                if (options.initialize) {
                    scopedStore.txn(txn => {
                        const pairs = options.initialize!(txn)
                        if (pairs) {
                            hydrate(txn.set, pairs)
                        }
                    })
                }

                destroyRef.onDestroy(() => {
                    scopedStore?.detach?.(scopeCreated)
                })

                return {
                    current: scopedStore,
                    stores: {
                        ...parentCtx.stores,
                        [parentCtx.current.data.id]: parentCtx.current,
                        [scopedStore.data.id]: scopedStore,
                    },
                }
            },
        },
    ]
}
