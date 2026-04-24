import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { store } from "valdres"
import { permissionAtom } from "./permissionAtom"

type ChangeListener = () => void

type FakePermissionStatus = {
    state: PermissionState
    addEventListener: (type: "change", listener: ChangeListener) => void
    removeEventListener: (type: "change", listener: ChangeListener) => void
    _listeners: Set<ChangeListener>
    _setState: (next: PermissionState) => void
}

const makeStatus = (initial: PermissionState): FakePermissionStatus => {
    const status: FakePermissionStatus = {
        state: initial,
        _listeners: new Set(),
        addEventListener: (_type, listener) => {
            status._listeners.add(listener)
        },
        removeEventListener: (_type, listener) => {
            status._listeners.delete(listener)
        },
        _setState: next => {
            status.state = next
            for (const fn of status._listeners) fn()
        },
    }
    return status
}

const originalPermissions = navigator.permissions

const setPermissions = (value: unknown) => {
    Object.defineProperty(navigator, "permissions", {
        value,
        configurable: true,
    })
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0))

describe("permissionAtom", () => {
    beforeEach(() => {
        permissionAtom.resetSelf()
    })

    afterEach(() => {
        setPermissions(originalPermissions)
        permissionAtom.resetSelf()
    })

    test("marks permission unsupported when Permissions API is missing", () => {
        setPermissions(undefined)
        const s = store()
        s.get(permissionAtom)
        expect(s.get(permissionAtom)).toBe("unsupported")
    })

    test("resolves to the current state after query resolves", async () => {
        const status = makeStatus("granted")
        setPermissions({
            query: () => Promise.resolve(status),
        })
        const s = store()
        s.get(permissionAtom)
        await flush()
        expect(s.get(permissionAtom)).toBe("granted")
    })

    test("updates when the underlying PermissionStatus changes", async () => {
        const status = makeStatus("prompt")
        setPermissions({
            query: () => Promise.resolve(status),
        })
        const s = store()
        s.get(permissionAtom)
        await flush()
        expect(s.get(permissionAtom)).toBe("prompt")

        status._setState("granted")
        expect(s.get(permissionAtom)).toBe("granted")

        status._setState("denied")
        expect(s.get(permissionAtom)).toBe("denied")
    })

    test("falls back to unsupported when query rejects", async () => {
        setPermissions({
            query: () => Promise.reject(new Error("nope")),
        })
        const s = store()
        s.get(permissionAtom)
        await flush()
        expect(s.get(permissionAtom)).toBe("unsupported")
    })
})
