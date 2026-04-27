export const stdDev = (values: number[]): number => {
    if (values.length < 2) return 0
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const variance =
        values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length
    return Math.sqrt(variance)
}
