/**
 * Compile-time enforcement that the screen is read-only browser truth. The
 * `@ts-expect-error` directives fail `bun run typecheck:tests` if a future
 * change makes `screenAtom` writable again or its snapshots mutable; the
 * runtime rejection is asserted in `src/atoms/screenAtom.test.ts`.
 */
import { expect, test } from "bun:test"
import { store, type ExternalAtom, type Store } from "valdres"
import {
    screenAtom,
    type ScreenInfo,
    type ScreenOrientationType,
} from "../src/index"

const rejectedWrites = (app: Store, info: ScreenInfo) => {
    // @ts-expect-error an external source cannot be written
    app.set(screenAtom, info)
    // @ts-expect-error an external source cannot be reset
    app.reset(screenAtom)
    // @ts-expect-error an external source cannot be updated
    app.update(screenAtom, () => info)
    // @ts-expect-error snapshots are shared between stores, so they are read-only
    info.devicePixelRatio = 2
}

// The package's own orientation type and the DOM's are interchangeable.
const fromDom = (type: OrientationType): ScreenOrientationType => type
const toDom = (type: ScreenOrientationType): OrientationType => type

test("reads keep their declared value domain", () => {
    const app = store()
    const definition: ExternalAtom<ScreenInfo> = screenAtom
    const info: ScreenInfo = app.get(definition)
    const orientation: ScreenOrientationType = info.orientationType
    expect(typeof orientation).toBe("string")
    expect(typeof rejectedWrites).toBe("function")
    expect(toDom(fromDom("portrait-primary"))).toBe("portrait-primary")
    app.dispose()
})
