/** An opaque snapshot identity. */
export type SnapshotID = number & { readonly __snapshotID: true }
