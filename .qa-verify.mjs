import { chromium } from 'playwright'; import fs from 'fs'
const OUT=process.argv[2], SEED=process.argv[3]
const b=await chromium.launch()
const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true})
const p=await ctx.newPage()
const dismiss=async()=>{for(const t of ['Entendido','Listo']){try{await p.getByText(t,{exact:true}).first().click({timeout:700});await p.waitForTimeout(300);return}catch{}}}
const scroll=async dy=>p.evaluate(d=>{const els=[...document.querySelectorAll('.scroll')];const el=els.find(e=>e.scrollHeight>e.clientHeight)||els[0];if(el)el.scrollBy(0,d)},dy)
await p.goto('http://localhost:5173'); await p.waitForTimeout(400)
await p.evaluate(v=>localStorage.setItem('hacktrack:v2',v), fs.readFileSync(SEED,'utf8'))
await p.reload(); await p.waitForTimeout(2500); await dismiss()
await p.getByText('Tus datos son tuyos',{exact:false}).first().click({timeout:2000})
await p.waitForTimeout(1000); await p.screenshot({path:OUT+'/y01-perfil.png'})
await scroll(900); await p.waitForTimeout(300); await p.screenshot({path:OUT+'/y02-perfil2.png'})
// ARCO
await p.getByText('Gestionar mis datos',{exact:false}).first().click({timeout:1500}).catch(()=>{})
await p.waitForTimeout(900); await p.screenshot({path:OUT+'/y03-arco.png'})
await b.close()
