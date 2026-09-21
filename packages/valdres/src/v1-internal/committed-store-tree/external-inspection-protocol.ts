/** Optional projection events. Report strings stay in the inspection subpath. */
export const enum ExternalInspectionEvent {
    sample = 96,
    attach,
    detach,
    invalidate,
    publish,
    drain,
    nonconvergence,
    deliveryLimit,
}
