import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { store } from "valdres"
import { currentScreenAtom } from "../atoms/currentScreenAtom"
import { screenPermissionAtom } from "../atoms/screenPermissionAtom"
import { screensAtom } from "../atoms/screensAtom"
import { detailsState } from "../lib/detailsState"
import { requestScreenDetails } from "./requestScreenDetails"

const installReject = (err: unknown) => {
    ;(window as unknown as { getScreenDetails: () => Promise<unknown> }).getScreenDetails =
        async () => {
            throw err
        }
}

type FakeScreen = EventTarget & Record<string, unknown>

const makeScreen = (overrides: Record<string, unknown> = {}): FakeScreen => {
    const screen = new EventTarget() as FakeScreen
    Object.assign(screen, {
        label: "Primary",
        left: 0,
        top: 0,
        width: 1920,
        height: 1080,
        availLeft: 0,
        availTop: 0,
        availWidth: 1920,
        availHeight: 1080,
        colorDepth: 24,
        pixelDepth: 24,
        devicePixelRatio: 1,
        orientation: { type: "landscape-primary", angle: 0 },
        isPrimary: true,
        isInternal: true,
        ...overrides,
    })
    return screen
}

const makeDetails = () => {
    const target = new EventTarget() as EventTarget & {
        screens: FakeScreen[]
        currentScreen: FakeScreen
    }
    target.screens = [makeScreen()]
    target.currentScreen = target.screens[0]
    return target
}

const install = (details: ReturnType<typeof makeDetails>) => {
    ;(window as unknown as { getScreenDetails: () => Promise<unknown> }).getScreenDetails =
        async () => details
}

const uninstall = () => {
    delete (window as unknown as { getScreenDetails?: unknown }).getScreenDetails
}

describe("requestScreenDetails", () => {
    let originalPermissions: typeof navigator.permissions | undefined

    beforeEach(() => {
        originalPermissions = navigator.permissions
        // Avoid the subscribe()'s async permissions query racing with
        // setSelf calls under test.
        Object.defineProperty(navigator, "permissions", {
            value: undefined,
            configurable: true,
        })
    })

    afterEach(() => {
        detailsState.request = null
        uninstall()
        screensAtom.resetSelf()
        currentScreenAtom.resetSelf()
        screenPermissionAtom.resetSelf()
        if (originalPermissions) {
            Object.defineProperty(navigator, "permissions", {
                value: originalPermissions,
                configurable: true,
            })
        }
    })

    test("returns null when the API is unavailable", async () => {
        const result = await requestScreenDetails()
        expect(result).toBe(null)
    })

    test("populates atoms and updates on screenschange", async () => {
        const details = makeDetails()
        install(details)

        const s = store()
        await requestScreenDetails()

        expect(s.get(screensAtom).length).toBe(1)
        expect(s.get(currentScreenAtom)?.label).toBe("Primary")

        const second = makeScreen({
            label: "External",
            left: 1920,
            isPrimary: false,
        })
        details.screens = [details.screens[0], second]
        details.dispatchEvent(new Event("screenschange"))

        expect(s.get(screensAtom).length).toBe(2)
        expect(s.get(screensAtom)[1].label).toBe("External")
    })

    test("updates only the current screen on currentscreenchange", async () => {
        const details = makeDetails()
        const second = makeScreen({ label: "External", left: 1920 })
        details.screens = [details.screens[0], second]
        install(details)

        const s = store()
        await requestScreenDetails()

        details.currentScreen = second
        details.dispatchEvent(new Event("currentscreenchange"))

        expect(s.get(currentScreenAtom)?.label).toBe("External")
    })

    test("re-syncs atoms when a screen's own change event fires", async () => {
        const details = makeDetails()
        install(details)

        const s = store()
        await requestScreenDetails()

        const screen = details.screens[0]
        screen.left = 500
        screen.dispatchEvent(new Event("change"))

        expect(s.get(screensAtom)[0].left).toBe(500)
        expect(s.get(currentScreenAtom)?.left).toBe(500)
    })

    test("rebinds change listeners after screenschange", async () => {
        const details = makeDetails()
        install(details)

        const s = store()
        await requestScreenDetails()

        const external = makeScreen({ label: "External", left: 1920 })
        details.screens = [details.screens[0], external]
        details.dispatchEvent(new Event("screenschange"))

        expect(s.get(screensAtom).length).toBe(2)

        external.width = 2560
        external.dispatchEvent(new Event("change"))

        expect(s.get(screensAtom)[1].width).toBe(2560)
    })

    test("sets permission to 'denied' on NotAllowedError", async () => {
        installReject(new DOMException("denied", "NotAllowedError"))

        const s = store()
        screenPermissionAtom.setSelf("prompt")

        await expect(requestScreenDetails()).rejects.toThrow()
        expect(s.get(screenPermissionAtom)).toBe("denied")
    })

    test("leaves permission untouched on non-permission errors", async () => {
        installReject(new Error("network blip"))

        const s = store()
        screenPermissionAtom.setSelf("prompt")

        await expect(requestScreenDetails()).rejects.toThrow()
        expect(s.get(screenPermissionAtom)).toBe("prompt")
    })
})
