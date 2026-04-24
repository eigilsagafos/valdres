export const bytesToMbps = (bytes: number, seconds: number): number => {
    if (seconds <= 0) return 0
    return (bytes * 8) / (seconds * 1_000_000)
}
