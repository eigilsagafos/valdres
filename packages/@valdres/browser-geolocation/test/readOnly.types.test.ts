/**
 * Compile-time enforcement that geolocation state is read-only. The
 * `@ts-expect-error` directives fail `bun run typecheck:tests` if a future
 * change makes any export writable; runtime rejection is asserted in
 * `src/utils/watchGeolocation.test.ts`.
 */
import { expect, test } from "bun:test"
import { store, type ExternalAtom, type Selector, type Store } from "valdres"
import {
    geolocationAtom,
    geolocationErrorAtom,
    geolocationStatusAtom,
    permissionAtom,
    positionAtom,
    watchGeolocation,
    type GeolocationError,
    type GeolocationSnapshot,
    type GeolocationState,
    type GeolocationStatus,
    type GeolocationWatchOptions,
    type PermissionValue,
} from "../src/index"

const rejectedWrites = (app: Store) => {
    // @ts-expect-error a selector cannot be written
    app.set(positionAtom, null)
    // @ts-expect-error a selector cannot be reset
    app.reset(geolocationAtom)
    // @ts-expect-error an external source cannot be written
    app.set(permissionAtom, "granted")
    // @ts-expect-error options are checked
    watchGeolocation(app, { enableHighAccuracy: "yes" })
    // @ts-expect-error a store is required
    watchGeolocation()
}

test("reads keep their declared value domains", () => {
    const app = store()
    const state: Selector<GeolocationState> = geolocationAtom
    const position: Selector<GeolocationSnapshot | null> = positionAtom
    const status: Selector<GeolocationStatus> = geolocationStatusAtom
    const error: Selector<GeolocationError | null> = geolocationErrorAtom
    const permission: ExternalAtom<PermissionValue> = permissionAtom
    const options: GeolocationWatchOptions = { enableHighAccuracy: true, timeout: 5_000 }
    const watch: (store: Store, options?: GeolocationWatchOptions) => () => void =
        watchGeolocation
    expect(app.get(state).status).toBe(app.get(status))
    expect([app.get(position), app.get(error)]).toEqual([null, null])
    expect(typeof app.get(permission)).toBe("string")
    expect([typeof watch, typeof rejectedWrites, options.timeout]).toEqual([
        "function",
        "function",
        5_000,
    ])
    app.dispose()
})
