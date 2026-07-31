export type CacheController = {
    cleanup: () => void
    refCount: number
    active: () => boolean
}
