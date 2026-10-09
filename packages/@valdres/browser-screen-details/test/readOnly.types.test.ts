/**
 * Compile-time enforcement that screen details are read-only browser truth.
 * The `@ts-expect-error` directives fail `bun run typecheck:tests` if a future
 * change makes any export writable.
 */
import { expect, test } from "bun:test"
import { store, type ExternalAtom, type Selector, type Store } from "valdres"
import {
    currentScreenAtom,
    requestScreenDetails,
    screenDetailsAtom,
    screenDetailsStatusAtom,
    screenPermissionAtom,
    screensAtom,
    type ScreenDetail,
    type ScreenDetailsState,
    type ScreenDetailsStatus,
    type ScreenPermissionState,
} from "../src/index"

const rejectedWrites = (app: Store) => {
    // @ts-expect-error an external source cannot be written
    app.set(screenDetailsAtom, app.get(screenDetailsAtom))
    // @ts-expect-error a selector cannot be written
    app.set(screensAtom, [])
    // @ts-expect-error an external source cannot be reset
    app.reset(screenPermissionAtom)
}

test("reads keep their declared value domains", () => {
    const app = store()
    const state: ExternalAtom<ScreenDetailsState> = screenDetailsAtom
    const screens: Selector<readonly ScreenDetail[]> = screensAtom
    const current: Selector<ScreenDetail | null> = currentScreenAtom
    const status: Selector<ScreenDetailsStatus> = screenDetailsStatusAtom
    const permission: ExternalAtom<ScreenPermissionState> = screenPermissionAtom
    const request: () => Promise<ScreenDetail[] | null> = requestScreenDetails
    expect(app.get(state).status).toBe(app.get(status))
    expect([app.get(screens), app.get(current)]).toEqual([[], null])
    expect(typeof app.get(permission)).toBe("string")
    expect([typeof request, typeof rejectedWrites]).toEqual(["function", "function"])
    app.dispose()
})
