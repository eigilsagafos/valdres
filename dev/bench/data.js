window.BENCHMARK_DATA = {
  "lastUpdate": 1779401180842,
  "repoUrl": "https://github.com/eigilsagafos/valdres",
  "entries": {
    "valdres benchmarks": [
      {
        "commit": {
          "author": {
            "name": "Eigil Sagafos",
            "username": "eigilsagafos",
            "email": "eigil@sagafos.no"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "e4dbc313d2f879e3eeea9df4b2f0a1e7ef5c510e",
          "message": "Stabilize benchmarks with paired per-batch measurement (#120)\n\nThe atomFamily cache-hit assertion was flaking on CI (5.1× vs 5.0× threshold\non PR #119, despite the PR not touching the hot path). Root cause: each\nside was measured back-to-back for 1.5s in a fixed order. A noisy CPU\nwindow during one side's run would shift its median 2× while the other\nran clean, blowing the ratio up even when neither implementation changed.\nIQR trimming only handles transient outliers; sustained pressure across\nthe whole window stays in the distribution.\n\nReplaces the back-to-back model with paired per-batch sampling:\nalternating ~30µs batches of valdres and competitor share the same ~60µs\nnoise window, so CPU stalls hit numerator and denominator together and\ncancel out of the ratio. Sample count is sized by a 50ms wall-clock\nbudget — fast benchmarks get 1000+ pairs, slow ones get the 50-sample\nfloor.\n\nSide effects:\n\n- CI bench job ~3× faster (20s vs ~66s of measurement budget on main).\n- Per-side numbers will shift on most benchmarks since pairing removes\n  noise that was biasing toward valdres on the old methodology\n  (store.get(atom) is the biggest mover; cache-hit basically unchanged).\n  Marketing numbers in README/BENCHMARKS.md will regenerate on first\n  main merge. Consider triggering the `reset_baseline` workflow input\n  to purge stale historical CV data — dynamic regression thresholds in\n  check-bench-regression.ts use that history.",
          "timestamp": "2026-05-21T20:52:10Z",
          "url": "https://github.com/eigilsagafos/valdres/commit/e4dbc313d2f879e3eeea9df4b2f0a1e7ef5c510e"
        },
        "date": 1779397144231,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 5,
            "unit": "ns",
            "extra": "jotai=61 ratio=0.0821 12.2x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 13,
            "unit": "ns",
            "extra": "jotai=340 ratio=0.0379 26.4x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 332,
            "unit": "ns",
            "extra": "jotai=4292 ratio=0.0767 13.0x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 344,
            "unit": "ns",
            "extra": "jotai=6559 ratio=0.0567 17.6x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 206,
            "unit": "ns",
            "extra": "jotai=3441 ratio=0.0616 16.2x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 17032,
            "unit": "ns",
            "extra": "jotai=262191 ratio=0.0649 15.4x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 289,
            "unit": "ns",
            "extra": "jotai=405 ratio=0.7027 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 28,
            "unit": "ns",
            "extra": "jotai=12 ratio=2.3854 2.4x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 304,
            "unit": "ns",
            "extra": "jotai=423 ratio=0.7228 1.4x faster"
          },
          {
            "name": "obj.value",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 9,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 345,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 1,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 19,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 188,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3037,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 8,
            "unit": "ns",
            "extra": "jotai=67 ratio=0.0968 10.3x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 6658,
            "unit": "ns",
            "extra": "jotai=24406 ratio=0.2731 3.7x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 59361,
            "unit": "ns",
            "extra": "jotai=247113 ratio=0.2392 4.2x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 5967,
            "unit": "ns",
            "extra": "jotai=12999 ratio=0.4529 2.2x faster"
          },
          {
            "name": "createStore",
            "value": 238,
            "unit": "ns",
            "extra": "jotai=5936 ratio=0.0401 24.9x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 106539,
            "unit": "ns",
            "extra": "jotai=929484 ratio=0.1151 8.7x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 9017,
            "unit": "ns",
            "extra": "jotai=385020 ratio=0.0215 46.4x faster"
          },
          {
            "name": "sub + unsub",
            "value": 1184,
            "unit": "ns",
            "extra": "jotai=3680 ratio=0.3114 3.2x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 86391,
            "unit": "ns",
            "extra": "jotai=291044 ratio=0.2920 3.4x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 135844,
            "unit": "ns",
            "extra": "jotai=546903 ratio=0.2393 4.2x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 948093,
            "unit": "ns",
            "extra": "jotai=3388137 ratio=0.2825 3.5x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 882470,
            "unit": "ns",
            "extra": "jotai=3579976 ratio=0.2463 4.1x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1361226,
            "unit": "ns",
            "extra": "jotai=18830237 ratio=0.0722 13.8x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 143488,
            "unit": "ns",
            "extra": "jotai=288279 ratio=0.4918 2.0x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 97783,
            "unit": "ns",
            "extra": "jotai=293569 ratio=0.3361 3.0x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 925897,
            "unit": "ns",
            "extra": "jotai=1395309 ratio=0.6499 1.5x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 1133370,
            "unit": "ns",
            "extra": "jotai=1836906 ratio=0.6078 1.6x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 1372502,
            "unit": "ns",
            "extra": "jotai=13216428 ratio=0.1059 9.4x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 43,
            "unit": "ns",
            "extra": "jotai=57 ratio=0.7768 1.3x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 8226,
            "unit": "ns",
            "extra": "jotai=14272 ratio=0.5755 1.7x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 81598,
            "unit": "ns",
            "extra": "jotai=129703 ratio=0.6294 1.6x faster"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 4418,
            "unit": "ns",
            "extra": "jotai=7157 ratio=0.6137 1.6x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 28,
            "unit": "ns",
            "extra": "jotai=53 ratio=0.5613 1.8x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 14,
            "unit": "ns",
            "extra": "jotai=156 ratio=0.0927 10.8x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 421,
            "unit": "ns",
            "extra": "jotai=1248 ratio=0.3360 3.0x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 298,
            "unit": "ns",
            "extra": "jotai=1468 ratio=0.2026 4.9x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 489,
            "unit": "ns",
            "extra": "jotai=1712 ratio=0.2823 3.5x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 31454,
            "unit": "ns",
            "extra": "jotai=143664 ratio=0.2174 4.6x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 166,
            "unit": "ns",
            "extra": "jotai=561 ratio=0.2956 3.4x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 80640,
            "unit": "ns",
            "extra": "jotai=488784 ratio=0.1651 6.1x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 15789,
            "unit": "ns",
            "extra": "jotai=206135 ratio=0.0764 13.1x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 815,
            "unit": "ns",
            "extra": "jotai=1401 ratio=0.5786 1.7x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 184,
            "unit": "ns",
            "extra": "jotai=227 ratio=0.8036 1.2x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 27,
            "unit": "ns",
            "extra": "jotai=10 ratio=2.7060 2.7x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 167,
            "unit": "ns",
            "extra": "jotai=208 ratio=0.8022 1.2x faster"
          },
          {
            "name": "obj.value [Node]",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key) [Node]",
            "value": 9,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get [Node]",
            "value": 17,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get [Node]",
            "value": 203,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n [Node]",
            "value": 1,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n) [Node]",
            "value": 6,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set [Node]",
            "value": 269,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1406,
            "unit": "ns",
            "extra": "baseline"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "56672784b854fb15223426980c49fe7ee896fb2d",
          "message": "Fix benchmark README push from detached HEAD (#121)\n\nactions/checkout@v6 (upgraded in #110) checks out the workflow SHA in\ndetached HEAD state. Bare `git push` then fails with \"You are not\ncurrently on a branch\" — first observed on a manual workflow_dispatch\nrun. Push events on main happened to keep working, but the workflow\nis fragile either way.\n\nPush HEAD explicitly to main so the job works regardless of how it\nwas triggered.",
          "timestamp": "2026-05-21T14:03:43-07:00",
          "tree_id": "402d7cd7aefe27ca2989e197101d88e3b744e4a8",
          "url": "https://github.com/eigilsagafos/valdres/commit/56672784b854fb15223426980c49fe7ee896fb2d"
        },
        "date": 1779397485146,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 9,
            "unit": "ns",
            "extra": "jotai=76 ratio=0.1362 7.3x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 13,
            "unit": "ns",
            "extra": "jotai=341 ratio=0.0371 27.0x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 328,
            "unit": "ns",
            "extra": "jotai=4540 ratio=0.0716 14.0x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 371,
            "unit": "ns",
            "extra": "jotai=5339 ratio=0.0663 15.1x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 390,
            "unit": "ns",
            "extra": "jotai=6046 ratio=0.0641 15.6x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 16526,
            "unit": "ns",
            "extra": "jotai=271881 ratio=0.0609 16.4x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 323,
            "unit": "ns",
            "extra": "jotai=426 ratio=0.7345 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 27,
            "unit": "ns",
            "extra": "jotai=12 ratio=2.2501 2.3x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 284,
            "unit": "ns",
            "extra": "jotai=383 ratio=0.7418 1.3x faster"
          },
          {
            "name": "obj.value",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 12,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 350,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 1,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 17,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 192,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3031,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 7,
            "unit": "ns",
            "extra": "jotai=69 ratio=0.0922 10.8x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 8757,
            "unit": "ns",
            "extra": "jotai=40296 ratio=0.2272 4.4x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 63631,
            "unit": "ns",
            "extra": "jotai=204597 ratio=0.3076 3.3x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 7858,
            "unit": "ns",
            "extra": "jotai=15466 ratio=0.5075 2.0x faster"
          },
          {
            "name": "createStore",
            "value": 246,
            "unit": "ns",
            "extra": "jotai=5944 ratio=0.0408 24.5x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 109006,
            "unit": "ns",
            "extra": "jotai=967112 ratio=0.1136 8.8x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 8987,
            "unit": "ns",
            "extra": "jotai=357137 ratio=0.0252 39.7x faster"
          },
          {
            "name": "sub + unsub",
            "value": 1310,
            "unit": "ns",
            "extra": "jotai=3834 ratio=0.3141 3.2x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 73790,
            "unit": "ns",
            "extra": "jotai=280682 ratio=0.2537 3.9x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 136458,
            "unit": "ns",
            "extra": "jotai=597912 ratio=0.2050 4.9x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 925240,
            "unit": "ns",
            "extra": "jotai=2748512 ratio=0.3291 3.0x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 843670,
            "unit": "ns",
            "extra": "jotai=3056855 ratio=0.2762 3.6x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1104959,
            "unit": "ns",
            "extra": "jotai=18459931 ratio=0.0600 16.7x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 138222,
            "unit": "ns",
            "extra": "jotai=289096 ratio=0.4778 2.1x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 94809,
            "unit": "ns",
            "extra": "jotai=268403 ratio=0.3534 2.8x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 892658,
            "unit": "ns",
            "extra": "jotai=1362407 ratio=0.6520 1.5x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 1092015,
            "unit": "ns",
            "extra": "jotai=1748947 ratio=0.6214 1.6x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 1103316,
            "unit": "ns",
            "extra": "jotai=11966024 ratio=0.1018 9.8x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 42,
            "unit": "ns",
            "extra": "jotai=62 ratio=0.7337 1.4x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 8176,
            "unit": "ns",
            "extra": "jotai=13987 ratio=0.5844 1.7x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 81835,
            "unit": "ns",
            "extra": "jotai=132090 ratio=0.6229 1.6x faster"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 4346,
            "unit": "ns",
            "extra": "jotai=6996 ratio=0.6189 1.6x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 27,
            "unit": "ns",
            "extra": "jotai=53 ratio=0.5158 1.9x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 24,
            "unit": "ns",
            "extra": "jotai=164 ratio=0.1457 6.9x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 427,
            "unit": "ns",
            "extra": "jotai=1253 ratio=0.3371 3.0x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 287,
            "unit": "ns",
            "extra": "jotai=1497 ratio=0.1911 5.2x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 501,
            "unit": "ns",
            "extra": "jotai=1746 ratio=0.2850 3.5x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 32281,
            "unit": "ns",
            "extra": "jotai=145580 ratio=0.2210 4.5x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 164,
            "unit": "ns",
            "extra": "jotai=539 ratio=0.3032 3.3x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 89269,
            "unit": "ns",
            "extra": "jotai=466943 ratio=0.1908 5.2x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 15775,
            "unit": "ns",
            "extra": "jotai=205374 ratio=0.0744 13.4x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 797,
            "unit": "ns",
            "extra": "jotai=1427 ratio=0.5577 1.8x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 164,
            "unit": "ns",
            "extra": "jotai=240 ratio=0.7293 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 60,
            "unit": "ns",
            "extra": "jotai=31 ratio=1.8971 1.9x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 117,
            "unit": "ns",
            "extra": "jotai=169 ratio=0.6956 1.4x faster"
          },
          {
            "name": "obj.value [Node]",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key) [Node]",
            "value": 9,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get [Node]",
            "value": 17,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get [Node]",
            "value": 199,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n [Node]",
            "value": 1,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n) [Node]",
            "value": 6,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set [Node]",
            "value": 279,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1383,
            "unit": "ns",
            "extra": "baseline"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "ea9e32542c90c8c45d7b6862d063c8f5a39f5ba6",
          "message": "Stop publish workflow from committing the npm token to a branch (#124)\n\nWhen the changesets/action enters Version Packages PR mode after our\n1.0.0-beta.1 wave, it does `git add . && git commit && git push` to open\nthe release PR. Because the workflow created `.npmrc` at the repo root\nright before that step, the `git add .` swept the token into the commit\nand GitHub's push protection (correctly) blocked the push — see\nhttps://github.com/eigilsagafos/valdres/actions/runs/26255304854.\n\nTwo-layer fix:\n1. Move the workflow's `.npmrc` to `$HOME/.npmrc` so the token never\n   lives in the working tree. npm/`bunx changeset publish` still pick\n   it up from the user config.\n2. Gitignore `.npmrc` so the same shape can't recur if someone reverts\n   layer 1 or runs `npm login` locally.\n\nNo token leaked — push protection caught it at the wire and the\nchangeset-release/main branch was never created on the remote.\n\nCo-authored-by: Claude Opus 4.7 <noreply@anthropic.com>",
          "timestamp": "2026-05-21T14:57:26-07:00",
          "tree_id": "6a6f17cace6701aa8953400a00834125d2346e96",
          "url": "https://github.com/eigilsagafos/valdres/commit/ea9e32542c90c8c45d7b6862d063c8f5a39f5ba6"
        },
        "date": 1779400704464,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 7,
            "unit": "ns",
            "extra": "jotai=70 ratio=0.1055 9.5x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 13,
            "unit": "ns",
            "extra": "jotai=353 ratio=0.0365 27.4x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 180,
            "unit": "ns",
            "extra": "jotai=2734 ratio=0.0725 13.8x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 329,
            "unit": "ns",
            "extra": "jotai=5284 ratio=0.0623 16.1x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 430,
            "unit": "ns",
            "extra": "jotai=6008 ratio=0.0683 14.6x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 16019,
            "unit": "ns",
            "extra": "jotai=274231 ratio=0.0585 17.1x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 351,
            "unit": "ns",
            "extra": "jotai=471 ratio=0.7298 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 35,
            "unit": "ns",
            "extra": "jotai=13 ratio=2.6004 2.6x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 295,
            "unit": "ns",
            "extra": "jotai=345 ratio=0.7852 1.3x faster"
          },
          {
            "name": "obj.value",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 11,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 364,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 1,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 17,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 186,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3269,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 9,
            "unit": "ns",
            "extra": "jotai=70 ratio=0.1271 7.9x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 8100,
            "unit": "ns",
            "extra": "jotai=28152 ratio=0.2908 3.4x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 58852,
            "unit": "ns",
            "extra": "jotai=248658 ratio=0.2396 4.2x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 5569,
            "unit": "ns",
            "extra": "jotai=12969 ratio=0.4276 2.3x faster"
          },
          {
            "name": "createStore",
            "value": 269,
            "unit": "ns",
            "extra": "jotai=6108 ratio=0.0436 22.9x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 81145,
            "unit": "ns",
            "extra": "jotai=900770 ratio=0.0896 11.2x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 8262,
            "unit": "ns",
            "extra": "jotai=362626 ratio=0.0228 43.9x faster"
          },
          {
            "name": "sub + unsub",
            "value": 1389,
            "unit": "ns",
            "extra": "jotai=3991 ratio=0.3154 3.2x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 63529,
            "unit": "ns",
            "extra": "jotai=270820 ratio=0.2353 4.3x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 143783,
            "unit": "ns",
            "extra": "jotai=544033 ratio=0.2377 4.2x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 911376,
            "unit": "ns",
            "extra": "jotai=3834153 ratio=0.2456 4.1x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 823066,
            "unit": "ns",
            "extra": "jotai=3776567 ratio=0.2264 4.4x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1692140,
            "unit": "ns",
            "extra": "jotai=20377164 ratio=0.0829 12.1x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 133938,
            "unit": "ns",
            "extra": "jotai=311009 ratio=0.4300 2.3x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 88597,
            "unit": "ns",
            "extra": "jotai=281811 ratio=0.3214 3.1x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 845048,
            "unit": "ns",
            "extra": "jotai=1429982 ratio=0.5884 1.7x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 1052425,
            "unit": "ns",
            "extra": "jotai=1887127 ratio=0.5516 1.8x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 1325307,
            "unit": "ns",
            "extra": "jotai=12899669 ratio=0.1084 9.2x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 46,
            "unit": "ns",
            "extra": "jotai=60 ratio=0.7874 1.3x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 7301,
            "unit": "ns",
            "extra": "jotai=14301 ratio=0.5097 2.0x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 76624,
            "unit": "ns",
            "extra": "jotai=131114 ratio=0.5838 1.7x faster"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 4176,
            "unit": "ns",
            "extra": "jotai=7323 ratio=0.5679 1.8x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 28,
            "unit": "ns",
            "extra": "jotai=54 ratio=0.5776 1.7x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 16,
            "unit": "ns",
            "extra": "jotai=159 ratio=0.1012 9.9x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 379,
            "unit": "ns",
            "extra": "jotai=1221 ratio=0.3070 3.3x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 272,
            "unit": "ns",
            "extra": "jotai=1455 ratio=0.1825 5.5x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 447,
            "unit": "ns",
            "extra": "jotai=1730 ratio=0.2557 3.9x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 30480,
            "unit": "ns",
            "extra": "jotai=138114 ratio=0.2188 4.6x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 178,
            "unit": "ns",
            "extra": "jotai=578 ratio=0.3066 3.3x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 81416,
            "unit": "ns",
            "extra": "jotai=448031 ratio=0.1826 5.5x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 14431,
            "unit": "ns",
            "extra": "jotai=205940 ratio=0.0701 14.3x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 728,
            "unit": "ns",
            "extra": "jotai=1393 ratio=0.5199 1.9x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 154,
            "unit": "ns",
            "extra": "jotai=217 ratio=0.7246 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 28,
            "unit": "ns",
            "extra": "jotai=8 ratio=3.3484 3.3x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 161,
            "unit": "ns",
            "extra": "jotai=194 ratio=0.8324 1.2x faster"
          },
          {
            "name": "obj.value [Node]",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key) [Node]",
            "value": 10,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get [Node]",
            "value": 18,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get [Node]",
            "value": 203,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n [Node]",
            "value": 1,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n) [Node]",
            "value": 7,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set [Node]",
            "value": 252,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1369,
            "unit": "ns",
            "extra": "baseline"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "123316db3145e895cda44e2c56dd49742ca01731",
          "message": "Relax atomFamily cache-hit benchmark threshold (#126)\n\nThe 5.0x threshold was tight enough to flake on GitHub runners: jotai's\ncache hit lands at ~16ns, right at the timer-resolution floor, so the\npair-ratio band routinely spans 4–9x even though quiet hardware reports\n~2x. Bumped to 8.0x and added a comment so the next reader knows why.\nThe README still tracks the real ratio; this assertion only guards\nagainst regressions.\n\nCo-authored-by: Claude Opus 4.7 <noreply@anthropic.com>",
          "timestamp": "2026-05-21T15:05:16-07:00",
          "tree_id": "a9beb1365f80cb53024d0df7d0af0c57b9ed159a",
          "url": "https://github.com/eigilsagafos/valdres/commit/123316db3145e895cda44e2c56dd49742ca01731"
        },
        "date": 1779401179813,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 5,
            "unit": "ns",
            "extra": "jotai=61 ratio=0.0842 11.9x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 13,
            "unit": "ns",
            "extra": "jotai=341 ratio=0.0377 26.6x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 179,
            "unit": "ns",
            "extra": "jotai=2729 ratio=0.0659 15.2x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 345,
            "unit": "ns",
            "extra": "jotai=5876 ratio=0.0598 16.7x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 268,
            "unit": "ns",
            "extra": "jotai=3323 ratio=0.0796 12.6x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 16156,
            "unit": "ns",
            "extra": "jotai=266747 ratio=0.0603 16.6x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 312,
            "unit": "ns",
            "extra": "jotai=429 ratio=0.7134 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 28,
            "unit": "ns",
            "extra": "jotai=11 ratio=2.4181 2.4x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 289,
            "unit": "ns",
            "extra": "jotai=390 ratio=0.7211 1.4x faster"
          },
          {
            "name": "obj.value",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 11,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 352,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 1,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 17,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 189,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3065,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 6,
            "unit": "ns",
            "extra": "jotai=63 ratio=0.1101 9.1x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 6628,
            "unit": "ns",
            "extra": "jotai=24050 ratio=0.2703 3.7x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 57568,
            "unit": "ns",
            "extra": "jotai=241325 ratio=0.2386 4.2x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 5901,
            "unit": "ns",
            "extra": "jotai=13115 ratio=0.4498 2.2x faster"
          },
          {
            "name": "createStore",
            "value": 229,
            "unit": "ns",
            "extra": "jotai=5956 ratio=0.0383 26.1x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 111353,
            "unit": "ns",
            "extra": "jotai=923240 ratio=0.1207 8.3x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 8871,
            "unit": "ns",
            "extra": "jotai=420874 ratio=0.0187 53.5x faster"
          },
          {
            "name": "sub + unsub",
            "value": 1056,
            "unit": "ns",
            "extra": "jotai=3861 ratio=0.2329 4.3x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 69690,
            "unit": "ns",
            "extra": "jotai=258777 ratio=0.2789 3.6x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 120033,
            "unit": "ns",
            "extra": "jotai=521141 ratio=0.2323 4.3x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 832015,
            "unit": "ns",
            "extra": "jotai=3353966 ratio=0.2480 4.0x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 799640,
            "unit": "ns",
            "extra": "jotai=3554561 ratio=0.2287 4.4x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1586635,
            "unit": "ns",
            "extra": "jotai=18541083 ratio=0.0801 12.5x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 174280,
            "unit": "ns",
            "extra": "jotai=286805 ratio=0.5612 1.8x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 104454,
            "unit": "ns",
            "extra": "jotai=285031 ratio=0.3614 2.8x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 937085,
            "unit": "ns",
            "extra": "jotai=1378282 ratio=0.6751 1.5x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 1144983,
            "unit": "ns",
            "extra": "jotai=1856067 ratio=0.6128 1.6x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 1288219,
            "unit": "ns",
            "extra": "jotai=12854762 ratio=0.1216 8.2x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 45,
            "unit": "ns",
            "extra": "jotai=62 ratio=0.8066 1.2x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 8200,
            "unit": "ns",
            "extra": "jotai=14241 ratio=0.5750 1.7x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 80230,
            "unit": "ns",
            "extra": "jotai=131956 ratio=0.6051 1.7x faster"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 4406,
            "unit": "ns",
            "extra": "jotai=7157 ratio=0.6144 1.6x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 27,
            "unit": "ns",
            "extra": "jotai=57 ratio=0.5172 1.9x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 15,
            "unit": "ns",
            "extra": "jotai=161 ratio=0.0926 10.8x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 434,
            "unit": "ns",
            "extra": "jotai=1285 ratio=0.3332 3.0x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 288,
            "unit": "ns",
            "extra": "jotai=1502 ratio=0.1915 5.2x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 494,
            "unit": "ns",
            "extra": "jotai=1784 ratio=0.2754 3.6x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 32440,
            "unit": "ns",
            "extra": "jotai=151698 ratio=0.2126 4.7x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 160,
            "unit": "ns",
            "extra": "jotai=574 ratio=0.2770 3.6x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 80730,
            "unit": "ns",
            "extra": "jotai=482733 ratio=0.1669 6.0x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 16281,
            "unit": "ns",
            "extra": "jotai=206510 ratio=0.0774 12.9x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 793,
            "unit": "ns",
            "extra": "jotai=1382 ratio=0.5714 1.8x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 169,
            "unit": "ns",
            "extra": "jotai=220 ratio=0.7551 1.3x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 28,
            "unit": "ns",
            "extra": "jotai=7 ratio=4.4443 4.4x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 181,
            "unit": "ns",
            "extra": "jotai=235 ratio=0.7411 1.3x faster"
          },
          {
            "name": "obj.value [Node]",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key) [Node]",
            "value": 9,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get [Node]",
            "value": 17,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get [Node]",
            "value": 198,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n [Node]",
            "value": 1,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n) [Node]",
            "value": 6,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set [Node]",
            "value": 266,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1430,
            "unit": "ns",
            "extra": "baseline"
          }
        ]
      }
    ]
  }
}