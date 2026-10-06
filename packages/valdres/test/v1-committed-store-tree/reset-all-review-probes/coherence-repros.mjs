import assert from 'node:assert/strict'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const target = path.resolve(process.argv[2])
const entry = process.argv[3] || 'dist'
const control = process.argv[4] || 'bulk'
const valdres = await import(pathToFileURL(path.join(target, entry, entry === 'src' ? 'index.ts' : 'index.js')))
const { query } = await import(pathToFileURL(path.join(target, entry, entry === 'src' ? 'query.ts' : 'query.js')))
const keys = rows => rows.map(row => row.key)
const clear = (cursor, owned) => {
    if (control === 'loop') for (const state of owned) cursor.reset(state)
    else if (control === 'bulk') cursor.resetAll()
}
const cases = []
const run = (name, operation) => {
    try {
        cases.push({ name, pass: true, observation: operation() })
    } catch (error) {
        cases.push({ name, pass: false, error: error.stack })
    }
}
const fixture = () => {
    const rows = valdres.collection({ indexes: { kind: value => value.kind } })
    const root = valdres.store()
    for (const key of ['a', 'b', 'c']) root.set(rows(key), { kind: 'match', key })
    const selected = query(rows, { where: { kind: { eq: 'match' } } })
    return { root, rows, selected }
}

run('nested clears: explicitly cleared leaf equals its current parent', () => {
    const { root, rows, selected } = fixture()
    const ancestor = root.scope('ancestor')
    ancestor.delete(rows('b'))
    const middle = ancestor.scope('middle')
    const leaf = middle.scope('leaf')
    leaf.set(rows('extra'), { kind: 'match', key: 'extra' })
    const notifications = []
    leaf.sub(rows, () => notifications.push({ rows: keys(leaf.get(rows)), query: keys(leaf.get(selected)), row: leaf.get(rows('b')) }))
    leaf.sub(selected, () => {})
    const observed = {}
    root.txn(tx => {
        clear(tx.scope(ancestor), [rows('b')])
        clear(tx.scope(leaf), [rows('extra')])
        observed.draftParent = keys(tx.scope(middle).get(rows))
        observed.draftLeaf = keys(tx.scope(leaf).get(rows))
        observed.draftRow = tx.scope(leaf).get(rows('b'))
    })
    observed.parent = keys(middle.get(rows))
    observed.leaf = keys(leaf.get(rows))
    observed.row = leaf.get(rows('b'))
    observed.query = keys(leaf.get(selected))
    observed.notifications = notifications
    root.set(rows('late'), { kind: 'match', key: 'late' })
    observed.laterParent = keys(middle.get(rows))
    observed.laterLeaf = keys(leaf.get(rows))
    console.log('NESTED_CLEAR', JSON.stringify(observed))
    assert.deepEqual(observed.draftLeaf, observed.draftParent)
    assert.deepEqual(observed.leaf, observed.parent)
    assert.deepEqual(observed.query, observed.parent)
    assert.deepEqual(observed.laterLeaf, observed.laterParent)
    return observed
})

run('order-only reset: query read before clear is invalidated', () => {
    const { root, rows, selected } = fixture()
    const draft = root.scope('draft')
    draft.delete(rows('a'))
    draft.reset(rows('a'))
    const observed = {}
    root.txn(tx => {
        const cursor = tx.scope(draft)
        observed.before = keys(cursor.get(selected))
        clear(cursor, [])
        observed.membership = keys(cursor.get(rows))
        observed.query = keys(cursor.get(selected))
    })
    observed.committed = keys(draft.get(selected))
    console.log('CACHED_QUERY', JSON.stringify(observed))
    assert.deepEqual(observed.query, observed.membership)
    return observed
})

run('negative control: cleared atom and deleted row actually inherit', () => {
    const { root, rows } = fixture()
    const marker = valdres.atom(0)
    const draft = root.scope('draft')
    draft.set(marker, 5)
    draft.delete(rows('b'))
    root.txn(tx => clear(tx.scope(draft), [marker, rows('b')]))
    assert.equal(draft.get(marker), 0)
    assert.equal(draft.get(rows('b')).key, 'b')
})

console.log(JSON.stringify({ target, entry, control, runtime: process.versions.bun || process.versions.node, cases }, null, 2))
process.exitCode = cases.every(result => result.pass) ? 0 : 1
