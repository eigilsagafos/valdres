import { forgetScreenDetails } from "../../src/lib/screenDetailsRecord"
import { deferred, installDeviceHarness, type DeviceHarness, type Deferred } from "./deviceHarness"

/** A `ScreenDetailed` stand-in that counts its `change` listeners. */
export class FakeScreen extends EventTarget {
    label = "Primary"
    left = 0
    top = 0
    width = 1920
    height = 1080
    availLeft = 0
    availTop = 0
    availWidth = 1920
    availHeight = 1080
    colorDepth = 24
    pixelDepth = 24
    devicePixelRatio = 1
    orientation = { type: "landscape-primary" as const, angle: 0 }
    isPrimary = true
    isInternal = true
    listeners = 0
    readonly #change = new Set<EventListenerOrEventListenerObject>()
    constructor(overrides: Partial<Omit<FakeScreen, keyof EventTarget>> = {}) {
        super()
        Object.assign(this, overrides)
    }
    override addEventListener(type: string, listener: EventListenerOrEventListenerObject | null) {
        if (type === "change" && listener) {
            this.listeners++
            this.#change.add(listener)
        }
        super.addEventListener(type, listener)
    }
    override removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null) {
        if (type === "change" && listener) {
            this.listeners--
            this.#change.delete(listener)
        }
        super.removeEventListener(type, listener)
    }
    change(overrides: Partial<Omit<FakeScreen, keyof EventTarget>>) {
        Object.assign(this, overrides)
        this.dispatchEvent(new Event("change"))
    }
    /**
     * Dispatch the way the DOM standard specifies — every listener in order,
     * reporting a throw and continuing — without relying on Happy-DOM's own
     * dispatch for that. Returns what threw.
     */
    changeReportingErrors(overrides: Partial<Omit<FakeScreen, keyof EventTarget>>) {
        Object.assign(this, overrides)
        const event = new Event("change")
        const reported: unknown[] = []
        for (const listener of [...this.#change]) {
            try {
                if (typeof listener === "function") listener(event)
                else listener.handleEvent(event)
            } catch (error) {
                reported.push(error)
            }
        }
        return reported
    }
}

/** A `ScreenDetails` stand-in: one per window, like the browser's. */
export class FakeScreenDetails extends EventTarget {
    screens: FakeScreen[] = [new FakeScreen()]
    currentScreen: FakeScreen = this.screens[0]!
    readonly counts = new Map<string, number>()
    override addEventListener(type: string, listener: EventListenerOrEventListenerObject | null) {
        if (listener) this.counts.set(type, (this.counts.get(type) ?? 0) + 1)
        super.addEventListener(type, listener)
    }
    override removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null) {
        if (listener) this.counts.set(type, (this.counts.get(type) ?? 0) - 1)
        super.removeEventListener(type, listener)
    }
    /** Every listener this package may hold on the details and its screens. */
    physical() {
        return (
            [...this.counts.values()].reduce((sum, n) => sum + n, 0) +
            this.screens.reduce((sum, screen) => sum + screen.listeners, 0)
        )
    }
}

export interface ScreenHarness extends DeviceHarness {
    readonly details: FakeScreenDetails
    /** Pending `getScreenDetails()` calls, oldest first. */
    readonly calls: { readonly activated: boolean; readonly answer: Deferred<FakeScreenDetails> }[]
    /** Answers the oldest pending call with access granted. */
    grant(): void
    /** Rejects the oldest pending call with a NotAllowedError. */
    deny(): void
}

export const installScreenDetails = (): ScreenHarness => {
    const harness = installDeviceHarness()
    forgetScreenDetails(window)
    harness.removePermissions()
    const details = new FakeScreenDetails()
    const calls: ScreenHarness["calls"][number][] = []
    harness.setGlobal("getScreenDetails", () => {
        const answer = deferred<FakeScreenDetails>()
        calls.push({ activated: harness.hasActivation(), answer })
        return answer.promise
    })
    const restore = harness.restore
    return {
        ...harness,
        details,
        calls,
        grant: () => calls.shift()!.answer.resolve(details),
        deny: () =>
            calls.shift()!.answer.reject(new DOMException("Permission denied", "NotAllowedError")),
        restore: () => {
            forgetScreenDetails(window)
            restore()
        },
    }
}
