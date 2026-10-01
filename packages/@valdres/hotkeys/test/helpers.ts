import { atom, type Atom, type Store } from "valdres"
import { bindHotkey } from "../src/index"
import type { HotkeyOptions } from "../src/types/HotkeyOptions"

// The keyboard package's own Happy-DOM harness: real KeyboardEvents through
// the hub's real listeners, with a fresh hub per test.
export {
    installKeyboardHarness,
    type KeyboardHarness,
} from "../../browser-keyboard/test/setup/keyboardHarness"

export const setPlatform = (platform: string) =>
    Object.defineProperty(navigator, "platform", {
        value: platform,
        configurable: true,
    })

/** Causes listed by a reported SubscriberNotificationError, as strings. */
export const causes = (error: unknown): string =>
    ((error as { causes?: unknown[] } | undefined)?.causes ?? [])
        .map(String)
        .join("\n")

/** A binding that counts its runs in a store atom and records the sequences it handled. */
export const counted = (
    store: Store,
    shortcut: string | readonly string[],
    options?: HotkeyOptions,
) => {
    const runs: Atom<number> = atom(0)
    const sequences: number[] = []
    const stop = bindHotkey(
        store,
        shortcut,
        (tx, hit) => {
            sequences.push(hit.keyDown.sequence)
            tx.set(runs, tx.get(runs) + 1)
        },
        options,
    )
    return { runs, sequences, stop, count: () => store.get(runs) }
}
