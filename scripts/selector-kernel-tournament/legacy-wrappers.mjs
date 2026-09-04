import ts from "typescript"
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { ROOT, requireGate, fileHash } from "./inputs.mjs"
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
    const withGC = `${helpers}\nexport async function collectHeap(){await settleAndCollect();return Math.round(heapUsed())}\n${code}`
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
