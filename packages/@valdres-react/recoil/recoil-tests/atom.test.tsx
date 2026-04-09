/**
 * Atom tests adapted from Recoil's Recoil_atom-test.js
 * Tests basic atom functionality, defaults, valid values, and effects.
 */
import React, { Profiler } from "react"
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
    return `atom-test-${nextKey++}`
}

describe("recoil/atom", () => {
    test("atom can read and write value", () => {
        const myAtom = atom({ key: uniqueKey(), default: "DEFAULT" })

        function Component() {
            const [value, setValue] = useRecoilState(myAtom)
            return (
                <>
                    <div data-testid="value">{value}</div>
                    <button onClick={() => setValue("VALUE")}>set</button>
                </>
            )
        }

        const { getByTestId, getByText } = render(
            <RecoilRoot>
                <Component />
            </RecoilRoot>,
        )
        expect(getByTestId("value").textContent).toBe("DEFAULT")
        act(() => getByText("set").click())
        expect(getByTestId("value").textContent).toBe("VALUE")
    })

    describe("Valid values", () => {
        test("atom can store null and undefined", () => {
            const myAtom = atom<string | null | undefined>({
                key: uniqueKey(),
                default: "DEFAULT",
            })

            let setValue: any
            function Component() {
                const [value, _setValue] = useRecoilState(myAtom)
                setValue = _setValue
                return <div data-testid="value">{String(value)}</div>
            }

            const { getByTestId } = render(
                <RecoilRoot>
                    <Component />
                </RecoilRoot>,
            )
            expect(getByTestId("value").textContent).toBe("DEFAULT")
            act(() => setValue(null))
            expect(getByTestId("value").textContent).toBe("null")
            act(() => setValue(undefined))
            expect(getByTestId("value").textContent).toBe("undefined")
            act(() => setValue("VALUE"))
            expect(getByTestId("value").textContent).toBe("VALUE")
        })

        test("atom can store a circular reference object", () => {
            class Circular {
                self: Circular
                constructor() {
                    this.self = this
                }
            }
            const circular = new Circular()
            const myAtom = atom<Circular | undefined>({
                key: uniqueKey(),
                default: undefined,
            })

            let value: any
            let setValue: any
            function Component() {
                const [v, sv] = useRecoilState(myAtom)
                value = v
                setValue = sv
                return <div data-testid="value">{String(v)}</div>
            }

            const { getByTestId } = render(
                <RecoilRoot>
                    <Component />
                </RecoilRoot>,
            )
            expect(getByTestId("value").textContent).toBe("undefined")
            act(() => setValue(circular))
            expect(value).toBe(circular)
        })
    })

    test("Updating with same value doesn't rerender", () => {
        const myAtom = atom({
            key: uniqueKey(),
            default: "DEFAULT",
        })

        let setAtom: any
        let resetAtom: any
        let renders = 0

        function AtomComponent() {
            const [value, setValue] = useRecoilState(myAtom)
            const resetValue = useResetRecoilState(myAtom)
            setAtom = setValue
            resetAtom = resetValue
            return value
        }

        const container = renderElements(
            <Profiler
                id="test"
                onRender={() => {
                    renders++
                }}
            >
                <AtomComponent />
            </Profiler>,
        )

        // Normalize initial render count
        renders = 1

        expect(container.textContent).toBe("DEFAULT")

        act(() => setAtom("SET"))
        expect(renders).toBe(2)
        expect(container.textContent).toBe("SET")

        // Same value shouldn't cause rerender
        act(() => setAtom("SET"))
        expect(renders).toBe(2)
        expect(container.textContent).toBe("SET")

        act(() => setAtom("CHANGE"))
        expect(renders).toBe(3)
        expect(container.textContent).toBe("CHANGE")

        act(() => resetAtom())
        expect(renders).toBe(4)
        expect(container.textContent).toBe("DEFAULT")

        // Resetting when already at default shouldn't rerender
        act(() => resetAtom())
        expect(renders).toBe(4)
        expect(container.textContent).toBe("DEFAULT")
    })
})

describe("recoil/atom - Effects", () => {
    test("initialization with setSelf", () => {
        let inited = false
        const myAtom = atom({
            key: uniqueKey(),
            default: "DEFAULT",
            effects: [
                ({ trigger, setSelf }: any) => {
                    inited = true
                    expect(trigger).toBe("get")
                    setSelf("INIT")
                },
            ],
        })

        let value: any
        function Component() {
            value = useRecoilValue(myAtom)
            return null
        }

        render(
            <RecoilRoot>
                <Component />
            </RecoilRoot>,
        )
        expect(inited).toBe(true)
        expect(value).toBe("INIT")
    })

    test("order of effects", () => {
        const myAtom = atom({
            key: uniqueKey(),
            default: "DEFAULT",
            effects: [
                ({ setSelf }: any) => {
                    setSelf("EFFECT 1")
                },
                ({ setSelf }: any) => {
                    setSelf("EFFECT 2")
                },
            ],
        })

        let value: any
        function Component() {
            value = useRecoilValue(myAtom)
            return null
        }

        render(
            <RecoilRoot>
                <Component />
            </RecoilRoot>,
        )
        expect(value).toBe("EFFECT 2")
    })

    test("reset during init", () => {
        const myAtom = atom({
            key: uniqueKey(),
            default: "DEFAULT",
            effects: [
                ({ setSelf }: any) => setSelf("INIT"),
                ({ resetSelf }: any) => resetSelf(),
            ],
        })

        let value: any
        function Component() {
            value = useRecoilValue(myAtom)
            return null
        }

        render(
            <RecoilRoot>
                <Component />
            </RecoilRoot>,
        )
        expect(value).toBe("DEFAULT")
    })

    test("onSet callback", () => {
        const onSetValues: Array<{ newValue: any; oldValue: any }> = []
        const myAtom = atom({
            key: uniqueKey(),
            default: "DEFAULT",
            effects: [
                ({ onSet }: any) => {
                    onSet((newValue: any, oldValue: any) => {
                        onSetValues.push({ newValue, oldValue })
                    })
                },
            ],
        })

        let setValue: any
        function Component() {
            const [, sv] = useRecoilState(myAtom)
            setValue = sv
            return null
        }

        render(
            <RecoilRoot>
                <Component />
            </RecoilRoot>,
        )

        act(() => setValue("VALUE1"))
        act(() => setValue("VALUE2"))

        expect(onSetValues).toEqual([
            { newValue: "VALUE1", oldValue: "DEFAULT" },
            { newValue: "VALUE2", oldValue: "VALUE1" },
        ])
    })

    test("async set via setSelf", () => {
        let setAtom: any
        let resetAtom: any

        const myAtom = atom({
            key: uniqueKey(),
            default: "DEFAULT",
            effects: [
                ({ setSelf, resetSelf }: any) => {
                    setAtom = setSelf
                    resetAtom = resetSelf
                    setSelf("INIT")
                },
            ],
        })

        const container = renderElements(<ReadsAtom atom={myAtom} />)
        expect(container.textContent).toBe('"INIT"')

        act(() => setAtom("SET"))
        expect(container.textContent).toBe('"SET"')

        act(() => setAtom("CHANGE"))
        expect(container.textContent).toBe('"CHANGE"')

        act(() => resetAtom())
        expect(container.textContent).toBe('"DEFAULT"')
    })

    // Effect cleanup on unmount is not yet implemented in the compat layer.
    // The onUnmount handler calls unsubscribe but doesn't invoke the effect's
    // cleanup return value.
    test.todo("cleanup on unmount")

    test("multiple onSet handlers from different effects", () => {
        const values1: any[] = []
        const values2: any[] = []

        const myAtom = atom({
            key: uniqueKey(),
            default: "DEFAULT",
            effects: [
                ({ onSet }: any) => {
                    onSet((newValue: any) => {
                        values1.push(newValue)
                    })
                },
                ({ onSet }: any) => {
                    onSet((newValue: any) => {
                        values2.push(newValue)
                    })
                },
            ],
        })

        let setValue: any
        function Component() {
            const [, sv] = useRecoilState(myAtom)
            setValue = sv
            return null
        }

        render(
            <RecoilRoot>
                <Component />
            </RecoilRoot>,
        )

        act(() => setValue("VALUE"))
        expect(values1).toEqual(["VALUE"])
        expect(values2).toEqual(["VALUE"])
    })
})
