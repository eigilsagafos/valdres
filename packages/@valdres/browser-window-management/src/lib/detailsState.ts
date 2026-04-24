import type { ScreenDetail } from "../../types/ScreenDetail"

interface DetailsState {
    inflight: Promise<ScreenDetail[] | null> | null
}

export const detailsState: DetailsState = { inflight: null }
