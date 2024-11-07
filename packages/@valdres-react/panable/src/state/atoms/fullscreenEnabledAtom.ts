import { atomFamily } from "valdres-react"
import type { ScopeId } from "../../types/ScopeId"

export const fullscreenEnabledAtom = atomFamily<ScopeId, boolean>(false, {
    name: "@valdres-react/panable/fullscreenEnabledAtom",
})
