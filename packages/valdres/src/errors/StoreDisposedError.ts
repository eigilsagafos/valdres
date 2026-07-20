/** Thrown when an operation is attempted on a terminally disposed store. */
export class StoreDisposedError extends Error {
    constructor(storeId: string) {
        super(`Store "${storeId}" has been disposed`)
        this.name = "StoreDisposedError"
    }
}
