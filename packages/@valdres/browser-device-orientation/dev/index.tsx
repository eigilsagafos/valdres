import { StrictMode, useEffect, useMemo, useRef } from "react"
import { createRoot } from "react-dom/client"
import { Canvas, useFrame } from "@react-three/fiber"
import { Grid } from "@react-three/drei"
import * as THREE from "three"
import { Provider, useValue } from "valdres-react"
import {
    orientationAtom,
    permissionAtom,
    orientationStatusAtom,
    alphaSelector,
    betaSelector,
    gammaSelector,
    compassHeadingSelector,
    requestOrientationPermission,
} from "../src"

const fmt = (n: number | null | undefined, digits = 1) =>
    typeof n === "number" ? n.toFixed(digits) : "—"

const deg = (d: number | null | undefined) =>
    typeof d === "number" ? (d * Math.PI) / 180 : 0

const Axis = ({
    direction,
    color,
}: {
    direction: [number, number, number]
    color: string
}) => {
    const arrow = useMemo(() => {
        const dir = new THREE.Vector3(...direction).normalize()
        return new THREE.ArrowHelper(
            dir,
            new THREE.Vector3(0, 0, 0),
            1.6,
            color,
            0.18,
            0.09,
        )
    }, [direction, color])

    useEffect(
        () => () => {
            arrow.dispose()
        },
        [arrow],
    )

    return <primitive object={arrow} />
}

const Phone = () => {
    const orientation = useValue(orientationAtom)
    const groupRef = useRef<THREE.Group>(null!)

    useFrame(({ clock }) => {
        if (!groupRef.current) return
        groupRef.current.rotation.order = "ZXY"
        if (orientation) {
            groupRef.current.rotation.set(
                deg(orientation.beta),
                deg(orientation.gamma),
                deg(orientation.alpha),
            )
        } else {
            const t = clock.getElapsedTime()
            groupRef.current.rotation.set(
                Math.sin(t * 0.5) * 0.35,
                Math.sin(t * 0.4) * 0.7,
                Math.sin(t * 0.3) * 0.15,
            )
        }
    })

    // Outer group maps the W3C earth frame (+Z up) to three.js world (+Y up).
    // Inner group then applies the device-to-earth rotation. With this in
    // place, alpha=beta=gamma=0 renders the phone flat on the grid with the
    // screen face up — matching the spec's reference pose.
    return (
        <group rotation-x={-Math.PI / 2}>
            <group ref={groupRef}>
                <mesh castShadow>
                <boxGeometry args={[1.0, 1.7, 0.16]} />
                <meshStandardMaterial
                    attach="material-0"
                    color="#f87171"
                    metalness={0.3}
                    roughness={0.5}
                />
                <meshStandardMaterial
                    attach="material-1"
                    color="#7f1d1d"
                    metalness={0.3}
                    roughness={0.5}
                />
                <meshStandardMaterial
                    attach="material-2"
                    color="#4ade80"
                    metalness={0.3}
                    roughness={0.5}
                />
                <meshStandardMaterial
                    attach="material-3"
                    color="#14532d"
                    metalness={0.3}
                    roughness={0.5}
                />
                <meshStandardMaterial
                    attach="material-4"
                    color="#0b1220"
                    metalness={0.6}
                    roughness={0.2}
                    emissive="#1d4ed8"
                    emissiveIntensity={0.35}
                />
                <meshStandardMaterial
                    attach="material-5"
                    color="#475569"
                    metalness={0.5}
                    roughness={0.4}
                />
            </mesh>
            <mesh position={[0, 0.78, 0.0805]}>
                <planeGeometry args={[0.32, 0.04]} />
                <meshBasicMaterial color="#020617" />
            </mesh>
                <Axis direction={[1, 0, 0]} color="#ef4444" />
                <Axis direction={[0, 1, 0]} color="#22c55e" />
                <Axis direction={[0, 0, 1]} color="#3b82f6" />
            </group>
        </group>
    )
}

const Scene = () => (
    <Canvas
        shadows
        camera={{ position: [3.2, 2.6, 3.6], fov: 32 }}
        style={{ width: "100%", height: "100%" }}
    >
        <color attach="background" args={["#0b1220"]} />
        <ambientLight intensity={0.5} />
        <directionalLight
            position={[5, 8, 4]}
            intensity={1.1}
            castShadow
            shadow-mapSize={[1024, 1024]}
        />
        <Grid
            args={[20, 20]}
            position={[0, -1.5, 0]}
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
        <Phone />
    </Canvas>
)

const Demo = () => {
    const permission = useValue(permissionAtom)
    const status = useValue(orientationStatusAtom)
    const orientation = useValue(orientationAtom)
    const alpha = useValue(alphaSelector)
    const beta = useValue(betaSelector)
    const gamma = useValue(gammaSelector)
    const heading = useValue(compassHeadingSelector)

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
                            void requestOrientationPermission()
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
                        <span style={{ color: "#ef4444" }}>■</span> X — right edge
                    </div>
                    <div>
                        <span style={{ color: "#22c55e" }}>■</span> Y — top edge
                    </div>
                    <div>
                        <span style={{ color: "#3b82f6" }}>■</span> Z — out of screen
                    </div>
                </div>
            </div>

            <div className="grid">
                <div className="card">
                    <div className="label">alpha (z, 0–360°)</div>
                    <div className="big">{fmt(alpha)}</div>
                </div>
                <div className="card">
                    <div className="label">beta (x, -180–180°)</div>
                    <div className="big">{fmt(beta)}</div>
                </div>
                <div className="card">
                    <div className="label">gamma (y, -90–90°)</div>
                    <div className="big">{fmt(gamma)}</div>
                </div>
                <div className="card">
                    <div className="label">compass heading</div>
                    <div className="big">{fmt(heading)}</div>
                </div>
                <div className="card">
                    <div className="label">absolute</div>
                    <div className="big">
                        {orientation ? String(orientation.absolute) : "—"}
                    </div>
                </div>
            </div>

            <pre>{orientation ? JSON.stringify(orientation, null, 2) : "—"}</pre>
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
