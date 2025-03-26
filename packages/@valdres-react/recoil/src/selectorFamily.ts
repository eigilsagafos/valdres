import {
    selectorFamily as valdresSelectorFamily,
    type SelectorFamily,
} from "valdres"
import {
    type SerializableParam,
    type ReadWriteSelectorFamilyOptions,
    type ReadOnlySelectorFamilyOptions,
} from "recoil"

export const selectorFamily: any = <T, P extends SerializableParam>(
    options:
        | ReadWriteSelectorFamilyOptions<T, P>
        | ReadOnlySelectorFamilyOptions<T, P>,
) => {
    return valdresSelectorFamily(
        // @ts-ignore @ts-todo
        key => get => options.get(key)({ get }),
        {
            name: options.key,
        },
    )
}
