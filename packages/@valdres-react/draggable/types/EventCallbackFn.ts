import type { Transaction } from "valdres"

export type EventCallbackFn = (
    event: MouseEvent | TouchEvent,
    eventId: string,
    txn: Transaction,
) => void
