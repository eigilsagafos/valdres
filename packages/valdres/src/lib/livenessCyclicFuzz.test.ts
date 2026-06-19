import { test } from "bun:test"
import { atom } from "../atom"
import { selector } from "../selector"
import { store } from "../store"
import { isLive } from "./mountAtom"
let uid = 0
const m32 = (s:number)=>()=>{s|=0;s=(s+0x6d2b79f5)|0;let t=Math.imul(s^(s>>>15),1|s);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296}
const check=(s:any,states:any[]):string|null=>{
  const d=s.data,L=new Set<any>()
  for(const st of states) if((d.subscriptions.get(st)?.size??0)>0)L.add(st)
  let ch=true
  while(ch){ch=false;for(const T of states){if(!L.has(T))continue;const dep=d.stateDependencies.get(T);if(dep)for(const D of dep)if(states.includes(D)&&!L.has(D)){L.add(D);ch=true}}}
  const exp=new Map<any,number>()
  for(const T of states){if(!L.has(T))continue;const dep=d.stateDependencies.get(T);if(dep)for(const D of dep)exp.set(D,(exp.get(D)??0)+1)}
  for(const D of states){const e=exp.get(D)??0,a=d.liveDependentCount.get(D)??0;if(a!==e)return {dir:a<e?"UNDER":"OVER", msg:`${String(D.name).slice(0,30)} exp ${e} got ${a}`}}
  return null
}
// CYCLIC dynamic-dep fuzzer: selectors read ANY other selector (cycles allowed),
// gated by atom parity so only one branch executes — mirrors Codex's structure.
test("cyclic dynamic-dep liveness invariant (WITH fix)", () => {
  let under=0, over=0, ran=0, firstUnder=""
  for(let seed=1;seed<=8000;seed++){
    const rnd=m32(seed), run=++uid
    const nA=3+Math.floor(rnd()*3), nS=5+Math.floor(rnd()*7)
    const atoms=Array.from({length:nA},(_,i)=>atom(Math.floor(rnd()*4),{name:`cy_a${i}.${run}`}))
    const sels:any[]=[]
    const defs=Array.from({length:nS},()=>({
      g0:Math.floor(rnd()*nA), g1:Math.floor(rnd()*nA),
      A:Array.from({length:1+Math.floor(rnd()*2)},()=>Math.floor(rnd()*nS)),  // ANY selector → cycles
      B:Array.from({length:1+Math.floor(rnd()*2)},()=>Math.floor(rnd()*nS)),
      aa:Math.floor(rnd()*nA),
    }))
    for(let i=0;i<nS;i++){
      const def=defs[i]
      sels.push(selector((get:any)=>{
        let acc=get(atoms[def.aa])
        if((get(atoms[def.g0])+get(atoms[def.g1]))%2===0){ for(const j of def.A) if(j!==i) acc+=get(sels[j]) }
        else { for(const j of def.B) if(j!==i) acc+=get(sels[j])*2 }
        return acc%97
      },{name:`cy_s${i}.${run}`}))
    }
    const states=[...atoms,...sels]
    const root=store("cy_gs"+run); const ctx=rnd()<0.5?root.scope("d"):root
    const subs=new Map<number,()=>void>()
    const toggle=(si:number)=>{if(subs.has(si)){subs.get(si)!();subs.delete(si)}else subs.set(si,ctx.sub(sels[si],()=>{},false))}
    try{
      for(let si=0;si<nS;si++) if(rnd()<0.4) toggle(si)
      let bad=check(ctx,states); if(bad){if(bad.dir==="UNDER"){under++;if(!firstUnder)firstUnder=`seed=${seed} init ${bad.msg}`}else over++}
      for(let step=0;step<20;step++){
        const w=1+Math.floor(rnd()*nA)
        ctx.txn((t:any)=>{for(let k=0;k<w;k++)t.set(atoms[Math.floor(rnd()*nA)],Math.floor(rnd()*4))})
        if(rnd()<0.5) toggle(Math.floor(rnd()*nS))
        ran++
        bad=check(ctx,states); if(bad){if(bad.dir==="UNDER"){under++;if(!firstUnder)firstUnder=`seed=${seed} step=${step} ${bad.msg}`}else over++}
      }
      for(const u of subs.values())u()
    }catch(e){ /* circular-dep error or similar — skip this seed */ }
  }
  console.error(`cyclic fuzz: UNDER(freeze)=${under} OVER(leak)=${over} across ${ran} ops; firstUnder="${firstUnder}"`)
})
