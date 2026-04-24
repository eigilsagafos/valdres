import type { ScreenDetail } from "../../types/ScreenDetail"

interface DetailsState {
    request: Promise<ScreenDetail[] | null> | null
}

export const detailsState: DetailsState = { request: null }
