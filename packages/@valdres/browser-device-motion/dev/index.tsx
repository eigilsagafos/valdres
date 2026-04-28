import { StrictMode, useEffect, useRef, useState } from "react"
import { createRoot } from "react-dom/client"
import { Canvas, useFrame } from "@react-three/fiber"
import { Grid } from "@react-three/drei"
import * as THREE from "three"
import { Provider, useValue } from "valdres-react"
import {
    motionAtom,
    permissionAtom,
    motionStatusAtom,
    accelerationSelector,
    accelerationIncludingGravitySelector,
    accelerationMagnitudeSelector,
    rotationRateSelector,
    intervalSelector,
    requestMotionPermission,
    type MotionSnapshot,
    type Vector3,
    type RotationRateSnapshot,
} from "../src"

const fmt = (n: number | null | undefined, digits = 2) =>
    typeof n === "number" ? n.toFixed(digits) : "—"

const deg = (d: number | null | undefined) =>
    typeof d === "number" ? (d * Math.PI) / 180 : 0

const VectorArrow = ({
    selector,
    color,
    scale,
    minVisible = 0.05,
}: {
    selector: (m: MotionSnapshot | null) => Vector3 | null
    color: string
    scale: number
    minVisible?: number
}) => {
    const arrowRef = useRef<THREE.ArrowHelper>(null!)
    const motion = useValue(motionAtom)
    const vector = selector(motion)

    useFrame(() => {
        if (!arrowRef.current) return
        if (!vector) {
            arrowRef.current.visible = false
            return
        }
        const x = vector.x ?? 0
        const y = vector.y ?? 0
        const z = vector.z ?? 0
        const len = Math.sqrt(x * x + y * y + z * z)
        if (len < minVisible) {
            arrowRef.current.visible = false
            return
        }
        arrowRef.current.visible = true
        const dir = new THREE.Vector3(x, y, z).normalize()
        arrowRef.current.setDirection(dir)
        arrowRef.current.setLength(len * scale, 0.2, 0.1)
    })

    return (
        <arrowHelper
            ref={arrowRef}
            args={[
                new THREE.Vector3(0, 1, 0),
                new THREE.Vector3(0, 0, 0),
                0.001,
                new THREE.Color(color),
                0.2,
                0.1,
            ]}
        />
    )
}

const GyroRing = ({
    rateKey,
    color,
    orientation,
}: {
    rateKey: keyof RotationRateSnapshot
    color: string
    orientation: [number, number, number]
}) => {
    const meshRef = useRef<THREE.Mesh>(null!)
    const rotation = useValue(rotationRateSelector)

    useFrame((_, dt) => {
        if (!meshRef.current) return
        const rate = rotation?.[rateKey]
        if (typeof rate === "number" && Math.abs(rate) > 0.5) {
            meshRef.current.rotation.z += deg(rate) * dt
        } else {
            meshRef.current.rotation.z += dt * 0.4
        }
    })

    return (
        <group rotation={orientation}>
            <mesh ref={meshRef}>
                <torusGeometry args={[1.3, 0.025, 16, 96]} />
                <meshStandardMaterial
                    color={color}
                    metalness={0.4}
                    roughness={0.35}
                    emissive={color}
                    emissiveIntensity={0.18}
                />
            </mesh>
            <mesh>
                <torusGeometry args={[1.3, 0.005, 8, 96]} />
                <meshBasicMaterial color={color} transparent opacity={0.4} />
            </mesh>
        </group>
    )
}

const Center = () => (
    <mesh>
        <sphereGeometry args={[0.08, 24, 24]} />
        <meshStandardMaterial
            color="#94a3b8"
            metalness={0.6}
            roughness={0.3}
            emissive="#475569"
            emissiveIntensity={0.4}
        />
    </mesh>
)

const Scene = () => (
    <Canvas
        shadows
        camera={{ position: [3.4, 2.4, 3.6], fov: 35 }}
        style={{ width: "100%", height: "100%" }}
    >
        <color attach="background" args={["#0b1220"]} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[5, 8, 4]} intensity={1.1} />
        <Grid
            args={[20, 20]}
            position={[0, -1.7, 0]}
            cellSize={0.5}
            cellThickness={0.6}
            cellColor="#475569"
            sectionSize={2}
            sectionThickness={1.2}
            sectionColor="#94a3b8"
            fadeDistance={14}
            fadeStrength={1.2}
            infiniteGrid
        />
        <Center />
        {/* Three orthogonal gyro rings, one per device axis. Each spins at its
            own rotation rate; idle drift makes them look alive when still. */}
        <GyroRing rateKey="beta" color="#ef4444" orientation={[0, Math.PI / 2, 0]} />
        <GyroRing rateKey="gamma" color="#22c55e" orientation={[Math.PI / 2, 0, 0]} />
        <GyroRing rateKey="alpha" color="#3b82f6" orientation={[0, 0, 0]} />
        {/* Acceleration vectors. Gravity-included always shows ~9.8 length
            in the "down" direction; pure acceleration only appears when
            you actually move the phone. */}
        <VectorArrow
            selector={m => m?.accelerationIncludingGravity ?? null}
            color="#fbbf24"
            scale={0.18}
        />
        <VectorArrow
            selector={m => m?.acceleration ?? null}
            color="#f87171"
            scale={0.4}
            minVisible={0.3}
        />
    </Canvas>
)

const SPARK_LEN = 120

const Sparkline = () => {
    const motion = useValue(motionAtom)
    const [history, setHistory] = useState<number[]>(() =>
        Array(SPARK_LEN).fill(0),
    )

    useEffect(() => {
        if (!motion) return
        const a = motion.acceleration
        if (!a) return
        const x = a.x ?? 0
        const y = a.y ?? 0
        const z = a.z ?? 0
        const mag = Math.sqrt(x * x + y * y + z * z)
        setHistory(h => {
            const next = h.slice(1)
            next.push(mag)
            return next
        })
    }, [motion])

    const peak = Math.max(2, ...history)
    const coords = history.map(
        (v, i) =>
            [
                (i / (SPARK_LEN - 1)) * 100,
                100 - (v / peak) * 95,
            ] as const,
    )
    const linePoints = coords.map(([x, y]) => `${x},${y}`).join(" ")
    const fillPath = `M0,100 L${coords
        .map(([x, y]) => `${x},${y}`)
        .join(" L")} L100,100 Z`

    return (
        <div className="sparkline">
            <div className="sparkline-label">acceleration magnitude</div>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                <defs>
                    <linearGradient id="spark-gradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.45" />
                        <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
                    </linearGradient>
                </defs>
                <path className="sparkline-fill" d={fillPath} />
                <polyline
                    className="sparkline-line"
                    points={linePoints}
                    vectorEffect="non-scaling-stroke"
                />
            </svg>
            <div className="sparkline-peak">peak {fmt(peak, 1)} m/s²</div>
        </div>
    )
}

const VectorReadout = ({ value }: { value: Vector3 | null }) => (
    <div className="vector">
        <span className="axis">x</span>
        <span>{fmt(value?.x)}</span>
        <span className="axis">y</span>
        <span>{fmt(value?.y)}</span>
        <span className="axis">z</span>
        <span>{fmt(value?.z)}</span>
    </div>
)

const RotationReadout = ({ value }: { value: RotationRateSnapshot | null }) => (
    <div className="vector">
        <span className="axis">α</span>
        <span>{fmt(value?.alpha)}</span>
        <span className="axis">β</span>
        <span>{fmt(value?.beta)}</span>
        <span className="axis">γ</span>
        <span>{fmt(value?.gamma)}</span>
    </div>
)

const Demo = () => {
    const permission = useValue(permissionAtom)
    const status = useValue(motionStatusAtom)
    const motion = useValue(motionAtom)
    const acceleration = useValue(accelerationSelector)
    const accelerationG = useValue(accelerationIncludingGravitySelector)
    const rotation = useValue(rotationRateSelector)
    const interval = useValue(intervalSelector)
    const magnitude = useValue(accelerationMagnitudeSelector)

    const needsPrompt = permission === "prompt"

    return (
        <>
            <div className="row">
                <span>
                    Status <span className={`pill pill-${status}`}>{status}</span>
                </span>
                <span>
                    Permission{" "}
                    <span className={`pill pill-${permission}`}>{permission}</span>
                </span>
                {needsPrompt && (
                    <button
                        onClick={() => {
                            void requestMotionPermission()
                        }}
                    >
                        Request permission
                    </button>
                )}
            </div>

            <div className="scene">
                <Scene />
                <div className="legend">
                    <div>
                        <span style={{ color: "#fbbf24" }}>↗</span> gravity
                        (incl.)
                    </div>
                    <div>
                        <span style={{ color: "#f87171" }}>↗</span> linear
                        acceleration
                    </div>
                    <div>
                        <span style={{ color: "#ef4444" }}>○</span> β rate (X)
                    </div>
                    <div>
                        <span style={{ color: "#22c55e" }}>○</span> γ rate (Y)
                    </div>
                    <div>
                        <span style={{ color: "#3b82f6" }}>○</span> α rate (Z)
                    </div>
                </div>
            </div>

            <Sparkline />

            <div className="grid">
                <div className="card">
                    <div className="label">acceleration (m/s², no gravity)</div>
                    <VectorReadout value={acceleration} />
                    <div className="label" style={{ marginTop: "0.5rem" }}>
                        magnitude {fmt(magnitude)}
                    </div>
                </div>
                <div className="card">
                    <div className="label">accelerationIncludingGravity</div>
                    <VectorReadout value={accelerationG} />
                </div>
                <div className="card">
                    <div className="label">rotationRate (°/s)</div>
                    <RotationReadout value={rotation} />
                </div>
                <div className="card">
                    <div className="label">interval (ms)</div>
                    <div className="vector">
                        <span className="axis">dt</span>
                        <span>{fmt(interval, 1)}</span>
                    </div>
                </div>
            </div>

            <pre>{motion ? JSON.stringify(motion, null, 2) : "—"}</pre>
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
