/**
 * RecoilRoot tests adapted from Recoil's Recoil_RecoilRoot-test.js
 * Tests initializeState, store isolation, and selector mutations.
 */
import React from "react"
import { describe, test, expect, afterEach } from "bun:test"
import { render, act, cleanup } from "@testing-library/react"
import { atom } from "../src/atom"
import { selector } from "../src/selector"
import { RecoilRoot } from "../src/RecoilRoot"
import { useRecoilState } from "../src/useRecoilState"
import { useRecoilValue } from "../src/useRecoilValue"
import { useSetRecoilState } from "../src/useSetRecoilState"

afterEach(() => {
    cleanup()
})

let nextKey = 0
function uniqueKey() {
    return `root-test-${nextKey++}`
}

describe("recoil/RecoilRoot", () => {
    describe("initializeState", () => {
        test("initialize atom", () => {
            const myAtom = atom({ key: uniqueKey(), default: "DEFAULT" })

            function Component() {
                const val = useRecoilValue(myAtom)
                return <div data-testid="value">{val}</div>
            }

            const { getByTestId } = render(
                <RecoilRoot
                    initializeState={({ set }) => {
                        set(myAtom as any, "INITIALIZED")
                    }}
                >
                    <Component />
                </RecoilRoot>,
            )

            expect(getByTestId("value").textContent).toBe("INITIALIZED")
        })

        test("initialize multiple atoms", () => {
            const atomA = atom({ key: uniqueKey(), default: "A" })
            const atomB = atom({ key: uniqueKey(), default: "B" })

            function Component() {
                const a = useRecoilValue(atomA)
                const b = useRecoilValue(atomB)
                return (
                    <div data-testid="value">
                        {a},{b}
                    </div>
                )
            }

            const { getByTestId } = render(
                <RecoilRoot
                    initializeState={({ set }) => {
                        set(atomA as any, "INIT_A")
                        set(atomB as any, "INIT_B")
                    }}
                >
                    <Component />
                </RecoilRoot>,
            )

            expect(getByTestId("value").textContent).toBe("INIT_A,INIT_B")
        })

        test("initialized atoms can be updated", () => {
            const myAtom = atom({ key: uniqueKey(), default: "DEFAULT" })

            let setValue: any
            function Component() {
                const [val, sv] = useRecoilState(myAtom)
                setValue = sv
                return <div data-testid="value">{val}</div>
            }

            const { getByTestId } = render(
                <RecoilRoot
                    initializeState={({ set }) => {
                        set(myAtom as any, "INITIALIZED")
                    }}
                >
                    <Component />
                </RecoilRoot>,
            )

            expect(getByTestId("value").textContent).toBe("INITIALIZED")
            act(() => setValue("UPDATED"))
            expect(getByTestId("value").textContent).toBe("UPDATED")
        })
    })

    test("selector can be written through set function", () => {
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
            const selectorVal = useRecoilValue(mySelector)
            const atomVal = useRecoilValue(myAtom)
            setValue = useSetRecoilState(mySelector as any)
            return (
                <div data-testid="value">
                    {selectorVal},{atomVal}
                </div>
            )
        }

        const { getByTestId } = render(
            <RecoilRoot>
                <Component />
            </RecoilRoot>,
        )

        expect(getByTestId("value").textContent).toBe("0,0")
        act(() => setValue(10))
        expect(getByTestId("value").textContent).toBe("10,5")
    })

    test("separate RecoilRoots have independent state", () => {
        const myAtom = atom({ key: uniqueKey(), default: "DEFAULT" })

        let setValue1: any
        function Component1() {
            const [val, sv] = useRecoilState(myAtom)
            setValue1 = sv
            return <div data-testid="value1">{val}</div>
        }

        function Component2() {
            const val = useRecoilValue(myAtom)
            return <div data-testid="value2">{val}</div>
        }

        const { getByTestId } = render(
            <>
                <RecoilRoot>
                    <Component1 />
                </RecoilRoot>
                <RecoilRoot>
                    <Component2 />
                </RecoilRoot>
            </>,
        )

        expect(getByTestId("value1").textContent).toBe("DEFAULT")
        expect(getByTestId("value2").textContent).toBe("DEFAULT")

        act(() => setValue1("CHANGED"))
        expect(getByTestId("value1").textContent).toBe("CHANGED")
        expect(getByTestId("value2").textContent).toBe("DEFAULT")
    })
})
