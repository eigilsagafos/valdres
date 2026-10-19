import type { PermissionValue } from "../types/PermissionValue"
import { invalidateAll, invalidateEach } from "./invalidateAll"
import { reportFailures } from "./reportFailure"
import { resolveOrientationHost } from "./resolveOrientationHost"

/** The Permissions API names `DeviceOrientationEvent.requestPermission()` asks for. */
const PERMISSION_NAMES = ["accelerometer", "gyroscope"] as const

interface Known {
    readonly value: PermissionValue
    /** Ordering stamp taken when the answer's operation STARTED. */
    readonly order: number
}

interface PermissionRecord {
    known: Known | undefined
    clock: number
    pending: Promise<PermissionValue> | undefined
    readonly registrations: Set<() => void>
    /** Releases the Permissions API attachment; set while attached. */
    release: (() => void) | undefined
}

// Per window: permission is the origin's, shared by every store.
const records = new WeakMap<Window, PermissionRecord>()

const recordFor = (view: Window): PermissionRecord => {
    let record = records.get(view)
    if (record === undefined) {
        record = {
            known: undefined,
            clock: 0,
            pending: undefined,
            registrations: new Set(),
            release: undefined,
        }
        records.set(view, record)
    }
    return record
}

/**
 * Applies an answer unless a newer one already landed: an answer whose
 * operation started earlier never overwrites one that started later, so a slow
 * Permissions API query cannot undo a request's result.
 */
const LABEL = "Orientation permission invalidation failed"

/**
 * `delivery` says where subscriber failures go: a native `change` listener
 * rethrows them for the platform to report; an asynchronous answer (a query
 * or a request) reports them, so they never become that operation's outcome
 * or an unhandled rejection.
 */
const apply = (
    record: PermissionRecord,
    next: Known,
    delivery: "rethrow" | "report",
) => {
    if (record.known !== undefined && next.order < record.known.order) return
    const changed = record.known?.value !== next.value
    record.known = next
    if (!changed) return
    if (delivery === "rethrow") invalidateAll(record.registrations, LABEL)
    else reportFailures(invalidateEach(record.registrations), LABEL)
}

const combine = (states: readonly PermissionState[]): PermissionValue =>
    states.includes("denied")
        ? "denied"
        : states.every(state => state === "granted")
          ? "granted"
          : "prompt"

/** Synchronous, never prompts, never attaches. */
export const readOrientationPermission = (): PermissionValue => {
    const host = resolveOrientationHost()
    if (host.kind !== "supported") return "unsupported"
    const known = records.get(host.view)?.known
    if (known !== undefined) return known.value
    return typeof host.ctor.requestPermission === "function"
        ? "prompt"
        : "granted"
}

/**
 * Registers one store tree. The first registration queries the Permissions API
 * (where it knows these names) and follows its `change` events; the last one
 * removes those listeners. Answers are kept: a store that re-subscribes (a
 * remount, StrictMode) keeps reading the last one instead of flickering back
 * while the new query is in flight, and that query corrects it if it went
 * stale.
 */
export const retainOrientationPermission = (
    invalidate: () => void,
): (() => void) => {
    const host = resolveOrientationHost()
    if (host.kind !== "supported") return () => {}
    const record = recordFor(host.view)
    const registration = () => invalidate()
    record.registrations.add(registration)
    if (record.release === undefined) attachQuery(record)
    return () => {
        if (!record.registrations.delete(registration)) return
        if (record.registrations.size > 0) return
        record.release?.()
        record.release = undefined
    }
}

const attachQuery = (record: PermissionRecord) => {
    const permissions =
        typeof navigator === "undefined" ? undefined : navigator.permissions
    let released = false
    const statuses: PermissionStatus[] = []
    const onChange = () => {
        if (released) return
        apply(
            record,
            {
                value: combine(statuses.map(status => status.state)),
                order: ++record.clock,
            },
            "rethrow",
        )
    }
    record.release = () => {
        released = true
        for (const status of statuses)
            status.removeEventListener("change", onChange)
    }
    if (typeof permissions?.query !== "function") return
    const order = ++record.clock
    let queries: Promise<PermissionStatus>[]
    try {
        queries = PERMISSION_NAMES.map(name =>
            permissions.query({ name: name as PermissionName }),
        )
    } catch {
        return
    }
    Promise.all(queries).then(
        results => {
            if (released) return
            for (const status of results) {
                statuses.push(status)
                status.addEventListener("change", onChange)
            }
            apply(
                record,
                { value: combine(results.map(status => status.state)), order },
                "report",
            )
        },
        // Engines that do not know these names (Safari, Firefox) reject: the
        // requestPermission-based answer stands.
        () => {},
    )
}

const toValue = (state: unknown): PermissionValue =>
    state === "granted" ? "granted" : state === "denied" ? "denied" : "prompt"

/**
 * Calls `DeviceOrientationEvent.requestPermission()` synchronously, inside the
 * caller's task, so the transient activation of the user gesture that called
 * this is the one the browser checks. Concurrent calls share one request. The
 * returned promise never rejects: it settles with the browser's answer, and a
 * subscriber that throws while that answer is published is reported (see
 * `reportFailures`), never turned into this promise's outcome.
 */
export const requestOrientationPermissionOnce = (): Promise<PermissionValue> => {
    const host = resolveOrientationHost()
    if (host.kind !== "supported") return Promise.resolve("unsupported")
    const record = recordFor(host.view)
    if (record.pending !== undefined) return record.pending
    const request = host.ctor.requestPermission
    if (typeof request !== "function")
        return Promise.resolve(readOrientationPermission())
    const order = ++record.clock
    let answer: Promise<PermissionState>
    try {
        answer = Promise.resolve(request.call(host.ctor))
    } catch {
        return Promise.resolve(readOrientationPermission())
    }
    const pending = answer.then(
        state => {
            const value = toValue(state)
            if (record.pending === pending) record.pending = undefined
            // "prompt" is not an answer: it changes nothing.
            if (value !== "prompt") apply(record, { value, order }, "report")
            return value
        },
        () => {
            // A rejection means the request could not run — no transient
            // activation (NotAllowedError), or a host failure — not that the
            // user said no. Nothing is recorded, so a later gesture can retry.
            if (record.pending === pending) record.pending = undefined
            return readOrientationPermission()
        },
    )
    record.pending = pending
    return pending
}

/** @internal Tests: forget everything recorded for `view`. */
export const forgetOrientationPermission = (view: Window): void => {
    records.get(view)?.release?.()
    records.delete(view)
}
