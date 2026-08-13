export const nativeAsyncSelectorError = (
    api: "selector()" | "selectorFamily()",
) =>
    new Error(
        "valdres: " +
            api +
            " does not accept async functions. " +
            "Use a sync function that returns a Promise instead.",
    )
