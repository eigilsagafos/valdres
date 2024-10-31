import type { TransactionInterface } from "valdres-react"
import type { ScopeId } from "./ScopeId"

export type OnSelectInitFn = (
    txn: TransactionInterface,
    eventId: string | number,
    scopeId: ScopeId,
) => void
