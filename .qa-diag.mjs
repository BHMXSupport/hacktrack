import { chromium } from 'playwright'; import fs from 'fs'
const OUT=process.argv[2], SEED=process.argv[3]
const b=await chromium.launch()
const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true})
const p=await ctx.newPage(); let buf=[]
p.on('console',m=>{if(m.type()==='error')buf.push(m.text())}); p.on('pageerror',e=>buf.push('PE '+e.message))
const click=async (t,to=2000)=>{try{await p.getByText(t,{exact:true}).first().click({timeout:to});return true}catch{return false}}
const dismiss=async()=>{for(const t of ['Entendido','Listo','Cerrar']){if(await click(t,700)){await p.waitForTimeout(300);return}}}
await p.goto('http://localhost:5173'); await p.waitForTimeout(400)
await p.evaluate(v=>localStorage.setItem('hacktrack:v2',v), fs.readFileSync(SEED,'utf8'))
await p.evaluate(()=>localStorage.setItem('hacktrack-glass-ml','250'))
await p.reload(); await p.waitForTimeout(2500); await dismiss()
const tabs=['Inicio','Diario','Progreso','Vida','Comida','Semana']
for(const tab of tabs){ buf=[]; await click(tab); await p.waitForTimeout(1300); await dismiss(); await p.waitForTimeout(500)
  console.log(`[${tab}] errs=${buf.length}: ${[...new Set(buf)].slice(0,3).join(' | ')}`) }
// Avances de Progreso
buf=[]; await click('Progreso'); await p.waitForTimeout(600); await click('Avances'); await p.waitForTimeout(1500); await dismiss()
await p.screenshot({path:OUT+'/v-avances.png'})
console.log(`[Avances] errs=${buf.length}: ${[...new Set(buf)].slice(0,3).join(' | ')}`)
// Comida shot
await click('Comida'); await p.waitForTimeout(1000); await dismiss(); await p.screenshot({path:OUT+'/v-comida.png'})
await b.close()
