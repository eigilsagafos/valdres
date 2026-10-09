import type { ExternalSource } from "valdres"
import type { ScreenDetailsState } from "../types/ScreenDetailsState"
import { IDLE_STATE, readScreenDetails, retainScreenDetails } from "./screenDetailsRecord"

export const screenDetailsSource: ExternalSource<ScreenDetailsState> = {
    getSnapshot: readScreenDetails,
    getServerSnapshot: () => IDLE_STATE,
    subscribe: retainScreenDetails,
}
