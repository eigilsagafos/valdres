import type { ReadWriteSelectorOptions } from "./ReadWriteSelectorOptions"
import type { ReadOnlySelectorFamilyOptions } from "./ReadOnlySelectorFamilyOptions"
import type { SerializableParam } from "./SerializableParam"

export interface ReadWriteSelectorFamilyOptions<T, P extends SerializableParam>
    extends ReadOnlySelectorFamilyOptions<T, P> {
    set: (param: P) => ReadWriteSelectorOptions<T>["set"]
}
