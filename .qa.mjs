import { chromium } from 'playwright'; import fs from 'fs'
const OUT=process.argv[2]
const b=await chromium.launch()
const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true})
const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push('PAGEERR '+e.message))
const shot=async n=>{await p.screenshot({path:`${OUT}/${n}.png`}); console.log('shot',n)}
const click=async (t,to=3000)=>{try{await p.getByText(t,{exact:false}).first().click({timeout:to});return true}catch{console.log('miss',t);return false}}
await p.goto('http://localhost:5173'); await p.waitForTimeout(3000)
await click('Saltar'); await p.waitForTimeout(600)
await click('Bajar de peso'); await p.waitForTimeout(300); await click('Continuar'); await p.waitForTimeout(700)
for(let i=0;i<3;i++){await click('Continuar'); await p.waitForTimeout(700)}
await click('Lo agrego manualmente'); await p.waitForTimeout(1200)
await p.locator('button:has-text("+")').last().click({timeout:3000}); await p.waitForTimeout(800)
await click('Registra tu dosis'); await p.waitForTimeout(1000)
await click('Retatrutide'); await p.waitForTimeout(900)
// avanzar pasos
for(let i=0;i<3;i++){
  const num=p.locator('input[type=number], input[inputmode=decimal]').first()
  try{ if(await num.count()){ await num.fill('2',{timeout:1500}) } }catch{}
  await shot('21-s'+i)
  if(await click('Guardar',1500)){ console.log('GUARDADO en paso',i); break }
  await click('Siguiente',2000); await p.waitForTimeout(900)
}
await p.waitForTimeout(1500); await shot('22-home-proto')
const st=await p.evaluate(()=>localStorage.getItem('hacktrack:v2'))
fs.writeFileSync(`${OUT}/state-proto.json`, st||'null')
console.log('STATE_LEN',(st||'').length,'ERRS',errs.slice(0,6).join('|')||'none')
await b.close()
