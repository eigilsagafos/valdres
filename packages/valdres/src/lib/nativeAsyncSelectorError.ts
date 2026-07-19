export const nativeAsyncSelectorError = (
    api: "selector()" | "selectorFamily()",
) =>
    new Error(
        api +
            " does not accept async functions. " +
            "Use a sync function that returns a Promise instead.",
    )
