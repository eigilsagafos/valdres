import {
    createCommittedStoreTreeDomain,
    type InternalCommittedStoreTreeDomain,
    type InternalStoreTreeTrace,
} from "./committed-store-tree/committed-store-tree"
import type { CommittedStoreTree } from "./committed-store-tree/types"

/** One owner token and Store/State registry for the public root and adapter.
 * Instrumented StoreTrees must be created through this same domain so they keep
 * exact State/Store ownership compatibility with the ordinary public runtime. */
export const v1Domain: InternalCommittedStoreTreeDomain =
    createCommittedStoreTreeDomain()

/** @internal Construction seam for the opt-in `valdres/inspect` subpath. */
export const createInspectableStoreTree = (
    instrumentation: Parameters<
        InternalCommittedStoreTreeDomain["createStoreTree"]
    >[0],
    trace: InternalStoreTreeTrace,
): CommittedStoreTree => v1Domain.createStoreTree(instrumentation, trace)
