import { stableStringify } from "./stableStringify"

/** Preserve the concise, pre-codec representation used in member debug names.
 * It is display metadata, never cache identity. */
export const displayFamilyArgs = (
    args: readonly unknown[],
): string | number | boolean => {
    const displayed =
        args.length === 1
            ? stableStringify(args[0])
            : stableStringify(args as unknown[])
    return typeof displayed === "bigint" ? String(displayed) : displayed
}
