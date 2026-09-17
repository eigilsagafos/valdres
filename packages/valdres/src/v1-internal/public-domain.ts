import {
    createDefinitionDomain,
    createDomainStore,
    type InternalStoreTreeInstrumentation,
    type InternalStoreTreeTrace,
} from "./committed-store-tree/committed-store-tree"
import type { CommittedStoreTree } from "./committed-store-tree/types"

/** One records identity shared by separately reachable runtime capabilities. */
export const v1Domain = createDefinitionDomain()

export const createInspectableStoreTree = (
    instrumentation: InternalStoreTreeInstrumentation | undefined,
    trace: InternalStoreTreeTrace,
): CommittedStoreTree => createDomainStore(v1Domain, instrumentation, trace)
