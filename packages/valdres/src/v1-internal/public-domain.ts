import { createCommittedStoreTreeDomain } from "./committed-store-tree/committed-store-tree"

/** One owner token and Store/State registry for the public root and adapter. */
export const v1Domain = createCommittedStoreTreeDomain()
