import { valdresTestHook } from "./reactSelectors"

export const testValdres = () => {
    console.log(valdresTestHook.result.current)
    const [values, increment]: [number[], any] = valdresTestHook.result.current
    values.every(1)

    // if (valdresTestHook.result.current[0].length !== 100) throw new Error(`Foo`)
    // valdresTestHook.result[0]
}
