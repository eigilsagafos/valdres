export type PressedKey = Readonly<{
    code: string
    key: string
    /** `timeStamp` of the keydown that first observed the press; unchanged by repeats. */
    timeStamp: number
    target: EventTarget | null
}>
