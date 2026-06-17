import { chromium } from 'playwright'
const url='http://localhost:5173', out=process.env.OUT||process.argv[2]||'/tmp'
const b=await chromium.launch()
const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true})
const p=await ctx.newPage()
const errs=[]; p.on('console',m=>{if(m.type()==='error')errs.push(m.text())}); p.on('pageerror',e=>errs.push('PAGEERR '+e.message))
await p.goto(url,{waitUntil:'load'})
await p.waitForTimeout(900)
await p.screenshot({path:out+'/01-entry.png'})
await p.waitForTimeout(2600) // pasar splash
await p.screenshot({path:out+'/02-after-splash.png'})
console.log('CONSOLE_ERRORS:',errs.slice(0,10).join(' || ')||'none')
await b.close()
