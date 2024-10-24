import { useAtom, useSetAtom } from "valdres-react"
import { useEffect } from "react"
import { scaleAtom } from "../atoms/scaleAtom"
import { fullscreenEnabledAtom } from "../atoms/fullscreenEnabledAtom"
import type { ScopeId } from "../../types/ScopeId"

export const useFullscreen = (ref, scopeId: ScopeId, enabled = true) => {
    const [isFullscreen, setIsFullscreen] = useAtom(
        fullscreenEnabledAtom(scopeId),
    )
    const setScale = useSetAtom(scaleAtom(scopeId))

    useEffect(() => {
        if (isFullscreen === false) {
            document.exitFullscreen()
        } else if (isFullscreen === true) {
            ref.current.requestFullscreen()
            let oldScale
            setScale(prev => {
                oldScale = prev
                return 1.0
            })
            return () => setScale(oldScale)
        }
    }, [isFullscreen])

    useEffect(() => {
        if (enabled) {
            const fullScreenEvent = [
                "fullscreenchange",
                "webkitfullscreenchange",
                "mozfullscreenchange",
                "msfullscreenchange",
            ]

            const fullscreenToggle = () => {
                const isFullscreen =
                    Boolean(document.fullscreenElement) ||
                    Boolean((document as any).webkitFullscreenElement)

                if (isFullscreen) {
                    setIsFullscreen(true)
                } else {
                    setIsFullscreen(false)
                }
            }

            fullScreenEvent.forEach(eventType =>
                document.addEventListener(eventType, fullscreenToggle, false),
            )

            return () => {
                fullScreenEvent.forEach(eventType =>
                    document.removeEventListener(
                        eventType,
                        fullscreenToggle,
                        false,
                    ),
                )
            }
        }
    }, [enabled])

    return isFullscreen
}
