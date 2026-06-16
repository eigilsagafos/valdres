/** The reactive box {@link fromState} returns for a selector (or a generic
 *  `State`): a read-only `.current`.
 *
 *  Async selectors surface as `V | Promise<V>` — core erases asyncness (a
 *  `selector(() => Promise.resolve(x))` is typed `Selector<X>`), and at runtime
 *  `.current` is the pending promise until it settles, then the resolved value,
 *  then a fresh promise again on dependency change. The honest type is the
 *  union; consume it with `{#await box.current then v}` or reach for
 *  {@link resourceState} for `loading`/`error` flags. */
export interface FromStateValue<V> {
    readonly current: V | Promise<V>
}
