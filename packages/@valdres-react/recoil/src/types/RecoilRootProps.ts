import type { ReactNode } from "react"
import type { MutableSnapshot } from "./MutableSnapshot"

export type RecoilRootProps =
    | {
          initializeState?: (mutableSnapshot: MutableSnapshot) => void
          override?: true
          children?: ReactNode
      }
    | {
          override: false
          children?: ReactNode
      }
