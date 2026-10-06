import assert from 'node:assert/strict'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const target = path.resolve(process.argv[2])
const entry = process.argv[3] || 'dist'
const valdres = await import(pathToFileURL(path.join(target, entry, entry === 'src' ? 'index.ts' : 'index.js')))
const { query } = await import(pathToFileURL(path.join(target, entry, entry === 'src' ? 'query.ts' : 'query.js')))
const absent = Symbol('absent')
const results = []
const keys = rows => rows.map(row => row.key)
const run = (name, operation) => {
    try { results.push({ name, pass: true, details: operation() }) }
    catch (error) { results.push({ name, pass: false, error: error.stack }) }
}
const fixture = () => {
    const root = valdres.store()
    const scopes = [root]
    for (const name of ['ancestor', 'bridge', 'history', 'bridge2', 'leaf', 'reader', 'grandreader']) scopes.push(scopes.at(-1).scope(name))
    const collections = [valdres.collection({ indexes: { kind: value => value.kind } }), valdres.collection({ indexes: { kind: value => value.kind } })]
    const queries = collections.map(rows => query(rows, { where: { kind: { eq: 'yes' } } }))
    const known = ['a', 'b', 'c', 'd', 'local', 'leaf', 'late', 'new']
    let ownership = scopes.map(() => collections.map(() => new Map()))
    let transaction
    const trace = []
    const readers = () => transaction ? scopes.map(scope => transaction.scope(scope)) : scopes
    const expected = (scopeIndex, collectionIndex, key) => {
        for (let ancestor = scopeIndex; ancestor >= 0; ancestor--) {
            const local = ownership[ancestor][collectionIndex]
            if (local.has(key)) return local.get(key) === absent ? undefined : local.get(key)
        }
        return undefined
    }
    const check = () => readers().map((reader, scopeIndex) => collections.map((rows, collectionIndex) => {
        const membership = keys(reader.get(rows))
        assert.equal(new Set(membership).size, membership.length, `duplicate row: ${scopeIndex}`)
        const present = []
        const matching = new Set()
        for (const key of known) {
            const value = expected(scopeIndex, collectionIndex, key)
            assert.equal(reader.get(rows(key)), value, `row mismatch ${scopeIndex}:${collectionIndex}:${key}`)
            if (value !== undefined) {
                present.push(key)
                if (value.kind === 'yes') matching.add(key)
            }
        }
        assert.deepEqual([...membership].sort(), present.sort(), `membership presence ${scopeIndex}:${collectionIndex}`)
        const selected = keys(reader.get(queries[collectionIndex]))
        assert.deepEqual(selected, membership.filter(key => matching.has(key)), `query order ${scopeIndex}:${collectionIndex}`)
        return { membership, selected }
    }))
    const mutate = (scopeIndex, operation, key = 'a', collectionIndex = 0, kind = 'yes') => {
        const cursor = readers()[scopeIndex]
        const rows = collections[collectionIndex]
        trace.push({ scopeIndex, operation, key, collectionIndex, kind })
        if (operation === 'set') {
            const value = { kind, key, revision: trace.length }
            cursor.set(rows(key), value)
            ownership[scopeIndex][collectionIndex].set(key, value)
        } else if (operation === 'delete') {
            cursor.delete(rows(key))
            if (scopeIndex === 0) ownership[scopeIndex][collectionIndex].delete(key)
            else ownership[scopeIndex][collectionIndex].set(key, absent)
        } else if (operation === 'reset') {
            cursor.reset(rows(key))
            ownership[scopeIndex][collectionIndex].delete(key)
        } else {
            cursor.resetAll()
            for (const local of ownership[scopeIndex]) local.clear()
        }
        const snapshot = check()
        if (operation === 'clear') {
            for (const [index] of collections.entries()) assert.deepEqual(snapshot[scopeIndex][index], snapshot[scopeIndex - 1][index], `explicit clear differs from CURRENT parent: ${scopeIndex}:${index}`)
        }
        return snapshot
    }
    for (const collectionIndex of [0, 1]) for (const key of ['a', 'b', 'c', 'd']) mutate(0, 'set', key, collectionIndex)
    const txn = (program, rollback = false) => {
        const before = check()
        const beforeArrays = scopes.map(scope => collections.map(rows => scope.get(rows)))
        const saved = ownership.map(byCollection => byCollection.map(local => new Map(local)))
        const failure = new Error('rollback requested')
        let notifications = 0
        const unsubscribes = scopes.flatMap(scope => collections.flatMap((rows, collectionIndex) => [rows, queries[collectionIndex]].map(state => scope.sub(state, () => {
            notifications++
            check()
        }))))
        let expectedFinal
        try {
            root.txn(cursor => {
                transaction = cursor
                check()
                program(mutate, check)
                expectedFinal = check()
                assert.equal(notifications, 0)
                transaction = undefined
                if (rollback) throw failure
            })
        } catch (error) {
            transaction = undefined
            if (!rollback || error !== failure) throw new Error(`${error.stack}\nTRACE ${JSON.stringify(trace)}`, { cause: error })
            ownership = saved
            assert.equal(notifications, 0)
            assert.deepEqual(check(), before)
            scopes.forEach((scope, scopeIndex) => collections.forEach((rows, collectionIndex) => assert.equal(scope.get(rows), beforeArrays[scopeIndex][collectionIndex])))
        }
        if (!rollback) assert.deepEqual(check(), expectedFinal, `transaction/commit disagreement: ${JSON.stringify(trace)}`)
        for (const unsubscribe of unsubscribes) unsubscribe()
        return notifications
    }
    return { root, mutate, check, txn, trace }
}

for (const leafFirst of [false, true]) for (const stagedBefore of [false, true]) {
    run(`history-retaining selected base; leafFirst=${leafFirst}; stagedBefore=${stagedBefore}`, () => {
        const state = fixture()
        state.mutate(1, 'delete', 'b')
        state.mutate(3, 'delete', 'c')
        state.mutate(3, 'set', 'local')
        state.mutate(5, 'set', 'leaf')
        state.mutate(5, 'delete', 'a')
        state.txn(mutate => {
            if (stagedBefore) {
                mutate(3, 'delete', 'd')
                mutate(3, 'set', 'd')
                mutate(0, 'set', 'late')
            }
            mutate(leafFirst ? 5 : 1, 'clear')
            mutate(3, 'set', 'a', 0, 'no')
            mutate(leafFirst ? 1 : 5, 'clear')
            mutate(3, 'delete', 'b')
            mutate(3, 'reset', 'b')
            mutate(0, 'delete', 'a')
            mutate(0, 'set', 'a')
            mutate(3, 'set', 'new', 1)
        })
        return { steps: state.trace.length }
    })
}

for (const leafFirst of [false, true]) {
    run(`nested clear with two mirroring scopes and staged root history; leafFirst=${leafFirst}`, () => {
        const state = fixture()
        state.mutate(1, 'delete', 'a')
        state.mutate(1, 'reset', 'a')
        state.mutate(5, 'set', 'leaf')
        state.txn(mutate => {
            mutate(0, 'delete', 'b')
            mutate(0, 'set', 'b')
            mutate(leafFirst ? 5 : 1, 'clear')
            mutate(0, 'set', 'late')
            mutate(leafFirst ? 1 : 5, 'clear')
            mutate(0, 'delete', 'd')
            mutate(0, 'set', 'd')
        })
        return { steps: state.trace.length }
    })
}

run('restore base changes after ancestor first write; repeated clear/write/clear across collections', () => {
    const state = fixture()
    state.mutate(1, 'delete', 'b')
    state.mutate(5, 'set', 'leaf')
    state.txn(mutate => {
        mutate(1, 'clear')
        mutate(5, 'clear')
        mutate(3, 'set', 'a')
        mutate(3, 'delete', 'c')
        mutate(3, 'reset', 'c')
        mutate(5, 'set', 'late')
        mutate(5, 'clear')
        mutate(1, 'set', 'local', 1)
        mutate(1, 'clear')
        mutate(3, 'set', 'a', 1, 'no')
        mutate(3, 'clear')
        mutate(3, 'set', 'b')
        mutate(5, 'clear')
    })
})

run('combined rollback preserves arrays, then same nested sequence succeeds', () => {
    const state = fixture()
    state.mutate(1, 'delete', 'b')
    state.mutate(3, 'set', 'local')
    state.mutate(5, 'delete', 'a')
    const program = mutate => {
        mutate(0, 'set', 'late')
        mutate(5, 'clear')
        mutate(1, 'clear')
        mutate(3, 'set', 'a')
        mutate(3, 'delete', 'd')
        mutate(3, 'reset', 'd')
    }
    state.txn(program, true)
    state.txn(program)
})

run('independent seeded presence model and transaction/commit order consistency', () => {
    for (let seed = 1; seed <= 120; seed++) {
        let randomState = seed
        const random = maximum => {
            randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0
            return (randomState >>> 16) % maximum
        }
        const state = fixture()
        const rowKeys = ['a', 'b', 'c', 'd', 'local', 'leaf', 'late', 'new']
        for (let operation = 0; operation < 10; operation++) state.mutate(random(8), ['set', 'delete', 'reset'][random(3)], rowKeys[random(rowKeys.length)], random(2), random(2) ? 'yes' : 'no')
        state.txn(mutate => {
            for (let operation = 0; operation < 22; operation++) {
                const scopeIndex = random(8)
                const kind = scopeIndex !== 0 && random(4) === 0 ? 'clear' : ['set', 'delete', 'reset'][random(3)]
                mutate(scopeIndex, kind, rowKeys[random(rowKeys.length)], random(2), random(2) ? 'yes' : 'no')
            }
        })
        state.root.dispose()
    }
    return { seeds: 120, scopes: 8, collections: 2, precedingOperations: 10, stagedOperations: 22, oracle: 'ownership/presence model, explicit clear current-parent order, final cursor/commit equality; no fresh-tree ordering oracle' }
})

console.log(JSON.stringify({ target, entry, runtime: process.versions.bun || process.versions.node, results }, null, 2))
process.exitCode = results.every(result => result.pass) ? 0 : 1
