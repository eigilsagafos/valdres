export const selector = <V>(
    get: (getter: () => V | Promise<V>) => any,
    debugLabel?: string
) => ({
    get,
    debugLabel,
})
