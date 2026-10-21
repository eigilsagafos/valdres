import type { ScreenDetail } from "../types/ScreenDetail"
import type { ScreenDetailsState } from "../types/ScreenDetailsState"
import type { ScreenDetailsStatus } from "../types/ScreenDetailsStatus"
import type { ScreenPermissionState } from "../types/ScreenPermissionState"
import { combineFailures, invalidateEach } from "./invalidateAll"
import { reportFailures } from "./reportFailure"
import { resolveScreenDetailsHost } from "./resolveScreenDetailsHost"
import { sameScreen, sameScreens } from "./sameScreens"
import { toScreenDetail } from "./toScreenDetail"

export type ScreenLike = Parameters<typeof toScreenDetail>[0] & EventTarget

export interface ScreenDetailsLike extends EventTarget {
    readonly screens: readonly ScreenLike[]
    readonly currentScreen: ScreenLike
}

/** Every state without screens shares one array, so status changes alone
 *  never change `screensAtom`'s identity. */
const NO_SCREENS: readonly ScreenDetail[] = Object.freeze([])

const fixed = (status: ScreenDetailsStatus): ScreenDetailsState =>
    Object.freeze({ status, screens: NO_SCREENS, currentScreen: null, error: null })

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

const DETAILS_LABEL = "Screen details invalidation failed"
const PERMISSION_LABEL = "Screen permission invalidation failed"

type Delivery = "rethrow" | "report"

/**
 * Where subscriber failures go: a native event listener rethrows them for the
 * platform to report; an asynchronous browser answer, and the publication a
 * request makes once its native call started, report them (see
 * `reportFailures`) so they never replace the operation's own outcome or
 * become an unhandled rejection. Either way every registration runs first.
 */
const deliver = (failures: unknown[], label: string, delivery: Delivery) => {
    if (failures.length === 0) return
    if (delivery === "report") reportFailures(failures, label)
    else throw combineFailures(failures, label)
}

const publish = (
    record: ScreenDetailsRecord,
    next: ScreenDetailsState,
    delivery: Delivery,
) => {
    if (record.state === next) return
    record.state = next
    deliver(invalidateEach(record.registrations), DETAILS_LABEL, delivery)
}

const deniedState = (message: string): ScreenDetailsState =>
    Object.freeze({
        status: "denied",
        screens: NO_SCREENS,
        currentScreen: null,
        error: Object.freeze({ name: "NotAllowedError", message }),
    })

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

// Native `change` / `screenschange` listeners: rethrow for the platform.
const invalidateDetails = (record: ScreenDetailsRecord) => () =>
    deliver(invalidateEach(record.registrations), DETAILS_LABEL, "rethrow")

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
 * last release removes them. Retaining the details also observes the
 * permission (see `observePermission`), so a revocation the browser reports
 * reaches a store that only reads screens.
 */
export const retainScreenDetails = (invalidate: () => void): (() => void) => {
    const host = resolveScreenDetailsHost()
    if (host.kind !== "supported") return () => {}
    const record = recordFor(host.view)
    const registration = () => invalidate()
    record.registrations.add(registration)
    attach(record)
    observePermission(record)
    return () => {
        if (!record.registrations.delete(registration)) return
        if (record.registrations.size === 0) detach(record)
        unobservePermissionIfUnused(record)
    }
}

/**
 * Records a permission answer unless a newer one already landed, then
 * notifies the permission's subscribers and, when the answer ends access, the
 * details' subscribers too — every registration runs before any failure is
 * delivered.
 */
const learnPermission = (
    record: ScreenDetailsRecord,
    next: Known,
    delivery: Delivery,
) => {
    if (record.permission !== undefined && next.order < record.permission.order) return
    const changed = record.permission?.value !== next.value
    record.permission = next
    if (!changed) return
    const failures: unknown[] = []
    // A denial the browser reports ends access: the screens are dropped, not
    // kept as stale data, and the status says why.
    if (next.value === "denied" && record.state.status === "ready") {
        detach(record)
        record.details = undefined
        record.state = deniedState("The window-management permission was revoked")
        failures.push(...invalidateEach(record.registrations))
    }
    failures.push(...invalidateEach(record.permissionRegistrations))
    deliver(failures, PERMISSION_LABEL, delivery)
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
 *
 * Error contract: once the native call has started, the caller always gets
 * the promise, and it settles only with the browser's outcome — the screens,
 * or the browser's rejection. Subscriber failures while publishing "pending",
 * "ready", "denied" or "error" are reported, never thrown or turned into a
 * rejection. A denial the browser reported after this request started wins
 * over the request's own grant: the state stays "denied", while the promise
 * still resolves with what the browser returned.
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
            const screens = details.screens.map(toScreenDetail)
            if (record.request !== request) return screens
            const newer = record.permission
            if (newer !== undefined && newer.order > order && newer.value === "denied") {
                // Revoked while this request was in flight: never restore
                // "ready" from the older grant.
                detach(record)
                record.details = undefined
                publish(
                    record,
                    deniedState("The window-management permission was denied after this request started"),
                    "report",
                )
                return screens
            }
            if (record.details !== details) {
                detach(record)
                record.details = details
            }
            // A repeated request on a ready record only re-samples, so an
            // unchanged layout publishes nothing.
            if (record.state.status !== "ready") record.state = READY_EMPTY
            const state = sample(record)
            attach(record)
            const failures = invalidateEach(record.registrations)
            reportFailures(failures, DETAILS_LABEL)
            learnPermission(record, { value: "granted", order }, "report")
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
                        screens: NO_SCREENS,
                        currentScreen: null,
                        error: toError(error),
                    }),
                    "report",
                )
                if (denied) learnPermission(record, { value: "denied", order }, "report")
            }
            throw error
        },
    )
    record.pending = pending
    // While ready, a repeated request keeps serving the current screens. The
    // native call already started, so this publication reports its failures
    // instead of throwing the caller's promise away.
    if (record.state.status !== "ready") publish(record, PENDING_STATE, "report")
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
 * Starts observing the permission — one Permissions API query, then its
 * `change` events — when the first observer arrives: a `screenPermissionAtom`
 * registration or a details registration. `unobservePermissionIfUnused`
 * removes the listener when both sets are empty. Answers are kept, so a store
 * that re-subscribes keeps reading the last one until the new query corrects
 * it; a query answered after its release is ignored.
 */
const observePermission = (record: ScreenDetailsRecord): void => {
    if (record.releaseQuery !== undefined) return
    let released = false
    let status: PermissionStatus | undefined
    const onChange = () => {
        if (released || status === undefined) return
        learnPermission(record, { value: status.state, order: ++record.clock }, "rethrow")
    }
    record.releaseQuery = () => {
        released = true
        status?.removeEventListener("change", onChange)
    }
    const permissions = permissionsOf()
    if (permissions === undefined) return
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
                learnPermission(record, { value: result.state, order }, "report")
            },
            () => {
                if (!released && index + 1 < PERMISSION_NAMES.length) query(index + 1)
            },
        )
    }
    query(0)
}

const unobservePermissionIfUnused = (record: ScreenDetailsRecord): void => {
    if (record.permissionRegistrations.size > 0 || record.registrations.size > 0) return
    record.releaseQuery?.()
    record.releaseQuery = undefined
}

/** Registers one store tree on the permission; see `observePermission`. */
export const retainScreenPermission = (invalidate: () => void): (() => void) => {
    const host = resolveScreenDetailsHost()
    if (host.kind !== "supported") return () => {}
    const record = recordFor(host.view)
    const registration = () => invalidate()
    record.permissionRegistrations.add(registration)
    observePermission(record)
    return () => {
        if (!record.permissionRegistrations.delete(registration)) return
        unobservePermissionIfUnused(record)
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
