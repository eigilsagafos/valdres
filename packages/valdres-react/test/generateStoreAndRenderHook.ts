import { renderHook } from "@testing-library/react-hooks"
import { store } from "valdres"
import { Provider } from "../src/Provider"

export const generateStoreAndRenderHook = () => {
    const store1 = store()

    const renderHookCustom = (cb: () => any) =>
        renderHook(cb, {
            wrapper: Provider,
            initialProps: {
                store: store1,
            },
        })

    return [store1, renderHookCustom] as const
}
