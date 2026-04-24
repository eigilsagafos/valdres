import { screenPermissionAtom } from "../atoms/screenPermissionAtom"

let bootstrapped = false

export const subscribe = () => {
    if (typeof window === "undefined") return
    if (bootstrapped) return
    bootstrapped = true

    if (typeof navigator === "undefined" || !navigator.permissions) return

    navigator.permissions
        .query({ name: "window-management" as PermissionName })
        .then(status => {
            screenPermissionAtom.setSelf(status.state)
            status.addEventListener("change", () =>
                screenPermissionAtom.setSelf(status.state),
            )
        })
        .catch(() => {})
}
