import { afterEach, describe, expect, test } from "bun:test"
import { store } from "valdres"
import { captureReports, flush, type DeviceHarness } from "../../test/setup/deviceHarness"
import { FakeDeviceOrientationEvent, installOrientation, orientationEvent } from "../../test/setup/orientationFixtures"
import { orientationAtom } from "../selectors/orientationAtom"
import { permissionSource } from "../lib/permissionSource"
import { permissionAtom } from "./permissionAtom"
import { requestOrientationPermission } from "../utils/requestOrientationPermission"

let harness: DeviceHarness | undefined
afterEach(() => {
    harness?.restore()
    harness = undefined
})
const iosRequest = () => Promise.resolve("granted" as PermissionState)

describe("permissionAtom", () => {
    test("reports prompt where requestPermission exists and nothing is known", () => {
        harness = installOrientation(iosRequest)
        const app = store()
        expect(app.get(permissionAtom)).toBe("prompt")
        app.dispose()
    })

    test("reports granted where the browser delivers events without asking", () => {
        harness = installOrientation()
        const app = store()
        expect(app.get(permissionAtom)).toBe("granted")
        app.dispose()
    })

    test("reports unsupported without the API and in insecure contexts", () => {
        harness = installOrientation()
        const app = store()
        harness.setSecure(false)
        expect(app.get(permissionAtom)).toBe("unsupported")
        harness.setSecure(undefined)
        harness.setGlobal("DeviceOrientationEvent", undefined)
        expect(app.get(permissionAtom)).toBe("unsupported")
        app.dispose()
    })

    test("subscribing follows the Permissions API answer and its change events", async () => {
        harness = installOrientation(iosRequest)
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
        harness = installOrientation(iosRequest)
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
        harness = installOrientation(iosRequest)
        const permissions = harness.installPermissions()
        const app = store()
        app.get(permissionAtom)
        expect(permissions.queries).toEqual([])
        app.dispose()
    })

    test("a query answered after the last release is ignored and attaches nothing", async () => {
        harness = installOrientation(iosRequest)
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

    test("a query answered after its store was disposed is ignored and attaches nothing", async () => {
        harness = installOrientation(iosRequest)
        const permissions = harness.installPermissions()
        permissions.hold = true
        permissions.set("accelerometer", "denied")
        permissions.set("gyroscope", "denied")
        const app = store()
        app.sub(permissionAtom, () => {})
        app.dispose()
        permissions.release()
        await flush()
        expect(permissions.changeListeners()).toBe(0)
        const next = store()
        expect(next.get(permissionAtom)).toBe("prompt")
        next.dispose()
    })

    test("after a restart, the replaced query's late answer cannot overwrite the new one", async () => {
        harness = installOrientation(iosRequest)
        const permissions = harness.installPermissions()
        permissions.freshStatuses = true
        permissions.hold = true
        permissions.set("accelerometer", "denied")
        permissions.set("gyroscope", "denied")
        const app = store()
        app.sub(permissionAtom, () => {})()
        permissions.set("accelerometer", "granted")
        permissions.set("gyroscope", "granted")
        const stop = app.sub(permissionAtom, () => {})
        permissions.releaseNewestFirst()
        await flush()
        expect(app.get(permissionAtom)).toBe("granted")
        // Only the live query's two statuses carry listeners.
        expect(permissions.issued.map(status => [status.state, status.listeners])).toEqual([
            ["granted", 1],
            ["granted", 1],
            ["denied", 0],
            ["denied", 0],
        ])
        stop()
        app.dispose()
    })

    test("a change made while nothing listened is corrected by the next subscription", async () => {
        harness = installOrientation(iosRequest)
        const permissions = harness.installPermissions()
        permissions.freshStatuses = true
        permissions.set("accelerometer", "granted")
        permissions.set("gyroscope", "granted")
        const app = store()
        const first = app.sub(permissionAtom, () => {})
        await flush()
        first()
        permissions.set("gyroscope", "denied")
        expect(app.get(permissionAtom)).toBe("granted")
        const seen: string[] = []
        const stop = app.sub(permissionAtom, () => seen.push(app.get(permissionAtom)))
        await flush()
        expect(seen).toEqual(["denied"])
        permissions.statuses.get("gyroscope")!.change("granted")
        expect(seen).toEqual(["denied", "granted"])
        stop()
        app.dispose()
    })

    test("a subscriber that throws on a query answer is reported, not an unhandled rejection", async () => {
        harness = installOrientation(iosRequest)
        const permissions = harness.installPermissions()
        permissions.set("accelerometer", "granted")
        permissions.set("gyroscope", "granted")
        const capture = captureReports()
        try {
            const failing = store()
            const healthy = store()
            failing.sub(permissionAtom, () => {
                throw new Error("subscriber boom")
            })
            const seen: string[] = []
            healthy.sub(permissionAtom, () => seen.push(healthy.get(permissionAtom)))
            await flush()
            expect(seen).toEqual(["granted"])
            expect(capture.unhandled).toEqual([])
            expect(capture.reported).toHaveLength(1)
            expect((capture.reported[0] as Error).name).toBe("SubscriberNotificationError")
            failing.dispose()
            healthy.dispose()
        } finally {
            capture.restore()
        }
    })

    test("engines that do not know the names keep the requestPermission answer", async () => {
        harness = installOrientation(iosRequest)
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
        harness = installOrientation(iosRequest)
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

describe("a reading as evidence of access", () => {
    // Disposed even when an assertion fails, so one failure cannot leave a
    // hub attached for the tests after it.
    const stores: ReturnType<typeof store>[] = []
    const track = () => {
        const app = store()
        stores.push(app)
        return app
    }
    afterEach(() => {
        for (const app of stores.splice(0)) app.dispose()
    })

    // iOS answers motion and orientation with one permission, and Safari's
    // Permissions API does not know the sensor names: a grant obtained through
    // the other package reaches this one only as readings.
    test("a reading with values records granted for every store, once", () => {
        harness = installOrientation(iosRequest)
        const reader = track()
        const observer = track()
        reader.sub(orientationAtom, () => {})
        const seen: string[] = []
        observer.sub(permissionAtom, () => seen.push(observer.get(permissionAtom)))
        expect(observer.get(permissionAtom)).toBe("prompt")
        harness.fire(orientationEvent(1))
        harness.fire(orientationEvent(2))
        harness.fire(orientationEvent(3))
        expect(observer.get(permissionAtom)).toBe("granted")
        expect(seen).toEqual(["granted"])
        reader.dispose()
        // Kept like any other answer once nothing listens.
        expect(observer.get(permissionAtom)).toBe("granted")
        observer.dispose()
    })

    test("an all-null reading proves nothing", () => {
        harness = installOrientation(iosRequest)
        const app = track()
        app.sub(orientationAtom, () => {})
        harness.fire(new FakeDeviceOrientationEvent({}))
        expect(app.get(permissionAtom)).toBe("prompt")
        app.dispose()
    })

    // Starts from an unanswered permission the Permissions API reports, so
    // readings, change events and requests all compete for it.
    const unanswered = async () => {
        harness = installOrientation(iosRequest)
        const permissions = harness.installPermissions()
        permissions.set("accelerometer", "prompt")
        permissions.set("gyroscope", "prompt")
        const app = track()
        app.sub(orientationAtom, () => {})
        app.sub(permissionAtom, () => {})
        await flush()
        expect(app.get(permissionAtom)).toBe("prompt")
        return { app, permissions }
    }

    test("a reading never overrides a recorded denial: reading, denial, reading", async () => {
        const { app, permissions } = await unanswered()
        harness!.fire(orientationEvent(1))
        expect(app.get(permissionAtom)).toBe("granted")
        permissions.statuses.get("gyroscope")!.change("denied")
        expect(app.get(permissionAtom)).toBe("denied")
        // Evidence of access, not an answer: the recorded denial stands.
        harness!.fire(orientationEvent(2))
        harness!.fire(orientationEvent(3))
        expect(app.get(permissionAtom)).toBe("denied")
    })

    test("a denial recorded by a request is not overridden by readings either", async () => {
        harness = installOrientation(() => Promise.resolve("denied" as PermissionState))
        const app = track()
        app.sub(orientationAtom, () => {})
        await expect(requestOrientationPermission()).resolves.toBe("denied")
        harness.fire(orientationEvent(1))
        expect(app.get(permissionAtom)).toBe("denied")
    })

    test("recovery from a denial comes from a newer explicit request", async () => {
        const { app, permissions } = await unanswered()
        permissions.statuses.get("gyroscope")!.change("denied")
        harness!.fire(orientationEvent(1))
        expect(app.get(permissionAtom)).toBe("denied")
        // iosRequest answers "granted": the explicit request is newer.
        await expect(requestOrientationPermission()).resolves.toBe("granted")
        expect(app.get(permissionAtom)).toBe("granted")
        harness!.fire(orientationEvent(2))
        expect(app.get(permissionAtom)).toBe("granted")
    })

    test("recovery from a denial comes from newer change events", async () => {
        const { app, permissions } = await unanswered()
        permissions.statuses.get("gyroscope")!.change("denied")
        harness!.fire(orientationEvent(1))
        expect(app.get(permissionAtom)).toBe("denied")
        permissions.statuses.get("accelerometer")!.change("granted")
        permissions.statuses.get("gyroscope")!.change("granted")
        expect(app.get(permissionAtom)).toBe("granted")
    })

    test("a throwing permission subscriber is rethrown after every reading subscriber ran", () => {
        harness = installOrientation(iosRequest)
        const healthy = track()
        const failing = track()
        let readings = 0
        healthy.sub(orientationAtom, () => readings++)
        failing.sub(permissionAtom, () => {
            throw new Error("subscriber boom")
        })
        const reported = harness.fireReportingErrors(orientationEvent(1))
        expect(readings).toBe(1)
        expect(failing.get(permissionAtom)).toBe("granted")
        expect(reported).toHaveLength(1)
        expect((reported[0] as Error).name).toBe("SubscriberNotificationError")
        healthy.dispose()
        failing.dispose()
    })
})
