import { createContext } from "@lit/context"
import type { Store } from "valdres"

export const valdresContext = createContext<Store>(Symbol.for("valdres-lit"))
