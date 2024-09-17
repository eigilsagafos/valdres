import type { AtomOptions } from "recoil"
import { atom as valdresAtom } from "valdres-react"

export const atom = <T>(args: AtomOptions<T>) => {
    return valdresAtom(args.default, { label: args.key })
}
