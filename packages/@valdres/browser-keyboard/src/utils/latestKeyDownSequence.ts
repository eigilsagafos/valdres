import { peekKeyboardHub } from "../lib/keyboardHubs"

/**
 * The `sequence` of the latest keydown this document has observed: 0 before
 * the first, before tracking starts, and where there is no `document`. Unlike
 * a store read it is never one keydown behind while that keydown is still
 * being delivered to other stores, and a focus-loss reset does not lower it.
 * Use it as a watermark: a handler that ignores sequences at or below it never
 * acts on a keydown that happened before the handler existed.
 */
export const latestKeyDownSequence = (): number =>
    peekKeyboardHub()?.sequence() ?? 0
