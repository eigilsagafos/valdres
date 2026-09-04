import ts from "typescript"
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { ROOT, requireGate, fileHash, manifest } from "./inputs.mjs"
// Extract frozen benchmark bodies as syntax, never import their legacy runtime.
// The generated module binds their constructor names to the installed v1 root.
export function buildLegacyWrappers(output) {
    const sources = {}
    function source(name) {
        const path = join(
            ROOT,
            "packages/valdres/test/performance",
            name + ".bench.ts",
        )
        sources[path.slice(ROOT.length + 1)] = fileHash(path)
        return ts.createSourceFile(
            path,
            readFileSync(path, "utf8"),
            ts.ScriptTarget.Latest,
            true,
            ts.ScriptKind.TS,
        )
    }
    function testBody(ast, name) {
        let found
        function visit(n) {
            if (
                ts.isCallExpression(n) &&
                n.expression.getText(ast) === "test" &&
                n.arguments[0]?.text === name
            )
                found = n.arguments[1].getText(ast)
            ts.forEachChild(n, visit)
        }
        visit(ast)
        requireGate(found, "WORKLOAD-PORT-ANCHOR", name)
        return found
    }
    const scope = testBody(
        source("scope"),
        "set atom in root with 1000 child scopes (no shadowing)",
    )
    const scratch = testBody(
        source("transaction"),
        "staged write followed by selector read",
    )
    const ast = source("unsubscribe")
    let factory
    function visit(n) {
        if (
            ts.isVariableDeclaration(n) &&
            n.name.getText(ast) === "makeSharedTeardown"
        )
            factory = n.initializer
        ts.forEachChild(n, visit)
    }
    visit(ast)
    requireGate(
        factory && ts.isArrowFunction(factory),
        "WORKLOAD-PORT-ANCHOR",
        "makeSharedTeardown",
    )
    const statements = factory.body.statements
    const firstJotai = statements.findIndex(
        s =>
            ts.isVariableStatement(s) &&
            s.declarationList.declarations[0]?.name.getText(ast) === "jStore",
    )
    requireGate(firstJotai > 0, "WORKLOAD-PORT-ANCHOR", "Jotai boundary")
    const setup = statements
        .slice(0, firstJotai)
        .map(s => s.getText(ast))
        .join("\n")
    const returned = statements.find(ts.isReturnStatement)?.expression
    const valdres = returned?.properties
        .find(p => p.name?.getText(ast) === "valdres")
        ?.initializer?.getText(ast)
    requireGate(valdres, "WORKLOAD-PORT-ANCHOR", "Valdres teardown")
    const memoryPath = join(
        ROOT,
        "packages/valdres/test/performance/architecture.memory.ts",
    )
    sources[memoryPath.slice(ROOT.length + 1)] = fileHash(memoryPath)
    const memory = ts.createSourceFile(
        memoryPath,
        readFileSync(memoryPath, "utf8"),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
    )
    const helperNames = new Set([
        "runtime",
        "bunJscSpecifier",
        "bunJsc",
        "heapUsed",
        "explicitGC",
        "settleAndCollect",
    ])
    const helpers = memory.statements
        .filter(
            s =>
                ts.isVariableStatement(s) &&
                helperNames.has(
                    s.declarationList.declarations[0]?.name.getText(memory),
                ),
        )
        .map(s => s.getText(memory))
        .join("\n")
    requireGate(
        helpers.includes("settleAndCollect"),
        "WORKLOAD-PORT-ANCHOR",
        "GC protocol",
    )
    const code = `export async function makeLegacy(kind,api,consume) {\n const {atom:valdresAtom,selector:valdresSelector,store:valdresCreateStore}=api;\n const do_not_optimize=consume; let perform; const measureOne=async(_name,fn)=>{perform=fn};\n if(kind==='scope'){await (${scope})();return perform;}\n if(kind==='scratch'){await (${scratch})();return perform;}\n if(kind==='subscription'){const count=100,fanIn=false,includeMount=false;${setup}\nconst noop=()=>{};return ${valdres};}\n throw new Error('unknown legacy wrapper '+kind);\n}\n`
    const memoryFactories = new Map()
    function visitMemory(node) {
        if (
            ts.isCallExpression(node) &&
            node.expression.getText(memory) === "measureRetained" &&
            ts.isStringLiteral(node.arguments[0]) &&
            ts.isArrowFunction(node.arguments[1])
        ) {
            const name = node.arguments[0].text
            const scenario = manifest.memoryScenarios.find(
                row => row.name === name,
            )
            if (scenario) {
                requireGate(
                    !memoryFactories.has(scenario.id),
                    "MEMORY-PORT-ANCHOR",
                    "duplicate scenario",
                )
                let factory = node.arguments[1].getText(memory)
                if (scenario.id === "M-ATOM-ONLY-STORES") {
                    const before =
                        "for (const state of states) target.set(state, state.defaultValue)"
                    requireGate(
                        factory.split(before).length === 2,
                        "MEMORY-PORT-ANCHOR",
                        "initial atom values",
                    )
                    factory = factory.replace(
                        before,
                        "for (let i = 0; i < states.length; i++) target.set(states[i], i)",
                    )
                }
                if (scenario.id === "M-SCOPE-CREATION-DISPOSAL") {
                    requireGate(
                        factory.split("scope.detach()").length === 2,
                        "MEMORY-PORT-ANCHOR",
                        "scope disposal",
                    )
                    factory = factory.replace(
                        "scope.detach()",
                        "scope.dispose()",
                    )
                }
                memoryFactories.set(scenario.id, factory)
            }
        }
        ts.forEachChild(node, visitMemory)
    }
    visitMemory(memory)
    requireGate(
        memoryFactories.size === manifest.memoryScenarios.length,
        "MEMORY-PORT-ANCHOR",
        "incomplete scenarios",
    )
    const factories = `export function makeMemoryFactory(id, api) { const {atom, selector, store} = api; switch(id) { ${[...memoryFactories].map(([id, factory]) => `case ${JSON.stringify(id)}: return ${factory};`).join("\n")} default: throw new Error("MEMORY-ID: unknown scenario"); }}\n`
    const withGC = `${helpers}\nexport {settleAndCollect as settleMemory, heapUsed as readMemoryHeap};\nexport async function collectHeap(){await settleAndCollect();return Math.round(heapUsed())}\n${code}\n${factories}`
    const compiled = new Bun.Transpiler({
        loader: "ts",
        target: "node",
    }).transformSync(withGC)
    requireGate(
        !compiled.includes("jotai") && !compiled.includes("/src/"),
        "WORKLOAD-PORT-IMPORT",
        "legacy runtime import escaped extraction",
    )
    writeFileSync(output, compiled)
    return { sources, generatedSha256: fileHash(output) }
}
