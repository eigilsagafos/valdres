import { afterEach, describe, expect, test } from "bun:test"
import { store } from "valdres"
import {
    captureReports,
    flush,
    installDeviceHarness,
    scriptedRequest,
    type DeviceHarness,
    type ScriptedRequest,
} from "../../test/setup/deviceHarness"
import { installOrientation } from "../../test/setup/orientationFixtures"
import { permissionAtom } from "../atoms/permissionAtom"
import { requestOrientationPermission } from "./requestOrientationPermission"

let harness: DeviceHarness | undefined
afterEach(() => {
    harness?.restore()
    harness = undefined
})

/** A DeviceOrientationEvent whose requestPermission follows the spec's activation rule. */
const installScripted = (): [DeviceHarness, ScriptedRequest] => {
    // The script reads activation from the harness it is given; the motion
    // fixture installs its own, so build the script against a proxy that
    // forwards to whichever harness ends up installed.
    let page: DeviceHarness | undefined
    const script = scriptedRequest({
        hasActivation: () => page!.hasActivation(),
    } as DeviceHarness)
    page = installOrientation(script.fn)
    harness = page
    return [page, script]
}

describe("requestOrientationPermission", () => {
    test("calls requestPermission synchronously inside the user gesture", async () => {
        const [page, script] = installScripted()
        const app = store()
        const answer = page.withActivation(() => requestOrientationPermission())
        expect(script.calls).toEqual([{ activated: true }])
        script.pending[0]!.resolve("granted")
        await expect(answer).resolves.toBe("granted")
        expect(app.get(permissionAtom)).toBe("granted")
        app.dispose()
    })

    test("without a user gesture it resolves the unchanged value and records nothing", async () => {
        const [page, script] = installScripted()
        const app = store()
        await expect(requestOrientationPermission()).resolves.toBe("prompt")
        expect(script.calls).toEqual([{ activated: false }])
        expect(app.get(permissionAtom)).toBe("prompt")

        // A later gesture can still ask.
        const retry = page.withActivation(() => requestOrientationPermission())
        script.pending[0]!.resolve("granted")
        await expect(retry).resolves.toBe("granted")
        app.dispose()
    })

    test("a denial is recorded for every store and notifies retained ones", async () => {
        const [page, script] = installScripted()
        const first = store()
        const second = store()
        const seen: string[] = []
        const stop = first.sub(permissionAtom, () => seen.push(first.get(permissionAtom)))
        const answer = page.withActivation(() => requestOrientationPermission())
        script.pending[0]!.resolve("denied")
        await expect(answer).resolves.toBe("denied")
        expect(seen).toEqual(["denied"])
        expect(second.get(permissionAtom)).toBe("denied")
        stop()
        // A request's answer outlives the subscription: it is page truth.
        expect(first.get(permissionAtom)).toBe("denied")
        first.dispose()
        second.dispose()
    })

    test("recovers from a denial when a later request is granted", async () => {
        const [page, script] = installScripted()
        const app = store()
        const denied = page.withActivation(() => requestOrientationPermission())
        script.pending[0]!.resolve("denied")
        await denied
        script.state = "denied"
        const granted = page.withActivation(() => requestOrientationPermission())
        script.pending[1]!.resolve("granted")
        await expect(granted).resolves.toBe("granted")
        expect(app.get(permissionAtom)).toBe("granted")
        app.dispose()
    })

    test("concurrent calls share one native request", async () => {
        const [page, script] = installScripted()
        const first = page.withActivation(() => requestOrientationPermission())
        const second = page.withActivation(() => requestOrientationPermission())
        expect(script.calls).toHaveLength(1)
        expect(second).toBe(first)
        script.pending[0]!.resolve("granted")
        await expect(second).resolves.toBe("granted")
    })

    test("a Permissions API answer that started before the request cannot undo it", async () => {
        const [page, script] = installScripted()
        const permissions = page.installPermissions()
        permissions.hold = true
        permissions.set("accelerometer", "prompt")
        permissions.set("gyroscope", "prompt")
        const app = store()
        const stop = app.sub(permissionAtom, () => {})
        const answer = page.withActivation(() => requestOrientationPermission())
        script.pending[0]!.resolve("granted")
        await answer
        expect(app.get(permissionAtom)).toBe("granted")
        // The stale query lands now.
        permissions.release()
        await flush()
        expect(app.get(permissionAtom)).toBe("granted")
        // A change event is newer than the request: it wins.
        permissions.statuses.get("gyroscope")!.change("denied")
        expect(app.get(permissionAtom)).toBe("denied")
        stop()
        app.dispose()
    })

    test("an answer that lands after every store was disposed is still recorded page truth", async () => {
        const [page, script] = installScripted()
        const app = store()
        app.sub(permissionAtom, () => {})
        const answer = page.withActivation(() => requestOrientationPermission())
        app.dispose()
        script.pending[0]!.resolve("granted")
        await expect(answer).resolves.toBe("granted")
        const next = store()
        expect(next.get(permissionAtom)).toBe("granted")
        next.dispose()
    })

    test("a request answer that started before a newer change event cannot undo it", async () => {
        const [page, script] = installScripted()
        const permissions = page.installPermissions()
        const app = store()
        const stop = app.sub(permissionAtom, () => {})
        await flush()
        const answer = page.withActivation(() => requestOrientationPermission())
        // The user changes the setting while the prompt is still open.
        permissions.statuses.get("gyroscope")!.change("denied")
        expect(app.get(permissionAtom)).toBe("denied")
        script.pending[0]!.resolve("granted")
        await expect(answer).resolves.toBe("granted")
        // The request began earlier than the change event, so the event stands.
        expect(app.get(permissionAtom)).toBe("denied")
        stop()
        app.dispose()
    })

    test("a throwing subscriber is reported; the request still resolves and records the browser's answer", async () => {
        const [page, script] = installScripted()
        const capture = captureReports()
        try {
            const failing = store()
            const healthy = store()
            failing.sub(permissionAtom, () => {
                throw new Error("subscriber boom")
            })
            const seen: string[] = []
            healthy.sub(permissionAtom, () => seen.push(healthy.get(permissionAtom)))
            const answer = page.withActivation(() => requestOrientationPermission())
            script.pending[0]!.resolve("granted")
            await expect(answer).resolves.toBe("granted")
            await flush()
            // The native outcome is the promise's; the subscriber failure is
            // reported once, after every store was notified, and retried never.
            expect(seen).toEqual(["granted"])
            expect(failing.get(permissionAtom)).toBe("granted")
            expect(script.calls).toHaveLength(1)
            expect(capture.unhandled).toEqual([])
            expect(capture.reported).toHaveLength(1)
            expect((capture.reported[0] as Error).name).toBe("SubscriberNotificationError")
            expect(((capture.reported[0] as { cause: Error }).cause).message).toBe("subscriber boom")
            failing.dispose()
            healthy.dispose()
        } finally {
            capture.restore()
        }
    })

    test("without globalThis.reportError the failure is thrown in a later task, not swallowed", async () => {
        const [page, script] = installScripted()
        const own = Object.getOwnPropertyDescriptor(globalThis, "reportError")
        delete (globalThis as { reportError?: unknown }).reportError
        const timers: (() => void)[] = []
        const realSetTimeout = globalThis.setTimeout
        globalThis.setTimeout = ((callback: () => void) => {
            timers.push(callback)
            return 0
        }) as unknown as typeof setTimeout
        try {
            const app = store()
            app.sub(permissionAtom, () => {
                throw new Error("subscriber boom")
            })
            const answer = page.withActivation(() => requestOrientationPermission())
            script.pending[0]!.resolve("denied")
            await expect(answer).resolves.toBe("denied")
            expect(timers).toHaveLength(1)
            expect(() => timers[0]!()).toThrow("One or more Store subscribers threw")
            app.dispose()
        } finally {
            globalThis.setTimeout = realSetTimeout
            if (own !== undefined) Object.defineProperty(globalThis, "reportError", own)
        }
    })

    test("a synchronous throw from requestPermission resolves the unchanged value", async () => {
        harness = installOrientation(() => {
            throw new Error("host failure")
        })
        await expect(requestOrientationPermission()).resolves.toBe("prompt")
    })

    test("a non-answer from requestPermission changes nothing", async () => {
        harness = installOrientation(() => Promise.resolve("prompt" as PermissionState))
        await expect(requestOrientationPermission()).resolves.toBe("prompt")
        const app = store()
        expect(app.get(permissionAtom)).toBe("prompt")
        app.dispose()
    })

    test("browsers without requestPermission resolve the current value without asking", async () => {
        harness = installOrientation()
        await expect(requestOrientationPermission()).resolves.toBe("granted")
    })

    test("unsupported and insecure contexts resolve unsupported", async () => {
        harness = installDeviceHarness()
        harness.setGlobal("DeviceOrientationEvent", undefined)
        await expect(requestOrientationPermission()).resolves.toBe("unsupported")
        harness.setGlobal("DeviceOrientationEvent", class {})
        harness.setSecure(false)
        await expect(requestOrientationPermission()).resolves.toBe("unsupported")
    })
})
