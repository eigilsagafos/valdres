import { atomFamily } from "valdres"
import type { ScopeId } from "../../types/ScopeId"

export const fullscreenEnabledAtom = atomFamily<ScopeId, boolean>(false, {
    name: "@valdres-react/panable/fullscreenEnabledAtom",
})
