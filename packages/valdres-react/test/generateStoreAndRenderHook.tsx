import { renderHook } from "@testing-library/react"
import { store } from "valdres"
import { Provider } from "../src/Provider"

const createWrapper = (Wrapper, props) => {
    return function CreatedWrapper({ children }) {
        return <Wrapper {...props}>{children}</Wrapper>
    }
}

export const generateStoreAndRenderHook = () => {
    const store1 = store()

    const renderHookCustom = (cb: () => any) =>
        renderHook(cb, {
            wrapper: createWrapper(Provider, { store: store1 }),
            // Provider,
            // initialProps: {
            //     store: store1,
            // },
        })

    return [store1, renderHookCustom] as const
}
