/** A frozen copy of a failed measurement's error, safe to render and compare. */
export interface BandwidthError {
    readonly name: string
    readonly message: string
}
