/**
 * The part of an `AbortSignal` this package uses, declared here so its
 * declarations compile without the DOM library or Node's types. Any
 * `AbortSignal` fits.
 */
export interface CancelSignal {
    readonly aborted: boolean
    readonly reason: unknown
    addEventListener(
        type: "abort",
        listener: () => void,
        options?: { readonly once?: boolean },
    ): void
    removeEventListener(type: "abort", listener: () => void): void
}
