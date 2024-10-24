import type { TransactionInterface } from "valdres-react"

export type EventCallbackFn = (
    txn: TransactionInterface,
    opts: { scopeId: string; eventId: string | number },
) => void
