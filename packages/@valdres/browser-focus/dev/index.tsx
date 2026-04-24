import { StrictMode, useEffect, useState } from "react"
import { createRoot } from "react-dom/client"
import { Provider, useValue } from "valdres-react"
import { focusAtom } from "../src"

type Entry = { at: string; focused: boolean }

const Demo = () => {
    const focused = useValue(focusAtom)
    const [log, setLog] = useState<Entry[]>([])

    useEffect(() => {
        setLog(prev =>
            [
                { at: new Date().toLocaleTimeString(), focused },
                ...prev,
            ].slice(0, 20),
        )
    }, [focused])

    return (
        <>
            <div className="card">
                <span className={`dot${focused ? " on" : ""}`} />
                <span className="label">
                    {focused ? "focused" : "blurred"}
                </span>
            </div>
            <ul className="log">
                {log.map((entry, i) => (
                    <li key={i}>
                        {entry.at} — {entry.focused ? "focus" : "blur"}
                    </li>
                ))}
            </ul>
        </>
    )
}

const root = createRoot(document.getElementById("root")!)
root.render(
    <StrictMode>
        <Provider>
            <Demo />
        </Provider>
    </StrictMode>,
)
