export type SetterOrUpdater<T> = (valueOrUpdater: ((current: T) => T) | T) => void
