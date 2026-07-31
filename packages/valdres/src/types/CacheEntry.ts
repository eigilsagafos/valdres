export type CacheEntry = {
    lastWriteAt?: number
    release?: () => void
}
