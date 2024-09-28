import { describe, test, expect } from "bun:test"
import { render } from "@testing-library/react"
import { renderHook } from "@testing-library/react-hooks"
import { useAtom } from "./useAtom"
import { atom } from "valdres"
import { useEffect } from "react"

describe("useAtom", () => {
    test("default", () => {
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
        )

        await findByText("count: 1")
    })
})
