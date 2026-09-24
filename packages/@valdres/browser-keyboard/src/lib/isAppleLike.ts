const IS_APPLE_LIKE_REGEX = /(Mac|iPhone|iPod|iPad)/i

export const isAppleLike = (): boolean =>
    typeof navigator !== "undefined" &&
    IS_APPLE_LIKE_REGEX.test(navigator.platform ?? "")
