import { StrictMode, useEffect, useRef, useState } from "react"
import { createRoot } from "react-dom/client"
import { store } from "valdres"
import { Provider, useValue } from "valdres-react"
import { focusAtom } from "../src"

// One store owns this demo root. valdres-react has no implicit global
// store: every Provider names the store its subtree reads.
const demoStore = store()

type Entry = { at: string; focused: boolean }

const Demo = () => {
    const focused = useValue(focusAtom)
    const [log, setLog] = useState<Entry[]>([])
    const lastLogged = useRef<boolean | null>(null)

    useEffect(() => {
        if (lastLogged.current === focused) return
        lastLogged.current = focused
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
        <Provider store={demoStore}>
            <Demo />
        </Provider>
    </StrictMode>,
)
