import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { store } from "valdres"
import { screenPermissionAtom } from "../atoms/screenPermissionAtom"
import { subscribe } from "./subscribe"

type FakeStatus = EventTarget & { state: PermissionState }

const makeStatus = (state: PermissionState = "granted"): FakeStatus => {
    const status = new EventTarget() as FakeStatus
    status.state = state
    return status
}

const installPermissions = (status: FakeStatus) =>
    Object.defineProperty(navigator, "permissions", {
        value: { query: async () => status },
        configurable: true,
    })

describe("subscribe", () => {
    let originalPermissions: typeof navigator.permissions | undefined

    beforeEach(() => {
        originalPermissions = navigator.permissions
    })

    afterEach(() => {
        screenPermissionAtom.resetSelf()
        if (originalPermissions) {
            Object.defineProperty(navigator, "permissions", {
                value: originalPermissions,
                configurable: true,
            })
        }
    })

    test("hydrates atom with the queried permission state", async () => {
        installPermissions(makeStatus("granted"))
        const s = store()
        subscribe()
        // Let the query microtask settle.
        await Promise.resolve()
        expect(s.get(screenPermissionAtom)).toBe("granted")
    })

    test("updates atom when permission status changes", async () => {
        const status = makeStatus("prompt")
        installPermissions(status)
        const s = store()
        subscribe()
        await Promise.resolve()
        expect(s.get(screenPermissionAtom)).toBe("prompt")

        status.state = "denied"
        status.dispatchEvent(new Event("change"))
        expect(s.get(screenPermissionAtom)).toBe("denied")
    })

    test("cleanup prevents a pending query from attaching its listener", async () => {
        const status = makeStatus("granted")
        let attached = false
        const origAdd = status.addEventListener.bind(status)
        status.addEventListener = ((
            type: string,
            cb: EventListenerOrEventListenerObject,
        ) => {
            attached = true
            origAdd(type, cb)
        }) as EventTarget["addEventListener"]
        installPermissions(status)
        const cleanup = subscribe()
        cleanup?.()
        await Promise.resolve()
        expect(attached).toBe(false)
    })

    test("cleanup removes the status change listener", async () => {
        const status = makeStatus("granted")
        installPermissions(status)
        const s = store()
        const cleanup = subscribe()
        await Promise.resolve()
        expect(s.get(screenPermissionAtom)).toBe("granted")

        cleanup?.()
        status.state = "denied"
        status.dispatchEvent(new Event("change"))
        expect(s.get(screenPermissionAtom)).toBe("granted")
    })
})
