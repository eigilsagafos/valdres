type Primitive = undefined | null | boolean | number | symbol | string

interface HasToJSON {
    toJSON(): SerializableParam
}

/** Recoil's family parameter type: compared by stable serialization. */
export type SerializableParam =
    | Primitive
    | HasToJSON
    | ReadonlyArray<SerializableParam>
    | ReadonlySet<SerializableParam>
    | ReadonlyMap<SerializableParam, SerializableParam>
    | Readonly<{ [key: string]: SerializableParam }>
