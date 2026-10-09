import type { ScreenDetail } from "./ScreenDetail"
import type { ScreenDetailsStatus } from "./ScreenDetailsStatus"

/**
 * One coherent publication. Screens are present only while `"ready"`; `error`
 * only while `"error"` or `"denied"`.
 */
export interface ScreenDetailsState {
    readonly status: ScreenDetailsStatus
    readonly screens: readonly ScreenDetail[]
    readonly currentScreen: ScreenDetail | null
    readonly error: { readonly name: string; readonly message: string } | null
}
