import type { TransactionInterface } from "valdres"

export type EventCallbackFnOld = (
    txn: TransactionInterface,
    opts: { scopeId: string; eventId: string | number },
) => void

export type EventCallbackFn = (
    event: MouseEvent | TouchEvent,
    eventId: string,
    txn: TransactionInterface,
) => void
