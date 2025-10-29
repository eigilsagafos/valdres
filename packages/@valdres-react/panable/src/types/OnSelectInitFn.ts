import type { Transaction } from "valdres"

export type OnSelectInitFn = (
    txn: Transaction,
    eventId: string | number,
) => void
