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
}>
