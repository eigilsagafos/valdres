import type { Store } from "valdres"

export type EventCallbackFn = (
    event: MouseEvent | TouchEvent,
    eventId: string,
    store: Store,
) => void
