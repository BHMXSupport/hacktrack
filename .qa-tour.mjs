import { chromium } from 'playwright'; import fs from 'fs'
const OUT=process.argv[2], SEED=process.argv[3]
const b=await chromium.launch()
const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true})
const p=await ctx.newPage(); const errs=[]
p.on('pageerror',e=>errs.push('PAGEERR '+e.message)); p.on('console',m=>{if(m.type()==='error')errs.push('CON '+m.text())})
const shot=async n=>{await p.screenshot({path:`${OUT}/${n}.png`})}
const click=async (t,to=2000)=>{try{await p.getByText(t,{exact:true}).first().click({timeout:to});return true}catch{return false}}
const dismiss=async()=>{ for(const t of ['Entendido','Listo','Cerrar','Ok','Got it']){ if(await click(t,800)){await p.waitForTimeout(400);return}} try{await p.keyboard.press('Escape')}catch{} }
const scroll=async dy=>p.evaluate(d=>{const els=[...document.querySelectorAll('.scroll')];const el=els.find(e=>e.scrollHeight>e.clientHeight)||els[0];if(el)el.scrollBy(0,d)},dy)
await p.goto('http://localhost:5173'); await p.waitForTimeout(400)
await p.evaluate(v=>localStorage.setItem('hacktrack:v2',v), fs.readFileSync(SEED,'utf8'))
await p.evaluate(()=>localStorage.setItem('hacktrack-glass-ml','250'))
await p.reload(); await p.waitForTimeout(2500); await dismiss()
const tabs=['Inicio','Diario','Progreso','Vida','Comida','Semana']
let i=0
for(const tab of tabs){
  i++; await click(tab); await p.waitForTimeout(1000); await dismiss(); await p.waitForTimeout(300)
  await scroll(-3000); await p.waitForTimeout(300); await shot(`u${i}-${tab}-a`)
  for(const [j,dy] of [[1,700],[2,800],[3,900]]){ await scroll(dy); await p.waitForTimeout(400); await shot(`u${i}-${tab}-${'bcd'[j-1]}`) }
}
await b.close()
console.log('ERRS', errs.slice(0,12).join(' || ')||'none')
