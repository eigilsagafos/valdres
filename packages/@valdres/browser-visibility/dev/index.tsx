import { StrictMode, useEffect, useRef, useState } from "react"
import { createRoot } from "react-dom/client"
import { store } from "valdres"
import { Provider, useValue } from "valdres-react"
import { visibilityAtom, type PageVisibility } from "../src"

// One store owns this demo root. valdres-react has no implicit global
// store: every Provider names the store its subtree reads.
const demoStore = store()

type Entry = { at: string; visibility: PageVisibility }

const Demo = () => {
    const visibility = useValue(visibilityAtom)
    const [log, setLog] = useState<Entry[]>([])
    const lastLogged = useRef<PageVisibility | null>(null)

    useEffect(() => {
        if (lastLogged.current === visibility) return
        lastLogged.current = visibility
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
        <Provider store={demoStore}>
            <Demo />
        </Provider>
    </StrictMode>,
)
