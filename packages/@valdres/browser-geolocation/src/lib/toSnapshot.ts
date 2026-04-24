import type { GeolocationSnapshot } from "../../types/GeolocationSnapshot"

export const toSnapshot = (
    position: GeolocationPosition,
): GeolocationSnapshot => ({
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
    altitude: position.coords.altitude,
    altitudeAccuracy: position.coords.altitudeAccuracy,
    heading: position.coords.heading,
    speed: position.coords.speed,
    timestamp: position.timestamp,
})
