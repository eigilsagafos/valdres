import type { GlobalAtom } from "valdres"

export type PermissionValue = PermissionState | "unsupported"

export const subscribePermission = (
    permissionAtom: GlobalAtom<PermissionValue>,
) => {
    if (
        typeof navigator === "undefined" ||
        !navigator.permissions?.query
    ) {
        permissionAtom.setSelf("unsupported")
        return
    }

    let status: PermissionStatus | undefined
    let cancelled = false

    const onChange = () => {
        if (status) permissionAtom.setSelf(status.state)
    }

    navigator.permissions
        // cast: TS lib's PermissionName union omits "geolocation" in some
        // versions, but the runtime spec includes it.
        .query({ name: "geolocation" as PermissionName })
        .then(result => {
            if (cancelled) return
            status = result
            permissionAtom.setSelf(result.state)
            result.addEventListener("change", onChange)
        })
        .catch(() => {
            if (!cancelled) permissionAtom.setSelf("unsupported")
        })

    return () => {
        cancelled = true
        status?.removeEventListener("change", onChange)
    }
}
