import { afterEach, describe, expect, test } from "bun:test"
import { store } from "valdres"
import { flush } from "../../test/setup/deviceHarness"
import { installGeolocation } from "../../test/setup/geolocationFixtures"
import { permissionSource } from "../lib/permissionSource"
import { watchGeolocation } from "../utils/watchGeolocation"
import { permissionAtom } from "./permissionAtom"

let page: ReturnType<typeof installGeolocation> | undefined
const install = () => (page = installGeolocation())
afterEach(() => {
    page?.restore()
    page = undefined
})

describe("permissionAtom", () => {
    test("reports unsupported without a Permissions API", () => {
        install()
        const app = store()
        expect(app.get(permissionAtom)).toBe("unsupported")
        app.dispose()
    })

    test("a dormant read reports prompt and never queries", () => {
        const harness = install()
        const permissions = harness.installPermissions()
        const app = store()
        expect(app.get(permissionAtom)).toBe("prompt")
        expect(permissions.queries).toEqual([])
        app.dispose()
    })

    test("subscribing queries once and follows change events, without prompting", async () => {
        const harness = install()
        const permissions = harness.installPermissions()
        permissions.set("geolocation", "granted")
        const first = store()
        const second = store()
        const seen: string[] = []
        const stops = [
            first.sub(permissionAtom, () => seen.push(first.get(permissionAtom))),
            second.sub(permissionAtom, () => {}),
            first.scope().sub(permissionAtom, () => {}),
        ]
        await flush()
        expect(permissions.queries).toEqual(["geolocation"])
        expect(first.get(permissionAtom)).toBe("granted")
        permissions.statuses.get("geolocation")!.change("denied")
        expect(second.get(permissionAtom)).toBe("denied")
        expect(seen).toEqual(["granted", "denied"])
        expect(harness.geolocation.watches).toEqual([])
        for (const stop of stops) stop()
        expect(permissions.changeListeners()).toBe(0)
        // The last answer is kept; the next subscription re-queries.
        expect(first.get(permissionAtom)).toBe("denied")
        first.dispose()
        second.dispose()
    })

    test("re-subscribing keeps the last answer, so a churning consumer cannot loop", async () => {
        const harness = install()
        const permissions = harness.installPermissions()
        permissions.set("geolocation", "granted")
        const app = store()
        const first = app.sub(permissionAtom, () => {})
        await flush()
        first()
        // A consumer that re-subscribes on every update, like
        // useSyncExternalStore with an inline subscribe function.
        let notified = 0
        let stop = () => {}
        const resubscribe = () => {
            stop()
            stop = app.sub(permissionAtom, () => {
                notified++
                resubscribe()
            })
        }
        resubscribe()
        expect(app.get(permissionAtom)).toBe("granted")
        await flush()
        expect(notified).toBe(0)
        expect(permissions.queries.length).toBe(2)
        stop()
        app.dispose()
    })

    test("a query answered after the last release is ignored", async () => {
        const harness = install()
        const permissions = harness.installPermissions()
        permissions.hold = true
        permissions.set("geolocation", "denied")
        const app = store()
        app.sub(permissionAtom, () => {})()
        permissions.release()
        await flush()
        expect(permissions.changeListeners()).toBe(0)
        expect(app.get(permissionAtom)).toBe("prompt")
        app.dispose()
    })

    test("a rejected query reports unsupported while subscribed", async () => {
        const harness = install()
        const permissions = harness.installPermissions()
        permissions.unknown.add("geolocation")
        const app = store()
        const stop = app.sub(permissionAtom, () => {})
        await flush()
        expect(app.get(permissionAtom)).toBe("unsupported")
        stop()
        app.dispose()
    })

    test("disposing a store releases its query listener", async () => {
        const harness = install()
        const permissions = harness.installPermissions()
        const app = store()
        app.sub(permissionAtom, () => {})
        await flush()
        expect(permissions.changeListeners()).toBe(1)
        app.dispose()
        expect(permissions.changeListeners()).toBe(0)
    })

    test("follows the permission a watch's prompt produced", async () => {
        const harness = install()
        const permissions = harness.installPermissions()
        const app = store()
        app.sub(permissionAtom, () => {})
        await flush()
        expect(app.get(permissionAtom)).toBe("prompt")
        const stop = watchGeolocation(app)
        permissions.statuses.get("geolocation")!.change("granted")
        expect(app.get(permissionAtom)).toBe("granted")
        stop()
        app.dispose()
    })

    test("unsupported and insecure hosts report unsupported", () => {
        const harness = install()
        harness.installPermissions()
        const app = store()
        harness.setSecure(false)
        expect(app.get(permissionAtom)).toBe("unsupported")
        app.dispose()
    })

    test("the server snapshot is a fixed prompt seed", () => {
        expect(permissionSource.getServerSnapshot?.()).toBe("prompt")
    })
})
