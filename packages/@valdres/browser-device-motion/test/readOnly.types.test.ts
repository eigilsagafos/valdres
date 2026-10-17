/**
 * Compile-time enforcement that motion state is read-only browser truth. The
 * `@ts-expect-error` directives fail `bun run typecheck:tests` if a future
 * change makes any export writable; the runtime rejection is asserted in
 * `src/selectors/motionAtom.test.ts`.
 */
import { expect, test } from "bun:test"
import { store, type ExternalAtom, type Selector, type Store } from "valdres"
import {
    motionAtom,
    motionStatusAtom,
    permissionAtom,
    requestMotionPermission,
    type MotionSnapshot,
    type MotionStatus,
    type PermissionValue,
} from "../src/index"

const rejectedWrites = (app: Store) => {
    // @ts-expect-error a selector cannot be written
    app.set(motionAtom, null)
    // @ts-expect-error a selector cannot be reset
    app.reset(motionStatusAtom)
    // @ts-expect-error an external source cannot be written
    app.set(permissionAtom, "granted")
}

test("reads keep their declared value domains", async () => {
    const app = store()
    const motion: Selector<MotionSnapshot | null> = motionAtom
    const status: Selector<MotionStatus> = motionStatusAtom
    const permission: ExternalAtom<PermissionValue> = permissionAtom
    const request: () => Promise<PermissionValue> = requestMotionPermission
    expect(app.get(motion)).toBeNull()
    expect(typeof app.get(status)).toBe("string")
    expect(typeof app.get(permission)).toBe("string")
    expect(typeof request).toBe("function")
    expect(typeof rejectedWrites).toBe("function")
    app.dispose()
})
