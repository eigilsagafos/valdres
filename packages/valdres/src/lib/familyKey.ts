import { stringifyFamilyArgs } from "./stringifyFamilyArgs"

export type EncodedFamilyKey = string | number | boolean | bigint

export const familyKey = (args: readonly unknown[]): EncodedFamilyKey => {
    if (args.length === 1) {
        const a = args[0]
        const t = typeof a
        // The Map key's JS type is already an unforgeable type tag. Keep the
        // allocation-free primitive path where it cannot overlap the encoded
        // string domain. Strings must go through the codec because arbitrary
        // user strings can equal serialized structured values. -0 is encoded
        // because Map's SameValueZero semantics otherwise merge it with +0.
        if (
            t === "boolean" ||
            t === "bigint" ||
            (t === "number" && !Object.is(a, -0))
        )
            return a as EncodedFamilyKey
    }
    return stringifyFamilyArgs(args)
}
