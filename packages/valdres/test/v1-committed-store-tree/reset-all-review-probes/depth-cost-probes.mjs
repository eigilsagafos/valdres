import assert from 'node:assert/strict'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { pathToFileURL } from 'node:url'

const target = path.resolve(process.argv[2])
const entry = process.argv[3] || 'dist'
const extension = entry === 'src' ? 'ts' : 'js'
const { collection } = await import(pathToFileURL(path.join(target, entry, `index.${extension}`)))
const { query } = await import(pathToFileURL(path.join(target, entry, `query.${extension}`)))
const { createInspectableStore } = await import(pathToFileURL(path.join(target, entry, `inspect.${extension}`)))
const keys = handles => handles.map(handle => handle.key)
const counterNames = [
    'collectionRowIntentsStaged',
    'collectionRowRouteVisits',
    'collectionMembershipRecordCreations',
    'collectionMembershipRouteVisits',
    'collectionMembershipRowsScanned',
    'collectionMembershipArrayAllocations',
    'selectorEvaluations',
    'collectionIndexExtractorCalls',
    'collectionIndexBucketRows',
]
const repeatedReads = 32
const results = []

const measure = (inspect, name, operation, readExtractors = () => 0) => inspect.span(name, () => {
    const beforeExtractors = readExtractors()
    const start = performance.now()
    const result = operation()
    return { result, elapsedUs: (performance.now() - start) * 1000, extractorCalls: readExtractors() - beforeExtractors }
})

const spans = inspect => Object.fromEntries(inspect.export().summaries
    .filter(summary => summary.type === 'span')
    .map(summary => [summary.name, Object.fromEntries(counterNames
        .filter(name => name in summary.totals)
        .map(name => [name, summary.totals[name]]))]))

const depthSample = (followers, rowCount) => {
    let extractorCalls = 0
    const rows = collection({ indexes: { tag: rowValue => {
        extractorCalls++
        return rowValue.tag
    } } })
    const selected = query(rows, { where: { tag: { eq: 'yes' } } })
    const { store: root, inspect } = createInspectableStore({ capacity: { summaries: 256, details: 0 } })
    const rowKeys = Array.from({ length: rowCount }, (_, index) => `row-${index}`)
    const values = rowKeys.map(() => ({ tag: 'yes', revision: 0 }))
    root.txn(transaction => {
        for (const [index, key] of rowKeys.entries()) transaction.set(rows(key), values[index])
    })
    const anchor = root.scope('anchor')
    anchor.delete(rows(rowKeys[0]))
    anchor.reset(rows(rowKeys[0]))
    const route = [anchor]
    for (let index = 0; index < followers; index++) route.push(route.at(-1).scope(`follower-${index}`))
    const leaf = route.at(-1).scope('leaf')
    leaf.set(rows(rowKeys[0]), values[0])
    leaf.reset(rows(rowKeys[0]))
    for (const scope of [...route, leaf]) {
        scope.get(rows)
        scope.get(selected)
        scope.sub(rows, () => {})
        scope.sub(selected, () => {})
    }
    inspect.reset()
    const timings = {}
    const extractors = {}
    root.txn(transaction => {
        transaction.scope(anchor).resetAll()
        transaction.scope(leaf).resetAll()
        const cursor = transaction.scope(leaf)
        const cold = measure(inspect, 'cold-leaf-membership', () => cursor.get(rows))
        timings.coldMembershipUs = cold.elapsedUs
        assert.deepEqual(keys(cold.result), rowKeys)
        const warm = measure(inspect, 'warm-leaf-membership-32', () => {
            for (let index = 0; index < repeatedReads; index++) assert.equal(cursor.get(rows), cold.result)
        })
        timings.warmMembership32Us = warm.elapsedUs
        if (followers > 0) {
            const follower = transaction.scope(route.at(-1))
            const coldFollower = measure(inspect, 'cold-deepest-follower-membership', () => follower.get(rows))
            timings.coldFollowerMembershipUs = coldFollower.elapsedUs
            assert.deepEqual(keys(coldFollower.result), rowKeys)
            const warmFollower = measure(inspect, 'warm-deepest-follower-membership-32', () => {
                for (let index = 0; index < repeatedReads; index++) assert.equal(follower.get(rows), coldFollower.result)
            })
            timings.warmFollowerMembership32Us = warmFollower.elapsedUs
        }
        const coldQuery = measure(inspect, 'cold-leaf-query', () => cursor.get(selected), () => extractorCalls)
        timings.coldQueryUs = coldQuery.elapsedUs
        extractors.coldLeafQuery = coldQuery.extractorCalls
        assert.deepEqual(keys(coldQuery.result), rowKeys)
        const warmQuery = measure(inspect, 'warm-leaf-query-32', () => {
            for (let index = 0; index < repeatedReads; index++) assert.equal(cursor.get(selected), coldQuery.result)
        }, () => extractorCalls)
        timings.warmQuery32Us = warmQuery.elapsedUs
        extractors.warmLeafQuery32 = warmQuery.extractorCalls
        assert.equal(warmQuery.extractorCalls, 0)
    })
    assert.deepEqual(keys(leaf.get(rows)), rowKeys)
    assert.deepEqual(keys(leaf.get(selected)), rowKeys)
    const counters = spans(inspect)
    assert.equal(counters['warm-leaf-membership-32'].collectionMembershipRowsScanned, 0)
    assert.equal(counters['warm-leaf-query-32'].collectionMembershipRowsScanned, 0)
    if (followers > 0) assert.equal(counters['warm-deepest-follower-membership-32'].collectionMembershipRowsScanned, 0)
    return { followers, scopeDepth: followers + 2, rowCount, repeatedReads, timings, extractors, counters }
}

const firstWriteSample = () => {
    const rowCount = 64
    let extractorCalls = 0
    const rows = collection({ indexes: { tag: rowValue => {
        extractorCalls++
        return rowValue.tag
    } } })
    const selected = query(rows, { where: { tag: { eq: 'yes' } } })
    const { store: root, inspect } = createInspectableStore({ capacity: { summaries: 256, details: 0 } })
    const rowKeys = Array.from({ length: rowCount }, (_, index) => `row-${index}`)
    root.txn(transaction => {
        for (const key of rowKeys) transaction.set(rows(key), { tag: 'yes', revision: 0 })
    })
    const parent = root.scope('parent')
    parent.delete(rows(rowKeys[0]))
    parent.reset(rows(rowKeys[0]))
    const child = parent.scope('child')
    const grandchild = child.scope('grandchild')
    const greatGrandchild = grandchild.scope('great-grandchild')
    const scopes = [child, grandchild, greatGrandchild]
    const historical = [...rowKeys.slice(1), rowKeys[0]]
    for (const scope of [parent, ...scopes]) {
        scope.get(rows)
        scope.get(selected)
        scope.sub(rows, () => {})
        scope.sub(selected, () => {})
    }
    inspect.reset()
    const timings = {}
    const extractors = {}
    root.txn(transaction => {
        transaction.scope(parent).resetAll()
        const cursors = scopes.map(scope => transaction.scope(scope))
        for (const cursor of cursors) assert.deepEqual(keys(cursor.get(rows)), rowKeys)
        const first = measure(inspect, 'first-neutral-write-and-dependent-membership', () => {
            cursors[0].set(rows(rowKeys[1]), { tag: 'yes', revision: 1 })
            return cursors.map(cursor => cursor.get(rows))
        })
        timings.firstWriteUs = first.elapsedUs
        for (const snapshot of first.result) assert.deepEqual(keys(snapshot), historical)
        const later = measure(inspect, 'later-neutral-writes-and-dependent-membership-16', () => {
            for (let index = 0; index < 16; index++) {
                cursors[0].set(rows(rowKeys[1]), { tag: 'yes', revision: index + 2 })
                for (const [cursorIndex, cursor] of cursors.entries()) assert.equal(cursor.get(rows), first.result[cursorIndex])
            }
        })
        timings.laterWrites16Us = later.elapsedUs
        const coldQuery = cursors[2].get(selected)
        const queryWrite = measure(inspect, 'later-neutral-write-and-query', () => {
            cursors[0].set(rows(rowKeys[1]), { tag: 'no', revision: 18 })
            assert.equal(cursors[2].get(rows), first.result[2])
            return cursors[2].get(selected)
        }, () => extractorCalls)
        timings.laterWriteQueryUs = queryWrite.elapsedUs
        extractors.laterWriteQuery = queryWrite.extractorCalls
        assert.equal(queryWrite.extractorCalls, rowCount)
        assert.notEqual(queryWrite.result, coldQuery)
        assert.deepEqual(keys(queryWrite.result), historical.filter(key => key !== rowKeys[1]))
    })
    for (const scope of scopes) {
        assert.deepEqual(keys(scope.get(rows)), historical)
        assert.deepEqual(keys(scope.get(selected)), historical.filter(key => key !== rowKeys[1]))
    }
    const counters = spans(inspect)
    assert.equal(counters['later-neutral-writes-and-dependent-membership-16'].collectionMembershipRowsScanned, 0)
    assert.equal(counters['later-neutral-writes-and-dependent-membership-16'].collectionRowIntentsStaged, 16)
    assert.equal(counters['later-neutral-write-and-query'].collectionMembershipRowsScanned, 0)
    return { rowCount, dependentScopes: scopes.length, laterWrites: 16, timings, extractors, counters }
}

for (const [followers, rowCount] of [[0, 64], [2, 64], [4, 64], [8, 64], [16, 64], [32, 64], [8, 256]]) {
    try {
        const samples = Array.from({ length: 3 }, () => depthSample(followers, rowCount))
        results.push({ name: `depth followers=${followers} rows=${rowCount}`, pass: true, samples })
    } catch (error) {
        results.push({ name: `depth followers=${followers} rows=${rowCount}`, pass: false, error: error.stack })
    }
}
try {
    results.push({ name: 'first-write optimization counters', pass: true, sample: firstWriteSample() })
} catch (error) {
    results.push({ name: 'first-write optimization counters', pass: false, error: error.stack })
}

console.log(JSON.stringify({ target, entry, runtime: process.versions.bun || process.versions.node, results }, null, 2))
process.exitCode = results.every(result => result.pass) ? 0 : 1
