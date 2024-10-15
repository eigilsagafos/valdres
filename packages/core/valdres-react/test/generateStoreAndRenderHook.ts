import { renderHook } from "@testing-library/react-hooks"
import { createStore } from "valdres"
import { Provider } from "../src/Provider"

export const generateStoreAndRenderHook = () => {
    const store = createStore()

    const renderHookCustom = (cb: () => any) =>
        renderHook(cb, {
            wrapper: Provider,
            initialProps: {
                store,
            },
        })

    return [store, renderHookCustom] as const
}
