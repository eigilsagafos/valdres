import { atom } from "valdres"

export const cameraPositionAtom = atom<{
    x: number
    y: number
    default?: boolean
    animate?: boolean
}>(
    { x: 100, y: 0, animate: false },
    { name: "@valdres-react/panable/cameraPosition" },
)
