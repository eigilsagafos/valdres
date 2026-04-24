import { screenPermissionAtom } from "../atoms/screenPermissionAtom"

export const subscribe = () => {
    if (typeof window === "undefined") return
    if (typeof navigator === "undefined" || !navigator.permissions?.query) return

    let cancelled = false
    let teardown: (() => void) | undefined

    navigator.permissions
        .query({ name: "window-management" as PermissionName })
        .then(status => {
            if (cancelled) return
            const onChange = () => screenPermissionAtom.setSelf(status.state)
            screenPermissionAtom.setSelf(status.state)
            status.addEventListener("change", onChange)
            teardown = () => status.removeEventListener("change", onChange)
        })
        .catch(() => {})

    return () => {
        cancelled = true
        teardown?.()
    }
}
