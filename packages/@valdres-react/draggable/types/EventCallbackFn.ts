import type { Transaction } from "valdres"

export type EventCallbackFnOld = (
    txn: Transaction,
    opts: { scopeId: string; eventId: string | number },
) => void

export type EventCallbackFn = (
    event: MouseEvent | TouchEvent,
    eventId: string,
    txn: Transaction,
) => void
