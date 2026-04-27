import { useRef, useEffect, useState } from "react"

// ISS orbits at ~408km, Earth radius ~6371km
const ISS_ALTITUDE = 408 / 6371

export function WorldMap({ lat, lon }: { lat?: number; lon?: number }) {
    const containerRef = useRef<HTMLDivElement>(null)
    const globeRef = useRef<any>(null)
    const trajectoryRef = useRef<[number, number][]>([])
    const pathsDataRef = useRef<{ points: [number, number][] }[]>([])
    const [loaded, setLoaded] = useState(false)

    // Initialize globe on first position
    useEffect(() => {
        if (lat == null || lon == null || !containerRef.current) return
        if (globeRef.current) return

        let cancelled = false

        ;(async () => {
            const [{ default: Globe }, THREE, { default: CameraControls }] = await Promise.all([
                import("globe.gl"),
                import("three"),
                import("camera-controls"),
            ])
            if (cancelled || !containerRef.current) return

            CameraControls.install({ THREE })

            const createMarker = () => {
                const group = new THREE.Group()
                const innerGeo = new THREE.SphereGeometry(0.5, 16, 16)
                const innerMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 })
                group.add(new THREE.Mesh(innerGeo, innerMat))
                const glowGeo = new THREE.SphereGeometry(1.0, 16, 16)
                const glowMat = new THREE.MeshBasicMaterial({
                    color: 0xffaa00,
                    transparent: true,
                    opacity: 0.25,
                })
                group.add(new THREE.Mesh(glowGeo, glowMat))
                return group
            }

            trajectoryRef.current = [[lat, lon]]
            pathsDataRef.current = [{ points: trajectoryRef.current }]

            const globe = new Globe(containerRef.current)
                .width(containerRef.current.clientWidth)
                .height(350)
                .backgroundColor("rgba(0,0,0,0)")
                .globeImageUrl("https://unpkg.com/three-globe@2.41.12/example/img/earth-blue-marble.jpg")
                .bumpImageUrl("https://unpkg.com/three-globe@2.41.12/example/img/earth-topology.png")
                .showAtmosphere(true)
                .atmosphereColor("lightskyblue")
                .atmosphereAltitude(0.12)
                .objectsData([{ lat, lng: lon }])
                .objectLat("lat")
                .objectLng("lng")
                .objectAltitude(ISS_ALTITUDE)
                .objectThreeObject(createMarker)
                .pathsData(pathsDataRef.current)
                .pathPoints("points")
                .pathPointLat((p: any) => p[0])
                .pathPointLng((p: any) => p[1])
                .pathPointAlt(ISS_ALTITUDE)
                .pathColor(() => "rgba(255,200,50,0.5)")
                .pathStroke(1.5)
                .pathDashLength(1)
                .pathDashGap(0)
                .pathDashAnimateTime(0)
                .pathTransitionDuration(0)

            // Set initial view
            globe.pointOfView({ lat: lat - 10, lng: lon, altitude: 0.5 }, 0)

            // Disable built-in OrbitControls
            const builtInControls = globe.controls()
            builtInControls.enabled = false

            // Attach camera-controls for proper trackpad/touch gestures
            const camera = globe.camera()
            const renderer = globe.renderer()
            const camControls = new CameraControls(camera, renderer.domElement)
            camControls.dollyToCursor = true
            camControls.minDistance = 101
            camControls.maxDistance = 500
            camControls.azimuthRotateSpeed = 0.3
            camControls.polarRotateSpeed = 0.3
            camControls.draggingSmoothTime = 0.15

            // Animate camera-controls
            const clock = new THREE.Clock()
            const animate = () => {
                if (cancelled) return
                const delta = clock.getDelta()
                camControls.update(delta)
                requestAnimationFrame(animate)
            }
            animate()

            globeRef.current = globe
            setLoaded(true)
        })()

        return () => { cancelled = true }
    }, [lat != null && lon != null])

    // Update ISS dot + extend trajectory
    useEffect(() => {
        if (!globeRef.current || lat == null || lon == null) return
        const globe = globeRef.current
        const traj = trajectoryRef.current

        const last = traj[traj.length - 1]
        if (!last || last[0] !== lat || last[1] !== lon) {
            const crossesAntimeridian = last && Math.abs(lon - last[1]) > 180

            if (crossesAntimeridian) {
                const newSeg: [number, number][] = [[lat, lon]]
                trajectoryRef.current = newSeg
                pathsDataRef.current = [...pathsDataRef.current, { points: newSeg }]
            } else {
                traj.push([lat, lon])
            }

            const totalPoints = pathsDataRef.current.reduce((n, s) => n + s.points.length, 0)
            if (totalPoints > 500 && pathsDataRef.current.length > 1) {
                pathsDataRef.current.shift()
            }

            globe.pathsData([...pathsDataRef.current.map((s: any) => ({ points: [...s.points] }))])
        }

        globe.objectsData([{ lat, lng: lon }])
    }, [lat, lon])

    // Handle resize
    useEffect(() => {
        if (!containerRef.current || !globeRef.current) return
        const observer = new ResizeObserver(entries => {
            for (const entry of entries) {
                globeRef.current?.width(entry.contentRect.width)
            }
        })
        observer.observe(containerRef.current)
        return () => observer.disconnect()
    }, [loaded])

    return (
        <div
            ref={containerRef}
            className="w-full rounded-lg overflow-hidden"
            style={{ height: 350, background: "radial-gradient(ellipse at center, #0a1628 0%, #000 100%)" }}
        />
    )
}
