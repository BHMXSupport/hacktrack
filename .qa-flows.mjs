import { chromium } from 'playwright'; import fs from 'fs'
const OUT=process.argv[2], SEED=process.argv[3]
const b=await chromium.launch()
const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true})
const p=await ctx.newPage(); const errs=[]
p.on('pageerror',e=>errs.push('PE '+e.message)); p.on('console',m=>{if(m.type()==='error')errs.push('CON '+m.text())})
const shot=async n=>{await p.screenshot({path:`${OUT}/${n}.png`})}
const click=async (t,to=2000)=>{try{await p.getByText(t,{exact:false}).first().click({timeout:to});return true}catch{return false}}
const clickExact=async (t,to=2000)=>{try{await p.getByText(t,{exact:true}).first().click({timeout:to});return true}catch{return false}}
const dismiss=async()=>{for(const t of ['Entendido','Listo']){if(await clickExact(t,700)){await p.waitForTimeout(300);return}}}
const scroll=async dy=>p.evaluate(d=>{const els=[...document.querySelectorAll('.scroll')];const el=els.find(e=>e.scrollHeight>e.clientHeight)||els[0];if(el)el.scrollBy(0,d)},dy)
await p.goto('http://localhost:5173'); await p.waitForTimeout(400)
await p.evaluate(v=>localStorage.setItem('hacktrack:v2',v), fs.readFileSync(SEED,'utf8'))
await p.evaluate(()=>localStorage.setItem('hacktrack-glass-ml','250'))
await p.reload(); await p.waitForTimeout(2500); await dismiss()
// A. Home con dosis de hoy (TodayDoses)
await scroll(380); await p.waitForTimeout(400); await shot('f01-todaydoses')
// B. marcar dosis: botón 'Hecho' o el check
let marked=false
for(const t of ['Hecho','Marcar','Registrar dosis']){ if(await click(t,1200)){marked=true; break} }
await p.waitForTimeout(900); await shot('f02-after-mark')
// selector de sitio si aparece
await shot('f03-site')
for(const t of ['Abdomen','Muslo','Gl']){ if(await click(t,1000)) break }
await p.waitForTimeout(800); await shot('f04-site-done')
// C. mapa de inyección: tap en una zona (botón con aria 'Abdomen'/'Muslo'/'Glúteo')
await scroll(-3000); await p.waitForTimeout(300); await scroll(360); await p.waitForTimeout(300)
try{ await p.locator('[aria-label*="Abdomen"]').first().click({timeout:1500}) }catch{}
await p.waitForTimeout(500); await shot('f05-map-tap')
// D. Perfil (shield arriba-der)
await scroll(-3000); await p.waitForTimeout(300)
try{ await p.locator('button[aria-label*="erfil"], button[aria-label*="cuenta"], button[aria-label*="rivac"]').first().click({timeout:1500}) }catch{ await p.locator('header button, .scroll button').first().click().catch(()=>{}) }
await p.waitForTimeout(1000); await shot('f06-perfil')
await scroll(600); await p.waitForTimeout(300); await shot('f07-perfil-b')
await b.close()
console.log('ERRS', [...new Set(errs)].slice(0,8).join(' || ')||'none', '| marked', marked)
