import type { ResetRecoilState } from "./ResetRecoilState"
import type { SetRecoilState } from "./SetRecoilState"
import type { Snapshot } from "./Snapshot"

/** What `initializeState` receives: writes apply immediately. */
export interface MutableSnapshot extends Snapshot {
    set: SetRecoilState
    reset: ResetRecoilState
}
