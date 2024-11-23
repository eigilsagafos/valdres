import type { TransactionInterface } from "valdres-react"

export type EventCallbackFnOld = (
    txn: TransactionInterface,
    opts: { scopeId: string; eventId: string | number },
) => void

export type EventCallbackFn = (
    event: MouseEvent | TouchEvent,
    eventId: string,
    txn: TransactionInterface,
) => void
