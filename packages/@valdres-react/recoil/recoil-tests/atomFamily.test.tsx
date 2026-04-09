/**
 * AtomFamily tests adapted from Recoil's Recoil_atomFamily-test.js
 * Tests parameterized atoms with various default types and parameter shapes.
 */
import React from "react"
import { describe, test, expect, afterEach } from "bun:test"
import { render, act, cleanup } from "@testing-library/react"
import { atom } from "../src/atom"
import { atomFamily } from "../src/atomFamily"
import { selectorFamily } from "../src/selectorFamily"
import { RecoilRoot } from "../src/RecoilRoot"
import { useRecoilState } from "../src/useRecoilState"
import { useRecoilValue } from "../src/useRecoilValue"
import { renderElements, ReadsAtom } from "./helpers"

afterEach(() => {
    cleanup()
})

let nextKey = 0
function uniqueKey() {
    return `atomFamily-test-${nextKey++}`
}

describe("recoil/atomFamily", () => {
    test("read fallback by default", () => {
        const pAtom = atomFamily({
            key: uniqueKey(),
            default: "fallback",
        })

        function Component() {
            const value = useRecoilValue(pAtom({ k: "x" }))
            return <div data-testid="value">{value}</div>
        }

        const { getByTestId } = render(
            <RecoilRoot>
                <Component />
            </RecoilRoot>,
        )
        expect(getByTestId("value").textContent).toBe("fallback")
    })

    test("uses value for parameter", () => {
        const pAtom = atomFamily({
            key: uniqueKey(),
            default: "fallback",
        })

        let setX: any
        let setY: any
        function Component() {
            const [xVal, sX] = useRecoilState(pAtom({ k: "x" }))
            const [yVal, sY] = useRecoilState(pAtom({ k: "y" }))
            const zVal = useRecoilValue(pAtom({ k: "z" }))
            setX = sX
            setY = sY
            return (
                <>
                    <div data-testid="x">{xVal}</div>
                    <div data-testid="y">{yVal}</div>
                    <div data-testid="z">{zVal}</div>
                </>
            )
        }

        const { getByTestId } = render(
            <RecoilRoot>
                <Component />
            </RecoilRoot>,
        )

        act(() => setX("xValue"))
        act(() => setY("yValue"))

        expect(getByTestId("x").textContent).toBe("xValue")
        expect(getByTestId("y").textContent).toBe("yValue")
        expect(getByTestId("z").textContent).toBe("fallback")
    })

    test("works with non-overlapping sets", () => {
        const pAtom = atomFamily({
            key: uniqueKey(),
            default: "fallback",
        })

        let setX: any
        let setY: any
        function Component() {
            const [xVal, sX] = useRecoilState(pAtom({ x: "x" }))
            const [yVal, sY] = useRecoilState(pAtom({ y: "y" }))
            setX = sX
            setY = sY
            return (
                <>
                    <div data-testid="x">{xVal}</div>
                    <div data-testid="y">{yVal}</div>
                </>
            )
        }

        const { getByTestId } = render(
            <RecoilRoot>
                <Component />
            </RecoilRoot>,
        )

        act(() => setX("xValue"))
        act(() => setY("yValue"))

        expect(getByTestId("x").textContent).toBe("xValue")
        expect(getByTestId("y").textContent).toBe("yValue")
    })

    test("independent atom subscriptions", () => {
        const pAtom = atomFamily({
            key: uniqueKey(),
            default: "default",
        })

        let renderCountA = 0
        let renderCountB = 0
        let setA: any

        function ComponentA() {
            const [val, sv] = useRecoilState(pAtom("a"))
            setA = sv
            renderCountA++
            return <div data-testid="a">{val}</div>
        }

        function ComponentB() {
            const val = useRecoilValue(pAtom("b"))
            renderCountB++
            return <div data-testid="b">{val}</div>
        }

        const { getByTestId } = render(
            <RecoilRoot>
                <ComponentA />
                <ComponentB />
            </RecoilRoot>,
        )

        const initialB = renderCountB
        act(() => setA("newA"))
        expect(getByTestId("a").textContent).toBe("newA")
        expect(getByTestId("b").textContent).toBe("default")
        // ComponentB should not have re-rendered
        expect(renderCountB).toBe(initialB)
    })

    describe("Default", () => {
        test("works with parameterized default (callback)", () => {
            const paramDefaultAtom = atomFamily({
                key: uniqueKey(),
                default: (param: { num: number }) => param.num,
            })

            function Component() {
                const val1 = useRecoilValue(paramDefaultAtom({ num: 1 }))
                const val2 = useRecoilValue(paramDefaultAtom({ num: 2 }))
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
            expect(getByTestId("v1").textContent).toBe("1")
            expect(getByTestId("v2").textContent).toBe("2")
        })

        test("parameterized default can be overwritten", () => {
            const paramDefaultAtom = atomFamily({
                key: uniqueKey(),
                default: (param: { num: number }) => param.num,
            })

            let setValue: any
            function Component() {
                const [val1, sv] = useRecoilState(
                    paramDefaultAtom({ num: 1 }),
                )
                const val2 = useRecoilValue(paramDefaultAtom({ num: 2 }))
                setValue = sv
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
            expect(getByTestId("v1").textContent).toBe("1")
            act(() => setValue(99))
            expect(getByTestId("v1").textContent).toBe("99")
            // Other params unaffected
            expect(getByTestId("v2").textContent).toBe("2")
        })
    })
})
