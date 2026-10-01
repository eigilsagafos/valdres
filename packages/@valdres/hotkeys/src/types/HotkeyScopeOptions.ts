export type HotkeyScopeOptions = Readonly<{
    /** For diagnostics and selector names. Default: a generated name. */
    name?: string
    /** Layer priority; finite. Default 0, the same as the base layer. */
    priority?: number
    /** While active, block every binding in a lower layer. Default `false`. */
    exclusive?: boolean
}>
