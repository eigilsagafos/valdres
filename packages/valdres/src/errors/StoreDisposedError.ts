import {
    brandedErrorHasInstance,
    errorBrand,
    markError,
} from "./lib/errorBrand"

const STORE_DISPOSED_ERROR = errorBrand("StoreDisposedError")

/** Thrown when an operation is attempted on a terminally disposed store. */
export class StoreDisposedError extends Error {
    /** Preserve instanceof across adopted same-version package copies. */
    static [Symbol.hasInstance](value: unknown): boolean {
        return brandedErrorHasInstance(
            this,
            StoreDisposedError,
            value,
            STORE_DISPOSED_ERROR,
        )
    }

    constructor(storeId: string) {
        super(`Store "${storeId}" has been disposed`)
        markError(this, STORE_DISPOSED_ERROR)
        this.name = "StoreDisposedError"
    }
}
