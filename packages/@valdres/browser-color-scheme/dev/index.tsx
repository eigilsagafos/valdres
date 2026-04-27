import { StrictMode, useEffect, useRef, useState } from "react"
import { createRoot } from "react-dom/client"
import { Provider, useValue } from "valdres-react"
import { colorSchemeAtom, type ColorScheme } from "../src"

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
        <Provider>
            <Demo />
        </Provider>
    </StrictMode>,
)
