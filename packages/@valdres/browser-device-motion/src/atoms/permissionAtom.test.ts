import { afterEach, describe, expect, test } from "bun:test"
import { store } from "valdres"
import { flush, type DeviceHarness } from "../../test/setup/deviceHarness"
import { installMotion } from "../../test/setup/motionFixtures"
import { permissionSource } from "../lib/permissionSource"
import { permissionAtom } from "./permissionAtom"

let harness: DeviceHarness | undefined
afterEach(() => {
    harness?.restore()
    harness = undefined
})
const iosRequest = () => Promise.resolve("granted" as PermissionState)

describe("permissionAtom", () => {
    test("reports prompt where requestPermission exists and nothing is known", () => {
        harness = installMotion(iosRequest)
        const app = store()
        expect(app.get(permissionAtom)).toBe("prompt")
        app.dispose()
    })

    test("reports granted where the browser delivers events without asking", () => {
        harness = installMotion()
        const app = store()
        expect(app.get(permissionAtom)).toBe("granted")
        app.dispose()
    })

    test("reports unsupported without the API and in insecure contexts", () => {
        harness = installMotion()
        const app = store()
        harness.setSecure(false)
        expect(app.get(permissionAtom)).toBe("unsupported")
        harness.setSecure(undefined)
        harness.setGlobal("DeviceMotionEvent", undefined)
        expect(app.get(permissionAtom)).toBe("unsupported")
        app.dispose()
    })

    test("subscribing follows the Permissions API answer and its change events", async () => {
        harness = installMotion(iosRequest)
        const permissions = harness.installPermissions()
        permissions.set("accelerometer", "granted")
        permissions.set("gyroscope", "granted")
        const app = store()
        const seen: string[] = []
        const stop = app.sub(permissionAtom, () => seen.push(app.get(permissionAtom)))
        expect(app.get(permissionAtom)).toBe("prompt")
        await flush()
        expect(app.get(permissionAtom)).toBe("granted")
        expect(permissions.changeListeners()).toBe(2)

        permissions.statuses.get("gyroscope")!.change("denied")
        expect(app.get(permissionAtom)).toBe("denied")
        expect(seen).toEqual(["granted", "denied"])

        stop()
        expect(permissions.changeListeners()).toBe(0)
        // The last answer is kept; the next subscription re-queries.
        expect(app.get(permissionAtom)).toBe("denied")
        app.dispose()
    })

    test("re-subscribing keeps the last answer while the new query is in flight", async () => {
        harness = installMotion(iosRequest)
        const permissions = harness.installPermissions()
        permissions.set("accelerometer", "granted")
        permissions.set("gyroscope", "granted")
        const app = store()
        const first = app.sub(permissionAtom, () => {})
        await flush()
        first()
        permissions.hold = true
        const seen: string[] = []
        for (let round = 0; round < 3; round++)
            app.sub(permissionAtom, () => seen.push(app.get(permissionAtom)))()
        const stop = app.sub(permissionAtom, () => seen.push(app.get(permissionAtom)))
        expect(app.get(permissionAtom)).toBe("granted")
        permissions.release()
        await flush()
        // Same answer again: nothing to publish, so a consumer that
        // re-subscribes on every update cannot loop.
        expect(seen).toEqual([])
        expect(permissions.changeListeners()).toBe(2)
        stop()
        app.dispose()
    })

    test("a dormant read never queries", () => {
        harness = installMotion(iosRequest)
        const permissions = harness.installPermissions()
        const app = store()
        app.get(permissionAtom)
        expect(permissions.queries).toEqual([])
        app.dispose()
    })

    test("a query answered after the last release is ignored and attaches nothing", async () => {
        harness = installMotion(iosRequest)
        const permissions = harness.installPermissions()
        permissions.hold = true
        permissions.set("accelerometer", "denied")
        permissions.set("gyroscope", "denied")
        const app = store()
        const stop = app.sub(permissionAtom, () => {})
        stop()
        permissions.release()
        await flush()
        expect(permissions.changeListeners()).toBe(0)
        expect(app.get(permissionAtom)).toBe("prompt")
        app.dispose()
    })

    test("engines that do not know the names keep the requestPermission answer", async () => {
        harness = installMotion(iosRequest)
        const permissions = harness.installPermissions()
        permissions.unknown.add("accelerometer")
        const app = store()
        const stop = app.sub(permissionAtom, () => {})
        await flush()
        expect(app.get(permissionAtom)).toBe("prompt")
        stop()
        app.dispose()
    })

    test("independent stores and scopes share one query and both observe changes", async () => {
        harness = installMotion(iosRequest)
        const permissions = harness.installPermissions()
        const first = store()
        const second = store()
        const stops = [
            first.sub(permissionAtom, () => {}),
            second.sub(permissionAtom, () => {}),
            first.scope().sub(permissionAtom, () => {}),
        ]
        await flush()
        expect(permissions.queries).toEqual(["accelerometer", "gyroscope"])
        permissions.statuses.get("accelerometer")!.change("granted")
        permissions.statuses.get("gyroscope")!.change("granted")
        expect([first.get(permissionAtom), second.get(permissionAtom)]).toEqual([
            "granted",
            "granted",
        ])
        for (const stop of stops) stop()
        expect(permissions.changeListeners()).toBe(0)
        first.dispose()
        second.dispose()
    })

    test("the server snapshot is a fixed prompt seed", () => {
        expect(permissionSource.getServerSnapshot?.()).toBe("prompt")
    })
})
