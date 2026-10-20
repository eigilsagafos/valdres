import type { RecoilValue } from "../lib/recoilValue"
import type { Loadable } from "./Loadable"
import type { SnapshotID } from "./SnapshotID"

/**
 * The readable part of Recoil's `Snapshot`, valid while the callback that
 * received it runs synchronously. Recoil's retention, `map`/`asyncMap` and
 * introspection members throw `UnsupportedRecoilFeatureError`.
 */
export interface Snapshot {
    getID(): SnapshotID
    getLoadable<T>(recoilValue: RecoilValue<T>): Loadable<T>
    getPromise<T>(recoilValue: RecoilValue<T>): Promise<T>
}
