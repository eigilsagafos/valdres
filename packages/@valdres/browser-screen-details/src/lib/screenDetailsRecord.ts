import type { ScreenDetail } from "../types/ScreenDetail"
import type { ScreenDetailsState } from "../types/ScreenDetailsState"
import type { ScreenDetailsStatus } from "../types/ScreenDetailsStatus"
import type { ScreenPermissionState } from "../types/ScreenPermissionState"
import { invalidateAll } from "./invalidateAll"
import { resolveScreenDetailsHost } from "./resolveScreenDetailsHost"
import { sameScreen, sameScreens } from "./sameScreens"
import { toScreenDetail } from "./toScreenDetail"

export type ScreenLike = Parameters<typeof toScreenDetail>[0] & EventTarget

export interface ScreenDetailsLike extends EventTarget {
    readonly screens: readonly ScreenLike[]
    readonly currentScreen: ScreenLike
}

const fixed = (status: ScreenDetailsStatus): ScreenDetailsState =>
    Object.freeze({ status, screens: Object.freeze([]), currentScreen: null, error: null })

export const UNSUPPORTED_STATE = fixed("unsupported")
export const INSECURE_STATE = fixed("insecure")
export const IDLE_STATE = fixed("idle")
const PENDING_STATE = fixed("pending")
const READY_EMPTY = fixed("ready")

interface Known {
    readonly value: ScreenPermissionState
    /** Ordering stamp taken when the answer's operation STARTED. */
    readonly order: number
}

/**
 * Everything this package knows about one window. The browser keeps one
 * `ScreenDetails` object per window, so this is page truth shared by every
 * store; stores only decide how long its listeners stay attached.
 */
interface ScreenDetailsRecord {
    state: ScreenDetailsState
    details: ScreenDetailsLike | undefined
    /** Bumped by every request; a settlement from an older one is ignored. */
    request: number
    pending: Promise<ScreenDetail[] | null> | undefined
    readonly registrations: Set<() => void>
    /** Removes the listeners on `details`; set while they are attached. */
    detach: (() => void) | undefined
    clock: number
    permission: Known | undefined
    readonly permissionRegistrations: Set<() => void>
    releaseQuery: (() => void) | undefined
}

// Weak so a discarded window (a removed iframe realm) releases everything.
const records = new WeakMap<Window, ScreenDetailsRecord>()

const recordFor = (view: Window): ScreenDetailsRecord => {
    let record = records.get(view)
    if (record === undefined) {
        record = {
            state: IDLE_STATE,
            details: undefined,
            request: 0,
            pending: undefined,
            registrations: new Set(),
            detach: undefined,
            clock: 0,
            permission: undefined,
            permissionRegistrations: new Set(),
            releaseQuery: undefined,
        }
        records.set(view, record)
    }
    return record
}

const publish = (record: ScreenDetailsRecord, next: ScreenDetailsState) => {
    if (record.state === next) return
    record.state = next
    invalidateAll(record.registrations, "Screen details invalidation failed")
}

/**
 * Samples the details object into the cached state, keeping the previous
 * arrays and objects when nothing changed so `Object.is` publication stays
 * quiet. Called by every read of a ready record: the value is always the
 * platform's, events only say "read again".
 */
const sample = (record: ScreenDetailsRecord): ScreenDetailsState => {
    const { details, state } = record
    if (details === undefined || state.status !== "ready") return state
    const screens = details.screens.map(toScreenDetail)
    const current = toScreenDetail(details.currentScreen)
    const nextScreens = sameScreens(state.screens, screens)
        ? state.screens
        : Object.freeze(screens)
    const nextCurrent = sameScreen(state.currentScreen, current)
        ? state.currentScreen
        : current
    if (nextScreens === state.screens && nextCurrent === state.currentScreen)
        return state
    record.state = Object.freeze({
        status: "ready",
        screens: nextScreens,
        currentScreen: nextCurrent,
        error: null,
    })
    return record.state
}

/** Synchronous, never prompts, never attaches. */
export const readScreenDetails = (): ScreenDetailsState => {
    const host = resolveScreenDetailsHost()
    if (host.kind === "unsupported") return UNSUPPORTED_STATE
    if (host.kind === "insecure") return INSECURE_STATE
    const record = records.get(host.view)
    return record === undefined ? IDLE_STATE : sample(record)
}

const invalidateDetails = (record: ScreenDetailsRecord) => () =>
    invalidateAll(record.registrations, "Screen details invalidation failed")

/** Listens to the details object and each screen while any tree retains it. */
const attach = (record: ScreenDetailsRecord) => {
    const details = record.details
    if (details === undefined || record.detach !== undefined) return
    if (record.registrations.size === 0) return
    const onChange = invalidateDetails(record)
    let screens: readonly ScreenLike[] = []
    const bindScreens = () => {
        for (const screen of screens) screen.removeEventListener("change", onChange)
        screens = [...details.screens]
        for (const screen of screens) screen.addEventListener("change", onChange)
    }
    const onScreensChange = () => {
        bindScreens()
        onChange()
    }
    bindScreens()
    details.addEventListener("screenschange", onScreensChange)
    details.addEventListener("currentscreenchange", onChange)
    record.detach = () => {
        for (const screen of screens) screen.removeEventListener("change", onChange)
        screens = []
        details.removeEventListener("screenschange", onScreensChange)
        details.removeEventListener("currentscreenchange", onChange)
    }
}

const detach = (record: ScreenDetailsRecord) => {
    record.detach?.()
    record.detach = undefined
}

/**
 * Registers one store tree. Listeners on the browser's `ScreenDetails` object
 * exist only while some tree retains the source AND access was granted; the
 * last release removes them.
 */
export const retainScreenDetails = (invalidate: () => void): (() => void) => {
    const host = resolveScreenDetailsHost()
    if (host.kind !== "supported") return () => {}
    const record = recordFor(host.view)
    const registration = () => invalidate()
    record.registrations.add(registration)
    attach(record)
    return () => {
        if (!record.registrations.delete(registration)) return
        if (record.registrations.size === 0) detach(record)
    }
}

const learnPermission = (record: ScreenDetailsRecord, next: Known) => {
    if (record.permission !== undefined && next.order < record.permission.order) return
    const changed = record.permission?.value !== next.value
    record.permission = next
    if (!changed) return
    // A revocation the browser announces ends access: drop the screens.
    if (next.value === "denied" && record.state.status === "ready") {
        detach(record)
        record.details = undefined
        publish(
            record,
            Object.freeze({
                status: "denied",
                screens: Object.freeze([]),
                currentScreen: null,
                error: Object.freeze({
                    name: "NotAllowedError",
                    message: "The window-management permission was revoked",
                }),
            }),
        )
    }
    invalidateAll(record.permissionRegistrations, "Screen permission invalidation failed")
}

const toError = (error: unknown) =>
    Object.freeze({
        name: String((error as { name?: unknown } | null)?.name ?? "Error"),
        message: String((error as { message?: unknown } | null)?.message ?? error),
    })

/**
 * Calls `window.getScreenDetails()` synchronously, inside the caller's task, so
 * a call from a user gesture keeps that gesture's activation. Concurrent calls
 * share one request.
 */
export const requestScreenDetailsOnce = (): Promise<ScreenDetail[] | null> => {
    const host = resolveScreenDetailsHost()
    if (host.kind !== "supported") return Promise.resolve(null)
    const record = recordFor(host.view)
    if (record.pending !== undefined) return record.pending
    const request = ++record.request
    const order = ++record.clock
    let answer: Promise<ScreenDetailsLike>
    try {
        answer = Promise.resolve(host.getScreenDetails.call(host.view))
    } catch (error) {
        answer = Promise.reject(error)
    }
    const pending = answer.then(
        details => {
            if (record.pending === pending) record.pending = undefined
            if (record.request !== request) return details.screens.map(toScreenDetail)
            if (record.details !== details) {
                detach(record)
                record.details = details
            }
            // A repeated request on a ready record only re-samples, so an
            // unchanged layout publishes nothing.
            if (record.state.status !== "ready") record.state = READY_EMPTY
            const state = sample(record)
            learnPermission(record, { value: "granted", order })
            attach(record)
            invalidateAll(record.registrations, "Screen details invalidation failed")
            return [...state.screens]
        },
        error => {
            if (record.pending === pending) record.pending = undefined
            if (record.request === request) {
                const denied =
                    (error as { name?: unknown } | null)?.name === "NotAllowedError"
                detach(record)
                record.details = undefined
                publish(
                    record,
                    Object.freeze({
                        status: denied ? "denied" : "error",
                        screens: Object.freeze([]),
                        currentScreen: null,
                        error: toError(error),
                    }),
                )
                if (denied)
                    learnPermission(record, { value: "denied", order })
            }
            throw error
        },
    )
    record.pending = pending
    // While ready, a repeated request keeps serving the current screens.
    if (record.state.status !== "ready") publish(record, PENDING_STATE)
    return pending
}

const permissionsOf = () => {
    const permissions =
        typeof navigator === "undefined"
            ? undefined
            : (navigator.permissions as Permissions | undefined)
    return typeof permissions?.query === "function" ? permissions : undefined
}

/** Synchronous, never prompts, never queries. */
export const readScreenPermission = (): ScreenPermissionState => {
    const host = resolveScreenDetailsHost()
    if (host.kind !== "supported") return "unsupported"
    return records.get(host.view)?.permission?.value ?? "prompt"
}

/** Current Chromium's name first, then the pre-111 name. */
const PERMISSION_NAMES = ["window-management", "window-placement"] as const

/**
 * Registers one store tree. The first registration queries the Permissions API
 * and follows its `change` events; the last one removes the listener. Answers
 * are kept, so a store that re-subscribes keeps reading the last one until the
 * new query corrects it.
 */
export const retainScreenPermission = (invalidate: () => void): (() => void) => {
    const host = resolveScreenDetailsHost()
    if (host.kind !== "supported") return () => {}
    const record = recordFor(host.view)
    const registration = () => invalidate()
    record.permissionRegistrations.add(registration)
    if (record.releaseQuery === undefined) {
        let released = false
        let status: PermissionStatus | undefined
        const onChange = () => {
            if (released || status === undefined) return
            learnPermission(record, { value: status.state, order: ++record.clock })
        }
        record.releaseQuery = () => {
            released = true
            status?.removeEventListener("change", onChange)
        }
        const permissions = permissionsOf()
        if (permissions !== undefined) {
            const order = ++record.clock
            const query = (index: number): void => {
                let answer: Promise<PermissionStatus>
                try {
                    answer = permissions.query({
                        name: PERMISSION_NAMES[index] as PermissionName,
                    })
                } catch (error) {
                    answer = Promise.reject(error)
                }
                answer.then(
                    result => {
                        if (released) return
                        status = result
                        result.addEventListener("change", onChange)
                        learnPermission(record, { value: result.state, order })
                    },
                    () => {
                        if (!released && index + 1 < PERMISSION_NAMES.length) query(index + 1)
                    },
                )
            }
            query(0)
        }
    }
    return () => {
        if (!record.permissionRegistrations.delete(registration)) return
        if (record.permissionRegistrations.size > 0) return
        record.releaseQuery?.()
        record.releaseQuery = undefined
    }
}

/** @internal Tests: forget everything recorded for `view`. */
export const forgetScreenDetails = (view: Window): void => {
    const record = records.get(view)
    if (record !== undefined) {
        record.request++
        detach(record)
        record.releaseQuery?.()
    }
    records.delete(view)
}
