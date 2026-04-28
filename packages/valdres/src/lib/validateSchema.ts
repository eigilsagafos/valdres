import type { Schema } from "../types/Schema"
import type { StoreData } from "../types/StoreData"

export const validateSchema = <V>(
    schema: Schema<V> | undefined,
    value: V,
    data: StoreData,
): V => {
    if (data.schemaValidation !== false && schema) {
        return schema.parse(value)
    }
    return value
}
