import { StrictMode, useEffect, useState, type ReactNode } from "react"
import { createRoot } from "react-dom/client"
import { cacheMeta, type GlobalAtom } from "valdres"
import { Provider, useStore, useValue } from "valdres-react"
import {
    publicIpAtom,
    publicIpValueAtom,
    publicIpStatusAtom,
    publicIpErrorAtom,
    publicIpEndpointsAtom,
    publicIpV4Atom,
    publicIpV4ValueAtom,
    publicIpV4StatusAtom,
    publicIpV4ErrorAtom,
    publicIpV4EndpointsAtom,
    publicIpV6Atom,
    publicIpV6ValueAtom,
    publicIpV6StatusAtom,
    publicIpV6ErrorAtom,
    publicIpV6EndpointsAtom,
    publicIpMaxAgeAtom,
    publicIpStaleWhileRevalidateAtom,
    publicIpStaleIfErrorAtom,
    type PublicIpStatus,
} from "../src"

type IpAtom = GlobalAtom<Promise<string> | string>

type FamilyAtoms = {
    ipAtom: IpAtom
    ipAtomName: string
    valueAtom: GlobalAtom<string | null>
    valueAtomName: string
    statusAtom: GlobalAtom<PublicIpStatus>
    statusAtomName: string
    errorAtom: GlobalAtom<Error | null>
    errorAtomName: string
    endpointsAtom: GlobalAtom<string[]>
    endpointsAtomName: string
}

const families: FamilyAtoms[] = [
    {
        ipAtom: publicIpAtom,
        ipAtomName: "publicIpAtom",
        valueAtom: publicIpValueAtom,
        valueAtomName: "publicIpValueAtom",
        statusAtom: publicIpStatusAtom,
        statusAtomName: "publicIpStatusAtom",
        errorAtom: publicIpErrorAtom,
        errorAtomName: "publicIpErrorAtom",
        endpointsAtom: publicIpEndpointsAtom,
        endpointsAtomName: "publicIpEndpointsAtom",
    },
    {
        ipAtom: publicIpV4Atom,
        ipAtomName: "publicIpV4Atom",
        valueAtom: publicIpV4ValueAtom,
        valueAtomName: "publicIpV4ValueAtom",
        statusAtom: publicIpV4StatusAtom,
        statusAtomName: "publicIpV4StatusAtom",
        errorAtom: publicIpV4ErrorAtom,
        errorAtomName: "publicIpV4ErrorAtom",
        endpointsAtom: publicIpV4EndpointsAtom,
        endpointsAtomName: "publicIpV4EndpointsAtom",
    },
    {
        ipAtom: publicIpV6Atom,
        ipAtomName: "publicIpV6Atom",
        valueAtom: publicIpV6ValueAtom,
        valueAtomName: "publicIpV6ValueAtom",
        statusAtom: publicIpV6StatusAtom,
        statusAtomName: "publicIpV6StatusAtom",
        errorAtom: publicIpV6ErrorAtom,
        errorAtomName: "publicIpV6ErrorAtom",
        endpointsAtom: publicIpV6EndpointsAtom,
        endpointsAtomName: "publicIpV6EndpointsAtom",
    },
]

const Row = ({ name, children }: { name: string; children: ReactNode }) => (
    <div className="row">
        <code className="atom-name">{name}</code>
        <div className="row-value">{children}</div>
    </div>
)

const StatusValue = ({
    statusAtom,
}: {
    statusAtom: GlobalAtom<PublicIpStatus>
}) => {
    const status = useValue(statusAtom)
    return <span className={`pill pill-${status}`}>{status}</span>
}

const ScalarValue = <T,>({ atom }: { atom: GlobalAtom<T> }) => {
    const value = useValue(atom)
    if (value === null || value === undefined) {
        return <span className="null">null</span>
    }
    if (value instanceof Error) {
        return <span className="error-text">{`Error: ${value.message}`}</span>
    }
    return <span className="string">{String(value)}</span>
}

const EndpointsField = ({
    endpointsAtom,
}: {
    endpointsAtom: GlobalAtom<string[]>
}) => {
    const endpoints = useValue(endpointsAtom)
    const [draft, setDraft] = useState(endpoints.join("\n"))
    useEffect(() => setDraft(endpoints.join("\n")), [endpoints])

    const commit = () => {
        const list = draft
            .split("\n")
            .map(l => l.trim())
            .filter(Boolean)
        if (list.length > 0) endpointsAtom.setSelf(list)
        else setDraft(endpoints.join("\n"))
    }

    return (
        <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            spellCheck={false}
        />
    )
}

const CacheMetaValue = ({ ipAtom }: { ipAtom: IpAtom }) => {
    const meta = useValue(cacheMeta(ipAtom))
    return <pre>{meta ? JSON.stringify(meta, null, 2) : "null"}</pre>
}

const IpAtomSubscriber = ({ ipAtom }: { ipAtom: IpAtom }) => {
    const store = useStore()
    useEffect(() => {
        const read = () => {
            // Swallow pending-promise throws from Suspense-style reads — this
            // subscriber only exists to keep the atom mounted.
            try {
                store.get(ipAtom)
            } catch {}
        }
        read()
        return store.sub(ipAtom, read)
    }, [store, ipAtom])
    return null
}

const PanelBody = ({ family }: { family: FamilyAtoms }) => (
    <>
        <Row name={family.valueAtomName}>
            <ScalarValue atom={family.valueAtom} />
        </Row>
        <Row name={family.statusAtomName}>
            <StatusValue statusAtom={family.statusAtom} />
        </Row>
        <Row name={family.errorAtomName}>
            <ScalarValue atom={family.errorAtom} />
        </Row>
        <Row name={family.endpointsAtomName}>
            <EndpointsField endpointsAtom={family.endpointsAtom} />
        </Row>
        <Row name={`cacheMeta(${family.ipAtomName})`}>
            <CacheMetaValue ipAtom={family.ipAtom} />
        </Row>
    </>
)

const IpPanel = ({ family }: { family: FamilyAtoms }) => (
    <section className="panel">
        <header className="panel-header">
            <code className="panel-title">{family.ipAtomName}</code>
            <button onClick={() => family.ipAtom.resetSelf()}>
                resetSelf()
            </button>
        </header>
        <IpAtomSubscriber ipAtom={family.ipAtom} />
        <PanelBody family={family} />
    </section>
)

const NumberConfigRow = ({
    name,
    atom,
    min,
}: {
    name: string
    atom: GlobalAtom<number>
    min: number
}) => {
    const committed = useValue(atom)
    const [draft, setDraft] = useState(String(committed))
    useEffect(() => setDraft(String(committed)), [committed])

    const commit = () => {
        const n = Number(draft)
        if (!Number.isNaN(n) && n >= min) {
            atom.setSelf(n)
        } else {
            setDraft(String(committed))
        }
    }

    return (
        <Row name={name}>
            <input
                type="text"
                inputMode="numeric"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={e => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur()
                }}
            />
        </Row>
    )
}

const ConfigPanel = () => (
    <section className="panel">
        <header className="panel-header">
            <code className="panel-title">config atoms</code>
        </header>
        <NumberConfigRow
            name="publicIpMaxAgeAtom"
            atom={publicIpMaxAgeAtom}
            min={100}
        />
        <NumberConfigRow
            name="publicIpStaleWhileRevalidateAtom"
            atom={publicIpStaleWhileRevalidateAtom}
            min={0}
        />
        <NumberConfigRow
            name="publicIpStaleIfErrorAtom"
            atom={publicIpStaleIfErrorAtom}
            min={0}
        />
    </section>
)

const App = () => (
    <main>
        <header className="app-header">
            <h1>
                <code>@valdres/public-ip</code>
            </h1>
            <p className="tagline">
                Live inspector for every atom exposed by the package.
            </p>
        </header>
        <ConfigPanel />
        {families.map(family => (
            <IpPanel key={family.ipAtomName} family={family} />
        ))}
    </main>
)

const root = createRoot(document.getElementById("root")!)
root.render(
    <StrictMode>
        <Provider>
            <App />
        </Provider>
    </StrictMode>,
)
