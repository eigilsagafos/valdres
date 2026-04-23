import { store, cacheMeta, type GlobalAtom } from "valdres"
import {
    publicIpAtom,
    publicIpV4Atom,
    publicIpV6Atom,
    publicIpEndpointsAtom,
    publicIpV4EndpointsAtom,
    publicIpV6EndpointsAtom,
    publicIpMaxAgeAtom,
} from "../src"

const s = store()

const maxAgeInput = document.getElementById("maxAge") as HTMLInputElement
maxAgeInput.value = String(s.get(publicIpMaxAgeAtom))
maxAgeInput.addEventListener("change", () => {
    const n = Number(maxAgeInput.value)
    if (Number.isFinite(n) && n > 0) publicIpMaxAgeAtom.setSelf(n)
})

const wire = (
    prefix: string,
    ipAtom: GlobalAtom<Promise<string> | string>,
    endpointsAtom: GlobalAtom<string[]>,
) => {
    const ipEl = document.getElementById(`${prefix}-ip`)!
    const statusEl = document.getElementById(`${prefix}-status`)!
    const metaEl = document.getElementById(`${prefix}-meta`)!
    const endpointsInput = document.getElementById(
        `${prefix}-endpoints`,
    ) as HTMLTextAreaElement
    const refetchBtn = document.getElementById(
        `${prefix}-refetch`,
    ) as HTMLButtonElement

    endpointsInput.value = s.get(endpointsAtom).join("\n")

    const renderIp = (value: string | Promise<string>) => {
        if (typeof value === "string") {
            ipEl.textContent = value
            statusEl.textContent = "ok"
        } else {
            statusEl.textContent = "loading…"
            value.then(
                ip => {
                    ipEl.textContent = ip
                    statusEl.textContent = "ok"
                },
                err => {
                    ipEl.textContent = "—"
                    statusEl.textContent = `error: ${err?.message ?? err}`
                },
            )
        }
    }

    const renderMeta = () => {
        const meta = s.get(cacheMeta(ipAtom as any))
        metaEl.textContent = meta ? JSON.stringify(meta, null, 2) : "—"
    }

    renderIp(s.get(ipAtom))
    renderMeta()
    s.sub(ipAtom, () => renderIp(s.get(ipAtom)))
    s.sub(cacheMeta(ipAtom as any), renderMeta)

    endpointsInput.addEventListener("change", () => {
        const list = endpointsInput.value
            .split("\n")
            .map(l => l.trim())
            .filter(Boolean)
        if (list.length > 0) endpointsAtom.setSelf(list)
    })

    refetchBtn.addEventListener("click", () => {
        ipAtom.resetSelf()
        renderIp(s.get(ipAtom))
        renderMeta()
    })
}

wire("default", publicIpAtom, publicIpEndpointsAtom)
wire("v4", publicIpV4Atom, publicIpV4EndpointsAtom)
wire("v6", publicIpV6Atom, publicIpV6EndpointsAtom)
