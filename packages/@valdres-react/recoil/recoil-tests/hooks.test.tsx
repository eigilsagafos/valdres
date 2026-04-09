/**
 * Hook tests adapted from Recoil's Recoil_PublicHooks-test.js
 * Tests useRecoilState, useRecoilValue, useSetRecoilState, useResetRecoilState.
 */
import React, { Profiler, useState } from "react"
import { describe, test, expect, afterEach, mock } from "bun:test"
import { render, act, cleanup } from "@testing-library/react"
import { atom } from "../src/atom"
import { selector } from "../src/selector"
import { selectorFamily } from "../src/selectorFamily"
import { RecoilRoot } from "../src/RecoilRoot"
import { useRecoilState } from "../src/useRecoilState"
import { useRecoilValue } from "../src/useRecoilValue"
import { useSetRecoilState } from "../src/useSetRecoilState"
import { useResetRecoilState } from "../src/useResetRecoilState"
import { renderElements } from "./helpers"

afterEach(() => {
    cleanup()
})

let nextKey = 0
function uniqueKey() {
    return `hooks-test-${nextKey++}`
}

describe("recoil/hooks", () => {
    test("Components are re-rendered when atoms change", () => {
        const anAtom = atom({ key: uniqueKey(), default: 0 })

        let setValue: any
        function Component() {
            const [value, sv] = useRecoilState(anAtom)
            setValue = sv
            return <>{value}</>
        }

        const container = renderElements(<Component />)
        expect(container.textContent).toBe("0")
        act(() => setValue(1))
        expect(container.textContent).toBe("1")
    })

    test("Can set an atom during rendering", () => {
        const anAtom = atom({ key: uniqueKey(), default: 0 })

        function Component() {
            const [value, setValue] = useRecoilState(anAtom)
            if (value === 0) {
                setValue(1)
            }
            return <>{value}</>
        }

        const container = renderElements(<Component />)
        expect(container.textContent).toBe("1")
    })

    test("Does not re-create setter function after setting a value", () => {
        const anAtom = atom({ key: uniqueKey(), default: 0 })
        const setters: any[] = []

        function Component() {
            const [, setValue] = useRecoilState(anAtom)
            setters.push(setValue)
            return null
        }

        render(
            <RecoilRoot>
                <Component />
            </RecoilRoot>,
        )

        act(() => setters[setters.length - 1](1))

        // All setters should be the same reference
        for (let i = 1; i < setters.length; i++) {
            expect(setters[i]).toBe(setters[0])
        }
    })

    describe("Render counts", () => {
        test("Write-only components are not subscribed", () => {
            const anAtom = atom({ key: uniqueKey(), default: 0 })
            let renderCount = 0

            function WriteComponent() {
                useSetRecoilState(anAtom)
                renderCount++
                return null
            }

            let setValue: any
            function SetterComponent() {
                const [, sv] = useRecoilState(anAtom)
                setValue = sv
                return null
            }

            render(
                <RecoilRoot>
                    <WriteComponent />
                    <SetterComponent />
                </RecoilRoot>,
            )

            const initialRenders = renderCount
            act(() => setValue(1))
            // WriteComponent should not re-render when atom changes
            expect(renderCount).toBe(initialRenders)
        })

        test("Component subscribed to atom is rendered when atom changes", () => {
            const anAtom = atom({ key: uniqueKey(), default: 0 })
            let renderCount = 0

            function ReadComponent() {
                useRecoilValue(anAtom)
                renderCount++
                return null
            }

            let setValue: any
            function SetterComponent() {
                setValue = useSetRecoilState(anAtom)
                return null
            }

            render(
                <RecoilRoot>
                    <ReadComponent />
                    <SetterComponent />
                </RecoilRoot>,
            )

            const initialRenders = renderCount
            act(() => setValue(1))
            expect(renderCount).toBeGreaterThan(initialRenders)
        })

        test("Component that depends on atom in multiple ways is rendered just once per change", () => {
            const anAtom = atom({ key: uniqueKey(), default: 0 })
            const derivedSelector = selector({
                key: uniqueKey(),
                get: ({ get }) => get(anAtom) + 1,
            })

            let commitCount = 0
            function Component() {
                const atomVal = useRecoilValue(anAtom)
                const selectorVal = useRecoilValue(derivedSelector)
                return (
                    <Profiler
                        id="test"
                        onRender={() => {
                            commitCount++
                        }}
                    >
                        {`${atomVal},${selectorVal}`}
                    </Profiler>
                )
            }

            let setValue: any
            function Setter() {
                setValue = useSetRecoilState(anAtom)
                return null
            }

            const container = renderElements(
                <>
                    <Component />
                    <Setter />
                </>,
            )

            expect(container.textContent).toBe("0,1")
            commitCount = 0
            act(() => setValue(1))
            expect(container.textContent).toBe("1,2")
            expect(commitCount).toBe(1)
        })
    })

    describe("Component Subscriptions", () => {
        test("Atom values are retained when atom has no subscribers", () => {
            const anAtom = atom({ key: uniqueKey(), default: 0 })

            let setValue: any
            let showReader: any
            function App() {
                const [show, setShow] = useState(false)
                showReader = setShow
                return (
                    <>
                        <Writer />
                        {show && <Reader />}
                    </>
                )
            }

            function Writer() {
                setValue = useSetRecoilState(anAtom)
                return null
            }

            function Reader() {
                const val = useRecoilValue(anAtom)
                return <div data-testid="value">{val}</div>
            }

            const { getByTestId, queryByTestId } = render(
                <RecoilRoot>
                    <App />
                </RecoilRoot>,
            )

            // Set value while no reader is subscribed
            act(() => setValue(42))
            expect(queryByTestId("value")).toBeNull()

            // Show reader - it should see the retained value
            act(() => showReader(true))
            expect(getByTestId("value").textContent).toBe("42")
        })

        test("Components unsubscribe from atoms when rendered without using them", () => {
            const atomA = atom({ key: uniqueKey(), default: "A" })
            const atomB = atom({ key: uniqueKey(), default: "B" })

            let renderCount = 0
            let useWhichAtom: any

            function Component() {
                const [which, setWhich] = useState<"a" | "b">("a")
                useWhichAtom = setWhich
                const val = useRecoilValue(which === "a" ? atomA : atomB)
                renderCount++
                return <>{val}</>
            }

            let setA: any
            function Setter() {
                setA = useSetRecoilState(atomA)
                return null
            }

            const container = renderElements(
                <>
                    <Component />
                    <Setter />
                </>,
            )
            expect(container.textContent).toBe("A")

            // Switch to atomB
            act(() => useWhichAtom("b"))
            expect(container.textContent).toBe("B")

            const prevRenderCount = renderCount
            // Changing atomA should not cause re-render since we unsubscribed
            act(() => setA("A2"))
            expect(renderCount).toBe(prevRenderCount)
        })
    })

    describe("useRecoilValue", () => {
        test("returns current atom value", () => {
            const anAtom = atom({ key: uniqueKey(), default: "hello" })

            function Component() {
                const val = useRecoilValue(anAtom)
                return <div data-testid="value">{val}</div>
            }

            const { getByTestId } = render(
                <RecoilRoot>
                    <Component />
                </RecoilRoot>,
            )
            expect(getByTestId("value").textContent).toBe("hello")
        })

        test("returns selector value", () => {
            const anAtom = atom({ key: uniqueKey(), default: 5 })
            const mySelector = selector({
                key: uniqueKey(),
                get: ({ get }) => get(anAtom) * 2,
            })

            function Component() {
                const val = useRecoilValue(mySelector)
                return <div data-testid="value">{val}</div>
            }

            const { getByTestId } = render(
                <RecoilRoot>
                    <Component />
                </RecoilRoot>,
            )
            expect(getByTestId("value").textContent).toBe("10")
        })
    })

    describe("useSetRecoilState", () => {
        test("sets atom value without subscribing", () => {
            const anAtom = atom({ key: uniqueKey(), default: 0 })

            let renderCount = 0
            let setValue: any
            function WriterComponent() {
                setValue = useSetRecoilState(anAtom)
                renderCount++
                return null
            }

            function ReaderComponent() {
                const val = useRecoilValue(anAtom)
                return <div data-testid="value">{val}</div>
            }

            const { getByTestId } = render(
                <RecoilRoot>
                    <WriterComponent />
                    <ReaderComponent />
                </RecoilRoot>,
            )

            const initialRenders = renderCount
            act(() => setValue(42))
            expect(getByTestId("value").textContent).toBe("42")
            expect(renderCount).toBe(initialRenders)
        })

        test("supports updater function", () => {
            const anAtom = atom({ key: uniqueKey(), default: 0 })

            let setValue: any
            function Component() {
                const val = useRecoilValue(anAtom)
                setValue = useSetRecoilState(anAtom)
                return <div data-testid="value">{val}</div>
            }

            const { getByTestId } = render(
                <RecoilRoot>
                    <Component />
                </RecoilRoot>,
            )

            act(() => setValue((prev: number) => prev + 10))
            expect(getByTestId("value").textContent).toBe("10")
            act(() => setValue((prev: number) => prev + 5))
            expect(getByTestId("value").textContent).toBe("15")
        })
    })

    describe("useResetRecoilState", () => {
        test("resets atom to default value", () => {
            const anAtom = atom({ key: uniqueKey(), default: "DEFAULT" })

            let setValue: any
            let resetValue: any
            function Component() {
                const val = useRecoilValue(anAtom)
                setValue = useSetRecoilState(anAtom)
                resetValue = useResetRecoilState(anAtom)
                return <div data-testid="value">{val}</div>
            }

            const { getByTestId } = render(
                <RecoilRoot>
                    <Component />
                </RecoilRoot>,
            )

            expect(getByTestId("value").textContent).toBe("DEFAULT")
            act(() => setValue("CHANGED"))
            expect(getByTestId("value").textContent).toBe("CHANGED")
            act(() => resetValue())
            expect(getByTestId("value").textContent).toBe("DEFAULT")
        })

        test("resets atom family member to default", () => {
            const { atomFamily } = require("../src/atomFamily")
            const myFamily = atomFamily({
                key: uniqueKey(),
                default: "DEFAULT",
            })

            let setValue: any
            let resetValue: any
            function Component() {
                const [val, sv] = useRecoilState(myFamily("param1"))
                resetValue = useResetRecoilState(myFamily("param1"))
                setValue = sv
                return <div data-testid="value">{val}</div>
            }

            const { getByTestId } = render(
                <RecoilRoot>
                    <Component />
                </RecoilRoot>,
            )

            expect(getByTestId("value").textContent).toBe("DEFAULT")
            act(() => setValue("CHANGED"))
            expect(getByTestId("value").textContent).toBe("CHANGED")
            act(() => resetValue())
            expect(getByTestId("value").textContent).toBe("DEFAULT")
        })
    })
})
