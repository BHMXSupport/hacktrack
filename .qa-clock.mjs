import { chromium } from 'playwright'; import fs from 'fs'
const SEED=process.argv[2]
const b=await chromium.launch()
const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true})
const p=await ctx.newPage()
await p.goto('http://localhost:5173'); await p.waitForTimeout(300)
await p.evaluate(v=>localStorage.setItem('hacktrack:v2',v), fs.readFileSync(SEED,'utf8'))
await p.reload(); await p.waitForTimeout(2500)
const clock=await p.evaluate(()=>({ browserNow:new Date().toISOString(), ts:Date.now() }))
const seed=JSON.parse(fs.readFileSync(SEED,'utf8'))
console.log('BROWSER now:', clock.browserNow, clock.ts)
console.log('SEED todayTs:', new Date(seed.todayTs).toISOString(), seed.todayTs)
console.log('proto startDate:', new Date(seed.protocols.Retatrutide.startDate).toISOString())
// texto del card próxima toma
const txt=await p.locator('text=Próxima toma').first().locator('xpath=ancestor::*[contains(@class,"card")][1]').innerText().catch(()=>'??')
console.log('CARD:', JSON.stringify(txt))
await b.close()
