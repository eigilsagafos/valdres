import { LitElement, css, html, nothing, type CSSResultGroup } from "lit"
import { atom, atomFamily, selector, store as createStore } from "valdres"
import {
    AtomController,
    ValueController,
    ScopeController,
    StoreProvider,
} from "../src"

// ===========================================================================
// Front Row — a live concert seat-picker built on valdres-lit.
//
// Tap a seat → its own atom flips → one composing selector chain
// (subtotal → squad discount → service fee → grand total) recomputes once,
// and the header badge, the receipt, and the checkout bar all repaint in the
// same batched commit. "Split the party" forks an isolated scoped store you
// can edit without touching the live board, then apply back.
// ===========================================================================

type Tier = "front" | "mid" | "rear"
type SeatStatus = "available" | "selected" | "sold"

const ROWS: { row: string; tier: Tier }[] = [
    { row: "A", tier: "front" },
    { row: "B", tier: "mid" },
    { row: "C", tier: "rear" },
]
const COLS = [1, 2, 3, 4, 5, 6]
const TIER_PRICE: Record<Tier, number> = { front: 18000, mid: 12000, rear: 8000 } // cents
const TIER_LABEL: Record<Tier, string> = {
    front: "Front",
    mid: "Middle",
    rear: "Rear",
}

const SEAT_CATALOG: Record<string, { row: string; col: number; tier: Tier }> =
    {}
for (const { row, tier } of ROWS)
    for (const col of COLS)
        SEAT_CATALOG[`${row}${col}`] = { row, col, tier }
const ALL_IDS = Object.keys(SEAT_CATALOG)

const SOLD_SEED = ["A3", "B5", "C2"]
const CONFLICT_SEAT = "A6" // deterministic "someone grabbed it" rejection
const SQUAD_MIN = 4
const DISCOUNT_RATE = 0.15
const FEE_RATE = 0.08
const HOLD_DELAY_MS = 400

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`

// ---------------------------------------------------------------------------
// State — atoms are the only writable truth; everything else is derived.
// ---------------------------------------------------------------------------

const seatStatusFamily = atomFamily<SeatStatus, [string]>(
    () => "available",
    { name: "front-row/seat" },
)
const holdResultAtom = atom<Promise<{ orderId: string }> | { orderId: string } | null>(
    null,
    { name: "front-row/hold" },
)
const lastHeldAtom = atom("—", { name: "front-row/lastHeld" })

const selectedSeatsSelector = selector(
    get => ALL_IDS.filter(id => get(seatStatusFamily(id)) === "selected"),
    { name: "front-row/selectedSeats" },
)
const selectedCountSelector = selector(
    get => get(selectedSeatsSelector).length,
    { name: "front-row/selectedCount" },
)
const tierSubtotalsSelector = selector<Record<Tier, number>>(
    get => {
        const out: Record<Tier, number> = { front: 0, mid: 0, rear: 0 }
        for (const id of get(selectedSeatsSelector))
            out[SEAT_CATALOG[id].tier] += TIER_PRICE[SEAT_CATALOG[id].tier]
        return out
    },
    { name: "front-row/tierSubtotals" },
)
const subtotalSelector = selector(
    get => {
        const t = get(tierSubtotalsSelector)
        return t.front + t.mid + t.rear
    },
    { name: "front-row/subtotal" },
)
const discountSelector = selector(
    get =>
        get(selectedCountSelector) >= SQUAD_MIN
            ? Math.round(get(subtotalSelector) * DISCOUNT_RATE)
            : 0,
    { name: "front-row/discount" },
)
const feesSelector = selector(
    get =>
        Math.round((get(subtotalSelector) - get(discountSelector)) * FEE_RATE),
    { name: "front-row/fees" },
)
const grandTotalSelector = selector(
    get =>
        get(subtotalSelector) - get(discountSelector) + get(feesSelector),
    { name: "front-row/grandTotal" },
)

// The whole board runs out of one batched store, module-scoped so the sandbox
// can read/write it directly for the delta chip and "apply".
const rootStore = createStore({ batchUpdates: true })
for (const id of SOLD_SEED) rootStore.set(seatStatusFamily(id), "sold")

const makeHold = (seats: string[]) =>
    new Promise<{ orderId: string }>((resolve, reject) => {
        setTimeout(() => {
            if (seats.includes(CONFLICT_SEAT))
                reject(new Error(`Someone grabbed ${CONFLICT_SEAT}`))
            else resolve({ orderId: "FR-1042" })
        }, HOLD_DELAY_MS)
    })

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

const surfaceCss = css`
    :host {
        font-family: var(--fr-font);
        color: var(--fr-ink);
    }
    .card {
        background: var(--fr-surface);
        border: 1px solid var(--fr-line);
        border-radius: var(--fr-radius);
        box-shadow: var(--fr-shadow);
    }
    .mono {
        font-family: var(--fr-mono);
        font-variant-numeric: tabular-nums;
    }
    .muted {
        color: var(--fr-muted);
    }
    @media (prefers-reduced-motion: reduce) {
        * {
            animation: none !important;
            transition: none !important;
        }
    }
`

const requestPop = (el: HTMLElement) => {
    if (typeof requestAnimationFrame !== "function") return
    el.classList.remove("pop")
    requestAnimationFrame(() => el.classList.add("pop"))
}

// ---------------------------------------------------------------------------
// <fr-status-pill> — presentational
// ---------------------------------------------------------------------------

class StatusPill extends LitElement {
    static properties = { kind: {}, label: {} }
    declare kind: string
    declare label: string
    static styles = css`
        .pill {
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
            padding: 0.2rem 0.7rem;
            border-radius: 999px;
            font-size: 0.78rem;
            font-weight: 600;
            letter-spacing: 0.02em;
            background: color-mix(in oklch, var(--fr-ink) 12%, transparent);
            color: var(--fr-ink);
        }
        .pill::before {
            content: "";
            width: 0.5rem;
            height: 0.5rem;
            border-radius: 999px;
            background: var(--fr-muted);
        }
        .ready::before {
            background: var(--fr-success);
        }
        .pending::before {
            background: var(--fr-glow);
            animation: blink 0.8s steps(2, start) infinite;
        }
        .error::before {
            background: var(--fr-error);
        }
        @keyframes blink {
            50% {
                opacity: 0.25;
            }
        }
    `
    render() {
        return html`<span class="pill ${this.kind}">${this.label}</span>`
    }
}
customElements.define("fr-status-pill", StatusPill)

// ---------------------------------------------------------------------------
// <fr-seat> — one tappable seat, reads only its own family atom
// ---------------------------------------------------------------------------

class Seat extends LitElement {
    static properties = { seatId: {} }
    declare seatId: string
    private _ctrl?: AtomController<SeatStatus>

    static styles = css`
        button {
            width: 100%;
            aspect-ratio: 1;
            border-radius: 10px;
            border: 1.5px solid var(--fr-available);
            background: transparent;
            color: var(--fr-muted);
            font:
                600 0.7rem/1 var(--fr-mono);
            cursor: pointer;
            display: grid;
            place-items: center;
            transition:
                transform 0.14s ease,
                box-shadow 0.2s ease,
                background 0.2s ease,
                color 0.2s ease;
        }
        button:hover:not(:disabled) {
            transform: translateY(-2px);
            border-color: var(--fr-accent-1);
        }
        button.selected {
            border-color: var(--fr-glow);
            background: color-mix(in oklch, var(--fr-glow) 22%, transparent);
            color: var(--fr-ink);
            box-shadow: 0 0 0 2px
                    color-mix(in oklch, var(--fr-glow) 35%, transparent),
                0 6px 22px -6px var(--fr-glow);
            transform: scale(1.06);
        }
        button.sold {
            border-style: dashed;
            border-color: var(--fr-sold);
            color: var(--fr-sold);
            cursor: not-allowed;
            text-decoration: line-through;
        }
    `

    private _ensure() {
        if (!this._ctrl && this.seatId)
            this._ctrl = new AtomController<SeatStatus>(
                this,
                seatStatusFamily(this.seatId),
            )
        return this._ctrl
    }
    willUpdate() {
        this._ensure()
    }
    private _toggle() {
        const c = this._ensure()
        const v = c?.value
        if (!c || v === "sold") return
        c.set(v === "selected" ? "available" : "selected")
    }
    render() {
        const status = this._ensure()?.value ?? "available"
        const glyph = status === "selected" ? "🎟" : status === "sold" ? "✕" : this.seatId
        return html`<button
            class=${status}
            ?disabled=${status === "sold"}
            aria-pressed=${status === "selected"}
            aria-label="Seat ${this.seatId} (${status})"
            @click=${this._toggle}
        >
            ${glyph}
        </button>`
    }
}
customElements.define("fr-seat", Seat)

// ---------------------------------------------------------------------------
// <fr-venue-map> — stage + rows of seats. Holds no state.
// ---------------------------------------------------------------------------

class VenueMap extends LitElement {
    static properties = { compact: { type: Boolean } }
    declare compact: boolean
    static styles = css`
        .stage {
            height: 2.4rem;
            margin: 0 auto 1.4rem;
            width: 70%;
            border-radius: 50% / 100% 100% 0 0;
            background: var(--fr-accent);
            display: grid;
            place-items: center;
            color: #fff;
            font:
                700 0.7rem/1 var(--fr-display);
            letter-spacing: 0.35em;
            box-shadow: 0 -22px 50px -20px
                color-mix(in oklch, var(--fr-accent-1) 70%, transparent);
        }
        .row {
            display: grid;
            grid-template-columns: 1.2rem repeat(6, 1fr);
            gap: 0.5rem;
            align-items: center;
            margin-bottom: 0.5rem;
        }
        .rowletter {
            font: 700 0.75rem var(--fr-mono);
            color: var(--fr-muted);
            text-align: center;
        }
        .legend {
            display: flex;
            gap: 1rem;
            justify-content: center;
            margin-top: 1rem;
            font-size: 0.74rem;
            color: var(--fr-muted);
        }
        .legend span {
            display: inline-flex;
            align-items: center;
            gap: 0.35rem;
        }
        .dot {
            width: 0.7rem;
            height: 0.7rem;
            border-radius: 4px;
            border: 1.5px solid var(--fr-available);
        }
        .dot.sel {
            border-color: var(--fr-glow);
            background: color-mix(in oklch, var(--fr-glow) 30%, transparent);
        }
        .dot.sold {
            border-style: dashed;
            border-color: var(--fr-sold);
        }
    `
    render() {
        return html`
            <div class="stage">STAGE ✦</div>
            ${ROWS.map(
                ({ row }) => html`
                    <div class="row">
                        <div class="rowletter">${row}</div>
                        ${COLS.map(
                            col =>
                                html`<fr-seat seatId=${row + col}></fr-seat>`,
                        )}
                    </div>
                `,
            )}
            <div class="legend">
                <span><i class="dot"></i> available</span>
                <span><i class="dot sel"></i> selected</span>
                <span><i class="dot sold"></i> sold</span>
            </div>
        `
    }
}
customElements.define("fr-venue-map", VenueMap)

// ---------------------------------------------------------------------------
// <fr-cart-badge> — header pill, far from the map (global reach proof)
// ---------------------------------------------------------------------------

class CartBadge extends LitElement {
    private count = new ValueController<number>(this, selectedCountSelector)
    private total = new ValueController<number>(this, grandTotalSelector)
    private held = new ValueController<string>(this, lastHeldAtom)

    static styles = css`
        .wrap {
            display: inline-flex;
            align-items: center;
            gap: 0.8rem;
        }
        .badge {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.4rem 0.9rem;
            border-radius: 999px;
            background: var(--fr-accent);
            color: #fff;
            font-weight: 700;
            font-variant-numeric: tabular-nums;
            box-shadow: 0 8px 24px -10px
                color-mix(in oklch, var(--fr-accent-1) 80%, transparent);
        }
        .badge.pop {
            animation: pop 0.32s ease;
        }
        @keyframes pop {
            40% {
                transform: scale(1.18);
            }
        }
        .held {
            font:
                0.72rem var(--fr-mono);
            color: var(--fr-muted);
        }
    `
    updated() {
        const b = this.renderRoot.querySelector(".badge") as HTMLElement | null
        if (b) requestPop(b)
    }
    render() {
        const n = this.count.value ?? 0
        return html`
            <div class="wrap">
                <span class="held">held ${this.held.value ?? "—"}</span>
                <span class="badge"
                    >🎟 ${n} · ${usd(this.total.value ?? 0)}</span
                >
            </div>
        `
    }
}
customElements.define("fr-cart-badge", CartBadge)

// ---------------------------------------------------------------------------
// <fr-price-summary> — the receipt; each line its own controller
// ---------------------------------------------------------------------------

class PriceSummary extends LitElement {
    static styles = [
        surfaceCss,
        css`
            .receipt {
                padding: 1.1rem 1.25rem;
            }
            h3 {
                margin: 0 0 0.9rem;
                font:
                    700 0.8rem/1 var(--fr-display);
                letter-spacing: 0.2em;
                text-transform: uppercase;
                color: var(--fr-muted);
            }
            .line {
                display: flex;
                justify-content: space-between;
                gap: 1rem;
                padding: 0.32rem 0;
                font-size: 0.92rem;
            }
            .line .mono {
                font-family: var(--fr-mono);
                font-variant-numeric: tabular-nums;
            }
            .discount {
                color: var(--fr-success);
                overflow: hidden;
                max-height: 0;
                opacity: 0;
                transition:
                    max-height 0.28s ease,
                    opacity 0.28s ease,
                    padding 0.28s ease;
                padding: 0;
            }
            .discount.show {
                max-height: 2rem;
                opacity: 1;
                padding: 0.32rem 0;
            }
            .divider {
                height: 1px;
                background: var(--fr-line);
                margin: 0.6rem 0;
            }
            .total {
                display: flex;
                justify-content: space-between;
                align-items: baseline;
                margin-top: 0.3rem;
            }
            .total .label {
                font-weight: 700;
                letter-spacing: 0.03em;
            }
            .total .amount {
                font:
                    800 1.5rem/1 var(--fr-mono);
                font-variant-numeric: tabular-nums;
            }
            .total .amount.flash {
                animation: flash 0.5s ease;
            }
            @keyframes flash {
                0% {
                    color: var(--fr-accent-1);
                }
                100% {
                    color: var(--fr-ink);
                }
            }
            .empty {
                color: var(--fr-muted);
                font-size: 0.9rem;
            }
        `,
    ] as CSSResultGroup

    private count = new ValueController<number>(this, selectedCountSelector)
    private tiers = new ValueController<Record<Tier, number>>(
        this,
        tierSubtotalsSelector,
    )
    private subtotal = new ValueController<number>(this, subtotalSelector)
    private discount = new ValueController<number>(this, discountSelector)
    private fees = new ValueController<number>(this, feesSelector)
    private grand = new ValueController<number>(this, grandTotalSelector)

    updated() {
        const a = this.renderRoot.querySelector(".amount") as HTMLElement | null
        if (a) {
            a.classList.remove("flash")
            if (typeof requestAnimationFrame === "function")
                requestAnimationFrame(() => a.classList.add("flash"))
        }
    }

    render() {
        const tiers = this.tiers.value ?? { front: 0, mid: 0, rear: 0 }
        const count = this.count.value ?? 0
        const discount = this.discount.value ?? 0
        return html`
            <div class="receipt card">
                <h3>Your seats</h3>
                ${count === 0
                    ? html`<p class="empty">
                          No seats yet — tap the glowing ones.
                      </p>`
                    : (Object.keys(tiers) as Tier[])
                          .filter(t => tiers[t] > 0)
                          .map(
                              t => html`<div class="line">
                                  <span>${TIER_LABEL[t]} ×
                                      ${tiers[t] / TIER_PRICE[t]}</span
                                  ><span class="mono">${usd(tiers[t])}</span>
                              </div>`,
                          )}
                <div class="line">
                    <span>Subtotal</span
                    ><span class="mono">${usd(this.subtotal.value ?? 0)}</span>
                </div>
                <div class="line discount ${discount > 0 ? "show" : ""}">
                    <span>Squad deal (${SQUAD_MIN}+ seats, −15%)</span
                    ><span class="mono">−${usd(discount)}</span>
                </div>
                <div class="line muted">
                    <span>Service fee (8%)</span
                    ><span class="mono">${usd(this.fees.value ?? 0)}</span>
                </div>
                <div class="divider"></div>
                <div class="total">
                    <span class="label">Grand total</span>
                    <span class="amount mono">${usd(this.grand.value ?? 0)}</span>
                </div>
            </div>
        `
    }
}
customElements.define("fr-price-summary", PriceSummary)

// ---------------------------------------------------------------------------
// <fr-checkout-bar> — async "Hold these seats" via AtomController.status
// ---------------------------------------------------------------------------

class CheckoutBar extends LitElement {
    private hold = new AtomController<{ orderId: string } | null>(
        this,
        holdResultAtom,
    )
    private selected = new ValueController<string[]>(this, selectedSeatsSelector)

    static styles = [
        surfaceCss,
        css`
            .bar {
                margin-top: 1rem;
                padding: 1rem 1.25rem;
                display: flex;
                flex-direction: column;
                gap: 0.7rem;
            }
            button {
                font:
                    700 0.95rem var(--fr-font);
                padding: 0.7rem 1rem;
                border: none;
                border-radius: 12px;
                background: var(--fr-accent);
                color: #fff;
                cursor: pointer;
                transition: filter 0.15s ease, transform 0.1s ease;
            }
            button:hover:not(:disabled) {
                filter: brightness(1.08);
            }
            button:active:not(:disabled) {
                transform: translateY(1px);
            }
            button:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            .result {
                display: flex;
                align-items: center;
                gap: 0.6rem;
                font-size: 0.9rem;
            }
            .ok {
                color: var(--fr-success);
                font-weight: 600;
            }
            .err {
                color: var(--fr-error);
                font-weight: 600;
            }
            .ring {
                width: 1rem;
                height: 1rem;
                border-radius: 999px;
                border: 2px solid color-mix(in oklch, var(--fr-ink) 25%, transparent);
                border-top-color: var(--fr-glow);
                animation: spin 0.7s linear infinite;
            }
            @keyframes spin {
                to {
                    transform: rotate(1turn);
                }
            }
        `,
    ] as CSSResultGroup

    private _hold() {
        const seats = this.selected.value ?? []
        if (seats.length === 0) return
        const p = makeHold(seats)
        this.hold.set(p as any)
        // Stamp the global "held" time on success — the header badge reads it,
        // so a value set deep in this async resolve shows up far away.
        p.then(() =>
            rootStore.set(lastHeldAtom, new Date().toLocaleTimeString()),
        ).catch(() => {})
    }

    render() {
        const seats = this.selected.value ?? []
        const status = this.hold.status
        const value = this.hold.value
        const pending = status === "pending"

        let result = nothing as unknown
        if (pending)
            result = html`<div class="result">
                <span class="ring"></span> Holding ${seats.length} seat${seats.length === 1 ? "" : "s"}…
            </div>`
        else if (status === "error")
            result = html`<div class="result err">
                😬 ${(this.hold.error as Error)?.message} — pick another
            </div>`
        else if (value)
            result = html`<div class="result ok">
                ✅ Held — order ${value.orderId}
            </div>`

        return html`
            <div class="bar card">
                <button ?disabled=${seats.length === 0 || pending} @click=${this._hold}>
                    ${pending
                        ? "Holding…"
                        : `Hold ${seats.length || ""} seat${seats.length === 1 ? "" : "s"}`.trim()}
                </button>
                ${result}
            </div>
        `
    }
}
customElements.define("fr-checkout-bar", CheckoutBar)

// ---------------------------------------------------------------------------
// <fr-party-sandbox> — ScopeController: an isolated "what-if" fork
// ---------------------------------------------------------------------------

class PartySandbox extends LitElement {
    private scope?: ScopeController
    private _seeded = false
    // Re-read live deltas off the scoped + root stores.
    private _delta = 0
    private _deltaSeats = 0

    static styles = [
        surfaceCss,
        css`
            .panel {
                border-left: 3px solid var(--fr-accent-1);
                padding: 1.2rem 1.4rem;
                margin-top: 1rem;
                display: grid;
                grid-template-columns: 1.1fr 0.9fr;
                gap: 1.4rem;
            }
            @media (max-width: 760px) {
                .panel {
                    grid-template-columns: 1fr;
                }
            }
            h3 {
                grid-column: 1 / -1;
                margin: 0;
                font:
                    700 0.95rem var(--fr-display);
                letter-spacing: 0.04em;
            }
            .delta {
                display: inline-block;
                margin-left: 0.6rem;
                padding: 0.15rem 0.6rem;
                border-radius: 999px;
                font:
                    600 0.78rem var(--fr-mono);
                background: color-mix(in oklch, var(--fr-accent-2) 25%, transparent);
            }
            .actions {
                grid-column: 1 / -1;
                display: flex;
                gap: 0.6rem;
            }
            button {
                font:
                    600 0.85rem var(--fr-font);
                padding: 0.5rem 0.9rem;
                border-radius: 10px;
                border: 1px solid var(--fr-line);
                background: transparent;
                color: var(--fr-ink);
                cursor: pointer;
            }
            button.apply {
                border: none;
                background: var(--fr-accent);
                color: #fff;
            }
            button:hover {
                filter: brightness(1.08);
            }
        `,
    ] as CSSResultGroup

    connectedCallback() {
        super.connectedCallback()
        if (!this.scope) {
            this.scope = new ScopeController(this)
            this._seedFromRoot()
        }
    }

    // Scopes don't auto-inherit family values, so we explicitly start the
    // sandbox from the live board ("start from your current plan").
    private _seedFromRoot() {
        const s = this.scope!.store
        for (const id of ALL_IDS) {
            const status = rootStore.get(seatStatusFamily(id))
            if (status !== "available") s.set(seatStatusFamily(id), status)
        }
    }

    private _recomputeDelta() {
        if (!this.scope) return
        this._delta =
            this.scope.store.get(grandTotalSelector) -
            rootStore.get(grandTotalSelector)
        this._deltaSeats =
            this.scope.store.get(selectedCountSelector) -
            rootStore.get(selectedCountSelector)
    }

    private _reset() {
        const s = this.scope!.store
        for (const id of ALL_IDS) s.set(seatStatusFamily(id), "available")
        this._seedFromRoot()
        this.requestUpdate()
    }

    private _apply() {
        const picks = this.scope!.store.get(selectedSeatsSelector)
        for (const id of picks)
            if (rootStore.get(seatStatusFamily(id)) !== "sold")
                rootStore.set(seatStatusFamily(id), "selected")
        this.requestUpdate()
    }

    render() {
        if (!this.scope) return nothing
        this._recomputeDelta()
        const sign = this._delta >= 0 ? "+" : "−"
        return html`
            <div class="panel card">
                <h3>
                    Split the party 👯
                    <span class="delta"
                        >${this._deltaSeats >= 0 ? "+" : ""}${this._deltaSeats}
                        seats · ${sign}${usd(Math.abs(this._delta))} vs your
                        plan</span
                    >
                </h3>
                <fr-venue-map compact></fr-venue-map>
                <fr-price-summary></fr-price-summary>
                <div class="actions">
                    <button @click=${this._reset}>Reset to my plan</button>
                    <button class="apply" @click=${this._apply}>
                        Apply to my party
                    </button>
                </div>
            </div>
        `
    }
}
customElements.define("fr-party-sandbox", PartySandbox)

// ---------------------------------------------------------------------------
// <front-row-app> — root shell + StoreProvider
// ---------------------------------------------------------------------------

class FrontRowApp extends LitElement {
    static properties = { _showSandbox: { state: true } }
    declare _showSandbox: boolean
    private _provider = new StoreProvider(this, rootStore)

    constructor() {
        super()
        this._showSandbox = false
    }

    static styles = [
        surfaceCss,
        css`
            header {
                position: sticky;
                top: 0;
                z-index: 10;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 1rem;
                padding: 0.8rem 1.4rem;
                background: color-mix(in oklch, var(--fr-bg) 80%, transparent);
                backdrop-filter: blur(12px);
                border-bottom: 1px solid var(--fr-line);
            }
            .brand {
                font:
                    800 1rem var(--fr-display);
                letter-spacing: 0.12em;
            }
            .now {
                display: none;
                font:
                    600 0.75rem var(--fr-mono);
                color: var(--fr-muted);
            }
            @media (min-width: 720px) {
                .now {
                    display: inline-flex;
                    gap: 0.45rem;
                    align-items: center;
                }
            }
            .live {
                width: 0.5rem;
                height: 0.5rem;
                border-radius: 999px;
                background: var(--fr-accent-1);
                animation: pulse 1.4s ease-in-out infinite;
            }
            @keyframes pulse {
                50% {
                    opacity: 0.3;
                }
            }
            .wrap {
                max-width: 60rem;
                margin: 0 auto;
                padding: 0 1.2rem 4rem;
            }
            .hero {
                text-align: center;
                padding: 3rem 0 2rem;
            }
            .eyebrow {
                display: inline-block;
                padding: 0.25rem 0.8rem;
                border-radius: 999px;
                border: 1px solid var(--fr-line);
                font:
                    600 0.72rem var(--fr-mono);
                letter-spacing: 0.12em;
                color: var(--fr-muted);
            }
            h1 {
                font:
                    800 clamp(2.25rem, 5vw, 3.5rem) / 1.05 var(--fr-display);
                margin: 1rem 0 0.6rem;
                background: var(--fr-accent);
                -webkit-background-clip: text;
                background-clip: text;
                color: transparent;
            }
            .sub {
                max-width: 40rem;
                margin: 0 auto;
                color: var(--fr-muted);
            }
            .chips {
                display: flex;
                gap: 0.6rem;
                justify-content: center;
                flex-wrap: wrap;
                margin-top: 1.4rem;
            }
            .chip {
                padding: 0.4rem 0.85rem;
                border-radius: 999px;
                background: var(--fr-surface);
                border: 1px solid var(--fr-line);
                font-size: 0.8rem;
            }
            .chip b {
                font-family: var(--fr-mono);
            }
            .main {
                display: grid;
                grid-template-columns: 1.3fr 0.9fr;
                gap: 1.4rem;
                align-items: start;
            }
            @media (max-width: 820px) {
                .main {
                    grid-template-columns: 1fr;
                }
            }
            .map {
                padding: 1.4rem;
            }
            .aside {
                position: sticky;
                top: 5rem;
            }
            .cap {
                text-align: center;
                font-size: 0.78rem;
                color: var(--fr-muted);
                margin-top: 0.8rem;
            }
            .scopebar {
                margin-top: 2.5rem;
            }
            .toggle {
                font:
                    700 0.9rem var(--fr-font);
                padding: 0.65rem 1.1rem;
                border-radius: 12px;
                border: 1px dashed var(--fr-accent-1);
                background: transparent;
                color: var(--fr-ink);
                cursor: pointer;
            }
            footer {
                text-align: center;
                margin-top: 3rem;
                color: var(--fr-muted);
                font-size: 0.82rem;
            }
        `,
    ] as CSSResultGroup

    render() {
        return html`
            <header>
                <span class="brand">◢ FRONT ROW</span>
                <span class="now"
                    ><span class="live"></span> THE RESONATORS · Live at The
                    Vault</span
                >
                <fr-cart-badge></fr-cart-badge>
            </header>

            <div class="wrap">
                <section class="hero">
                    <span class="eyebrow">NOW PLAYING · valdres-lit</span>
                    <h1>Pick your seats.<br />Watch the math keep up.</h1>
                    <p class="sub">
                        A live booking board built on valdres + Lit. Tap any
                        seat — tier price, squad discount, service fee and grand
                        total recompute <em>everywhere at once</em>. The header
                        badge updates with zero prop-drilling. No event buses, no
                        reducers — just atoms, one selector chain, and a handful
                        of tiny controllers.
                    </p>
                    <div class="chips">
                        <span class="chip"><b>1 store</b> — the whole board</span>
                        <span class="chip"
                            ><b>1 selector chain</b> — subtotal → discount → fees
                            → total</span
                        >
                        <span class="chip"
                            ><b>4 controllers</b> — Atom · Value · Scope ·
                            Provider</span
                        >
                    </div>
                </section>

                <div class="main">
                    <div class="map card">
                        <fr-venue-map></fr-venue-map>
                        <p class="cap">
                            18 seats, each its own atom. One tap re-settles the
                            whole board in a single batched commit.
                        </p>
                    </div>
                    <div class="aside">
                        <fr-price-summary></fr-price-summary>
                        <fr-checkout-bar></fr-checkout-bar>
                    </div>
                </div>

                <div class="scopebar">
                    <button
                        class="toggle"
                        @click=${() => (this._showSandbox = !this._showSandbox)}
                    >
                        ${this._showSandbox ? "Close" : "Split the party 👯"}
                    </button>
                    ${this._showSandbox
                        ? html`<fr-party-sandbox></fr-party-sandbox>`
                        : nothing}
                </div>

                <footer>
                    Built on a store. The seat math is invisible plumbing —
                    that's the point.
                </footer>
            </div>
        `
    }
}
customElements.define("front-row-app", FrontRowApp)
