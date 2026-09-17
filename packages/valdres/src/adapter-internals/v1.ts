import { createDomainAdapter } from "../v1-internal/committed-store-tree/committed-store-tree"
import type {
    CommittedStoreTree as Store,
    State,
} from "../v1-internal/committed-store-tree/committed-store-tree"
import { v1Domain } from "../v1-internal/public-domain"

const adapter = createDomainAdapter(v1Domain)

export const assertStore: (value: unknown) => asserts value is Store =
    adapter.assertStore

export const read: <Value>(store: Store, state: State<Value>) => Value =
    adapter.read

export const subscribe: <Value>(
    store: Store,
    state: State<Value>,
    callback: () => void,
) => () => void = adapter.subscribe

export const readHydrationSnapshot: <Value>(
    store: Store,
    state: State<Value>,
) => Value = adapter.readHydrationSnapshot
