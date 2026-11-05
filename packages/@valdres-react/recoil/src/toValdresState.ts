import type { State } from "valdres"
import { nodeOf, type RecoilValue } from "./lib/recoilValue"

/**
 * The read-only Valdres State behind a Recoil atom or selector, for reading it
 * with `valdres-react` hooks or native selectors while migrating. Write
 * through this package.
 */
export const toValdresState = <T>(recoilValue: RecoilValue<T>): State<T> =>
    nodeOf(recoilValue, "toValdresState").state
