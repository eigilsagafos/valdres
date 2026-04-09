/**
 * Selector tests adapted from Recoil's Recoil_selector-test.js
 * Tests selector get, set, reset, dependencies, and chaining.
 */
import React from "react"
import { describe, test, expect, afterEach } from "bun:test"
import { render, act, cleanup } from "@testing-library/react"
import { atom } from "../src/atom"
import { selector } from "../src/selector"
import { RecoilRoot } from "../src/RecoilRoot"
import { useRecoilState } from "../src/useRecoilState"
import { useRecoilValue } from "../src/useRecoilValue"
import { useResetRecoilState } from "../src/useResetRecoilState"
import { renderElements, ReadsAtom } from "./helpers"

afterEach(() => {
    cleanup()
})

let nextKey = 0
function uniqueKey() {
    return `selector-test-${nextKey++}`
}

describe("recoil/selector", () => {
    test("selector get", () => {
        const myAtom = atom({ key: uniqueKey(), default: "ATOM" })
        const mySelector = selector({
            key: uniqueKey(),
            get: ({ get }) => `SELECTOR_${get(myAtom)}`,
        })

        const container = renderElements(<ReadsAtom atom={mySelector} />)
        expect(container.textContent).toBe('"SELECTOR_ATOM"')
    })

    test("selector set", () => {
        const myAtom = atom({ key: uniqueKey(), default: 0 })
        const mySelector = selector({
            key: uniqueKey(),
            get: ({ get }) => get(myAtom) * 2,
            set: ({ set }, newValue) => {
                set(myAtom, (newValue as number) / 2)
            },
        })

        let setValue: any
        function Component() {
            const [value, sv] = useRecoilState(mySelector as any)
            setValue = sv
            return <div data-testid="value">{value}</div>
        }

        const { getByTestId } = render(
            <RecoilRoot>
                <Component />
            </RecoilRoot>,
        )
        expect(getByTestId("value").textContent).toBe("0")
        act(() => setValue(10))
        expect(getByTestId("value").textContent).toBe("10")
    })

    test("selector with multiple atom dependencies", () => {
        const atomA = atom({ key: uniqueKey(), default: 1 })
        const atomB = atom({ key: uniqueKey(), default: 2 })
        const mySelector = selector({
            key: uniqueKey(),
            get: ({ get }) => get(atomA) + get(atomB),
        })

        let setA: any
        let setB: any
        function Component() {
            const value = useRecoilValue(mySelector)
            const [, sa] = useRecoilState(atomA)
            const [, sb] = useRecoilState(atomB)
            setA = sa
            setB = sb
            return <div data-testid="value">{value}</div>
        }

        const { getByTestId } = render(
            <RecoilRoot>
                <Component />
            </RecoilRoot>,
        )
        expect(getByTestId("value").textContent).toBe("3")
        act(() => setA(10))
        expect(getByTestId("value").textContent).toBe("12")
        act(() => setB(20))
        expect(getByTestId("value").textContent).toBe("30")
    })

    test("selector with chained dependencies", () => {
        const baseAtom = atom({ key: uniqueKey(), default: 1 })
        const selectorA = selector({
            key: uniqueKey(),
            get: ({ get }) => get(baseAtom) * 2,
        })
        const selectorB = selector({
            key: uniqueKey(),
            get: ({ get }) => get(selectorA) + 10,
        })

        let setValue: any
        function Component() {
            const value = useRecoilValue(selectorB)
            const [, sv] = useRecoilState(baseAtom)
            setValue = sv
            return <div data-testid="value">{value}</div>
        }

        const { getByTestId } = render(
            <RecoilRoot>
                <Component />
            </RecoilRoot>,
        )
        expect(getByTestId("value").textContent).toBe("12")
        act(() => setValue(5))
        expect(getByTestId("value").textContent).toBe("20")
    })

    test("selector with nested selector dependencies", () => {
        const atomA = atom({ key: uniqueKey(), default: 1 })
        const atomB = atom({ key: uniqueKey(), default: 10 })
        const innerSelector = selector({
            key: uniqueKey(),
            get: ({ get }) => get(atomA) + get(atomB),
        })
        const outerSelector = selector({
            key: uniqueKey(),
            get: ({ get }) => get(innerSelector) * 2,
        })

        let setA: any
        function Component() {
            const value = useRecoilValue(outerSelector)
            const [, sa] = useRecoilState(atomA)
            setA = sa
            return <div data-testid="value">{value}</div>
        }

        const { getByTestId } = render(
            <RecoilRoot>
                <Component />
            </RecoilRoot>,
        )
        expect(getByTestId("value").textContent).toBe("22")
        act(() => setA(5))
        expect(getByTestId("value").textContent).toBe("30")
    })

    test("selector reset through writable selector", () => {
        const myAtom = atom({ key: uniqueKey(), default: 0 })
        const mySelector = selector({
            key: uniqueKey(),
            get: ({ get }) => get(myAtom),
            set: ({ set, reset }, newValue) => {
                if (newValue instanceof Object && "type" in newValue) {
                    reset(myAtom)
                } else {
                    set(myAtom, newValue)
                }
            },
        })

        let setValue: any
        let resetValue: any
        function Component() {
            const value = useRecoilValue(mySelector)
            const [, sv] = useRecoilState(mySelector as any)
            resetValue = useResetRecoilState(myAtom)
            setValue = sv
            return <div data-testid="value">{value}</div>
        }

        const { getByTestId } = render(
            <RecoilRoot>
                <Component />
            </RecoilRoot>,
        )
        expect(getByTestId("value").textContent).toBe("0")
        act(() => setValue(42))
        expect(getByTestId("value").textContent).toBe("42")
        act(() => resetValue())
        expect(getByTestId("value").textContent).toBe("0")
    })

    test("selector value updates when dependency changes", () => {
        const myAtom = atom({ key: uniqueKey(), default: "hello" })
        const mySelector = selector({
            key: uniqueKey(),
            get: ({ get }) => get(myAtom).toUpperCase(),
        })

        let setValue: any
        function Component() {
            const derived = useRecoilValue(mySelector)
            const [, sv] = useRecoilState(myAtom)
            setValue = sv
            return <div data-testid="value">{derived}</div>
        }

        const { getByTestId } = render(
            <RecoilRoot>
                <Component />
            </RecoilRoot>,
        )
        expect(getByTestId("value").textContent).toBe("HELLO")
        act(() => setValue("world"))
        expect(getByTestId("value").textContent).toBe("WORLD")
    })

    test("selector is only evaluated when dependencies change", () => {
        let evalCount = 0
        const myAtom = atom({ key: uniqueKey(), default: 0 })
        const mySelector = selector({
            key: uniqueKey(),
            get: ({ get }) => {
                evalCount++
                return get(myAtom) * 2
            },
        })

        let setValue: any
        function Component() {
            const derived = useRecoilValue(mySelector)
            const [, sv] = useRecoilState(myAtom)
            setValue = sv
            return <div data-testid="value">{derived}</div>
        }

        const { getByTestId } = render(
            <RecoilRoot>
                <Component />
            </RecoilRoot>,
        )

        const initialEvals = evalCount
        expect(getByTestId("value").textContent).toBe("0")

        act(() => setValue(5))
        expect(getByTestId("value").textContent).toBe("10")
        expect(evalCount).toBe(initialEvals + 1)
    })
})
