import type { AtomOptions } from "recoil"
import { atom as baseAtom } from "../atom"

export const atom = <T>(args: AtomOptions<T>) => {
    return baseAtom(args.default, args.key)
}
