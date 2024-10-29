import useResizeObserver from "@react-hook/resize-observer"
import { useSetAtom, type Atom } from "valdres-react"
import { useEffect } from "react"
import type { ScopeId } from "../../types/ScopeId"
import type { Size } from "../../../../draggable/src/types/Size"

export const useUpdateAtomRectOnSizeChange = (
    ref,
    atom: Atom<Size>,
    scopeId: ScopeId = null,
) => {
    const setSize = useSetAtom(atom)
    useResizeObserver(ref, ({ contentRect, target }) => {
        const rect = target.getBoundingClientRect()
        setSize({
            bottom: contentRect.bottom,
            height: contentRect.height,
            left: rect.left,
            right: contentRect.right,
            top: rect.top,
            width: contentRect.width,
            x: contentRect.x,
            y: contentRect.y,
        })
    })

    useEffect(() => {
        const rect = ref.current.getBoundingClientRect()
        setSize({
            bottom: rect.bottom,
            height: rect.height,
            left: rect.left,
            right: rect.right,
            top: rect.top,
            width: rect.width,
            x: rect.x,
            y: rect.y,
        })
    }, [scopeId])
}