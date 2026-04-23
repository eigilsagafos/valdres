import { describe, test, expect, afterEach } from "bun:test"
import { store } from "valdres"
import { bootstrap } from "./bootstrap"
import { onlineAtom } from "../atoms/onlineAtom"

type Listener = (event?: Event) => void

const makeFakeWindow = () => {
    const listeners: Record<string, Listener[]> = {}
    return {
        listeners,
        addEventListener: (type: string, cb: Listener) => {
            listeners[type] = [...(listeners[type] ?? []), cb]
        },
        removeEventListener: (type: string, cb: Listener) => {
            listeners[type] = (listeners[type] ?? []).filter(l => l !== cb)
        },
        dispatch: (type: string) => {
            for (const cb of listeners[type] ?? []) cb()
        },
    }
}

const installFakeEnv = (onLine: boolean) => {
    const fakeWindow = makeFakeWindow()
    ;(globalThis as any).window = fakeWindow
    ;(globalThis as any).navigator = { onLine }
    return fakeWindow
}

const removeFakeEnv = () => {
    delete (globalThis as any).window
    delete (globalThis as any).navigator
}

describe("bootstrap", () => {
    afterEach(removeFakeEnv)

    test("returns undefined when window is undefined", () => {
        removeFakeEnv()
        expect(bootstrap()).toBeUndefined()
    })

    test("syncs initial value from navigator.onLine on bootstrap", () => {
        installFakeEnv(false)
        const s = store()
        const cleanup = bootstrap()
        expect(s.get(onlineAtom)).toBe(false)
        cleanup?.()
    })

    test("updates atom when online/offline events fire", () => {
        const fakeWindow = installFakeEnv(true)
        const s = store()
        const cleanup = bootstrap()

        expect(s.get(onlineAtom)).toBe(true)

        ;(globalThis as any).navigator.onLine = false
        fakeWindow.dispatch("offline")
        expect(s.get(onlineAtom)).toBe(false)

        ;(globalThis as any).navigator.onLine = true
        fakeWindow.dispatch("online")
        expect(s.get(onlineAtom)).toBe(true)

        cleanup?.()
    })

    test("cleanup removes listeners", () => {
        const fakeWindow = installFakeEnv(true)
        const cleanup = bootstrap()
        expect(fakeWindow.listeners.online?.length).toBe(1)
        expect(fakeWindow.listeners.offline?.length).toBe(1)
        cleanup?.()
        expect(fakeWindow.listeners.online?.length).toBe(0)
        expect(fakeWindow.listeners.offline?.length).toBe(0)
    })
})
