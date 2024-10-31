import type { Mode } from "./Mode"
import type { OnSelectInitFn } from "./OnSelectInitFn"

export type Config = {
    mode: Mode
    onCanvasClick?: OnCanvasClickFn
    onSelectInit?: OnSelectInitFn
}
