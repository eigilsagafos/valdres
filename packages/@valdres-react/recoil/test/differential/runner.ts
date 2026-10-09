import { describeError, type DifferentialEnv, type Scenario } from "./scenarios"

export type Observations = Record<string, unknown>

/** Runs every scenario in order and records what it observed (or threw). */
export const runScenarios = async (
    env: DifferentialEnv,
    scenarios: readonly Scenario[],
): Promise<Observations> => {
    const observations: Observations = {}
    for (const scenario of scenarios) {
        try {
            observations[scenario.name] = await scenario.run(env)
        } catch (error) {
            observations[scenario.name] = { uncaught: describeError(error) }
        } finally {
            env.cleanup()
        }
    }
    return observations
}
