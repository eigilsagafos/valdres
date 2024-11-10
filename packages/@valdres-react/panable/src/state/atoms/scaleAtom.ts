import { atomFamily } from "valdres"
import type { ScopeId } from "../../types/ScopeId"

export const scaleAtom = atomFamily<ScopeId, number>(1.0, {
    name: "@valdres-react/panable/scaleAtom",
})
