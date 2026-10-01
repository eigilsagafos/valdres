/** One observed `keydown`, repeats included. */
export type KeyDown = Readonly<{
    code: string
    key: string
    /** `true` for an auto-repeat of a key that is being held. */
    repeat: boolean
    timeStamp: number
    /**
     * Increases by one for every observed keydown in this document, and is
     * never reset, so two keydowns never compare equal even when every other
     * field matches.
     */
    sequence: number
    /**
     * Whether the keydown was aimed at text entry: a textarea, a select, a
     * text-like input or a contenteditable element, looking through open shadow
     * roots. Read when the keyboard's listener received the event.
     */
    editable: boolean
    /**
     * Whether something had already cancelled the keydown when the keyboard's
     * listener received it: element and capture listeners, framework handlers
     * on a root element, and `document` listeners added before the keyboard's.
     * A snapshot taken before any store is updated, so a store that cancels the
     * keydown later never changes it, for that store or any other.
     */
    defaultPrevented: boolean
}>
