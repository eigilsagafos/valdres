/**
 * useRecoilCallback tests adapted from Recoil's Recoil_useRecoilCallback-test.js
 * Tests callback interface: reading, setting, resetting state, and snapshots.
 */
import React from "react"
import { describe, test, expect, afterEach } from "bun:test"
import { render, act, cleanup } from "@testing-library/react"
import { atom } from "../src/atom"
import { selector } from "../src/selector"
import { RecoilRoot } from "../src/RecoilRoot"
import { useRecoilCallback } from "../src/useRecoilCallback"
import { useRecoilValue } from "../src/useRecoilValue"
import { useSetRecoilState } from "../src/useSetRecoilState"
import { renderElements, ReadsAtom } from "./helpers"

afterEach(() => {
    cleanup()
})

let nextKey = 0
function uniqueKey() {
    return `callback-test-${nextKey++}`
}

describe("recoil/useRecoilCallback", () => {
    test("reads Recoil values via snapshot", () => {
        const anAtom = atom({ key: uniqueKey(), default: "DEFAULT" })
        let cb: any

        function Component() {
            cb = useRecoilCallback(({ snapshot }) => () => {
                return snapshot.getLoadable(anAtom).contents
            })
            return null
        }

        render(
            <RecoilRoot>
                <Component />
            </RecoilRoot>,
        )

        let result: any
        act(() => {
            result = cb()
        })
        expect(result).toBe("DEFAULT")
    })

    test("sets Recoil values", () => {
        const anAtom = atom({ key: uniqueKey(), default: "DEFAULT" })
        let cb: any

        function Component() {
            cb = useRecoilCallback(({ set }) => (value: string) => {
                set(anAtom, value)
            })
            return null
        }

        const container = renderElements(
            <>
                <Component />
                <ReadsAtom atom={anAtom} />
            </>,
        )
        expect(container.textContent).toBe('"DEFAULT"')
        act(() => cb("NEW_VALUE"))
        expect(container.textContent).toBe('"NEW_VALUE"')
    })

    test("resets Recoil values", () => {
        const anAtom = atom({ key: uniqueKey(), default: "DEFAULT" })
        let setCB: any
        let resetCB: any

        function Component() {
            setCB = useRecoilCallback(({ set }) => (value: string) => {
                set(anAtom, value)
            })
            resetCB = useRecoilCallback(({ reset }) => () => {
                reset(anAtom)
            })
            return null
        }

        const container = renderElements(
            <>
                <Component />
                <ReadsAtom atom={anAtom} />
            </>,
        )
        expect(container.textContent).toBe('"DEFAULT"')
        act(() => setCB("CHANGED"))
        expect(container.textContent).toBe('"CHANGED"')
        act(() => resetCB())
        expect(container.textContent).toBe('"DEFAULT"')
    })

    test("snapshot reads current state at callback call time", () => {
        const anAtom = atom({ key: uniqueKey(), default: 0 })
        let cb: any
        let setValue: any

        function Component() {
            setValue = useSetRecoilState(anAtom)
            cb = useRecoilCallback(({ snapshot }) => () => {
                return snapshot.getLoadable(anAtom).contents
            })
            return null
        }

        render(
            <RecoilRoot>
                <Component />
            </RecoilRoot>,
        )

        let result: any
        act(() => {
            result = cb()
        })
        expect(result).toBe(0)

        act(() => setValue(42))

        act(() => {
            result = cb()
        })
        expect(result).toBe(42)
    })

    test("setter updater sees latest state", () => {
        const anAtom = atom({ key: uniqueKey(), default: 0 })
        let cb: any

        function Component() {
            cb = useRecoilCallback(({ set }) => () => {
                set(anAtom, (prev: number) => prev + 1)
            })
            return null
        }

        function Reader() {
            const val = useRecoilValue(anAtom)
            return <div data-testid="value">{val}</div>
        }

        const { getByTestId } = render(
            <RecoilRoot>
                <Component />
                <Reader />
            </RecoilRoot>,
        )

        expect(getByTestId("value").textContent).toBe("0")
        act(() => cb())
        expect(getByTestId("value").textContent).toBe("1")
        act(() => cb())
        expect(getByTestId("value").textContent).toBe("2")
    })

    test("callback function is consistent across renders", () => {
        const anAtom = atom({ key: uniqueKey(), default: 0 })
        const callbacks: any[] = []

        function Component() {
            const cb = useRecoilCallback(({ set }) => () => {
                set(anAtom, (prev: number) => prev + 1)
            })
            callbacks.push(cb)
            useRecoilValue(anAtom) // subscribe to trigger rerenders
            return null
        }

        render(
            <RecoilRoot>
                <Component />
            </RecoilRoot>,
        )

        act(() => callbacks[0]())

        // Callback reference should remain stable
        for (let i = 1; i < callbacks.length; i++) {
            expect(callbacks[i]).toBe(callbacks[0])
        }
    })

    test("set and read multiple atoms in one callback", () => {
        const atomA = atom({ key: uniqueKey(), default: "A" })
        const atomB = atom({ key: uniqueKey(), default: "B" })
        let cb: any

        function Component() {
            cb = useRecoilCallback(({ set, snapshot }) => () => {
                const a = snapshot.getLoadable(atomA).contents
                const b = snapshot.getLoadable(atomB).contents
                set(atomA, `${a}_modified`)
                set(atomB, `${b}_modified`)
                return `${a}+${b}`
            })
            return null
        }

        function Reader() {
            const a = useRecoilValue(atomA)
            const b = useRecoilValue(atomB)
            return (
                <div data-testid="value">
                    {a},{b}
                </div>
            )
        }

        const { getByTestId } = render(
            <RecoilRoot>
                <Component />
                <Reader />
            </RecoilRoot>,
        )

        expect(getByTestId("value").textContent).toBe("A,B")

        let result: any
        act(() => {
            result = cb()
        })
        expect(result).toBe("A+B")
        expect(getByTestId("value").textContent).toBe("A_modified,B_modified")
    })
})
