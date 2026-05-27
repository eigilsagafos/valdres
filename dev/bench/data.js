window.BENCHMARK_DATA = {
  "lastUpdate": 1779880362366,
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
          "id": "6ed43d8bebb08cf43e42096619f1d6dcd3d087af",
          "message": "Gate publish on Test workflow success (#125)\n\n* Gate publish workflow on Test workflow success\n\nPublish previously ran in parallel with Test on push to main, so a\nfailing test suite wouldn't block an npm release. Switch to\n`workflow_run` so Publish only runs when Test completes successfully,\nand check out the exact tested commit.\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>\n\n* Consolidate test and publish into single CI workflow\n\nReplace the workflow_run gating with the more idiomatic pattern: one\nworkflow with two jobs, publish depending on test via `needs:`. Publish\nonly runs on push to main and only when the test job succeeds.\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.7 <noreply@anthropic.com>",
          "timestamp": "2026-05-21T15:08:03-07:00",
          "tree_id": "5e7fcf3f6f7bedb09dc51988faef0bdbdca185fc",
          "url": "https://github.com/eigilsagafos/valdres/commit/6ed43d8bebb08cf43e42096619f1d6dcd3d087af"
        },
        "date": 1779401345619,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 7,
            "unit": "ns",
            "extra": "jotai=57 ratio=0.1143 8.8x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 13,
            "unit": "ns",
            "extra": "jotai=399 ratio=0.0322 31.0x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 345,
            "unit": "ns",
            "extra": "jotai=5764 ratio=0.0634 15.8x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 327,
            "unit": "ns",
            "extra": "jotai=5563 ratio=0.0602 16.6x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 488,
            "unit": "ns",
            "extra": "jotai=6316 ratio=0.0756 13.2x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 17688,
            "unit": "ns",
            "extra": "jotai=285144 ratio=0.0626 16.0x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 422,
            "unit": "ns",
            "extra": "jotai=620 ratio=0.6902 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 28,
            "unit": "ns",
            "extra": "jotai=11 ratio=2.3943 2.4x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 343,
            "unit": "ns",
            "extra": "jotai=448 ratio=0.7482 1.3x faster"
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
            "value": 19,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 191,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3129,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 8,
            "unit": "ns",
            "extra": "jotai=66 ratio=0.1218 8.2x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 7066,
            "unit": "ns",
            "extra": "jotai=24816 ratio=0.2744 3.6x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 68388,
            "unit": "ns",
            "extra": "jotai=245408 ratio=0.2679 3.7x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 5931,
            "unit": "ns",
            "extra": "jotai=13210 ratio=0.4433 2.3x faster"
          },
          {
            "name": "createStore",
            "value": 248,
            "unit": "ns",
            "extra": "jotai=5999 ratio=0.0409 24.4x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 105256,
            "unit": "ns",
            "extra": "jotai=943512 ratio=0.1113 9.0x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 9848,
            "unit": "ns",
            "extra": "jotai=435623 ratio=0.0193 51.7x faster"
          },
          {
            "name": "sub + unsub",
            "value": 1119,
            "unit": "ns",
            "extra": "jotai=4060 ratio=0.2567 3.9x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 72060,
            "unit": "ns",
            "extra": "jotai=271467 ratio=0.2619 3.8x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 130103,
            "unit": "ns",
            "extra": "jotai=542062 ratio=0.2434 4.1x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 833998,
            "unit": "ns",
            "extra": "jotai=3470929 ratio=0.2417 4.1x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 838156,
            "unit": "ns",
            "extra": "jotai=3618910 ratio=0.2327 4.3x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1498559,
            "unit": "ns",
            "extra": "jotai=18866381 ratio=0.0806 12.4x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 142907,
            "unit": "ns",
            "extra": "jotai=305751 ratio=0.4786 2.1x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 101129,
            "unit": "ns",
            "extra": "jotai=283895 ratio=0.3526 2.8x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 947268,
            "unit": "ns",
            "extra": "jotai=1439557 ratio=0.6664 1.5x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 1139512,
            "unit": "ns",
            "extra": "jotai=1905617 ratio=0.5878 1.7x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 1471396,
            "unit": "ns",
            "extra": "jotai=13302613 ratio=0.1109 9.0x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 43,
            "unit": "ns",
            "extra": "jotai=69 ratio=0.7512 1.3x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 8408,
            "unit": "ns",
            "extra": "jotai=14783 ratio=0.5681 1.8x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 82254,
            "unit": "ns",
            "extra": "jotai=135152 ratio=0.6058 1.7x faster"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 4719,
            "unit": "ns",
            "extra": "jotai=7464 ratio=0.6204 1.6x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 35,
            "unit": "ns",
            "extra": "jotai=63 ratio=0.5253 1.9x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 24,
            "unit": "ns",
            "extra": "jotai=164 ratio=0.1447 6.9x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 425,
            "unit": "ns",
            "extra": "jotai=1285 ratio=0.3297 3.0x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 278,
            "unit": "ns",
            "extra": "jotai=1484 ratio=0.1863 5.4x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 482,
            "unit": "ns",
            "extra": "jotai=1754 ratio=0.2728 3.7x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 31499,
            "unit": "ns",
            "extra": "jotai=144630 ratio=0.2164 4.6x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 161,
            "unit": "ns",
            "extra": "jotai=574 ratio=0.2800 3.6x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 79809,
            "unit": "ns",
            "extra": "jotai=473584 ratio=0.1682 5.9x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 16436,
            "unit": "ns",
            "extra": "jotai=209311 ratio=0.0760 13.2x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 854,
            "unit": "ns",
            "extra": "jotai=1479 ratio=0.5738 1.7x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 147,
            "unit": "ns",
            "extra": "jotai=217 ratio=0.6706 1.5x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 69,
            "unit": "ns",
            "extra": "jotai=31 ratio=3.7752 3.8x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 115,
            "unit": "ns",
            "extra": "jotai=175 ratio=0.6674 1.5x faster"
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
            "value": 273,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1466,
            "unit": "ns",
            "extra": "baseline"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "41898282+github-actions[bot]@users.noreply.github.com",
            "name": "github-actions[bot]",
            "username": "github-actions[bot]"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "74112a646288fb29048507008780dba625e16031",
          "message": "Version Packages (beta) (#127)\n\n* Version Packages (beta)\n\n* Hardcode 0.3.0-beta.0 for the six pre-tag packages\n\nChangesets pre mode computes the new version as `semverInc(oldVersion,\nbumpType) + \"-${tag}.${preCount+1}\"`. When oldVersion already carries a\nprerelease identifier (here 0.2.0-pre.28), semver.inc collapses\nminor/patch into the bare 0.2.0, so a \"minor\" bump for these six\npackages produced 0.2.0-beta.29 instead of the intended 0.3.0-beta.0.\n\nOverride the bot's output for @valdres/color-mode, @valdres/hotkeys,\n@valdres-react/{color-mode,draggable,hotkeys,panable} — including their\ninter-package peerDependencies and the \"Updated dependencies\" footnotes\nin their CHANGELOGs. All other packages in this release PR are\nunaffected.\n\n* Add empty changeset for manual version override\n\nThe \"Require changeset\" CI gate runs `bunx changeset status --since=origin/main`\nand rejects publishable-package edits without a corresponding changeset\nentry. The override in the previous commit bypassed the bot's computed\nversions but added no changeset of its own — this empty entry satisfies\nthe gate without triggering an unwanted release.\n\n---------\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>\nCo-authored-by: Eigil Sagafos <eigil.sagafos@ardoq.com>",
          "timestamp": "2026-05-21T18:01:34-07:00",
          "tree_id": "a26f53ffe6a9020c4d9926251b80392489700bcf",
          "url": "https://github.com/eigilsagafos/valdres/commit/74112a646288fb29048507008780dba625e16031"
        },
        "date": 1779411751689,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 8,
            "unit": "ns",
            "extra": "jotai=80 ratio=0.1062 9.4x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 25,
            "unit": "ns",
            "extra": "jotai=708 ratio=0.0363 27.6x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 304,
            "unit": "ns",
            "extra": "jotai=4746 ratio=0.0649 15.4x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 359,
            "unit": "ns",
            "extra": "jotai=5659 ratio=0.0637 15.7x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 435,
            "unit": "ns",
            "extra": "jotai=5940 ratio=0.0723 13.8x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 16575,
            "unit": "ns",
            "extra": "jotai=278706 ratio=0.0592 16.9x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 332,
            "unit": "ns",
            "extra": "jotai=449 ratio=0.7327 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 32,
            "unit": "ns",
            "extra": "jotai=12 ratio=2.5408 2.5x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 334,
            "unit": "ns",
            "extra": "jotai=447 ratio=0.7254 1.4x faster"
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
            "value": 361,
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
            "value": 185,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3232,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 9,
            "unit": "ns",
            "extra": "jotai=71 ratio=0.1203 8.3x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 7041,
            "unit": "ns",
            "extra": "jotai=40439 ratio=0.1790 5.6x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 55152,
            "unit": "ns",
            "extra": "jotai=207109 ratio=0.2639 3.8x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 7154,
            "unit": "ns",
            "extra": "jotai=14915 ratio=0.4850 2.1x faster"
          },
          {
            "name": "createStore",
            "value": 258,
            "unit": "ns",
            "extra": "jotai=6071 ratio=0.0421 23.7x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 103703,
            "unit": "ns",
            "extra": "jotai=922738 ratio=0.1109 9.0x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 8533,
            "unit": "ns",
            "extra": "jotai=368872 ratio=0.0230 43.4x faster"
          },
          {
            "name": "sub + unsub",
            "value": 1306,
            "unit": "ns",
            "extra": "jotai=4034 ratio=0.3184 3.1x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 68671,
            "unit": "ns",
            "extra": "jotai=239533 ratio=0.2805 3.6x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 196590,
            "unit": "ns",
            "extra": "jotai=742598 ratio=0.2388 4.2x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 947815,
            "unit": "ns",
            "extra": "jotai=2998894 ratio=0.3091 3.2x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 769082,
            "unit": "ns",
            "extra": "jotai=3088726 ratio=0.2482 4.0x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1497399,
            "unit": "ns",
            "extra": "jotai=19252167 ratio=0.0679 14.7x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 137372,
            "unit": "ns",
            "extra": "jotai=312750 ratio=0.4402 2.3x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 93313,
            "unit": "ns",
            "extra": "jotai=283777 ratio=0.3313 3.0x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 889199,
            "unit": "ns",
            "extra": "jotai=1398223 ratio=0.6323 1.6x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 1100587,
            "unit": "ns",
            "extra": "jotai=1874857 ratio=0.5680 1.8x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 1272379,
            "unit": "ns",
            "extra": "jotai=12961834 ratio=0.1042 9.6x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 51,
            "unit": "ns",
            "extra": "jotai=58 ratio=0.8319 1.2x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 7326,
            "unit": "ns",
            "extra": "jotai=14451 ratio=0.5069 2.0x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 74165,
            "unit": "ns",
            "extra": "jotai=132585 ratio=0.5580 1.8x faster"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 4153,
            "unit": "ns",
            "extra": "jotai=7394 ratio=0.5574 1.8x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 28,
            "unit": "ns",
            "extra": "jotai=52 ratio=0.5840 1.7x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 23,
            "unit": "ns",
            "extra": "jotai=164 ratio=0.1382 7.2x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 406,
            "unit": "ns",
            "extra": "jotai=1247 ratio=0.3224 3.1x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 273,
            "unit": "ns",
            "extra": "jotai=1457 ratio=0.1858 5.4x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 458,
            "unit": "ns",
            "extra": "jotai=1713 ratio=0.2647 3.8x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 29599,
            "unit": "ns",
            "extra": "jotai=141738 ratio=0.2077 4.8x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 179,
            "unit": "ns",
            "extra": "jotai=552 ratio=0.3222 3.1x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 80784,
            "unit": "ns",
            "extra": "jotai=436583 ratio=0.1865 5.4x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 14292,
            "unit": "ns",
            "extra": "jotai=205082 ratio=0.0697 14.4x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 731,
            "unit": "ns",
            "extra": "jotai=1352 ratio=0.5395 1.9x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 254,
            "unit": "ns",
            "extra": "jotai=250 ratio=0.9124 1.1x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 87,
            "unit": "ns",
            "extra": "jotai=29 ratio=4.7200 4.7x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 156,
            "unit": "ns",
            "extra": "jotai=191 ratio=0.7807 1.3x faster"
          },
          {
            "name": "obj.value [Node]",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key) [Node]",
            "value": 24,
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
            "value": 202,
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
            "value": 264,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1346,
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
          "id": "6c3a33be48a8024907bd995ff6162fd4c00f1f28",
          "message": "Fix spurious SelectorCircularDependencyError from leaked cycle-set entry (#128)\n\nevaluateSelector switched to a module-level sharedCircularDepSet for cycle\ndetection, but cleanup only ran on the NeedsInitError branch and at the\ntail of the function. Any other throw — a SelectorEvaluationError rethrow,\na wrapped non-cycle error, or anything from the dep-tracking code after\nthe inner catch — left the selector in the set, so the next read tripped\nthe cycle check against a stale entry.\n\nWrap the body in try/finally so the delete runs on every exit path. The\nold per-call new WeakSet hid the bug because it was GC'd after each\ntop-level call.\n\nRepro (added as regression tests in selector.test.ts):\n  - Inner selector throws once; second store.get(outer) should succeed.\n  - Same via the reEvaluteSelector propagation path (which passes\n    circularDependencySet=undefined and defaults to the shared set).\n\nBoth fail before this change with \"Circular dependency detected in 'outer'\";\nboth pass after.",
          "timestamp": "2026-05-22T07:51:31-07:00",
          "tree_id": "e8cd661e744cf298e3a99142f68cb1ddeb0ef143",
          "url": "https://github.com/eigilsagafos/valdres/commit/6c3a33be48a8024907bd995ff6162fd4c00f1f28"
        },
        "date": 1779461549894,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 13,
            "unit": "ns",
            "extra": "jotai=81 ratio=0.1468 6.8x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 13,
            "unit": "ns",
            "extra": "jotai=353 ratio=0.0365 27.4x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 312,
            "unit": "ns",
            "extra": "jotai=4201 ratio=0.0736 13.6x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 331,
            "unit": "ns",
            "extra": "jotai=5237 ratio=0.0605 16.5x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 423,
            "unit": "ns",
            "extra": "jotai=6120 ratio=0.0702 14.2x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 29264,
            "unit": "ns",
            "extra": "jotai=499186 ratio=0.0583 17.2x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 409,
            "unit": "ns",
            "extra": "jotai=550 ratio=0.7474 1.3x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 31,
            "unit": "ns",
            "extra": "jotai=12 ratio=2.6365 2.6x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 383,
            "unit": "ns",
            "extra": "jotai=494 ratio=0.7867 1.3x faster"
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
            "value": 361,
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
            "value": 3246,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 10,
            "unit": "ns",
            "extra": "jotai=73 ratio=0.1299 7.7x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 10636,
            "unit": "ns",
            "extra": "jotai=56485 ratio=0.1782 5.6x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 56269,
            "unit": "ns",
            "extra": "jotai=211641 ratio=0.2599 3.8x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 5648,
            "unit": "ns",
            "extra": "jotai=11392 ratio=0.4950 2.0x faster"
          },
          {
            "name": "createStore",
            "value": 278,
            "unit": "ns",
            "extra": "jotai=6135 ratio=0.0451 22.2x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 103064,
            "unit": "ns",
            "extra": "jotai=924071 ratio=0.1116 9.0x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 8172,
            "unit": "ns",
            "extra": "jotai=375987 ratio=0.0220 45.4x faster"
          },
          {
            "name": "sub + unsub",
            "value": 1356,
            "unit": "ns",
            "extra": "jotai=4107 ratio=0.3146 3.2x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 72498,
            "unit": "ns",
            "extra": "jotai=292657 ratio=0.2428 4.1x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 207019,
            "unit": "ns",
            "extra": "jotai=639475 ratio=0.2390 4.2x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 993203,
            "unit": "ns",
            "extra": "jotai=2990376 ratio=0.3264 3.1x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 773736,
            "unit": "ns",
            "extra": "jotai=3144656 ratio=0.2469 4.0x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1827289,
            "unit": "ns",
            "extra": "jotai=22580471 ratio=0.0943 10.6x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 146224,
            "unit": "ns",
            "extra": "jotai=324796 ratio=0.4490 2.2x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 96019,
            "unit": "ns",
            "extra": "jotai=296889 ratio=0.3124 3.2x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 874541,
            "unit": "ns",
            "extra": "jotai=1404928 ratio=0.6260 1.6x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 1082632,
            "unit": "ns",
            "extra": "jotai=1910873 ratio=0.5609 1.8x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 1568047,
            "unit": "ns",
            "extra": "jotai=14149366 ratio=0.1090 9.2x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 46,
            "unit": "ns",
            "extra": "jotai=58 ratio=0.8331 1.2x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 7461,
            "unit": "ns",
            "extra": "jotai=14632 ratio=0.5105 2.0x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 76274,
            "unit": "ns",
            "extra": "jotai=133520 ratio=0.5685 1.8x faster"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 4116,
            "unit": "ns",
            "extra": "jotai=7451 ratio=0.5524 1.8x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 28,
            "unit": "ns",
            "extra": "jotai=52 ratio=0.5808 1.7x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 23,
            "unit": "ns",
            "extra": "jotai=160 ratio=0.1325 7.5x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 273,
            "unit": "ns",
            "extra": "jotai=1194 ratio=0.2309 4.3x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 271,
            "unit": "ns",
            "extra": "jotai=1477 ratio=0.1819 5.5x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 451,
            "unit": "ns",
            "extra": "jotai=1745 ratio=0.2525 4.0x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 30115,
            "unit": "ns",
            "extra": "jotai=136444 ratio=0.2187 4.6x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 176,
            "unit": "ns",
            "extra": "jotai=547 ratio=0.3221 3.1x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 81927,
            "unit": "ns",
            "extra": "jotai=429451 ratio=0.1903 5.3x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 14412,
            "unit": "ns",
            "extra": "jotai=205587 ratio=0.0701 14.3x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 738,
            "unit": "ns",
            "extra": "jotai=1373 ratio=0.5361 1.9x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 228,
            "unit": "ns",
            "extra": "jotai=254 ratio=0.9348 1.1x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 28,
            "unit": "ns",
            "extra": "jotai=7 ratio=3.9259 3.9x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 150,
            "unit": "ns",
            "extra": "jotai=187 ratio=0.8036 1.2x faster"
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
            "value": 256,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1324,
            "unit": "ns",
            "extra": "baseline"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "41898282+github-actions[bot]@users.noreply.github.com",
            "name": "github-actions[bot]",
            "username": "github-actions[bot]"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "9ee7d48cde10467af56040ee32d4df7ed6b3d5e2",
          "message": "Version Packages (beta) (#130)\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-05-22T07:54:58-07:00",
          "tree_id": "b84d7302b29c9f85fba5faf854a0848ebc5c808e",
          "url": "https://github.com/eigilsagafos/valdres/commit/9ee7d48cde10467af56040ee32d4df7ed6b3d5e2"
        },
        "date": 1779461757747,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 8,
            "unit": "ns",
            "extra": "jotai=89 ratio=0.0934 10.7x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 12,
            "unit": "ns",
            "extra": "jotai=322 ratio=0.0385 26.0x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 343,
            "unit": "ns",
            "extra": "jotai=4113 ratio=0.0799 12.5x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 406,
            "unit": "ns",
            "extra": "jotai=5746 ratio=0.0730 13.7x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 301,
            "unit": "ns",
            "extra": "jotai=4271 ratio=0.0755 13.3x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 16440,
            "unit": "ns",
            "extra": "jotai=276999 ratio=0.0596 16.8x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 303,
            "unit": "ns",
            "extra": "jotai=403 ratio=0.7402 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 31,
            "unit": "ns",
            "extra": "jotai=12 ratio=2.5672 2.6x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 281,
            "unit": "ns",
            "extra": "jotai=391 ratio=0.7237 1.4x faster"
          },
          {
            "name": "obj.value",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 3,
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
            "value": 341,
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
            "value": 16,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 171,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 2839,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 10,
            "unit": "ns",
            "extra": "jotai=81 ratio=0.1378 7.3x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 11297,
            "unit": "ns",
            "extra": "jotai=40034 ratio=0.2751 3.6x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 58829,
            "unit": "ns",
            "extra": "jotai=226024 ratio=0.2617 3.8x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 5275,
            "unit": "ns",
            "extra": "jotai=12480 ratio=0.4180 2.4x faster"
          },
          {
            "name": "createStore",
            "value": 293,
            "unit": "ns",
            "extra": "jotai=6556 ratio=0.0449 22.3x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 96808,
            "unit": "ns",
            "extra": "jotai=948925 ratio=0.1024 9.8x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 8091,
            "unit": "ns",
            "extra": "jotai=337730 ratio=0.0239 41.8x faster"
          },
          {
            "name": "sub + unsub",
            "value": 1042,
            "unit": "ns",
            "extra": "jotai=3280 ratio=0.2865 3.5x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 69202,
            "unit": "ns",
            "extra": "jotai=255957 ratio=0.2703 3.7x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 107527,
            "unit": "ns",
            "extra": "jotai=461889 ratio=0.2317 4.3x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 795742,
            "unit": "ns",
            "extra": "jotai=2933746 ratio=0.2861 3.5x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 790835,
            "unit": "ns",
            "extra": "jotai=3385234 ratio=0.2407 4.2x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1689467,
            "unit": "ns",
            "extra": "jotai=17898672 ratio=0.0818 12.2x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 113189,
            "unit": "ns",
            "extra": "jotai=233584 ratio=0.4946 2.0x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 99856,
            "unit": "ns",
            "extra": "jotai=293246 ratio=0.3430 2.9x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 887833,
            "unit": "ns",
            "extra": "jotai=1476801 ratio=0.6016 1.7x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 1075336,
            "unit": "ns",
            "extra": "jotai=1959202 ratio=0.5456 1.8x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 1460100,
            "unit": "ns",
            "extra": "jotai=12533762 ratio=0.1183 8.5x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 45,
            "unit": "ns",
            "extra": "jotai=62 ratio=0.7426 1.3x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 7725,
            "unit": "ns",
            "extra": "jotai=15386 ratio=0.5010 2.0x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 74838,
            "unit": "ns",
            "extra": "jotai=137125 ratio=0.5501 1.8x faster"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 4149,
            "unit": "ns",
            "extra": "jotai=7601 ratio=0.5429 1.8x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 24,
            "unit": "ns",
            "extra": "jotai=58 ratio=0.4436 2.3x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 19,
            "unit": "ns",
            "extra": "jotai=159 ratio=0.1140 8.8x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 258,
            "unit": "ns",
            "extra": "jotai=1355 ratio=0.1909 5.2x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 257,
            "unit": "ns",
            "extra": "jotai=1577 ratio=0.1640 6.1x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 445,
            "unit": "ns",
            "extra": "jotai=1951 ratio=0.2296 4.4x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 27652,
            "unit": "ns",
            "extra": "jotai=154980 ratio=0.1793 5.6x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 271,
            "unit": "ns",
            "extra": "jotai=809 ratio=0.3356 3.0x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 75492,
            "unit": "ns",
            "extra": "jotai=508801 ratio=0.1594 6.3x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 13182,
            "unit": "ns",
            "extra": "jotai=182350 ratio=0.0716 14.0x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 897,
            "unit": "ns",
            "extra": "jotai=1575 ratio=0.5649 1.8x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 270,
            "unit": "ns",
            "extra": "jotai=336 ratio=0.7050 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 63,
            "unit": "ns",
            "extra": "jotai=13 ratio=4.4612 4.5x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 267,
            "unit": "ns",
            "extra": "jotai=337 ratio=0.8482 1.2x faster"
          },
          {
            "name": "obj.value [Node]",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key) [Node]",
            "value": 21,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get [Node]",
            "value": 15,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get [Node]",
            "value": 186,
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
            "value": 242,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1495,
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
          "id": "36f75240f8fed2d0441fd30f360ed2dec24fafe1",
          "message": "Lazy-allocate AbortController for selector first eval (#131)\n\n* Defer AbortController allocation until selector reads options.signal\n\n`options.signal` is now a lazy getter. Selectors that never read it (the\ncommon case) skip AbortController allocation on first eval — ~160ns saved\nper first-eval sync selector, ~29% off the init path for that case. The\nknown-sync cache, previous-controller abort on re-eval, and controller\nstorage for async cancellation are all preserved.\n\n* Pre-abort signal when accessed after eval was superseded\n\nA selector whose body returns a Promise without reading `opts.signal` and\nonly touches it later (e.g. after an await) would, with lazy allocation\nalone, miss the abort on re-eval — Eval 2 would see no controller in the\nmap to abort. The getter now captures its eval's `evalCtx` and, if that\ncontext has been revoked by the time `signal` is first read, returns a\npre-aborted signal. Hot path (signal never read) is unchanged.",
          "timestamp": "2026-05-22T09:59:05-07:00",
          "tree_id": "beee59247d3909ebd2542f2f4a7bdd9c8ba61f15",
          "url": "https://github.com/eigilsagafos/valdres/commit/36f75240f8fed2d0441fd30f360ed2dec24fafe1"
        },
        "date": 1779469202902,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 8,
            "unit": "ns",
            "extra": "jotai=70 ratio=0.1077 9.3x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 25,
            "unit": "ns",
            "extra": "jotai=740 ratio=0.0333 30.0x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 196,
            "unit": "ns",
            "extra": "jotai=2688 ratio=0.0795 12.6x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 397,
            "unit": "ns",
            "extra": "jotai=5427 ratio=0.0703 14.2x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 486,
            "unit": "ns",
            "extra": "jotai=5796 ratio=0.0809 12.4x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 15767,
            "unit": "ns",
            "extra": "jotai=272097 ratio=0.0576 17.4x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 307,
            "unit": "ns",
            "extra": "jotai=394 ratio=0.7419 1.3x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 31,
            "unit": "ns",
            "extra": "jotai=11 ratio=2.6712 2.7x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 311,
            "unit": "ns",
            "extra": "jotai=389 ratio=0.7407 1.4x faster"
          },
          {
            "name": "obj.value",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 3,
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
            "value": 338,
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
            "value": 18,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 165,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 2787,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 11,
            "unit": "ns",
            "extra": "jotai=83 ratio=0.1384 7.2x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 8618,
            "unit": "ns",
            "extra": "jotai=25946 ratio=0.3396 2.9x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 62555,
            "unit": "ns",
            "extra": "jotai=229761 ratio=0.2785 3.6x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 5137,
            "unit": "ns",
            "extra": "jotai=12565 ratio=0.4061 2.5x faster"
          },
          {
            "name": "createStore",
            "value": 513,
            "unit": "ns",
            "extra": "jotai=6973 ratio=0.0732 13.7x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 80477,
            "unit": "ns",
            "extra": "jotai=942192 ratio=0.0851 11.8x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 7883,
            "unit": "ns",
            "extra": "jotai=330950 ratio=0.0239 41.8x faster"
          },
          {
            "name": "sub + unsub",
            "value": 1240,
            "unit": "ns",
            "extra": "jotai=3510 ratio=0.3246 3.1x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 70518,
            "unit": "ns",
            "extra": "jotai=262296 ratio=0.2725 3.7x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 129522,
            "unit": "ns",
            "extra": "jotai=494782 ratio=0.2403 4.2x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 809401,
            "unit": "ns",
            "extra": "jotai=3046629 ratio=0.2810 3.6x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 834779,
            "unit": "ns",
            "extra": "jotai=3506002 ratio=0.2438 4.1x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1505130,
            "unit": "ns",
            "extra": "jotai=17786621 ratio=0.0766 13.1x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 114012,
            "unit": "ns",
            "extra": "jotai=234557 ratio=0.4808 2.1x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 97130,
            "unit": "ns",
            "extra": "jotai=296056 ratio=0.3233 3.1x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 879488,
            "unit": "ns",
            "extra": "jotai=1489297 ratio=0.5666 1.8x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 1102642,
            "unit": "ns",
            "extra": "jotai=2095686 ratio=0.4904 2.0x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 1659863,
            "unit": "ns",
            "extra": "jotai=13864766 ratio=0.1187 8.4x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 42,
            "unit": "ns",
            "extra": "jotai=62 ratio=0.7041 1.4x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 7583,
            "unit": "ns",
            "extra": "jotai=15781 ratio=0.4802 2.1x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 72248,
            "unit": "ns",
            "extra": "jotai=142842 ratio=0.5103 2.0x faster"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 3996,
            "unit": "ns",
            "extra": "jotai=8072 ratio=0.4925 2.0x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 24,
            "unit": "ns",
            "extra": "jotai=57 ratio=0.4408 2.3x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 13,
            "unit": "ns",
            "extra": "jotai=158 ratio=0.0886 11.3x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 254,
            "unit": "ns",
            "extra": "jotai=1300 ratio=0.1956 5.1x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 254,
            "unit": "ns",
            "extra": "jotai=1524 ratio=0.1673 6.0x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 441,
            "unit": "ns",
            "extra": "jotai=1877 ratio=0.2338 4.3x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 27679,
            "unit": "ns",
            "extra": "jotai=138999 ratio=0.1997 5.0x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 240,
            "unit": "ns",
            "extra": "jotai=757 ratio=0.3188 3.1x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 72036,
            "unit": "ns",
            "extra": "jotai=445610 ratio=0.1623 6.2x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 13360,
            "unit": "ns",
            "extra": "jotai=184829 ratio=0.0716 14.0x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 772,
            "unit": "ns",
            "extra": "jotai=1509 ratio=0.5125 2.0x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 207,
            "unit": "ns",
            "extra": "jotai=286 ratio=0.6757 1.5x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 58,
            "unit": "ns",
            "extra": "jotai=13 ratio=4.6151 4.6x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 209,
            "unit": "ns",
            "extra": "jotai=289 ratio=0.7582 1.3x faster"
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
            "value": 27,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get [Node]",
            "value": 183,
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
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set [Node]",
            "value": 245,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1445,
            "unit": "ns",
            "extra": "baseline"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "41898282+github-actions[bot]@users.noreply.github.com",
            "name": "github-actions[bot]",
            "username": "github-actions[bot]"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "28d47c9ecce46f88a18664921d7273312c6d80bb",
          "message": "Version Packages (beta) (#132)\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-05-22T13:06:49-07:00",
          "tree_id": "024c4f14f364061a75e4ec110699e61e693346a3",
          "url": "https://github.com/eigilsagafos/valdres/commit/28d47c9ecce46f88a18664921d7273312c6d80bb"
        },
        "date": 1779480474410,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 4,
            "unit": "ns",
            "extra": "jotai=58 ratio=0.0845 11.8x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 13,
            "unit": "ns",
            "extra": "jotai=342 ratio=0.0377 26.5x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 305,
            "unit": "ns",
            "extra": "jotai=4211 ratio=0.0741 13.5x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 402,
            "unit": "ns",
            "extra": "jotai=5700 ratio=0.0676 14.8x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 327,
            "unit": "ns",
            "extra": "jotai=5978 ratio=0.0619 16.2x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 16471,
            "unit": "ns",
            "extra": "jotai=262970 ratio=0.0630 15.9x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 339,
            "unit": "ns",
            "extra": "jotai=504 ratio=0.7203 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 28,
            "unit": "ns",
            "extra": "jotai=11 ratio=2.4611 2.5x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 304,
            "unit": "ns",
            "extra": "jotai=402 ratio=0.7268 1.4x faster"
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
            "value": 347,
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
            "value": 187,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3086,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 7,
            "unit": "ns",
            "extra": "jotai=66 ratio=0.0985 10.1x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 7344,
            "unit": "ns",
            "extra": "jotai=27492 ratio=0.2727 3.7x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 62086,
            "unit": "ns",
            "extra": "jotai=245919 ratio=0.2512 4.0x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 5821,
            "unit": "ns",
            "extra": "jotai=13225 ratio=0.4379 2.3x faster"
          },
          {
            "name": "createStore",
            "value": 229,
            "unit": "ns",
            "extra": "jotai=5959 ratio=0.0378 26.4x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 104715,
            "unit": "ns",
            "extra": "jotai=918153 ratio=0.1143 8.7x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 8681,
            "unit": "ns",
            "extra": "jotai=403983 ratio=0.0191 52.3x faster"
          },
          {
            "name": "sub + unsub",
            "value": 1065,
            "unit": "ns",
            "extra": "jotai=3861 ratio=0.2320 4.3x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 74960,
            "unit": "ns",
            "extra": "jotai=259709 ratio=0.2899 3.4x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 130844,
            "unit": "ns",
            "extra": "jotai=532719 ratio=0.2430 4.1x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 869461,
            "unit": "ns",
            "extra": "jotai=3368286 ratio=0.2595 3.9x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 841896,
            "unit": "ns",
            "extra": "jotai=3610514 ratio=0.2376 4.2x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1366343,
            "unit": "ns",
            "extra": "jotai=18411976 ratio=0.0753 13.3x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 144009,
            "unit": "ns",
            "extra": "jotai=291273 ratio=0.4896 2.0x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 97426,
            "unit": "ns",
            "extra": "jotai=285802 ratio=0.3486 2.9x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 902573,
            "unit": "ns",
            "extra": "jotai=1397852 ratio=0.6478 1.5x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 1110320,
            "unit": "ns",
            "extra": "jotai=1814083 ratio=0.6021 1.7x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 1234161,
            "unit": "ns",
            "extra": "jotai=12591329 ratio=0.1031 9.7x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 43,
            "unit": "ns",
            "extra": "jotai=55 ratio=0.7679 1.3x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 8080,
            "unit": "ns",
            "extra": "jotai=14778 ratio=0.5466 1.8x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 81462,
            "unit": "ns",
            "extra": "jotai=135042 ratio=0.6044 1.7x faster"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 4341,
            "unit": "ns",
            "extra": "jotai=7369 ratio=0.5874 1.7x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 26,
            "unit": "ns",
            "extra": "jotai=54 ratio=0.5162 1.9x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 13,
            "unit": "ns",
            "extra": "jotai=161 ratio=0.0835 12.0x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 302,
            "unit": "ns",
            "extra": "jotai=1239 ratio=0.2445 4.1x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 309,
            "unit": "ns",
            "extra": "jotai=1456 ratio=0.2119 4.7x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 502,
            "unit": "ns",
            "extra": "jotai=1723 ratio=0.2900 3.4x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 32371,
            "unit": "ns",
            "extra": "jotai=141479 ratio=0.2286 4.4x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 163,
            "unit": "ns",
            "extra": "jotai=552 ratio=0.2943 3.4x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 92743,
            "unit": "ns",
            "extra": "jotai=462633 ratio=0.2007 5.0x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 16210,
            "unit": "ns",
            "extra": "jotai=210137 ratio=0.0758 13.2x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 793,
            "unit": "ns",
            "extra": "jotai=1401 ratio=0.5643 1.8x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 144,
            "unit": "ns",
            "extra": "jotai=204 ratio=0.6711 1.5x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 27,
            "unit": "ns",
            "extra": "jotai=10 ratio=2.8811 2.9x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 170,
            "unit": "ns",
            "extra": "jotai=203 ratio=0.7965 1.3x faster"
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
            "value": 200,
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
            "value": 292,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1378,
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
          "id": "389b886302e199a1d630ec44d468056fabb98376",
          "message": "Fix Bun-only API in Node bench + ungate Node bench on PRs (#138)\n\ncleanup-walk.bench.ts called Bun.nanoseconds() directly, which broke the\nNode bench step on main. The Node step was gated to refs/heads/main, so\nPR CI didn't catch it before merge.\n\n- Add a portable nanoseconds() helper to test-compat.ts (Bun.nanoseconds\n  under Bun, performance.now() * 1e6 under Node) and use it.\n- Run the Node bench step on PRs too, so portability breakage in\n  .bench.ts files is caught before merge.\n\nCo-authored-by: Claude Opus 4.7 <noreply@anthropic.com>",
          "timestamp": "2026-05-22T15:23:25-07:00",
          "tree_id": "8bbfb758c566ab8728d5eabd79b89d75d0807533",
          "url": "https://github.com/eigilsagafos/valdres/commit/389b886302e199a1d630ec44d468056fabb98376"
        },
        "date": 1779488667106,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 6,
            "unit": "ns",
            "extra": "jotai=60 ratio=0.0961 10.4x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 13,
            "unit": "ns",
            "extra": "jotai=340 ratio=0.0371 26.9x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 292,
            "unit": "ns",
            "extra": "jotai=4690 ratio=0.0604 16.6x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 128,
            "unit": "ns",
            "extra": "jotai=2765 ratio=0.0463 21.6x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 215,
            "unit": "ns",
            "extra": "jotai=3439 ratio=0.0618 16.2x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 12960,
            "unit": "ns",
            "extra": "jotai=272520 ratio=0.0473 21.1x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 272,
            "unit": "ns",
            "extra": "jotai=386 ratio=0.6927 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 29,
            "unit": "ns",
            "extra": "jotai=11 ratio=2.5232 2.5x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 311,
            "unit": "ns",
            "extra": "jotai=411 ratio=0.7554 1.3x faster"
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
            "value": 349,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
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
            "value": 146,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3117,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 6,
            "unit": "ns",
            "extra": "jotai=62 ratio=0.1031 9.7x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 7063,
            "unit": "ns",
            "extra": "jotai=38823 ratio=0.1926 5.2x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 65137,
            "unit": "ns",
            "extra": "jotai=271338 ratio=0.2359 4.2x faster"
          },
          {
            "name": "sub+unsub on chain of 50 unsubscribed derived deps",
            "value": 86632,
            "unit": "ns",
            "extra": "jotai=118432 ratio=0.6977 1.4x faster"
          },
          {
            "name": "sub+unsub on chain of 100 unsubscribed derived deps",
            "value": 194835,
            "unit": "ns",
            "extra": "jotai=226745 ratio=0.8524 1.2x faster"
          },
          {
            "name": "sub+unsub on chain of 500 unsubscribed derived deps",
            "value": 736899,
            "unit": "ns",
            "extra": "jotai=678003 ratio=0.8701 1.1x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 6984,
            "unit": "ns",
            "extra": "jotai=20431 ratio=0.3477 2.9x faster"
          },
          {
            "name": "createStore",
            "value": 232,
            "unit": "ns",
            "extra": "jotai=5961 ratio=0.0386 25.9x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 82575,
            "unit": "ns",
            "extra": "jotai=961795 ratio=0.0857 11.7x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 8461,
            "unit": "ns",
            "extra": "jotai=358104 ratio=0.0237 42.2x faster"
          },
          {
            "name": "sub + unsub",
            "value": 1278,
            "unit": "ns",
            "extra": "jotai=3629 ratio=0.3496 2.9x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 73843,
            "unit": "ns",
            "extra": "jotai=394128 ratio=0.1878 5.3x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 119544,
            "unit": "ns",
            "extra": "jotai=624458 ratio=0.1919 5.2x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 904682,
            "unit": "ns",
            "extra": "jotai=3694587 ratio=0.2452 4.1x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 886333,
            "unit": "ns",
            "extra": "jotai=3828151 ratio=0.2284 4.4x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1462475,
            "unit": "ns",
            "extra": "jotai=23068501 ratio=0.0674 14.8x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 145102,
            "unit": "ns",
            "extra": "jotai=296444 ratio=0.4793 2.1x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 108193,
            "unit": "ns",
            "extra": "jotai=283952 ratio=0.3668 2.7x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 871701,
            "unit": "ns",
            "extra": "jotai=1350251 ratio=0.6486 1.5x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 1065133,
            "unit": "ns",
            "extra": "jotai=1800448 ratio=0.5882 1.7x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 1358481,
            "unit": "ns",
            "extra": "jotai=12289017 ratio=0.1202 8.3x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 42,
            "unit": "ns",
            "extra": "jotai=56 ratio=0.8271 1.2x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 7259,
            "unit": "ns",
            "extra": "jotai=14076 ratio=0.5152 1.9x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 75136,
            "unit": "ns",
            "extra": "jotai=127233 ratio=0.5919 1.7x faster"
          },
          {
            "name": "sub+unsub on chain of 50 unsubscribed derived deps [Node]",
            "value": 101740,
            "unit": "ns",
            "extra": "jotai=57889 ratio=1.7816 1.8x slower"
          },
          {
            "name": "sub+unsub on chain of 100 unsubscribed derived deps [Node]",
            "value": 193893,
            "unit": "ns",
            "extra": "jotai=108753 ratio=1.7769 1.8x slower"
          },
          {
            "name": "sub+unsub on chain of 500 unsubscribed derived deps [Node]",
            "value": 910272,
            "unit": "ns",
            "extra": "jotai=528374 ratio=1.7385 1.7x slower"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 4401,
            "unit": "ns",
            "extra": "jotai=7071 ratio=0.6192 1.6x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 25,
            "unit": "ns",
            "extra": "jotai=56 ratio=0.5040 2.0x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 24,
            "unit": "ns",
            "extra": "jotai=163 ratio=0.1441 6.9x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 212,
            "unit": "ns",
            "extra": "jotai=1240 ratio=0.1715 5.8x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 219,
            "unit": "ns",
            "extra": "jotai=1462 ratio=0.1494 6.7x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 258,
            "unit": "ns",
            "extra": "jotai=1688 ratio=0.1534 6.5x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 23755,
            "unit": "ns",
            "extra": "jotai=145362 ratio=0.1621 6.2x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 170,
            "unit": "ns",
            "extra": "jotai=491 ratio=0.3439 2.9x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 80987,
            "unit": "ns",
            "extra": "jotai=482904 ratio=0.1678 6.0x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 16276,
            "unit": "ns",
            "extra": "jotai=207528 ratio=0.0773 12.9x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 869,
            "unit": "ns",
            "extra": "jotai=1401 ratio=0.6201 1.6x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 181,
            "unit": "ns",
            "extra": "jotai=214 ratio=0.7849 1.3x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 78,
            "unit": "ns",
            "extra": "jotai=16 ratio=4.8739 4.9x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 138,
            "unit": "ns",
            "extra": "jotai=180 ratio=0.7720 1.3x faster"
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
            "value": 200,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1371,
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
          "id": "0c7553015fc6705eaf3aa01109bf242c392438b6",
          "message": "Remove dead lib files from valdres core (#139)\n\nrecursivlyUpdateSelectors.ts was leftover from the state propagation\noverhaul and has had no references since. trace.ts had an unreachable\nbody (early return on line 5) and no call sites.\n\nCo-authored-by: Claude Opus 4.7 <noreply@anthropic.com>",
          "timestamp": "2026-05-22T15:32:09-07:00",
          "tree_id": "6f0d79ce85f187f6e083872e97d83c3ea490390a",
          "url": "https://github.com/eigilsagafos/valdres/commit/0c7553015fc6705eaf3aa01109bf242c392438b6"
        },
        "date": 1779489190051,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 6,
            "unit": "ns",
            "extra": "jotai=58 ratio=0.1057 9.5x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 13,
            "unit": "ns",
            "extra": "jotai=341 ratio=0.0379 26.4x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 155,
            "unit": "ns",
            "extra": "jotai=2733 ratio=0.0617 16.2x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 247,
            "unit": "ns",
            "extra": "jotai=5585 ratio=0.0448 22.3x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 211,
            "unit": "ns",
            "extra": "jotai=3686 ratio=0.0588 17.0x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 12378,
            "unit": "ns",
            "extra": "jotai=268900 ratio=0.0464 21.6x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 338,
            "unit": "ns",
            "extra": "jotai=461 ratio=0.7236 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 30,
            "unit": "ns",
            "extra": "jotai=12 ratio=2.5202 2.5x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 301,
            "unit": "ns",
            "extra": "jotai=399 ratio=0.7731 1.3x faster"
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
            "value": 350,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 5,
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
            "value": 145,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3129,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 6,
            "unit": "ns",
            "extra": "jotai=62 ratio=0.1096 9.1x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 8766,
            "unit": "ns",
            "extra": "jotai=40010 ratio=0.2344 4.3x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 66815,
            "unit": "ns",
            "extra": "jotai=384400 ratio=0.1828 5.5x faster"
          },
          {
            "name": "sub+unsub on chain of 50 unsubscribed derived deps",
            "value": 72325,
            "unit": "ns",
            "extra": "jotai=114574 ratio=0.6300 1.6x faster"
          },
          {
            "name": "sub+unsub on chain of 100 unsubscribed derived deps",
            "value": 149012,
            "unit": "ns",
            "extra": "jotai=165167 ratio=0.8343 1.2x faster"
          },
          {
            "name": "sub+unsub on chain of 500 unsubscribed derived deps",
            "value": 978776,
            "unit": "ns",
            "extra": "jotai=1128841 ratio=0.8774 1.1x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 7023,
            "unit": "ns",
            "extra": "jotai=19016 ratio=0.3667 2.7x faster"
          },
          {
            "name": "createStore",
            "value": 230,
            "unit": "ns",
            "extra": "jotai=5998 ratio=0.0380 26.3x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 104184,
            "unit": "ns",
            "extra": "jotai=998894 ratio=0.1060 9.4x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 8090,
            "unit": "ns",
            "extra": "jotai=359144 ratio=0.0226 44.2x faster"
          },
          {
            "name": "sub + unsub",
            "value": 1308,
            "unit": "ns",
            "extra": "jotai=3736 ratio=0.3453 2.9x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 76372,
            "unit": "ns",
            "extra": "jotai=394925 ratio=0.1982 5.0x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 140277,
            "unit": "ns",
            "extra": "jotai=665288 ratio=0.2081 4.8x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 943441,
            "unit": "ns",
            "extra": "jotai=3757342 ratio=0.2488 4.0x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 861914,
            "unit": "ns",
            "extra": "jotai=3781782 ratio=0.2288 4.4x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1632844,
            "unit": "ns",
            "extra": "jotai=22328924 ratio=0.0699 14.3x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 139661,
            "unit": "ns",
            "extra": "jotai=292154 ratio=0.4870 2.1x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 103663,
            "unit": "ns",
            "extra": "jotai=284500 ratio=0.3601 2.8x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 857856,
            "unit": "ns",
            "extra": "jotai=1387913 ratio=0.6165 1.6x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 1074539,
            "unit": "ns",
            "extra": "jotai=1853099 ratio=0.5764 1.7x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 1297965,
            "unit": "ns",
            "extra": "jotai=12530262 ratio=0.1059 9.4x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 43,
            "unit": "ns",
            "extra": "jotai=57 ratio=0.7823 1.3x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 7549,
            "unit": "ns",
            "extra": "jotai=14557 ratio=0.5184 1.9x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 77234,
            "unit": "ns",
            "extra": "jotai=135722 ratio=0.5693 1.8x faster"
          },
          {
            "name": "sub+unsub on chain of 50 unsubscribed derived deps [Node]",
            "value": 102466,
            "unit": "ns",
            "extra": "jotai=60783 ratio=1.6748 1.7x slower"
          },
          {
            "name": "sub+unsub on chain of 100 unsubscribed derived deps [Node]",
            "value": 194752,
            "unit": "ns",
            "extra": "jotai=112354 ratio=1.7375 1.7x slower"
          },
          {
            "name": "sub+unsub on chain of 500 unsubscribed derived deps [Node]",
            "value": 919781,
            "unit": "ns",
            "extra": "jotai=548741 ratio=1.6815 1.7x slower"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 4535,
            "unit": "ns",
            "extra": "jotai=7357 ratio=0.6138 1.6x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 27,
            "unit": "ns",
            "extra": "jotai=56 ratio=0.5352 1.9x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 23,
            "unit": "ns",
            "extra": "jotai=169 ratio=0.1327 7.5x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 222,
            "unit": "ns",
            "extra": "jotai=1310 ratio=0.1651 6.1x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 213,
            "unit": "ns",
            "extra": "jotai=1497 ratio=0.1379 7.3x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 259,
            "unit": "ns",
            "extra": "jotai=1757 ratio=0.1477 6.8x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 23163,
            "unit": "ns",
            "extra": "jotai=148411 ratio=0.1547 6.5x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 164,
            "unit": "ns",
            "extra": "jotai=510 ratio=0.3217 3.1x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 83691,
            "unit": "ns",
            "extra": "jotai=470024 ratio=0.1786 5.6x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 16110,
            "unit": "ns",
            "extra": "jotai=207617 ratio=0.0749 13.3x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 872,
            "unit": "ns",
            "extra": "jotai=1459 ratio=0.5975 1.7x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 179,
            "unit": "ns",
            "extra": "jotai=214 ratio=0.7965 1.3x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 28,
            "unit": "ns",
            "extra": "jotai=7 ratio=4.2214 4.2x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 136,
            "unit": "ns",
            "extra": "jotai=187 ratio=0.7348 1.4x faster"
          },
          {
            "name": "obj.value [Node]",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key) [Node]",
            "value": 24,
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
            "value": 200,
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
            "value": 195,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1398,
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
          "id": "69b0e6da6c1c6a62e900d9e48d13d75340764982",
          "message": "Move pending-default suspense placeholder off the Promise instance (#142)\n\n* Move pending-default suspense placeholder off the Promise instance\n\nAtoms declared with no defaultValue produce a suspense placeholder Promise\non first read. The placeholder was previously identified by patching\n__isEmptyAtomPromise__ / __resolveEmptyAtomPromise__ on the Promise itself,\nand the chain through async set() calls relied on patching\n__emptyAtomPromiseOrigin__ onto user-supplied promises. Both could leak to\nuser code via get() — React Suspense, raw setter return values in Vue/Solid/\nAngular, Svelte readable subscribers — and the user-promise mutation breaks\nunder SES / lockdown.\n\nReplace with a WeakMap<Atom, { promise, resolve }> on StoreData, keyed by\natom identity. The origin chain disappears (the invariant is per-atom, not\nper-promise), six @ts-ignores go with it, and the Promise returned by get()\nis now plain.\n\nAlso fixes two latent bugs the prior structure had:\n  - sync set() after an in-flight async set() on an empty atom hung the\n    suspense promise (sync branch checked currentValue.__isEmptyAtomPromise__\n    which was false once an async set had overwritten values)\n  - set() in a scoped store on an empty atom inited in the parent hung the\n    suspense promise (each store has its own pendingDefaults; resolver\n    walks the scope chain)\n\nBoth have regression tests.\n\n* Eagerly allocate pendingDefaults instead of using lazy getter\n\nresolvePendingDefault in setAtom walks the scope chain on every setAtom call, so the\nlazy pattern (one-shot allocation on first read) buys nothing — first setAtom\ntriggers allocation regardless. Allocating in createStoreData alongside values and\nscopes makes the hot-path access a plain own-property read and matches the eager\nallocation of the other always-touched maps.",
          "timestamp": "2026-05-22T16:48:22-07:00",
          "tree_id": "3769309360fac890e4873845ef8b2908b2c77e4a",
          "url": "https://github.com/eigilsagafos/valdres/commit/69b0e6da6c1c6a62e900d9e48d13d75340764982"
        },
        "date": 1779493758560,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 4,
            "unit": "ns",
            "extra": "jotai=58 ratio=0.0900 11.1x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 13,
            "unit": "ns",
            "extra": "jotai=340 ratio=0.0379 26.4x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 247,
            "unit": "ns",
            "extra": "jotai=4748 ratio=0.0505 19.8x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 105,
            "unit": "ns",
            "extra": "jotai=2870 ratio=0.0369 27.1x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 409,
            "unit": "ns",
            "extra": "jotai=6506 ratio=0.0636 15.7x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 11136,
            "unit": "ns",
            "extra": "jotai=274232 ratio=0.0406 24.6x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 277,
            "unit": "ns",
            "extra": "jotai=383 ratio=0.7132 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 29,
            "unit": "ns",
            "extra": "jotai=11 ratio=2.4701 2.5x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 268,
            "unit": "ns",
            "extra": "jotai=376 ratio=0.7661 1.3x faster"
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
            "value": 350,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 5,
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
            "value": 122,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 2670,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 7,
            "unit": "ns",
            "extra": "jotai=65 ratio=0.1162 8.6x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 7985,
            "unit": "ns",
            "extra": "jotai=41858 ratio=0.2015 5.0x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 66374,
            "unit": "ns",
            "extra": "jotai=384536 ratio=0.1759 5.7x faster"
          },
          {
            "name": "sub+unsub on chain of 50 unsubscribed derived deps",
            "value": 85906,
            "unit": "ns",
            "extra": "jotai=121416 ratio=0.6977 1.4x faster"
          },
          {
            "name": "sub+unsub on chain of 100 unsubscribed derived deps",
            "value": 125174,
            "unit": "ns",
            "extra": "jotai=151822 ratio=0.8373 1.2x faster"
          },
          {
            "name": "sub+unsub on chain of 500 unsubscribed derived deps",
            "value": 765421,
            "unit": "ns",
            "extra": "jotai=1126064 ratio=0.8519 1.2x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 6838,
            "unit": "ns",
            "extra": "jotai=18525 ratio=0.3681 2.7x faster"
          },
          {
            "name": "createStore",
            "value": 278,
            "unit": "ns",
            "extra": "jotai=6053 ratio=0.0458 21.8x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 82563,
            "unit": "ns",
            "extra": "jotai=948398 ratio=0.0858 11.7x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 7779,
            "unit": "ns",
            "extra": "jotai=356314 ratio=0.0219 45.7x faster"
          },
          {
            "name": "sub + unsub",
            "value": 1312,
            "unit": "ns",
            "extra": "jotai=3751 ratio=0.3432 2.9x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 74124,
            "unit": "ns",
            "extra": "jotai=342819 ratio=0.2207 4.5x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 132016,
            "unit": "ns",
            "extra": "jotai=569181 ratio=0.2234 4.5x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 929337,
            "unit": "ns",
            "extra": "jotai=3715946 ratio=0.2454 4.1x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 841318,
            "unit": "ns",
            "extra": "jotai=3852559 ratio=0.2144 4.7x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1459340,
            "unit": "ns",
            "extra": "jotai=22929673 ratio=0.0643 15.6x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 143553,
            "unit": "ns",
            "extra": "jotai=295461 ratio=0.4875 2.1x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 108868,
            "unit": "ns",
            "extra": "jotai=291534 ratio=0.3717 2.7x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 937677,
            "unit": "ns",
            "extra": "jotai=1389855 ratio=0.6717 1.5x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 1145685,
            "unit": "ns",
            "extra": "jotai=1868853 ratio=0.6131 1.6x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 1360365,
            "unit": "ns",
            "extra": "jotai=12764329 ratio=0.1122 8.9x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 43,
            "unit": "ns",
            "extra": "jotai=60 ratio=0.7721 1.3x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 7474,
            "unit": "ns",
            "extra": "jotai=14588 ratio=0.5121 2.0x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 74499,
            "unit": "ns",
            "extra": "jotai=132697 ratio=0.5578 1.8x faster"
          },
          {
            "name": "sub+unsub on chain of 50 unsubscribed derived deps [Node]",
            "value": 101289,
            "unit": "ns",
            "extra": "jotai=59966 ratio=1.7129 1.7x slower"
          },
          {
            "name": "sub+unsub on chain of 100 unsubscribed derived deps [Node]",
            "value": 194136,
            "unit": "ns",
            "extra": "jotai=110536 ratio=1.7628 1.8x slower"
          },
          {
            "name": "sub+unsub on chain of 500 unsubscribed derived deps [Node]",
            "value": 918759,
            "unit": "ns",
            "extra": "jotai=539299 ratio=1.7084 1.7x slower"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 4472,
            "unit": "ns",
            "extra": "jotai=7341 ratio=0.6055 1.7x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 26,
            "unit": "ns",
            "extra": "jotai=52 ratio=0.5434 1.8x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 24,
            "unit": "ns",
            "extra": "jotai=164 ratio=0.1365 7.3x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 231,
            "unit": "ns",
            "extra": "jotai=1266 ratio=0.1813 5.5x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 231,
            "unit": "ns",
            "extra": "jotai=1525 ratio=0.1487 6.7x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 263,
            "unit": "ns",
            "extra": "jotai=1762 ratio=0.1488 6.7x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 25467,
            "unit": "ns",
            "extra": "jotai=144540 ratio=0.1751 5.7x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 197,
            "unit": "ns",
            "extra": "jotai=484 ratio=0.4073 2.5x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 80250,
            "unit": "ns",
            "extra": "jotai=461650 ratio=0.1747 5.7x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 15429,
            "unit": "ns",
            "extra": "jotai=206946 ratio=0.0743 13.5x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 892,
            "unit": "ns",
            "extra": "jotai=1459 ratio=0.6109 1.6x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 137,
            "unit": "ns",
            "extra": "jotai=225 ratio=0.6511 1.5x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 75,
            "unit": "ns",
            "extra": "jotai=16 ratio=4.7268 4.7x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 129,
            "unit": "ns",
            "extra": "jotai=185 ratio=0.7075 1.4x faster"
          },
          {
            "name": "obj.value [Node]",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key) [Node]",
            "value": 24,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get [Node]",
            "value": 31,
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
            "value": 205,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1443,
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
          "id": "8393f22a408b886a6ff83179eba65cd3a6da1513",
          "message": "Allow user-provided onSet on global atoms (#144)\n\nThe onSet field on global atoms was reserved for the internal cross-store\nsync mechanism, so passing options.onSet threw at construction. Compose\nthe two in the factory: cross-store sync runs first (peers receive the\nupdate with skipOnSet=true so the user hook doesn't double-fire), then\nthe user hook fires once in the originating store.",
          "timestamp": "2026-05-22T16:48:49-07:00",
          "tree_id": "efe1981a701225cd7216c1d133bef2751c3cb20d",
          "url": "https://github.com/eigilsagafos/valdres/commit/8393f22a408b886a6ff83179eba65cd3a6da1513"
        },
        "date": 1779493826824,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 5,
            "unit": "ns",
            "extra": "jotai=47 ratio=0.1035 9.7x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 10,
            "unit": "ns",
            "extra": "jotai=274 ratio=0.0363 27.5x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 169,
            "unit": "ns",
            "extra": "jotai=3354 ratio=0.0482 20.7x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 152,
            "unit": "ns",
            "extra": "jotai=4042 ratio=0.0380 26.3x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 120,
            "unit": "ns",
            "extra": "jotai=2834 ratio=0.0438 22.8x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 8964,
            "unit": "ns",
            "extra": "jotai=216772 ratio=0.0407 24.6x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 250,
            "unit": "ns",
            "extra": "jotai=357 ratio=0.7026 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 23,
            "unit": "ns",
            "extra": "jotai=8 ratio=2.7856 2.8x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 249,
            "unit": "ns",
            "extra": "jotai=330 ratio=0.7095 1.4x faster"
          },
          {
            "name": "obj.value",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 3,
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
            "value": 281,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 13,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 95,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 1889,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 7,
            "unit": "ns",
            "extra": "jotai=53 ratio=0.1349 7.4x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 5701,
            "unit": "ns",
            "extra": "jotai=24837 ratio=0.2235 4.5x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 45929,
            "unit": "ns",
            "extra": "jotai=284869 ratio=0.1608 6.2x faster"
          },
          {
            "name": "sub+unsub on chain of 50 unsubscribed derived deps",
            "value": 52539,
            "unit": "ns",
            "extra": "jotai=60647 ratio=0.8297 1.2x faster"
          },
          {
            "name": "sub+unsub on chain of 100 unsubscribed derived deps",
            "value": 106030,
            "unit": "ns",
            "extra": "jotai=117402 ratio=0.9229 1.1x faster"
          },
          {
            "name": "sub+unsub on chain of 500 unsubscribed derived deps",
            "value": 437639,
            "unit": "ns",
            "extra": "jotai=460863 ratio=0.9436 1.1x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 4253,
            "unit": "ns",
            "extra": "jotai=10719 ratio=0.3962 2.5x faster"
          },
          {
            "name": "createStore",
            "value": 247,
            "unit": "ns",
            "extra": "jotai=4800 ratio=0.0517 19.3x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 65208,
            "unit": "ns",
            "extra": "jotai=716058 ratio=0.0902 11.1x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 6455,
            "unit": "ns",
            "extra": "jotai=323958 ratio=0.0196 50.9x faster"
          },
          {
            "name": "sub + unsub",
            "value": 1012,
            "unit": "ns",
            "extra": "jotai=3140 ratio=0.2989 3.3x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 48212,
            "unit": "ns",
            "extra": "jotai=302871 ratio=0.1600 6.2x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 83606,
            "unit": "ns",
            "extra": "jotai=485030 ratio=0.1726 5.8x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 690630,
            "unit": "ns",
            "extra": "jotai=2972378 ratio=0.2293 4.4x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 628411,
            "unit": "ns",
            "extra": "jotai=4124215 ratio=0.1959 5.1x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1208398,
            "unit": "ns",
            "extra": "jotai=20129133 ratio=0.0591 16.9x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 103556,
            "unit": "ns",
            "extra": "jotai=244278 ratio=0.4205 2.4x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 71807,
            "unit": "ns",
            "extra": "jotai=209696 ratio=0.3460 2.9x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 659097,
            "unit": "ns",
            "extra": "jotai=1081898 ratio=0.6014 1.7x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 791907,
            "unit": "ns",
            "extra": "jotai=1465480 ratio=0.5370 1.9x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 1018658,
            "unit": "ns",
            "extra": "jotai=9833732 ratio=0.1043 9.6x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 35,
            "unit": "ns",
            "extra": "jotai=45 ratio=0.8134 1.2x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 5153,
            "unit": "ns",
            "extra": "jotai=11247 ratio=0.4574 2.2x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 53661,
            "unit": "ns",
            "extra": "jotai=103196 ratio=0.5171 1.9x faster"
          },
          {
            "name": "sub+unsub on chain of 50 unsubscribed derived deps [Node]",
            "value": 78188,
            "unit": "ns",
            "extra": "jotai=46360 ratio=1.6891 1.7x slower"
          },
          {
            "name": "sub+unsub on chain of 100 unsubscribed derived deps [Node]",
            "value": 151039,
            "unit": "ns",
            "extra": "jotai=88593 ratio=1.7158 1.7x slower"
          },
          {
            "name": "sub+unsub on chain of 500 unsubscribed derived deps [Node]",
            "value": 727895,
            "unit": "ns",
            "extra": "jotai=430999 ratio=1.7040 1.7x slower"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 3237,
            "unit": "ns",
            "extra": "jotai=6246 ratio=0.5157 1.9x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 21,
            "unit": "ns",
            "extra": "jotai=40 ratio=0.5535 1.8x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 12,
            "unit": "ns",
            "extra": "jotai=156 ratio=0.0802 12.5x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 171,
            "unit": "ns",
            "extra": "jotai=1036 ratio=0.1638 6.1x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 175,
            "unit": "ns",
            "extra": "jotai=1261 ratio=0.1364 7.3x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 215,
            "unit": "ns",
            "extra": "jotai=1425 ratio=0.1494 6.7x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 18518,
            "unit": "ns",
            "extra": "jotai=120672 ratio=0.1525 6.6x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 162,
            "unit": "ns",
            "extra": "jotai=435 ratio=0.3704 2.7x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 63851,
            "unit": "ns",
            "extra": "jotai=340252 ratio=0.1879 5.3x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 11146,
            "unit": "ns",
            "extra": "jotai=160021 ratio=0.0696 14.4x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 633,
            "unit": "ns",
            "extra": "jotai=1130 ratio=0.5581 1.8x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 186,
            "unit": "ns",
            "extra": "jotai=173 ratio=0.9610 1.0x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 71,
            "unit": "ns",
            "extra": "jotai=13 ratio=5.2017 5.2x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 196,
            "unit": "ns",
            "extra": "jotai=182 ratio=0.9820 1.0x faster"
          },
          {
            "name": "obj.value [Node]",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key) [Node]",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get [Node]",
            "value": 11,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get [Node]",
            "value": 156,
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
            "value": 157,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1103,
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
          "id": "3234ea9911f5fd4bd220702dbdf3aee3f413b79e",
          "message": "Honor skipOnSet in setAtoms (#145)\n\nMirror setAtom's signature so the cross-store-sync invariant holds\nuniformly. Today peers route through setAtom singular, so this only\ncloses a latent gap — but anyone routing peer syncs through setAtoms\n(e.g. transactional global-atom writes) would re-enter onSet and\nrecurse without it.",
          "timestamp": "2026-05-27T11:11:38+02:00",
          "tree_id": "1e2aa48a974bdf5f8235bb3b0da093a1016cd138",
          "url": "https://github.com/eigilsagafos/valdres/commit/3234ea9911f5fd4bd220702dbdf3aee3f413b79e"
        },
        "date": 1779873158197,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 4,
            "unit": "ns",
            "extra": "jotai=56 ratio=0.0913 11.0x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 13,
            "unit": "ns",
            "extra": "jotai=372 ratio=0.0352 28.4x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 256,
            "unit": "ns",
            "extra": "jotai=4686 ratio=0.0539 18.6x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 110,
            "unit": "ns",
            "extra": "jotai=3045 ratio=0.0382 26.2x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 155,
            "unit": "ns",
            "extra": "jotai=3410 ratio=0.0468 21.4x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 11171,
            "unit": "ns",
            "extra": "jotai=259168 ratio=0.0428 23.4x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 289,
            "unit": "ns",
            "extra": "jotai=390 ratio=0.7336 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 29,
            "unit": "ns",
            "extra": "jotai=11 ratio=2.4805 2.5x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 271,
            "unit": "ns",
            "extra": "jotai=370 ratio=0.7258 1.4x faster"
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
            "value": 350,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
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
            "value": 125,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 2351,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 6,
            "unit": "ns",
            "extra": "jotai=65 ratio=0.0969 10.3x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 6973,
            "unit": "ns",
            "extra": "jotai=38563 ratio=0.1896 5.3x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 66300,
            "unit": "ns",
            "extra": "jotai=360313 ratio=0.2006 5.0x faster"
          },
          {
            "name": "sub+unsub on chain of 50 unsubscribed derived deps",
            "value": 69782,
            "unit": "ns",
            "extra": "jotai=113273 ratio=0.6177 1.6x faster"
          },
          {
            "name": "sub+unsub on chain of 100 unsubscribed derived deps",
            "value": 136457,
            "unit": "ns",
            "extra": "jotai=166434 ratio=0.8211 1.2x faster"
          },
          {
            "name": "sub+unsub on chain of 500 unsubscribed derived deps",
            "value": 633427,
            "unit": "ns",
            "extra": "jotai=667146 ratio=0.8522 1.2x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 6753,
            "unit": "ns",
            "extra": "jotai=18039 ratio=0.3739 2.7x faster"
          },
          {
            "name": "createStore",
            "value": 278,
            "unit": "ns",
            "extra": "jotai=5905 ratio=0.0464 21.5x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 82325,
            "unit": "ns",
            "extra": "jotai=953604 ratio=0.0852 11.7x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 7930,
            "unit": "ns",
            "extra": "jotai=358405 ratio=0.0224 44.6x faster"
          },
          {
            "name": "sub + unsub",
            "value": 1242,
            "unit": "ns",
            "extra": "jotai=3615 ratio=0.3421 2.9x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 73529,
            "unit": "ns",
            "extra": "jotai=405463 ratio=0.1855 5.4x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 140143,
            "unit": "ns",
            "extra": "jotai=661049 ratio=0.2146 4.7x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 907136,
            "unit": "ns",
            "extra": "jotai=3675611 ratio=0.2421 4.1x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 853160,
            "unit": "ns",
            "extra": "jotai=3864912 ratio=0.2197 4.6x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1428859,
            "unit": "ns",
            "extra": "jotai=22253296 ratio=0.0645 15.5x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 139192,
            "unit": "ns",
            "extra": "jotai=288077 ratio=0.4736 2.1x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 110523,
            "unit": "ns",
            "extra": "jotai=285773 ratio=0.3747 2.7x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 892559,
            "unit": "ns",
            "extra": "jotai=1373304 ratio=0.6457 1.5x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 1067668,
            "unit": "ns",
            "extra": "jotai=1830078 ratio=0.5826 1.7x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 1192875,
            "unit": "ns",
            "extra": "jotai=12876748 ratio=0.0977 10.2x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 43,
            "unit": "ns",
            "extra": "jotai=56 ratio=0.7937 1.3x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 7259,
            "unit": "ns",
            "extra": "jotai=14229 ratio=0.5102 2.0x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 75883,
            "unit": "ns",
            "extra": "jotai=131333 ratio=0.5810 1.7x faster"
          },
          {
            "name": "sub+unsub on chain of 50 unsubscribed derived deps [Node]",
            "value": 102007,
            "unit": "ns",
            "extra": "jotai=58601 ratio=1.7257 1.7x slower"
          },
          {
            "name": "sub+unsub on chain of 100 unsubscribed derived deps [Node]",
            "value": 192062,
            "unit": "ns",
            "extra": "jotai=109556 ratio=1.7742 1.8x slower"
          },
          {
            "name": "sub+unsub on chain of 500 unsubscribed derived deps [Node]",
            "value": 896908,
            "unit": "ns",
            "extra": "jotai=520058 ratio=1.7412 1.7x slower"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 4522,
            "unit": "ns",
            "extra": "jotai=7134 ratio=0.6332 1.6x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 27,
            "unit": "ns",
            "extra": "jotai=55 ratio=0.5158 1.9x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 14,
            "unit": "ns",
            "extra": "jotai=159 ratio=0.0914 10.9x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 248,
            "unit": "ns",
            "extra": "jotai=1244 ratio=0.1991 5.0x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 254,
            "unit": "ns",
            "extra": "jotai=1446 ratio=0.1767 5.7x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 281,
            "unit": "ns",
            "extra": "jotai=1718 ratio=0.1637 6.1x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 26831,
            "unit": "ns",
            "extra": "jotai=144477 ratio=0.1838 5.4x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 176,
            "unit": "ns",
            "extra": "jotai=562 ratio=0.3126 3.2x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 83332,
            "unit": "ns",
            "extra": "jotai=468461 ratio=0.1788 5.6x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 15639,
            "unit": "ns",
            "extra": "jotai=210837 ratio=0.0723 13.8x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 870,
            "unit": "ns",
            "extra": "jotai=1401 ratio=0.6199 1.6x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 138,
            "unit": "ns",
            "extra": "jotai=211 ratio=0.6557 1.5x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 28,
            "unit": "ns",
            "extra": "jotai=7 ratio=4.2051 4.2x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 169,
            "unit": "ns",
            "extra": "jotai=211 ratio=0.8132 1.2x faster"
          },
          {
            "name": "obj.value [Node]",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key) [Node]",
            "value": 24,
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
            "value": 210,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1373,
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
          "id": "9f011c915d4c8a1fbb2b3e886014890444e93afc",
          "message": "Unify StoreData type and fix maxAge × scope shadow surprises (#146)\n\n* Unify StoreData type and fix maxAge × scope shadow surprises\n\nCollapse RootStoreData and ScopedStoreData into a single StoreData\nshape with optional parent. The eight `\"parent\" in data` runtime\nchecks across getState, propagateUpdatedAtoms, setValueInData,\natomFamilyIndex, and subscribe become `data.parent` checks, and\nthree @ts-ignore @ts-todo markers go with the union narrowing they\nexisted to paper over.\n\nFix two surprises around maxAge × scope shadows:\n\n- scope.set(maxAgeAtom, value) is now a deliberate pin. The lazy\n  revalidation guard in isCachedValueStale no longer evicts\n  scope-local values past their TTL, so the shadow survives an\n  unsubscribed read instead of silently falling back to the parent.\n- Subscribing to a scope-shadowed maxAge atom no longer installs a\n  second scope-local revalidation timer that would overwrite the\n  shadow and double-invoke defaultValue(). Non-shadowed scope subs\n  continue to delegate up to the parent's timer as before.\n\nAdds packages/valdres/src/lib/scope.test.ts covering 4–5 level\nnesting, cross-scope family deletion, subscribe/unsubscribe/resub\nin scopes, and the new maxAge × shadow semantics.\n\n* Address Copilot review feedback\n\n- trackScopeValue: replace `data.parent!` / `data.scopeIndexKeys!` with\n  explicit guard + throw, so an accidental call on a root store fails\n  fast with a clear error instead of a downstream TypeError.\n- subscribe.ts: switch `state.maxAge` truthiness checks to `!== undefined`\n  at both call sites (installMaxAgeTimer and the scope-skip guard). The\n  type is `Reactive<number>`, so `0` is a valid TTL that previously got\n  treated as \"unset\".\n\n* Add red regression tests for Copilot fixes and apply same fix in globalAtom\n\nTests pin down the contracts the prior commit (212a8373) restored:\n\n- trackScopeValue throws \"trackScopeValue called on a root store\"\n  when invoked on a root store. Pre-fix, the test caught the generic\n  TypeError \"undefined is not an object (evaluating\n  'parent.scopeValueIndex')\".\n- subscribe installs setInterval for an atom with maxAge: 0. Pre-fix,\n  the truthy check `if (!state.maxAge) return` in installMaxAgeTimer\n  and `&& state.maxAge` in subscribe both treated 0 as unset and\n  setInterval was never called.\n- attach installs setInterval for a global atom with maxAge: 0. Same\n  root cause in globalAtom.ts:136 (`if (atom.maxAge && ...)`), which\n  the prior commit missed. Fix and test added here.\n\nAll three tests verified red against the pre-fix code, green after.",
          "timestamp": "2026-05-27T12:02:15+02:00",
          "tree_id": "662a8006cd2b7e67567628bdbd5052d00824c23a",
          "url": "https://github.com/eigilsagafos/valdres/commit/9f011c915d4c8a1fbb2b3e886014890444e93afc"
        },
        "date": 1779876193935,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 7,
            "unit": "ns",
            "extra": "jotai=65 ratio=0.1108 9.0x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 13,
            "unit": "ns",
            "extra": "jotai=355 ratio=0.0366 27.3x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 212,
            "unit": "ns",
            "extra": "jotai=4329 ratio=0.0481 20.8x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 183,
            "unit": "ns",
            "extra": "jotai=5037 ratio=0.0357 28.0x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 150,
            "unit": "ns",
            "extra": "jotai=3432 ratio=0.0431 23.2x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 12008,
            "unit": "ns",
            "extra": "jotai=289586 ratio=0.0404 24.8x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 317,
            "unit": "ns",
            "extra": "jotai=441 ratio=0.7145 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 32,
            "unit": "ns",
            "extra": "jotai=12 ratio=2.5561 2.6x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 340,
            "unit": "ns",
            "extra": "jotai=456 ratio=0.7405 1.4x faster"
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
            "value": 363,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 5,
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
            "value": 128,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3339,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 10,
            "unit": "ns",
            "extra": "jotai=72 ratio=0.1354 7.4x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 7261,
            "unit": "ns",
            "extra": "jotai=40100 ratio=0.1858 5.4x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 62554,
            "unit": "ns",
            "extra": "jotai=366681 ratio=0.1821 5.5x faster"
          },
          {
            "name": "sub+unsub on chain of 50 unsubscribed derived deps",
            "value": 69725,
            "unit": "ns",
            "extra": "jotai=105449 ratio=0.6609 1.5x faster"
          },
          {
            "name": "sub+unsub on chain of 100 unsubscribed derived deps",
            "value": 217497,
            "unit": "ns",
            "extra": "jotai=231528 ratio=0.9342 1.1x faster"
          },
          {
            "name": "sub+unsub on chain of 500 unsubscribed derived deps",
            "value": 644088,
            "unit": "ns",
            "extra": "jotai=600563 ratio=1.0187 1.0x slower"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 6155,
            "unit": "ns",
            "extra": "jotai=14289 ratio=0.4335 2.3x faster"
          },
          {
            "name": "createStore",
            "value": 312,
            "unit": "ns",
            "extra": "jotai=6076 ratio=0.0514 19.5x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 82048,
            "unit": "ns",
            "extra": "jotai=935907 ratio=0.0875 11.4x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 8252,
            "unit": "ns",
            "extra": "jotai=420597 ratio=0.0197 50.8x faster"
          },
          {
            "name": "sub + unsub",
            "value": 1388,
            "unit": "ns",
            "extra": "jotai=4096 ratio=0.3238 3.1x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 64587,
            "unit": "ns",
            "extra": "jotai=385590 ratio=0.1728 5.8x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 117727,
            "unit": "ns",
            "extra": "jotai=638430 ratio=0.1857 5.4x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 951852,
            "unit": "ns",
            "extra": "jotai=3870658 ratio=0.2411 4.1x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 884529,
            "unit": "ns",
            "extra": "jotai=5344724 ratio=0.1653 6.0x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1758313,
            "unit": "ns",
            "extra": "jotai=27713252 ratio=0.0625 16.0x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 140742,
            "unit": "ns",
            "extra": "jotai=315134 ratio=0.4471 2.2x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 97898,
            "unit": "ns",
            "extra": "jotai=278889 ratio=0.3424 2.9x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 863899,
            "unit": "ns",
            "extra": "jotai=1399223 ratio=0.6110 1.6x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 1046373,
            "unit": "ns",
            "extra": "jotai=1883161 ratio=0.5523 1.8x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 1406024,
            "unit": "ns",
            "extra": "jotai=12736705 ratio=0.1158 8.6x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 45,
            "unit": "ns",
            "extra": "jotai=59 ratio=0.7992 1.3x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 6825,
            "unit": "ns",
            "extra": "jotai=14604 ratio=0.4674 2.1x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 69104,
            "unit": "ns",
            "extra": "jotai=134192 ratio=0.5101 2.0x faster"
          },
          {
            "name": "sub+unsub on chain of 50 unsubscribed derived deps [Node]",
            "value": 100110,
            "unit": "ns",
            "extra": "jotai=57772 ratio=1.7414 1.7x slower"
          },
          {
            "name": "sub+unsub on chain of 100 unsubscribed derived deps [Node]",
            "value": 196205,
            "unit": "ns",
            "extra": "jotai=108733 ratio=1.8171 1.8x slower"
          },
          {
            "name": "sub+unsub on chain of 500 unsubscribed derived deps [Node]",
            "value": 942307,
            "unit": "ns",
            "extra": "jotai=526682 ratio=1.8081 1.8x slower"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 4200,
            "unit": "ns",
            "extra": "jotai=7329 ratio=0.5713 1.8x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 28,
            "unit": "ns",
            "extra": "jotai=54 ratio=0.5577 1.8x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 23,
            "unit": "ns",
            "extra": "jotai=165 ratio=0.1379 7.3x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 215,
            "unit": "ns",
            "extra": "jotai=1204 ratio=0.1771 5.6x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 228,
            "unit": "ns",
            "extra": "jotai=1473 ratio=0.1537 6.5x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 257,
            "unit": "ns",
            "extra": "jotai=1742 ratio=0.1473 6.8x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 25619,
            "unit": "ns",
            "extra": "jotai=138534 ratio=0.1840 5.4x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 201,
            "unit": "ns",
            "extra": "jotai=565 ratio=0.3545 2.8x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 81252,
            "unit": "ns",
            "extra": "jotai=429896 ratio=0.1904 5.3x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 14342,
            "unit": "ns",
            "extra": "jotai=205935 ratio=0.0697 14.3x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 807,
            "unit": "ns",
            "extra": "jotai=1450 ratio=0.5534 1.8x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 203,
            "unit": "ns",
            "extra": "jotai=219 ratio=0.8917 1.1x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 81,
            "unit": "ns",
            "extra": "jotai=29 ratio=4.3384 4.3x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 140,
            "unit": "ns",
            "extra": "jotai=184 ratio=0.7775 1.3x faster"
          },
          {
            "name": "obj.value [Node]",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key) [Node]",
            "value": 24,
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
            "value": 202,
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
            "value": 200,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1332,
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
          "id": "fa8db1b83675544d68cba2000df708b606f54511",
          "message": "Move selector eval state to StoreData (#141)\n\n* Move selector eval state to StoreData\n\n`circularDepSet` and `latestEvalContext` were module-level, shared across\nall stores. Fixes two bugs surfaced by tests at\npackages/valdres/src/lib/initSelector.crossStore.test.ts:\n\n1. The same selector evaluated in store2 mid-eval in store1 threw a\n   spurious SelectorCircularDependencyError — the shared WeakSet treated\n   independent cross-store reads as a re-entry.\n\n2. Async selectors with deferred (post-await) `get` calls silently lost\n   dep registration when a second store evaluated the same selector before\n   the first store's promise resolved. The second eval marked the first\n   eval's context `revoked`, routing the deferred get into the read-only\n   stale-closure branch.\n\nBoth maps use the existing lazy-getter prototype pattern, so store\ncreation overhead is unchanged. Selector + atom + store benches show no\nregression.\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>\n\n* Address Copilot review: tighten WeakSet<any> → WeakSet<Selector>, drop test internals probe\n\n- Type circularDependencySet as WeakSet<Selector> through evaluateSelector,\n  initSelector, and evaluate. Matches getState's existing signature.\n- Use the public Store.data field in the latestEvalContext test instead\n  of probing (s1 as any)._data ?? (s1 as any).data.\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.7 <noreply@anthropic.com>",
          "timestamp": "2026-05-27T13:11:41+02:00",
          "tree_id": "7b79f9f5f6ce810ff85d0c4465234687289ab6c3",
          "url": "https://github.com/eigilsagafos/valdres/commit/fa8db1b83675544d68cba2000df708b606f54511"
        },
        "date": 1779880361857,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 7,
            "unit": "ns",
            "extra": "jotai=64 ratio=0.1216 8.2x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 13,
            "unit": "ns",
            "extra": "jotai=375 ratio=0.0349 28.6x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 213,
            "unit": "ns",
            "extra": "jotai=4967 ratio=0.0428 23.3x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 116,
            "unit": "ns",
            "extra": "jotai=3227 ratio=0.0375 26.7x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 158,
            "unit": "ns",
            "extra": "jotai=3628 ratio=0.0447 22.4x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 11947,
            "unit": "ns",
            "extra": "jotai=271233 ratio=0.0445 22.5x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 320,
            "unit": "ns",
            "extra": "jotai=429 ratio=0.7310 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 33,
            "unit": "ns",
            "extra": "jotai=13 ratio=2.4164 2.4x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 308,
            "unit": "ns",
            "extra": "jotai=412 ratio=0.7412 1.3x faster"
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
            "value": 365,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 5,
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
            "value": 129,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3288,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 11,
            "unit": "ns",
            "extra": "jotai=87 ratio=0.1301 7.7x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 6670,
            "unit": "ns",
            "extra": "jotai=38387 ratio=0.1835 5.5x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 61611,
            "unit": "ns",
            "extra": "jotai=374735 ratio=0.1674 6.0x faster"
          },
          {
            "name": "sub+unsub on chain of 50 unsubscribed derived deps",
            "value": 74536,
            "unit": "ns",
            "extra": "jotai=112812 ratio=0.6732 1.5x faster"
          },
          {
            "name": "sub+unsub on chain of 100 unsubscribed derived deps",
            "value": 131114,
            "unit": "ns",
            "extra": "jotai=150253 ratio=0.8521 1.2x faster"
          },
          {
            "name": "sub+unsub on chain of 500 unsubscribed derived deps",
            "value": 1068182,
            "unit": "ns",
            "extra": "jotai=1051326 ratio=0.8587 1.2x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 6250,
            "unit": "ns",
            "extra": "jotai=18017 ratio=0.3484 2.9x faster"
          },
          {
            "name": "createStore",
            "value": 346,
            "unit": "ns",
            "extra": "jotai=6420 ratio=0.0536 18.6x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 85697,
            "unit": "ns",
            "extra": "jotai=960452 ratio=0.0876 11.4x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 8052,
            "unit": "ns",
            "extra": "jotai=369182 ratio=0.0217 46.1x faster"
          },
          {
            "name": "sub + unsub",
            "value": 1503,
            "unit": "ns",
            "extra": "jotai=3961 ratio=0.3554 2.8x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 71085,
            "unit": "ns",
            "extra": "jotai=403037 ratio=0.1876 5.3x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 134670,
            "unit": "ns",
            "extra": "jotai=562713 ratio=0.2264 4.4x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 974983,
            "unit": "ns",
            "extra": "jotai=3949793 ratio=0.2419 4.1x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 883588,
            "unit": "ns",
            "extra": "jotai=5130832 ratio=0.2136 4.7x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1654485,
            "unit": "ns",
            "extra": "jotai=24117963 ratio=0.0653 15.3x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 131274,
            "unit": "ns",
            "extra": "jotai=317981 ratio=0.4153 2.4x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 92462,
            "unit": "ns",
            "extra": "jotai=278733 ratio=0.3305 3.0x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 817174,
            "unit": "ns",
            "extra": "jotai=1366031 ratio=0.6009 1.7x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 1015248,
            "unit": "ns",
            "extra": "jotai=1842246 ratio=0.5421 1.8x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 1326248,
            "unit": "ns",
            "extra": "jotai=13071879 ratio=0.1070 9.3x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 46,
            "unit": "ns",
            "extra": "jotai=58 ratio=0.8218 1.2x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 6420,
            "unit": "ns",
            "extra": "jotai=14221 ratio=0.4494 2.2x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 67786,
            "unit": "ns",
            "extra": "jotai=130759 ratio=0.5153 1.9x faster"
          },
          {
            "name": "sub+unsub on chain of 50 unsubscribed derived deps [Node]",
            "value": 89192,
            "unit": "ns",
            "extra": "jotai=57616 ratio=1.5525 1.6x slower"
          },
          {
            "name": "sub+unsub on chain of 100 unsubscribed derived deps [Node]",
            "value": 169446,
            "unit": "ns",
            "extra": "jotai=107064 ratio=1.5841 1.6x slower"
          },
          {
            "name": "sub+unsub on chain of 500 unsubscribed derived deps [Node]",
            "value": 773334,
            "unit": "ns",
            "extra": "jotai=515753 ratio=1.4952 1.5x slower"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 3899,
            "unit": "ns",
            "extra": "jotai=7471 ratio=0.5134 1.9x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 28,
            "unit": "ns",
            "extra": "jotai=55 ratio=0.5706 1.8x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 23,
            "unit": "ns",
            "extra": "jotai=165 ratio=0.1401 7.1x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 226,
            "unit": "ns",
            "extra": "jotai=1271 ratio=0.1761 5.7x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 224,
            "unit": "ns",
            "extra": "jotai=1477 ratio=0.1494 6.7x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 253,
            "unit": "ns",
            "extra": "jotai=1744 ratio=0.1430 7.0x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 24617,
            "unit": "ns",
            "extra": "jotai=141609 ratio=0.1722 5.8x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 197,
            "unit": "ns",
            "extra": "jotai=520 ratio=0.3814 2.6x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 83754,
            "unit": "ns",
            "extra": "jotai=469230 ratio=0.1780 5.6x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 14311,
            "unit": "ns",
            "extra": "jotai=207116 ratio=0.0691 14.5x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 820,
            "unit": "ns",
            "extra": "jotai=1369 ratio=0.5960 1.7x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 171,
            "unit": "ns",
            "extra": "jotai=211 ratio=0.8245 1.2x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 25,
            "unit": "ns",
            "extra": "jotai=10 ratio=2.5132 2.5x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 128,
            "unit": "ns",
            "extra": "jotai=188 ratio=0.6929 1.4x faster"
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
            "value": 211,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1429,
            "unit": "ns",
            "extra": "baseline"
          }
        ]
      }
    ]
  }
}