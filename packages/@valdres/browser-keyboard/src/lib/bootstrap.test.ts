import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { store } from "valdres"
import { bootstrap } from "./bootstrap"
import { eventHandler } from "./eventHandler"
import { toggleKeyAtom } from "../atoms/toggleKeyAtom"
import { locksState } from "./locksState"

const makeFakeTarget = () => ({
    addEventListener: () => {},
    removeEventListener: () => {},
})

const installFakeDom = () => {
    ;(globalThis as any).document = makeFakeTarget()
    ;(globalThis as any).window = makeFakeTarget()
}

const removeFakeDom = () => {
    delete (globalThis as any).document
    delete (globalThis as any).window
}

describe("bootstrap", () => {
    afterEach(removeFakeDom)

    test("returns undefined when document is undefined", () => {
        removeFakeDom()
        expect(bootstrap()).toBeUndefined()
    })

    test("does not throw when window is undefined but document exists", () => {
        ;(globalThis as any).document = makeFakeTarget()
        const cleanup = bootstrap()
        expect(cleanup).toBeDefined()
        cleanup?.()
    })

    test("cleanup resets toggle key state and initialized flag", () => {
        installFakeDom()
        const s = store()
        const cleanup = bootstrap()

        eventHandler({
            type: "keydown",
            code: "KeyA",
            key: "a",
            target: null,
            keyCode: 0,
            isComposing: false,
            timeStamp: 0,
            getModifierState: () => true,
        } as unknown as KeyboardEvent)

        expect(s.get(toggleKeyAtom("CapsLock"))).toBe(true)
        expect(locksState.initialized).toBe(true)

        cleanup?.()

        expect(s.get(toggleKeyAtom("CapsLock"))).toBe(null)
        expect(locksState.initialized).toBe(false)
    })
})
