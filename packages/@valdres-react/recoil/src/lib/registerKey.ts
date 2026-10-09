const keys = new Set<string>()

/**
 * Recoil keeps one global registry by key, so a reused key aliases the earlier
 * definition's state. Here each definition owns its own state; warn once per
 * reused key so the difference is visible (hot module replacement re-creates
 * definitions and will warn too).
 */
export const registerKey = (key: string, kind: "atom" | "selector") => {
    if (typeof key !== "string")
        throw new Error(
            `A key option with a unique string value must be provided when creating ${kind === "atom" ? "an atom" : "a selector"}.`,
        )
    if (!keys.has(key)) {
        keys.add(key)
        return
    }
    console.warn(
        `Duplicate atom key "${key}". @valdres-react/recoil identifies atoms and selectors by object, not by key: this definition has its own state and does not share the state of the earlier definition with the same key.`,
    )
}
