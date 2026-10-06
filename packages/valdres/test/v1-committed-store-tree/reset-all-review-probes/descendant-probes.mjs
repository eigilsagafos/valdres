import assert from 'node:assert/strict'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const target = path.resolve(process.argv[2])
const entry = process.argv[3] || 'dist'
const valdres = await import(pathToFileURL(path.join(target, entry, entry === 'src' ? 'index.ts' : 'index.js')))
const { query } = await import(pathToFileURL(path.join(target, entry, entry === 'src' ? 'query.ts' : 'query.js')))
const keys = rows => rows.map(row => row.key)
const results = []
const run = (name, operation) => {
    try { results.push({ name, pass: true, details: operation() }) }
    catch (error) { results.push({ name, pass: false, error: error.stack }) }
}

run('independent descendant mirroring matrix, including staged writes', () => {
    const rows = valdres.collection({ indexes: { kind: value => value.kind } })
    const selected = query(rows, { where: { kind: { eq: 'yes' } } })
    const root = valdres.store()
    for (const key of ['a', 'b', 'c', 'd']) root.set(rows(key), { kind: 'yes', value: key })
    const draft = root.scope('draft')
    draft.delete(rows('b'))
    const untouched = draft.scope('untouched')
    const deeper = untouched.scope('deeper')
    const valueOnly = draft.scope('value')
    const localValue = { kind: 'yes', value: 'child-owned' }
    valueOnly.set(rows('a'), localValue)
    const membershipOwner = draft.scope('membership')
    membershipOwner.delete(rows('c'))
    membershipOwner.set(rows('own'), { kind: 'yes', value: 'own' })
    const residue = draft.scope('residue')
    residue.delete(rows('a'))
    residue.reset(rows('a'))
    const staged = draft.scope('staged')
    const stagedValue = { kind: 'yes', value: 'staged' }
    const scopes = [untouched, deeper, valueOnly, membershipOwner, residue, staged]
    const seen = new Map(scopes.map(scope => [scope, []]))
    for (const scope of scopes) {
        scope.sub(rows, () => seen.get(scope).push({ rows: keys(scope.get(rows)), query: keys(scope.get(selected)) }))
        scope.sub(selected, () => {})
    }
    root.txn(tx => {
        tx.scope(staged).set(rows('a'), stagedValue)
        tx.scope(draft).resetAll()
        for (const scope of [untouched, deeper, valueOnly]) assert.deepEqual(keys(tx.scope(scope).get(rows)), ['a', 'b', 'c', 'd'])
        assert.deepEqual(keys(tx.scope(membershipOwner).get(rows)), ['a', 'd', 'own', 'b'])
        assert.deepEqual(keys(tx.scope(residue).get(rows)), ['c', 'd', 'a', 'b'])
        assert.deepEqual(keys(tx.scope(staged).get(rows)), ['a', 'c', 'd', 'b'])
    })
    assert.equal(valueOnly.get(rows('a')), localValue)
    assert.equal(staged.get(rows('a')), stagedValue)
    assert.equal(membershipOwner.get(rows('c')), undefined)
    for (const scope of scopes) {
        assert.deepEqual(keys(scope.get(selected)), keys(scope.get(rows)))
        assert.equal(seen.get(scope).length, 1)
        assert.deepEqual(seen.get(scope)[0].rows, keys(scope.get(rows)))
        assert.deepEqual(seen.get(scope)[0].query, keys(scope.get(rows)))
    }
    return scopes.map(scope => keys(scope.get(rows)))
})

run('value-only override becomes membership-owning if parent discards that row', () => {
    const root = valdres.store()
    const rows = valdres.collection()
    root.set(rows('a'), 1)
    const draft = root.scope('draft')
    draft.set(rows('old'), 2)
    const child = draft.scope('child')
    child.set(rows('old'), 3)
    root.txn(tx => tx.scope(draft).resetAll())
    assert.deepEqual(keys(child.get(rows)), ['a', 'old'])
    assert.equal(child.get(rows('old')), 3)
})

run('explicit order-only descendant clear through follower inherits newly restored order', () => {
    const root = valdres.store()
    const rows = valdres.collection()
    for (const key of ['a', 'b', 'c']) root.set(rows(key), key)
    const ancestor = root.scope('ancestor')
    ancestor.delete(rows('a'))
    ancestor.reset(rows('a'))
    const middle = ancestor.scope('middle')
    const leaf = middle.scope('leaf')
    leaf.set(rows('extra'), 'extra')
    const observed = {}
    root.txn(tx => {
        tx.scope(ancestor).resetAll()
        tx.scope(leaf).resetAll()
        observed.middle = keys(tx.scope(middle).get(rows))
        observed.leaf = keys(tx.scope(leaf).get(rows))
    })
    observed.committedMiddle = keys(middle.get(rows))
    observed.committedLeaf = keys(leaf.get(rows))
    console.log('ORDER_ONLY_NESTED', JSON.stringify(observed))
    assert.deepEqual(observed.leaf, observed.middle)
    assert.deepEqual(observed.committedLeaf, observed.committedMiddle)
    return observed
})

console.log(JSON.stringify({ target, entry, runtime: process.versions.bun || process.versions.node, results }, null, 2))
process.exitCode = results.every(result => result.pass) ? 0 : 1
