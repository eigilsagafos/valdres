/**
 * Compile-time enforcement that keyboard state is read-only browser truth. The
 * `@ts-expect-error` directives fail `bun run typecheck:tests` if any source or
 * derived read becomes writable. They sit in a function that is never called;
 * runtime rejection is asserted in `src/atoms/keyboardAtom.test.ts`.
 */
import { expect, test } from "bun:test"
import { store, type ExternalAtom, type Selector, type Store } from "valdres"
import {
    isCodePressedSelector,
    isKeyPressedSelector,
    keyboardAtom,
    modifierSelector,
    pressedCodesSelector,
    pressedKeysAtom,
    pressedKeyValuesSelector,
    toggleKeyAtom,
    type KeyboardSnapshot,
    type PressedKey,
} from "../src/index"

const rejectedWrites = (app: Store, snapshot: KeyboardSnapshot) => {
    // @ts-expect-error an external source cannot be written
    app.set(keyboardAtom, snapshot)
    // @ts-expect-error an external source cannot be reset
    app.reset(keyboardAtom)
    // @ts-expect-error an external source cannot be updated
    app.update(keyboardAtom, () => snapshot)
    // @ts-expect-error pressed keys are derived, not writable
    app.set(pressedKeysAtom, [])
    // @ts-expect-error lock state is derived, not writable
    app.set(toggleKeyAtom("CapsLock"), true)
    // @ts-expect-error snapshots are readonly
    snapshot.pressed.push({ code: "KeyA", key: "a", timeStamp: 0, target: null })
    // @ts-expect-error snapshot entries are readonly
    snapshot.pressed[0]!.code = "KeyB"
    // @ts-expect-error lock records are readonly
    snapshot.locks.CapsLock = true
    // @ts-expect-error codes outside the known union are rejected by this family
    isCodePressedSelector("NotACode")
    // @ts-expect-error only the four modifiers exist
    modifierSelector("hyper")
    // @ts-expect-error only the three lock keys exist
    toggleKeyAtom("KanaMode")
}

test("reads keep their declared value domains", () => {
    const app = store()
    const source: ExternalAtom<KeyboardSnapshot> = keyboardAtom
    const pressed: Selector<readonly PressedKey[]> = pressedKeysAtom
    const codes: string[] = app.get(pressedCodesSelector)
    const keys: string[] = app.get(pressedKeyValuesSelector)
    const code: boolean = app.get(isCodePressedSelector("KeyA"))
    const key: boolean = app.get(isKeyPressedSelector("a"))
    const shift: boolean = app.get(modifierSelector("shift"))
    const caps: boolean | null = app.get(toggleKeyAtom("CapsLock"))
    expect([codes, keys, code, key, shift, caps]).toEqual([[], [], false, false, false, null])
    expect(app.get(source).pressed).toBe(app.get(pressed))
    expect(typeof rejectedWrites).toBe("function")
    app.dispose()
})
