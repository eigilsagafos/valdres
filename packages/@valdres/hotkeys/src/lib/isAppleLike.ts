const IS_APPLE_LIKE_REGEX = /(Mac|iPhone|iPod|iPad)/i

/** Whether `Mod` means Meta here. Reads `navigator` lazily; false without one. */
export const isAppleLike = (): boolean =>
    typeof navigator !== "undefined" &&
    IS_APPLE_LIKE_REGEX.test(navigator.platform ?? "")
