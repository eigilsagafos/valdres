import type { PermissionValue } from "../types/PermissionValue"
import { invalidateAll } from "./invalidateAll"
import { resolveGeolocationHost } from "./resolveGeolocationHost"

interface PermissionRecord {
    value: PermissionValue | undefined
    readonly registrations: Set<() => void>
    release: (() => void) | undefined
}

// Per navigator: permission is the origin's, shared by every store.
const records = new WeakMap<Navigator, PermissionRecord>()

const permissionsOf = () => {
    const permissions = navigator.permissions as Permissions | undefined
    return typeof permissions?.query === "function" ? permissions : undefined
}

/**
 * Synchronous, never prompts, never queries: the last answer the Permissions
 * API gave on this page, or `"prompt"` before any.
 */
export const readGeolocationPermission = (): PermissionValue => {
    if (resolveGeolocationHost().kind !== "supported") return "unsupported"
    if (permissionsOf() === undefined) return "unsupported"
    return records.get(navigator)?.value ?? "prompt"
}

const setValue = (record: PermissionRecord, next: PermissionValue) => {
    if (record.value === next) return
    record.value = next
    invalidateAll(record.registrations, "Geolocation permission invalidation failed")
}

/**
 * Registers one store tree. The first registration queries the Permissions API
 * once and follows the status's `change` events; the last one removes the
 * listener. The last answer is kept, so a store that re-subscribes (a remount,
 * StrictMode) keeps reading it instead of flickering back to `"prompt"` while
 * the new query is in flight; that query corrects it if it went stale. A query
 * answered after its release is ignored.
 */
export const retainGeolocationPermission = (
    invalidate: () => void,
): (() => void) => {
    if (resolveGeolocationHost().kind !== "supported") return () => {}
    const permissions = permissionsOf()
    if (permissions === undefined) return () => {}
    const view = navigator
    let record = records.get(view)
    if (record === undefined) {
        record = { value: undefined, registrations: new Set(), release: undefined }
        records.set(view, record)
    }
    const owner = record
    const registration = () => invalidate()
    owner.registrations.add(registration)
    if (owner.release === undefined) {
        let released = false
        let status: PermissionStatus | undefined
        const onChange = () => {
            if (!released && status !== undefined) setValue(owner, status.state)
        }
        owner.release = () => {
            released = true
            status?.removeEventListener("change", onChange)
        }
        let query: Promise<PermissionStatus>
        try {
            query = permissions.query({ name: "geolocation" })
        } catch {
            query = Promise.reject()
        }
        query.then(
            result => {
                if (released) return
                status = result
                result.addEventListener("change", onChange)
                setValue(owner, result.state)
            },
            () => {
                if (!released) setValue(owner, "unsupported")
            },
        )
    }
    return () => {
        if (!owner.registrations.delete(registration)) return
        if (owner.registrations.size > 0) return
        owner.release?.()
        owner.release = undefined
    }
}

/** @internal Tests: forget everything recorded for the current navigator. */
export const forgetGeolocationPermission = (): void => {
    if (typeof navigator === "undefined") return
    records.get(navigator)?.release?.()
    records.delete(navigator)
}
