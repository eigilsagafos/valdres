import type { Transaction } from "valdres"
import type { ScopeId } from "./ScopeId"

export type OnSelectInitFn = (
    txn: Transaction,
    eventId: string | number,
    scopeId: ScopeId,
) => void
