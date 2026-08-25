import { act } from "@testing-library/react"

/**
 * Settle a `batchUpdates` store and let React apply the notification.
 *
 * A batched store commits on a microtask, and only the commit notifies
 * subscribers — so a component reflects a `store.set` after the flush, not
 * within the same tick. (`useValue` reads the committed value on purpose: a
 * snapshot that moved with the staged write instead would be a change no
 * subscriber callback accompanied, which is what useSyncExternalStore reports as
 * tearing.) `act` wraps the re-render the notification schedules.
 */
export const flushBatch = () => act(async () => {})
