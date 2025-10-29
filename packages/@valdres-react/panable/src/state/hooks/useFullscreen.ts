import { useEffect } from "react"
import { useAtom, useSetAtom } from "valdres-react"
import { fullscreenEnabledAtom } from "../atoms/fullscreenEnabledAtom"
import { scaleAtom } from "../atoms/scaleAtom"

export const useFullscreen = (ref, enabled = true) => {
    const [isFullscreen, setIsFullscreen] = useAtom(fullscreenEnabledAtom)
    const setScale = useSetAtom(scaleAtom)

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
