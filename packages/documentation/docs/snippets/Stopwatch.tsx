import { useEffect } from "react"
import { atom, useAtom } from "valdres-react"

const timeAtom = atom(0.0)
const isRunningAtom = atom(false)

export const Stopwatch = () => {
    const [time, setTime] = useAtom(timeAtom)
    const [isRunning, setIsRunning] = useAtom(isRunningAtom)

    useEffect(() => {
        if (isRunning) {
            const interval = setInterval(() => {
                setTime(curr => curr + 0.01)
            }, 10)
            return () => clearInterval(interval)
        }
    }, [isRunning])

    return (
        <div>
            <button onClick={() => setIsRunning(curr => !curr)}>
                {isRunning ? "Stop" : "Start"}
            </button>
            <button
                onClick={() => {
                    setIsRunning(false)
                    setTime(0.0)
                }}
            >
                Reset
            </button>
            <div style={{ fontFamily: "monospace" }}>
                {(Math.round(time * 100) / 100).toFixed(2)}
            </div>
        </div>
    )
}
