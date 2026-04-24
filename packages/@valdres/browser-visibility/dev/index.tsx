import { StrictMode, useEffect, useState } from "react"
import { createRoot } from "react-dom/client"
import { Provider, useValue } from "valdres-react"
import { visibilityAtom } from "../src"

type Entry = { at: string; visibility: DocumentVisibilityState }

const Demo = () => {
    const visibility = useValue(visibilityAtom)
    const [log, setLog] = useState<Entry[]>([])

    useEffect(() => {
        setLog(prev =>
            [
                { at: new Date().toLocaleTimeString(), visibility },
                ...prev,
            ].slice(0, 20),
        )
    }, [visibility])

    return (
        <>
            <div className="card">
                <span
                    className={`dot${visibility === "visible" ? " on" : ""}`}
                />
                <span className="label">{visibility}</span>
            </div>
            <ul className="log">
                {log.map((entry, i) => (
                    <li key={i}>
                        {entry.at} — {entry.visibility}
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
