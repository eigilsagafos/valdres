import type { ScreenDetail } from "../../types/ScreenDetail"

interface DetailsState {
    details: EventTarget | null
    inflight: Promise<ScreenDetail[] | null> | null
}

export const detailsState: DetailsState = { details: null, inflight: null }
