/** The async snapshot {@link resourceState} exposes for a (possibly async)
 *  selector: the resolved value (or `undefined` while pending or errored), plus
 *  `loading` and `error` flags derived at runtime via core's `isPromiseLike`. */
export interface ResourceState<V> {
    readonly current: V | undefined
    readonly loading: boolean
    readonly error: unknown
}
