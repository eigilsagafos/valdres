/**
 * Runs inside the probe page, after `instrument.js`. Bundled from workspace
 * source by `run.ts`. Exposes `window.geometryProbe` for the driver.
 */
import {
    selector,
    store,
    type State,
    type Store,
} from "../../packages/valdres/src/index"
import {
    windowSizeAtom,
    type WindowSize,
} from "../../packages/@valdres/browser-window/src/index"
import {
    screenAtom,
    type ScreenInfo,
} from "../../packages/@valdres/browser-screen/src/index"

declare global {
    interface Window {
        __geometry: {
            attached(): Record<string, number>
            queries(): string[]
            natives(): unknown[]
            environment(): Record<string, unknown>
            untracked(
                target: EventTarget,
                type: string,
                listener: (event: Event) => void,
            ): void
        }
        geometryProbe: unknown
    }
}

const afterImport = {
    attached: window.__geometry.attached(),
    queries: window.__geometry.queries(),
}

const first = store()
const second = store()
const child = first.scope("child")
const dormant = store()

const isWide = selector(get => get(windowSizeAtom).innerWidth >= 700)
const ratio = selector(get => get(screenAtom).devicePixelRatio)

type Notification = { store: string; state: string; value: unknown }
const notifications: Notification[] = []
const stops: (() => void)[] = []
const errors: string[] = []
window.__geometry.untracked(window, "error", event => {
    errors.push(
        String(
            (event as ErrorEvent).error?.name ?? (event as ErrorEvent).message,
        ),
    )
})

const watch = <Value>(
    name: string,
    app: Store,
    state: State<Value>,
    label: string,
) =>
    stops.push(
        app.sub(state, () =>
            notifications.push({
                store: name,
                state: label,
                value: app.get(state),
            }),
        ),
    )

window.geometryProbe = {
    afterImport: () => afterImport,
    environment: () => window.__geometry.environment(),
    dormantRead: () => {
        const size = dormant.get(windowSizeAtom)
        const info = dormant.get(screenAtom)
        return {
            size,
            info,
            sameObjectOnReread:
                dormant.get(windowSizeAtom) === size &&
                dormant.get(screenAtom) === info,
            frozen: Object.isFrozen(size) && Object.isFrozen(info),
            attached: window.__geometry.attached(),
            queries: window.__geometry.queries(),
            live: {
                innerWidth,
                innerHeight,
                outerWidth,
                outerHeight,
                screenWidth: screen.width,
                devicePixelRatio,
            },
        }
    },
    subscribe: () => {
        watch("first", first, windowSizeAtom, "window")
        watch("first", first, screenAtom, "screen")
        watch("second", second, windowSizeAtom, "window")
        watch("second", second, screenAtom, "screen")
        watch("child", child, isWide, "isWide")
        watch("child", child, ratio, "ratio")
        return {
            attached: window.__geometry.attached(),
            queries: window.__geometry.queries(),
        }
    },
    take: () => {
        const taken = notifications.splice(0)
        return {
            notifications: taken,
            natives: window.__geometry.natives(),
            first: {
                size: first.get(windowSizeAtom),
                screen: first.get(screenAtom),
            },
            sharedSnapshot:
                first.get(windowSizeAtom) === second.get(windowSizeAtom) &&
                first.get(screenAtom) === second.get(screenAtom),
            live: {
                innerWidth,
                innerHeight,
                outerWidth,
                outerHeight,
                screen: [
                    screen.width,
                    screen.height,
                    screen.availWidth,
                    screen.availHeight,
                ],
                orientation: [
                    screen.orientation?.type,
                    screen.orientation?.angle,
                ],
                devicePixelRatio,
            },
            attached: window.__geometry.attached(),
            queries: window.__geometry.queries(),
            errors: errors.splice(0),
        }
    },
    syntheticEvents: () => {
        window.dispatchEvent(new Event("resize"))
        screen.orientation?.dispatchEvent(new Event("change"))
        // Chromium's Screen is an EventTarget; the DOM typings do not say so.
        const target = screen as unknown as Partial<EventTarget>
        if (typeof target.dispatchEvent === "function")
            target.dispatchEvent(new Event("change"))
    },
    release: () => {
        for (const stop of stops.splice(0)) stop()
        const afterUnsubscribe = window.__geometry.attached()
        // Reattach through disposal: dispose must release a live tree too.
        first.sub(screenAtom, () => {})
        second.sub(windowSizeAtom, () => {})
        const beforeDispose = window.__geometry.attached()
        first.dispose()
        second.dispose()
        dormant.dispose()
        return {
            afterUnsubscribe,
            beforeDispose,
            afterDispose: window.__geometry.attached(),
        }
    },
} satisfies Record<string, () => unknown>

export type { ScreenInfo, WindowSize }
