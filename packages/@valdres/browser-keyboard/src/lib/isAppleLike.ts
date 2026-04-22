const IS_APPLE_LIKE_REGEX = /(Mac|iPhone|iPod|iPad)/i

export const isAppleLike = () => {
    return IS_APPLE_LIKE_REGEX.test(navigator.platform)
}
