/** `unsetAll` reverts a store's own values to what it inherits, so it is only
 *  meaningful on a scope. A root store has nothing to fall back to — and no way
 *  to enumerate its own values in the first place: `scopeIndexKeys` is a scope's
 *  register of what it shadows in its parent, and a default (non-enumerable)
 *  store keeps `values` in a WeakMap. Thrown rather than treated as a no-op so a
 *  handle mix-up surfaces at the call site instead of silently doing nothing.
 *
 *  `entryPoint` names the surface in the message, so the error points at the
 *  call the caller actually made. */
export const rootUnsetAllError = (
    storeId: string,
    entryPoint: "store" | "transaction",
) =>
    `valdres: ${entryPoint}.unsetAll() is only available on a scope, and store '${storeId}' is a root store.
A scope's own values revert to the values it inherits from its parent; a root store has no parent to revert to.
Reach a scope with store.scope(scopeId) or, inside a transaction, txn.scope(scopeId, txn => txn.unsetAll()).`
