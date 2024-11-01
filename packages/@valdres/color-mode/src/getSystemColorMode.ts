import type { ColorMode } from "../types/ColorMode"
import { prefersColorSchemeDark } from "./prefersColorSchemeDark"

export const getSystemColorMode = (): ColorMode => {
    if (window?.matchMedia?.(prefersColorSchemeDark)?.matches) {
        return "dark"
    } else {
        return "light"
    }
}
