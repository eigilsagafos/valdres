import type { DragAction } from "./DragAction"
import type { MoveAction } from "./MoveAction"
import type { SelectAction } from "./SelectAction"
import type { ZoomAction } from "./ZoomAction"

export type Action = DragAction | MoveAction | SelectAction | ZoomAction
