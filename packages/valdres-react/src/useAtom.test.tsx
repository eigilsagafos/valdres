import { render } from "@testing-library/react"
import { describe, expect, test } from "bun:test"
import { useEffect } from "react"
import { atom } from "valdres"
import { generateStoreAndRenderHook } from "../test/generateStoreAndRenderHook"
import { useAtom } from "./useAtom"
import { Provider } from "./Provider"

describe("useAtom", () => {
    test("default", () => {
        const [, renderHook] = generateStoreAndRenderHook()
        const numberAtom = atom(10)
        const { result } = renderHook(() => useAtom(numberAtom))
        expect(result.current[0]).toBe(10)
        result.current[1](20)
        expect(result.current[0]).toBe(20)
    })
    test("can write an atom value on useEffect", async () => {
        const countAtom = atom(0)

        const Counter = () => {
            const [count, setCount] = useAtom(countAtom)
            useEffect(() => {
                setCount(c => c + 1)
            }, [setCount])
            // @ts-ignore
            return <div>count: {count}</div>
        }

        const { findByText } = render(
            <>
                <Counter />
            </>,
            { wrapper: Provider },
        )

        await findByText("count: 1")
    })
})
