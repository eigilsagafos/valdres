import { afterEach, describe, expect, test } from "bun:test"
import { store } from "valdres"
import { flush } from "../../test/setup/deviceHarness"
import { installScreenDetails, type ScreenHarness } from "../../test/setup/screenFixtures"
import { screenPermissionSource } from "../lib/screenPermissionSource"
import { requestScreenDetails } from "../utils/requestScreenDetails"
import { screenPermissionAtom } from "./screenPermissionAtom"

let page: ScreenHarness | undefined
const install = () => (page = installScreenDetails())
afterEach(() => {
    page?.restore()
    page = undefined
})

describe("screenPermissionAtom", () => {
    test("reports prompt and never queries on a dormant read", () => {
        const harness = install()
        const permissions = harness.installPermissions()
        const app = store()
        expect(app.get(screenPermissionAtom)).toBe("prompt")
        expect(permissions.queries).toEqual([])
        app.dispose()
    })

    test("subscribing queries and follows change events without prompting", async () => {
        const harness = install()
        const permissions = harness.installPermissions()
        permissions.set("window-management", "granted")
        const app = store()
        const stop = app.sub(screenPermissionAtom, () => {})
        await flush()
        expect(app.get(screenPermissionAtom)).toBe("granted")
        permissions.statuses.get("window-management")!.change("prompt")
        expect(app.get(screenPermissionAtom)).toBe("prompt")
        expect(harness.calls).toEqual([])
        stop()
        expect(permissions.changeListeners()).toBe(0)
        app.dispose()
    })

    test("falls back to the pre-111 window-placement name", async () => {
        const harness = install()
        const permissions = harness.installPermissions()
        permissions.unknown.add("window-management")
        permissions.set("window-placement", "denied")
        const app = store()
        const stop = app.sub(screenPermissionAtom, () => {})
        await flush()
        expect(permissions.queries).toEqual(["window-management", "window-placement"])
        expect(app.get(screenPermissionAtom)).toBe("denied")
        stop()
        app.dispose()
    })

    test("a query that started before a request cannot undo its answer", async () => {
        const harness = install()
        const permissions = harness.installPermissions()
        permissions.hold = true
        permissions.set("window-management", "prompt")
        const app = store()
        const stop = app.sub(screenPermissionAtom, () => {})
        const answer = requestScreenDetails()
        harness.grant()
        await answer
        expect(app.get(screenPermissionAtom)).toBe("granted")
        permissions.release()
        await flush()
        expect(app.get(screenPermissionAtom)).toBe("granted")
        stop()
        app.dispose()
    })

    test("re-subscribing keeps the last answer while the new query is in flight", async () => {
        const harness = install()
        const permissions = harness.installPermissions()
        permissions.set("window-management", "granted")
        const app = store()
        const first = app.sub(screenPermissionAtom, () => {})
        await flush()
        first()
        permissions.hold = true
        const seen: string[] = []
        const stop = app.sub(screenPermissionAtom, () => seen.push(app.get(screenPermissionAtom)))
        expect(app.get(screenPermissionAtom)).toBe("granted")
        permissions.release()
        await flush()
        expect(seen).toEqual([])
        stop()
        app.dispose()
    })

    test("a query answered after the last release is ignored", async () => {
        const harness = install()
        const permissions = harness.installPermissions()
        permissions.hold = true
        permissions.set("window-management", "denied")
        const app = store()
        app.sub(screenPermissionAtom, () => {})()
        permissions.release()
        await flush()
        expect(permissions.changeListeners()).toBe(0)
        expect(app.get(screenPermissionAtom)).toBe("prompt")
        app.dispose()
    })

    test("a query answered after its store was disposed is ignored and attaches nothing", async () => {
        const harness = install()
        const permissions = harness.installPermissions()
        permissions.hold = true
        permissions.set("window-management", "denied")
        const app = store()
        app.sub(screenPermissionAtom, () => {})
        app.dispose()
        permissions.release()
        await flush()
        expect(permissions.changeListeners()).toBe(0)
        const next = store()
        expect(next.get(screenPermissionAtom)).toBe("prompt")
        next.dispose()
    })

    test("after a restart, the replaced query's late answer cannot overwrite the new one", async () => {
        const harness = install()
        const permissions = harness.installPermissions()
        permissions.freshStatuses = true
        permissions.hold = true
        permissions.set("window-management", "denied")
        const app = store()
        app.sub(screenPermissionAtom, () => {})()
        permissions.set("window-management", "granted")
        const stop = app.sub(screenPermissionAtom, () => {})
        permissions.releaseNewestFirst()
        await flush()
        expect(app.get(screenPermissionAtom)).toBe("granted")
        expect(permissions.issued.map(status => [status.state, status.listeners])).toEqual([
            ["granted", 1],
            ["denied", 0],
        ])
        stop()
        app.dispose()
    })

    test("a change made while nothing listened is corrected by the next subscription", async () => {
        const harness = install()
        const permissions = harness.installPermissions()
        permissions.freshStatuses = true
        permissions.set("window-management", "granted")
        const app = store()
        const first = app.sub(screenPermissionAtom, () => {})
        await flush()
        first()
        permissions.set("window-management", "denied")
        expect(app.get(screenPermissionAtom)).toBe("granted")
        const seen: string[] = []
        const stop = app.sub(screenPermissionAtom, () => seen.push(app.get(screenPermissionAtom)))
        await flush()
        expect(seen).toEqual(["denied"])
        stop()
        app.dispose()
    })

    test("the server snapshot is a fixed prompt seed", () => {
        expect(screenPermissionSource.getServerSnapshot?.()).toBe("prompt")
    })
})
