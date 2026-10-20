import { afterEach, describe, expect, test } from "bun:test"
import { StoreDisposedError, store } from "valdres"
import { flush } from "../../test/setup/deviceHarness"
import {
    installGeolocation,
    position,
    positionError,
} from "../../test/setup/geolocationFixtures"
import { GeolocationWatchConflictError } from "../errors/GeolocationWatchConflictError"
import { inspectWatch } from "../lib/watchRegistry"
import { coordsSelector } from "../selectors/coordsSelector"
import { geolocationAtom } from "../selectors/geolocationAtom"
import { geolocationErrorAtom } from "../selectors/geolocationErrorAtom"
import { geolocationStatusAtom } from "../selectors/geolocationStatusAtom"
import { positionAtom } from "../selectors/positionAtom"
import { watchGeolocation } from "./watchGeolocation"

let page: ReturnType<typeof installGeolocation> | undefined
const install = () => (page = installGeolocation())
afterEach(() => {
    page?.restore()
    page = undefined
})

describe("reading without a watch", () => {
    test("reports idle and never starts a watch, even while subscribed", () => {
        const { geolocation } = install()
        const app = store()
        const stop = app.sub(geolocationAtom, () => {})
        expect(app.get(geolocationAtom)).toEqual({
            status: "idle",
            position: null,
            error: null,
        })
        expect(geolocation.watches).toEqual([])
        stop()
        app.dispose()
    })

    test("reports unsupported without navigator.geolocation", () => {
        install()
        Object.defineProperty(navigator, "geolocation", { configurable: true, value: undefined })
        const app = store()
        expect(app.get(geolocationStatusAtom)).toBe("unsupported")
        app.dispose()
    })

    test("reports insecure in an insecure context", () => {
        const harness = install()
        harness.setSecure(false)
        const app = store()
        expect(app.get(geolocationStatusAtom)).toBe("insecure")
        app.dispose()
    })
})

describe("watchGeolocation", () => {
    test("starts one native watch synchronously with the default options", () => {
        const { geolocation } = install()
        const app = store()
        const stop = watchGeolocation(app)
        expect(geolocation.live()).toHaveLength(1)
        expect(geolocation.watches[0]!.options).toEqual({
            enableHighAccuracy: false,
            timeout: 30_000,
            maximumAge: 0,
        })
        expect(app.get(geolocationStatusAtom)).toBe("pending")
        stop()
        expect(geolocation.live()).toHaveLength(0)
        expect(app.get(geolocationStatusAtom)).toBe("idle")
        app.dispose()
    })

    test("keeps the user activation of the gesture that called it", () => {
        const harness = install()
        const app = store()
        const stop = harness.withActivation(() => watchGeolocation(app))
        expect(harness.geolocation.watches[0]!.activated).toBe(true)
        stop()
        app.dispose()
    })

    test("publishes status, position and error coherently", () => {
        const { geolocation } = install()
        const app = store()
        const seen: unknown[] = []
        app.sub(geolocationAtom, () => seen.push(app.get(geolocationAtom)))
        const stop = watchGeolocation(app)
        const [watch] = geolocation.watches
        watch!.success(position(59.91))
        watch!.error!(positionError(3))
        watch!.success(position(59.92))
        expect(seen.slice(1)).toEqual([
            {
                status: "active",
                position: expect.objectContaining({ latitude: 59.91 }),
                error: null,
            },
            {
                status: "error",
                position: expect.objectContaining({ latitude: 59.91 }),
                error: { code: 3, message: "code 3" },
            },
            {
                status: "active",
                position: expect.objectContaining({ latitude: 59.92 }),
                error: null,
            },
        ])
        expect(app.get(coordsSelector)).toEqual({ latitude: 59.92, longitude: 10.75 })
        stop()
        app.dispose()
    })

    test("a denial reports denied with code 1; a new watch after the user allows it recovers", () => {
        const { geolocation } = install()
        const app = store()
        const first = watchGeolocation(app)
        geolocation.watches[0]!.error!(positionError(1, "User denied Geolocation"))
        // Distinct from an ordinary error: the browser ended the watch.
        expect(app.get(geolocationStatusAtom)).toBe("denied")
        expect(app.get(geolocationErrorAtom)).toEqual({
            code: 1,
            message: "User denied Geolocation",
        })
        first()
        const second = watchGeolocation(app)
        expect(app.get(geolocationStatusAtom)).toBe("pending")
        expect(app.get(geolocationErrorAtom)).toBeNull()
        geolocation.watches[1]!.success(position(1))
        expect(app.get(geolocationStatusAtom)).toBe("active")
        second()
        app.dispose()
    })

    test("unsupported, insecure, denied and ordinary errors are distinct statuses", () => {
        const harness = install()
        const outcome = (setup: () => void, report?: (watch: (typeof harness.geolocation.watches)[number]) => void) => {
            setup()
            const app = store()
            const stop = watchGeolocation(app)
            const watch = harness.geolocation.watches.at(-1)
            if (report !== undefined && watch !== undefined && !watch.cleared) report(watch)
            const state = app.get(geolocationAtom)
            stop()
            app.dispose()
            return [state.status, state.error?.code ?? null]
        }
        expect(outcome(() => {}, watch => watch.error!(positionError(1)))).toEqual(["denied", 1])
        expect(outcome(() => {}, watch => watch.error!(positionError(2)))).toEqual(["error", 2])
        expect(outcome(() => {}, watch => watch.error!(positionError(3)))).toEqual(["error", 3])
        expect(outcome(() => harness.setSecure(false))).toEqual(["insecure", null])
        expect(
            outcome(() => {
                harness.setSecure(undefined)
                Object.defineProperty(navigator, "geolocation", { configurable: true, value: undefined })
            }),
        ).toEqual(["unsupported", null])
    })

    test("a denial after a position keeps the last position with the denial", () => {
        const { geolocation } = install()
        const app = store()
        const stop = watchGeolocation(app)
        geolocation.watches[0]!.success(position(40))
        geolocation.watches[0]!.error!(positionError(1))
        expect(app.get(geolocationAtom)).toMatchObject({
            status: "denied",
            position: { latitude: 40 },
            error: { code: 1 },
        })
        stop()
        app.dispose()
    })

    test("callers with the same options share one watch until the last releases", () => {
        const { geolocation } = install()
        const app = store()
        const a = watchGeolocation(app, { enableHighAccuracy: true })
        const b = watchGeolocation(app, { enableHighAccuracy: true, timeout: 30_000 })
        expect(geolocation.watches).toHaveLength(1)
        expect(inspectWatch(app)?.holders).toBe(2)
        a()
        a()
        expect(geolocation.live()).toHaveLength(1)
        b()
        expect(geolocation.live()).toHaveLength(0)
        expect(inspectWatch(app)).toBeUndefined()
        app.dispose()
    })

    test("different options in the same store throw instead of overwriting", () => {
        const { geolocation } = install()
        const app = store()
        const stop = watchGeolocation(app, { enableHighAccuracy: false })
        let thrown: unknown
        try {
            watchGeolocation(app, { enableHighAccuracy: true })
        } catch (error) {
            thrown = error
        }
        expect(thrown).toBeInstanceOf(GeolocationWatchConflictError)
        expect((thrown as GeolocationWatchConflictError).active.enableHighAccuracy).toBe(false)
        expect((thrown as GeolocationWatchConflictError).requested.enableHighAccuracy).toBe(true)
        expect(geolocation.watches).toHaveLength(1)
        expect(geolocation.watches[0]!.options?.enableHighAccuracy).toBe(false)
        stop()
        app.dispose()
    })

    test("independent stores keep independent options and positions", () => {
        const { geolocation } = install()
        const coarse = store()
        const precise = store()
        const stopCoarse = watchGeolocation(coarse, { maximumAge: 60_000 })
        const stopPrecise = watchGeolocation(precise, { enableHighAccuracy: true })
        const [coarseWatch, preciseWatch] = geolocation.watches
        expect(coarseWatch!.options).toMatchObject({ enableHighAccuracy: false, maximumAge: 60_000 })
        expect(preciseWatch!.options).toMatchObject({ enableHighAccuracy: true, maximumAge: 0 })
        preciseWatch!.success(position(2))
        expect(precise.get(positionAtom)?.latitude).toBe(2)
        expect(coarse.get(positionAtom)).toBeNull()
        stopCoarse()
        expect(precise.get(geolocationStatusAtom)).toBe("active")
        stopPrecise()
        coarse.dispose()
        precise.dispose()
    })

    test("a child scope inherits its parent's watch, can run its own, and re-inherits on release", () => {
        const { geolocation } = install()
        const app = store()
        const child = app.scope()
        const stopRoot = watchGeolocation(app)
        geolocation.watches[0]!.success(position(3))
        expect(child.get(positionAtom)?.latitude).toBe(3)

        const stopChild = watchGeolocation(child, { enableHighAccuracy: true })
        expect(child.get(geolocationStatusAtom)).toBe("pending")
        geolocation.watches[1]!.success(position(4))
        expect(child.get(positionAtom)?.latitude).toBe(4)
        expect(app.get(positionAtom)?.latitude).toBe(3)

        stopChild()
        expect(geolocation.watches[1]!.cleared).toBe(true)
        expect(child.get(positionAtom)?.latitude).toBe(3)
        stopRoot()
        expect(child.get(geolocationStatusAtom)).toBe("idle")
        child.dispose()
        app.dispose()
    })

    test("sibling scopes do not see each other's watch", () => {
        const { geolocation } = install()
        const app = store()
        const left = app.scope()
        const right = app.scope()
        const stop = watchGeolocation(left)
        geolocation.watches[0]!.success(position(5))
        expect(left.get(positionAtom)?.latitude).toBe(5)
        expect(right.get(positionAtom)).toBeNull()
        expect(app.get(positionAtom)).toBeNull()
        stop()
        app.dispose()
    })

    test("sharing is by effective options, and a conflict lasts while any holder remains", () => {
        const { geolocation } = install()
        const app = store()
        const implicit = watchGeolocation(app)
        const explicit = watchGeolocation(app, {
            enableHighAccuracy: false,
            timeout: 30_000,
            maximumAge: 0,
        })
        expect(geolocation.watches).toHaveLength(1)
        expect(inspectWatch(app)?.holders).toBe(2)
        implicit()
        // One holder left: different options still conflict.
        expect(() => watchGeolocation(app, { maximumAge: 5 })).toThrow(
            GeolocationWatchConflictError,
        )
        expect(geolocation.live()).toHaveLength(1)
        explicit()
        expect(geolocation.live()).toHaveLength(0)
        // Every holder gone: the store is free to watch with other options.
        const other = watchGeolocation(app, { maximumAge: 5 })
        expect(geolocation.watches).toHaveLength(2)
        expect(geolocation.watches[1]!.options?.maximumAge).toBe(5)
        other()
        app.dispose()
    })

    test("siblings share their parent's one watch; a child's own watch affects neither", () => {
        const { geolocation } = install()
        const app = store()
        const left = app.scope()
        const right = app.scope()
        const stopParent = watchGeolocation(app)
        geolocation.watches[0]!.success(position(10))
        // Both siblings inherit the same parent watch: one native watch.
        expect([left.get(positionAtom)?.latitude, right.get(positionAtom)?.latitude]).toEqual([10, 10])
        expect(geolocation.live()).toHaveLength(1)

        const stopLeft = watchGeolocation(left, { enableHighAccuracy: true })
        geolocation.watches[1]!.success(position(20))
        geolocation.watches[1]!.error!(positionError(3))
        expect(left.get(geolocationAtom)).toMatchObject({ status: "error", position: { latitude: 20 } })
        expect(app.get(geolocationAtom)).toMatchObject({ status: "active", position: { latitude: 10 } })
        expect(right.get(geolocationAtom)).toMatchObject({ status: "active", position: { latitude: 10 } })
        // The parent's options do not constrain the child, nor the child's the parent.
        expect(inspectWatch(app)?.options.enableHighAccuracy).toBe(false)
        expect(() => watchGeolocation(app)()).not.toThrow()

        geolocation.watches[0]!.success(position(11))
        expect(right.get(positionAtom)?.latitude).toBe(11)
        expect(left.get(positionAtom)?.latitude).toBe(20)

        stopLeft()
        expect(left.get(positionAtom)?.latitude).toBe(11)
        expect(geolocation.watches[0]!.cleared).toBe(false)
        stopParent()
        app.dispose()
    })

    test("stopping or disposing one owner never stops another owner's watch", () => {
        const { geolocation } = install()
        const app = store()
        const child = app.scope()
        const stopParent = watchGeolocation(app)
        watchGeolocation(child, { maximumAge: 1 })
        // The parent stops; the child keeps its own watch and its own reading.
        stopParent()
        expect(geolocation.watches[0]!.cleared).toBe(true)
        expect(geolocation.watches[1]!.cleared).toBe(false)
        geolocation.watches[1]!.success(position(30))
        expect(child.get(positionAtom)?.latitude).toBe(30)
        expect(app.get(geolocationStatusAtom)).toBe("idle")

        // Disposing a child releases only the child's watch.
        const restarted = watchGeolocation(app)
        child.dispose()
        expect(geolocation.watches[1]!.cleared).toBe(true)
        expect(geolocation.watches[2]!.cleared).toBe(false)
        restarted()
        app.dispose()
    })

    test("reports from a released or superseded watch never land", () => {
        const { geolocation } = install()
        const app = store()
        const first = watchGeolocation(app, { timeout: 1_000 })
        const stale = geolocation.watches[0]!
        first()
        const second = watchGeolocation(app, { timeout: 5_000 })
        const current = geolocation.watches[1]!
        current.success(position(6))
        stale.success(position(-1))
        stale.error!(positionError(1))
        expect(app.get(geolocationAtom)).toMatchObject({
            status: "active",
            position: { latitude: 6 },
            error: null,
        })
        second()
        app.dispose()
    })

    test("disposing the store clears its watch and ignores later reports", () => {
        const { geolocation } = install()
        const app = store()
        const child = app.scope()
        const stop = watchGeolocation(app)
        const stopChild = watchGeolocation(child, { maximumAge: 1 })
        app.dispose()
        expect(geolocation.live()).toHaveLength(0)
        geolocation.watches[0]!.success(position(7))
        // Disposers after disposal are harmless no-ops.
        expect(() => stop()).not.toThrow()
        expect(() => stopChild()).not.toThrow()
        expect(() => watchGeolocation(app)).toThrow(StoreDisposedError)
    })

    test("a failing watchPosition leaves no watch behind", () => {
        const { geolocation } = install()
        const app = store()
        geolocation.failNext = new Error("host failure")
        expect(() => watchGeolocation(app)).toThrow()
        expect(inspectWatch(app)).toBeUndefined()
        expect(app.get(geolocationStatusAtom)).toBe("idle")
        const stop = watchGeolocation(app)
        expect(geolocation.live()).toHaveLength(1)
        stop()
        app.dispose()
    })

    test("rejects invalid options before starting anything", () => {
        const { geolocation } = install()
        const app = store()
        expect(() => watchGeolocation(app, { timeout: -1 })).toThrow(TypeError)
        expect(() => watchGeolocation(app, { maximumAge: Number.NaN })).toThrow(TypeError)
        expect(() =>
            watchGeolocation(app, { enableHighAccuracy: "yes" as unknown as boolean }),
        ).toThrow(TypeError)
        expect(geolocation.watches).toEqual([])
        expect(() => watchGeolocation(app, { timeout: Infinity, maximumAge: Infinity })()).not.toThrow()
        app.dispose()
    })

    test("unsupported and insecure hosts publish their status and start nothing", () => {
        const harness = install()
        const app = store()
        harness.setSecure(false)
        const insecure = watchGeolocation(app)
        expect(app.get(geolocationStatusAtom)).toBe("insecure")
        expect(harness.geolocation.watches).toEqual([])
        insecure()
        harness.setSecure(undefined)
        Object.defineProperty(navigator, "geolocation", { configurable: true, value: undefined })
        const unsupported = watchGeolocation(app)
        expect(app.get(geolocationStatusAtom)).toBe("unsupported")
        unsupported()
        app.dispose()
    })

    test("a disposer called inside a transaction finishes after it", async () => {
        const { geolocation } = install()
        const app = store()
        const stop = watchGeolocation(app)
        app.txn(() => {
            stop()
        })
        // Store writes are forbidden inside the transaction: still running.
        expect(geolocation.live()).toHaveLength(1)
        await Promise.resolve()
        expect(geolocation.live()).toHaveLength(0)
        expect(app.get(geolocationStatusAtom)).toBe("idle")
        app.dispose()
    })

    test("a deferred stop clears only its own watch when the store restarts before it runs", async () => {
        const { geolocation } = install()
        const app = store()
        const stopOld = watchGeolocation(app)
        app.txn(() => {
            stopOld()
        })
        // Restart before the deferred stop's microtask: a new session.
        const stopNew = watchGeolocation(app)
        expect(geolocation.watches).toHaveLength(2)
        await flush()
        // The old stop cleared the old native watch, and only that one.
        expect(geolocation.watches[0]!.cleared).toBe(true)
        expect(geolocation.watches[1]!.cleared).toBe(false)
        // The new session is still the store's: its reports land.
        expect(app.get(geolocationStatusAtom)).toBe("pending")
        geolocation.watches[1]!.success(position(42))
        expect(app.get(geolocationAtom)).toMatchObject({ status: "active", position: { latitude: 42 } })
        // Calling the old stop again is a no-op.
        stopOld()
        expect(geolocation.watches[1]!.cleared).toBe(false)
        stopNew()
        expect(geolocation.live()).toHaveLength(0)
        app.dispose()
    })

    test("a deferred stop after the store was disposed is harmless", async () => {
        const { geolocation } = install()
        const app = store()
        const stop = watchGeolocation(app)
        app.txn(() => {
            stop()
        })
        app.dispose()
        await flush()
        expect(geolocation.live()).toHaveLength(0)
    })

    test("one store's throwing subscriber does not stop another store's watch", () => {
        const { geolocation } = install()
        const failing = store()
        const healthy = store()
        failing.sub(positionAtom, () => {
            throw new Error("subscriber exploded")
        })
        let healthyRuns = 0
        healthy.sub(positionAtom, () => healthyRuns++)
        watchGeolocation(failing)
        watchGeolocation(healthy)
        expect(() => geolocation.watches[0]!.success(position(8))).toThrow()
        geolocation.watches[1]!.success(position(9))
        expect(healthyRuns).toBe(1)
        expect(failing.get(positionAtom)?.latitude).toBe(8)
        expect(healthy.get(positionAtom)?.latitude).toBe(9)
        failing.dispose()
        healthy.dispose()
        expect(geolocation.live()).toHaveLength(0)
    })

    test("the public state is read-only", () => {
        install()
        const app = store()
        const loose = app as unknown as Record<"set" | "reset", (...args: unknown[]) => void>
        expect(() => loose.set(positionAtom, null)).toThrow(TypeError)
        expect(() => loose.reset(geolocationAtom)).toThrow(TypeError)
        app.dispose()
    })
})
