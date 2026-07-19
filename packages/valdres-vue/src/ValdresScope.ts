import {
    defineComponent,
    inject,
    provide,
    onScopeDispose,
    type PropType,
} from "vue"
import { storeAdapter } from "valdres/adapter-internals/v1"
import { ValdresKey } from "./lib/storeKey"
import { hydrate } from "./lib/hydrate"
import type { InitializeCallback } from "./types/InitializeCallback"

const generateId = () => (Math.random() + 1).toString(36).substring(7)

export const ValdresScope = defineComponent({
    name: "ValdresScope",
    props: {
        scopeId: {
            type: String,
            default: () => generateId(),
        },
        initialize: {
            type: Function as PropType<InitializeCallback>,
        },
    },
    setup(props, { slots }) {
        const parentCtx = inject(ValdresKey)
        if (!parentCtx) {
            throw new Error(
                "No valdres store provided. ValdresScope must be nested under createValdres() or another ValdresScope.",
            )
        }

        const scopeCreated = !storeAdapter.hasScope(
            parentCtx.current,
            props.scopeId,
        )
        const scopedStore = parentCtx.current.scope(props.scopeId)

        if (props.initialize) {
            scopedStore.txn(txn => {
                const pairs = props.initialize!(txn)
                if (pairs) {
                    hydrate(txn.set, pairs)
                }
            })
        }

        provide(ValdresKey, {
            current: scopedStore,
            stores: {
                ...parentCtx.stores,
                [parentCtx.current.id]: parentCtx.current,
                [scopedStore.id]: scopedStore,
            },
        })

        onScopeDispose(() => {
            scopedStore?.detach?.(scopeCreated)
        })

        return () => slots.default?.()
    },
})
