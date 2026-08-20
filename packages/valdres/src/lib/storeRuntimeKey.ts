/** Structural StoreData keys shared by compatible adopted copies. These are
 * not capability tokens: STORE_DATA_ACCESS deliberately remains copy-private. */
export const STORE_RUNTIME: unique symbol = Symbol.for("valdres.storeRuntime")
export const BORROWED_STORE_RUNTIME: unique symbol = Symbol.for(
    "valdres.borrowedStoreRuntime",
)
