/**
 * The `"window-management"` permission as the Permissions API reports it, or
 * as the last request answered it. `"prompt"` when neither is known yet;
 * `"unsupported"` without the API or in an insecure context.
 */
export type ScreenPermissionState =
    | "prompt"
    | "granted"
    | "denied"
    | "unsupported"
