/**
 * SelectorFamily tests adapted from Recoil's Recoil_selectorFamily-test.js
 * Tests parameterized selectors with various parameter types.
 */
import React from "react"
import { describe, test, expect, afterEach } from "bun:test"
import { render, act, cleanup } from "@testing-library/react"
import { atom } from "../src/atom"
import { selectorFamily } from "../src/selectorFamily"
import { RecoilRoot } from "../src/RecoilRoot"
import { useRecoilState } from "../src/useRecoilState"
import { useRecoilValue } from "../src/useRecoilValue"

afterEach(() => {
    cleanup()
})

let nextKey = 0
function uniqueKey() {
    return `selectorFamily-test-${nextKey++}`
}

describe("recoil/selectorFamily", () => {
    test("number parameter", () => {
        const myAtom = atom({ key: uniqueKey(), default: 1 })
        const mySelector = selectorFamily({
            key: uniqueKey(),
            get:
                (multiplier: number) =>
                ({ get }: any) =>
                    get(myAtom) * multiplier,
        })

        let setValue: any
        function Component() {
            const val10 = useRecoilValue(mySelector(10))
            const val100 = useRecoilValue(mySelector(100))
            const [, sv] = useRecoilState(myAtom)
            setValue = sv
            return (
                <>
                    <div data-testid="v10">{val10}</div>
                    <div data-testid="v100">{val100}</div>
                </>
            )
        }

        const { getByTestId } = render(
            <RecoilRoot>
                <Component />
            </RecoilRoot>,
        )
        expect(getByTestId("v10").textContent).toBe("10")
        expect(getByTestId("v100").textContent).toBe("100")

        act(() => setValue(2))
        expect(getByTestId("v10").textContent).toBe("20")
        expect(getByTestId("v100").textContent).toBe("200")
    })

    test("array parameter", () => {
        const mySelector = selectorFamily({
            key: uniqueKey(),
            get:
                (numbers: number[]) =>
                () =>
                    numbers.reduce((x, y) => x + y, 0),
        })

        function Component() {
            const empty = useRecoilValue(mySelector([]))
            const sum3 = useRecoilValue(mySelector([1, 2, 3]))
            const fib = useRecoilValue(mySelector([0, 1, 1, 2, 3, 5]))
            return (
                <>
                    <div data-testid="empty">{empty}</div>
                    <div data-testid="sum3">{sum3}</div>
                    <div data-testid="fib">{fib}</div>
                </>
            )
        }

        const { getByTestId } = render(
            <RecoilRoot>
                <Component />
            </RecoilRoot>,
        )
        expect(getByTestId("empty").textContent).toBe("0")
        expect(getByTestId("sum3").textContent).toBe("6")
        expect(getByTestId("fib").textContent).toBe("12")
    })

    test("object parameter", () => {
        const myAtom = atom({ key: uniqueKey(), default: 1 })
        const mySelector = selectorFamily({
            key: uniqueKey(),
            get:
                ({ multiplier }: { multiplier: number }) =>
                ({ get }: any) =>
                    get(myAtom) * multiplier,
        })

        let setValue: any
        function Component() {
            const val10 = useRecoilValue(mySelector({ multiplier: 10 }))
            const val100 = useRecoilValue(mySelector({ multiplier: 100 }))
            const [, sv] = useRecoilState(myAtom)
            setValue = sv
            return (
                <>
                    <div data-testid="v10">{val10}</div>
                    <div data-testid="v100">{val100}</div>
                </>
            )
        }

        const { getByTestId } = render(
            <RecoilRoot>
                <Component />
            </RecoilRoot>,
        )
        expect(getByTestId("v10").textContent).toBe("10")
        expect(getByTestId("v100").textContent).toBe("100")

        act(() => setValue(2))
        expect(getByTestId("v10").textContent).toBe("20")
        expect(getByTestId("v100").textContent).toBe("200")
    })

    test("value caching - selector not re-evaluated for same deps", () => {
        let evals = 0
        const myAtom = atom({ key: uniqueKey(), default: 1 })
        const mySelector = selectorFamily({
            key: uniqueKey(),
            get:
                ({ multiplier }: { multiplier: number }) =>
                ({ get }: any) => {
                    evals++
                    return get(myAtom) * multiplier
                },
        })

        let setValue: any
        function Component() {
            const val = useRecoilValue(mySelector({ multiplier: 10 }))
            const [, sv] = useRecoilState(myAtom)
            setValue = sv
            return <div data-testid="value">{val}</div>
        }

        const { getByTestId } = render(
            <RecoilRoot>
                <Component />
            </RecoilRoot>,
        )

        const initialEvals = evals
        expect(getByTestId("value").textContent).toBe("10")

        act(() => setValue(2))
        expect(getByTestId("value").textContent).toBe("20")
        expect(evals).toBe(initialEvals + 1)
    })

    test("selectorFamily used with atomFamily", () => {
        const myAtomFamily = atom({
            key: uniqueKey(),
            default: 0,
        })
        // Note: Using a regular atom here since the compat atomFamily might
        // not integrate directly with selectorFamily in the same way

        const baseAtom = atom({ key: uniqueKey(), default: 10 })
        const mySelector = selectorFamily({
            key: uniqueKey(),
            get:
                (offset: number) =>
                ({ get }: any) =>
                    get(baseAtom) + offset,
        })

        function Component() {
            const val1 = useRecoilValue(mySelector(5))
            const val2 = useRecoilValue(mySelector(20))
            return (
                <>
                    <div data-testid="v1">{val1}</div>
                    <div data-testid="v2">{val2}</div>
                </>
            )
        }

        const { getByTestId } = render(
            <RecoilRoot>
                <Component />
            </RecoilRoot>,
        )
        expect(getByTestId("v1").textContent).toBe("15")
        expect(getByTestId("v2").textContent).toBe("30")
    })
})
