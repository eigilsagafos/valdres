import { StrictMode, useEffect, useRef, useState } from "react"
import { createRoot } from "react-dom/client"
import { store } from "valdres"
import { Provider, useValue } from "valdres-react"
import { colorSchemeAtom, type ColorScheme } from "../src"

// One store owns this demo root. valdres-react has no implicit global store:
// every Provider names the store its subtree reads.
const demoStore = store()

type Entry = { at: string; scheme: ColorScheme }

const Demo = () => {
    const scheme = useValue(colorSchemeAtom)
    const [log, setLog] = useState<Entry[]>([])
    const lastLogged = useRef<ColorScheme | null>(null)

    useEffect(() => {
        if (lastLogged.current === scheme) return
        lastLogged.current = scheme
        setLog(prev =>
            [
                { at: new Date().toLocaleTimeString(), scheme },
                ...prev,
            ].slice(0, 20),
        )
    }, [scheme])

    return (
        <>
            <div className="card">
                <span className={`dot${scheme === "dark" ? " on" : ""}`} />
                <span className="label">{scheme}</span>
            </div>
            <ul className="log">
                {log.map((entry, i) => (
                    <li key={i}>
                        {entry.at} — {entry.scheme}
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
