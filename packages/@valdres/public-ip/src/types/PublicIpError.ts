/** A frozen copy of a failed request's error, safe to render and compare. */
export interface PublicIpError {
    readonly name: string
    readonly message: string
}
