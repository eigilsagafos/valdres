import { StrictMode, useRef, useState, type ReactNode } from "react"
import { createRoot } from "react-dom/client"
import { store, type ExternalAtom } from "valdres"
import { Provider, useValue } from "valdres-react"
import {
    publicIpAtom,
    publicIpV4Atom,
    publicIpV6Atom,
    requestPublicIp,
    type PublicIpFamily,
    type PublicIpState,
} from "../src"

const families: {
    family: PublicIpFamily
    name: string
    state: ExternalAtom<PublicIpState>
}[] = [
    { family: "any", name: "publicIpAtom", state: publicIpAtom },
    { family: "v4", name: "publicIpV4Atom", state: publicIpV4Atom },
    { family: "v6", name: "publicIpV6Atom", state: publicIpV6Atom },
]

const PILL: Record<PublicIpState["status"], string> = {
    unsupported: "error",
    idle: "idle",
    pending: "loading",
    ready: "ok",
    error: "error",
}

const Row = ({ name, children }: { name: string; children: ReactNode }) => (
    <div className="row">
        <code className="atom-name">{name}</code>
        <div className="row-value">{children}</div>
    </div>
)

const Family = ({ family, name, state }: (typeof families)[number]) => {
    const value = useValue(state)
    const [endpoints, setEndpoints] = useState("")
    const controller = useRef<AbortController | null>(null)
    const request = (fresh: boolean) => {
        controller.current = new AbortController()
        const list = endpoints
            .split("\n")
            .map(line => line.trim())
            .filter(Boolean)
        requestPublicIp({
            family,
            fresh,
            signal: controller.current.signal,
            ...(list.length > 0 ? { endpoints: list } : {}),
        }).catch(() => {})
    }
    return (
        <section className="panel">
            <header className="panel-header">
                <code className="panel-title">{name}</code>
            </header>
            <Row name="status">
                <span className={`pill pill-${PILL[value.status]}`}>
                    {value.status}
                </span>
            </Row>
            <Row name="ip">
                {value.ip === null ? (
                    <span className="null">null</span>
                ) : (
                    <span className="string">{value.ip}</span>
                )}
            </Row>
            <Row name="updatedAt">
                {value.updatedAt === null ? (
                    <span className="null">null</span>
                ) : (
                    new Date(value.updatedAt).toLocaleTimeString()
                )}
            </Row>
            <Row name="error">
                {value.error === null ? (
                    <span className="null">null</span>
                ) : (
                    <span className="error-text">{`${value.error.name}: ${value.error.message}`}</span>
                )}
            </Row>
            <Row name="endpoints">
                <textarea
                    rows={2}
                    placeholder="default endpoints (one URL per line to override)"
                    value={endpoints}
                    onChange={event => setEndpoints(event.target.value)}
                />
            </Row>
            <div className="row">
                <button onClick={() => request(false)}>Request</button>
                <button onClick={() => request(true)}>Request fresh</button>
                <button onClick={() => controller.current?.abort()}>
                    Cancel mine
                </button>
            </div>
        </section>
    )
}

const App = () => (
    <>
        <header className="app-header">
            <h1>@valdres/public-ip</h1>
            <p className="tagline">
                Nothing is requested until you press a button. Each request
                reveals this browser's IP address to the endpoint it asks.
            </p>
        </header>
        {families.map(family => (
            <Family key={family.family} {...family} />
        ))}
    </>
)

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <Provider store={store()}>
            <App />
        </Provider>
    </StrictMode>,
)
