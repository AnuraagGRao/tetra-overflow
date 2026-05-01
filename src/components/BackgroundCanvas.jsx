import { useEffect, useRef } from 'react'

// ── Base fill colour per bgType ───────────────────────────────────────────────
const BG_BASE = {
  lava:'#110200', ember:'#0f0400', crystal:'#01040f',
  quake:'#0a0804', ocean:'#00050f', bubbles:'#00060c',
  storm:'#040608', clouds:'#06080e', stars:'#000005',
  nebula:'#030008', blackhole:'#000003', matrix:'#000500',
  // New types
  forest:'#000802', glacier:'#000a18', volcano:'#150200',
  inferno:'#100000', aurora:'#000410', warp:'#000008', abyss:'#000000',
}

// ── Layer 1: Animated ambient gradient ───────────────────────────────────────
function drawAmbient(ctx, bgType, w, h, t) {
  switch (bgType) {
    // ── Existing ──────────────────────────────────────────────────────────────
    case 'lava':
    case 'ember': {
      const g = ctx.createRadialGradient(w*0.5+Math.sin(t*0.0008)*w*0.3, h*0.7+Math.cos(t*0.0005)*h*0.2, 0, w*0.5, h*0.5, h*0.9)
      g.addColorStop(0, bgType==='lava' ? 'rgba(180,30,0,0.35)' : 'rgba(200,80,0,0.30)')
      g.addColorStop(0.5,'rgba(80,10,0,0.20)'); g.addColorStop(1,'rgba(0,0,0,0)')
      ctx.fillStyle = g; ctx.fillRect(0,0,w,h)
      ctx.save(); ctx.globalAlpha = 0.07
      for (let i=0;i<4;i++) {
        ctx.strokeStyle = bgType==='lava'?`rgba(255,${80+i*20},0,1)`:`rgba(255,${140+i*20},0,1)`
        ctx.lineWidth = 2+i*1.5; ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 12
        ctx.beginPath(); ctx.moveTo(0, h*(0.2+i*0.18))
        for (let x=0;x<=w;x+=8) ctx.lineTo(x, h*(0.2+i*0.18)+Math.sin(x*0.015+t*0.0015+i*1.3)*h*0.04)
        ctx.stroke()
      }
      ctx.restore(); break
    }
    case 'crystal': {
      const hue = 200+Math.sin(t*0.0004)*30
      const g = ctx.createLinearGradient(0,0,w,h)
      g.addColorStop(0,`hsla(${hue},80%,8%,1)`); g.addColorStop(0.5,`hsla(${hue+40},70%,4%,1)`); g.addColorStop(1,`hsla(${hue+80},90%,6%,1)`)
      ctx.fillStyle = g; ctx.fillRect(0,0,w,h)
      ctx.save(); ctx.globalAlpha = 0.06
      for (let i=0;i<6;i++) {
        const x1 = (i/6)*w+Math.sin(t*0.0006+i)*30
        ctx.strokeStyle = `hsla(${hue+i*15},100%,70%,1)`; ctx.lineWidth = 1.5; ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 18
        ctx.beginPath(); ctx.moveTo(x1,-10); ctx.lineTo(x1+w*0.3, h+10); ctx.stroke()
      }
      ctx.restore(); break
    }
    case 'quake': {
      const g = ctx.createRadialGradient(w*0.5, h*0.5+Math.sin(t*0.001)*h*0.1, 0, w*0.5, h*0.5, h*0.8)
      g.addColorStop(0,'rgba(70,40,10,0.25)'); g.addColorStop(1,'rgba(0,0,0,0)')
      ctx.fillStyle = g; ctx.fillRect(0,0,w,h)
      ctx.save(); ctx.globalAlpha = 0.08
      for (let i=0;i<6;i++) {
        ctx.strokeStyle = 'rgba(200,120,30,1)'; ctx.lineWidth = 1; ctx.shadowColor = 'rgba(255,160,40,1)'; ctx.shadowBlur = 8
        ctx.beginPath(); ctx.moveTo(w*(0.3+(i*0.11)%0.5), h*0.5)
        for (let s=0;s<8;s++) ctx.lineTo(w*(0.3+(i*0.11+s*0.05)%0.6)+Math.sin(s*37.1)*8, h*(0.5+s*0.05+Math.sin(s+i)*0.04))
        ctx.stroke()
      }
      ctx.restore(); break
    }
    case 'ocean': {
      const g = ctx.createLinearGradient(0,0,0,h)
      g.addColorStop(0,'rgba(0,15,40,1)'); g.addColorStop(0.6,'rgba(0,8,24,1)'); g.addColorStop(1,'rgba(0,3,10,1)')
      ctx.fillStyle = g; ctx.fillRect(0,0,w,h)
      ctx.save(); ctx.globalAlpha = 0.04
      for (let i=0;i<8;i++) {
        const cx2 = w*(0.1+i*0.12)+Math.sin(t*0.0007+i)*w*0.06
        const g2 = ctx.createLinearGradient(cx2,0,cx2+16,h)
        g2.addColorStop(0,'rgba(80,200,255,0.8)'); g2.addColorStop(1,'rgba(80,200,255,0)')
        ctx.fillStyle = g2; ctx.fillRect(cx2,0,16,h)
      }
      ctx.globalAlpha = 0.06; ctx.strokeStyle = 'rgba(100,220,255,1)'; ctx.lineWidth = 1.5
      for (let j=0;j<4;j++) {
        ctx.beginPath()
        for (let x=0;x<=w;x+=4) { const y=h*0.15+j*h*0.08+Math.sin(x*0.02+t*0.002+j)*h*0.025; x===0?ctx.moveTo(x,y):ctx.lineTo(x,y) }
        ctx.stroke()
      }
      ctx.restore(); break
    }
    case 'bubbles': {
      const g = ctx.createLinearGradient(0,0,0,h)
      g.addColorStop(0,'rgba(0,20,40,1)'); g.addColorStop(1,'rgba(0,8,18,1)')
      ctx.fillStyle = g; ctx.fillRect(0,0,w,h); break
    }
    case 'storm': {
      const g = ctx.createLinearGradient(0,0,0,h)
      g.addColorStop(0,'rgba(5,8,20,1)'); g.addColorStop(0.5,'rgba(12,18,35,1)'); g.addColorStop(1,'rgba(3,5,12,1)')
      ctx.fillStyle = g; ctx.fillRect(0,0,w,h)
      if ((t % 3000) < 140) {
        const bolt = Math.floor(t*0.0005) % 3
        ctx.save(); ctx.globalAlpha = 0.3+0.4*(1-(t%3000)/140)
        ctx.strokeStyle = '#d0e8ff'; ctx.lineWidth = 2; ctx.shadowColor = '#b0d0ff'; ctx.shadowBlur = 30
        let lx = w*(0.2+bolt*0.3), ly = 0
        ctx.beginPath(); ctx.moveTo(lx,ly)
        while (ly < h) { lx += (Math.sin(ly*0.1+bolt)*30); ly += 40; ctx.lineTo(lx,ly) }
        ctx.stroke(); ctx.restore()
      }
      break
    }
    case 'clouds': {
      const g = ctx.createLinearGradient(0,0,0,h)
      g.addColorStop(0,'rgba(5,10,25,1)'); g.addColorStop(0.5,'rgba(10,16,32,1)'); g.addColorStop(1,'rgba(2,4,12,1)')
      ctx.fillStyle = g; ctx.fillRect(0,0,w,h)
      ctx.save()
      for (let i=0;i<3;i++) {
        const ay = h*(0.1+i*0.12)+Math.sin(t*0.0006+i*2)*h*0.04
        const ag = ctx.createLinearGradient(0,ay-40,0,ay+40)
        const aHue = 160+i*40+Math.sin(t*0.0003)*20
        ag.addColorStop(0,'rgba(0,0,0,0)'); ag.addColorStop(0.5,`hsla(${aHue},80%,40%,0.12)`); ag.addColorStop(1,'rgba(0,0,0,0)')
        ctx.fillStyle = ag; ctx.fillRect(0,ay-40,w,80)
      }
      ctx.restore(); break
    }
    case 'stars': {
      const g = ctx.createRadialGradient(w*0.5,h*0.4,0,w*0.5,h*0.4,h*0.7)
      g.addColorStop(0,'rgba(10,0,25,1)'); g.addColorStop(1,'rgba(0,0,5,1)')
      ctx.fillStyle = g; ctx.fillRect(0,0,w,h)
      ctx.save(); ctx.globalAlpha = 0.04
      const mwg = ctx.createLinearGradient(0,h*0.2,w,h*0.8)
      mwg.addColorStop(0,'rgba(255,255,255,0)'); mwg.addColorStop(0.5,'rgba(200,210,255,0.6)'); mwg.addColorStop(1,'rgba(255,255,255,0)')
      ctx.fillStyle = mwg; ctx.fillRect(0,0,w,h); ctx.restore(); break
    }
    case 'nebula': {
      const g = ctx.createRadialGradient(w*0.3,h*0.3,0,w*0.5,h*0.5,h)
      g.addColorStop(0,'rgba(40,0,80,1)'); g.addColorStop(0.4,'rgba(15,0,35,1)'); g.addColorStop(1,'rgba(2,0,8,1)')
      ctx.fillStyle = g; ctx.fillRect(0,0,w,h)
      ctx.save()
      ;[[0.2,0.3,0.4,'280',0.06],[0.7,0.2,0.3,'320',0.04],[0.5,0.7,0.35,'240',0.05],[0.1,0.8,0.25,'300',0.04]]
        .forEach(([bx,by,br,bh,ba]) => {
          const bxp = w*bx+Math.sin(t*0.0003+bx)*w*0.05, byp = h*by+Math.cos(t*0.0004+by)*h*0.04
          const rad = Math.min(w,h)*br
          const gr = ctx.createRadialGradient(bxp,byp,0,bxp,byp,rad)
          gr.addColorStop(0,`hsla(${bh},90%,55%,${ba})`); gr.addColorStop(1,'rgba(0,0,0,0)')
          ctx.fillStyle = gr; ctx.fillRect(0,0,w,h)
        })
      ctx.restore(); break
    }
    case 'blackhole': {
      const cx=w*0.5, cy=h*0.5
      const g = ctx.createRadialGradient(cx,cy,0,cx,cy,h*0.55)
      g.addColorStop(0,'rgba(0,0,0,1)'); g.addColorStop(0.12,'rgba(0,0,0,1)')
      g.addColorStop(0.2,'rgba(100,20,160,0.5)'); g.addColorStop(0.35,'rgba(200,60,255,0.18)')
      g.addColorStop(0.5,'rgba(100,10,80,0.10)'); g.addColorStop(1,'rgba(0,0,0,0)')
      ctx.fillStyle = g; ctx.fillRect(0,0,w,h)
      ctx.save()
      for (let r=1;r<=3;r++) {
        const ring = h*(0.12+r*0.07)+Math.sin(t*0.001)*3
        const rg = ctx.createRadialGradient(cx,cy,ring-4,cx,cy,ring+4)
        rg.addColorStop(0,'rgba(0,0,0,0)')
        rg.addColorStop(0.5,`rgba(${r===1?'255,100,255':r===2?'160,80,255':'80,160,255'},0.14)`)
        rg.addColorStop(1,'rgba(0,0,0,0)')
        ctx.fillStyle = rg; ctx.fillRect(0,0,w,h)
      }
      ctx.restore(); break
    }
    case 'matrix': {
      const g = ctx.createLinearGradient(0,0,0,h)
      g.addColorStop(0,'rgba(0,8,0,1)'); g.addColorStop(1,'rgba(0,2,0,1)')
      ctx.fillStyle = g; ctx.fillRect(0,0,w,h); break
    }

    // ── New bgTypes ───────────────────────────────────────────────────────────
    case 'forest': {
      const g = ctx.createLinearGradient(0,0,0,h)
      g.addColorStop(0,'rgba(0,12,4,1)'); g.addColorStop(0.5,'rgba(0,8,2,1)'); g.addColorStop(1,'rgba(0,4,1,1)')
      ctx.fillStyle = g; ctx.fillRect(0,0,w,h)
      // Moon glow
      const moonG = ctx.createRadialGradient(w*0.78,-h*0.05,0,w*0.78,-h*0.05,h*0.55)
      moonG.addColorStop(0,'rgba(200,220,255,0.08)'); moonG.addColorStop(1,'rgba(0,0,0,0)')
      ctx.fillStyle = moonG; ctx.fillRect(0,0,w,h)
      // Tree silhouettes
      ctx.save(); ctx.globalAlpha = 0.40; ctx.fillStyle = '#000'
      const numTrees = Math.floor(w/22)
      for (let ti=0;ti<numTrees;ti++) {
        const tx = (ti/numTrees)*w + (ti%3)*7
        const treeH = 28+((ti*17)%5)*13
        ctx.beginPath(); ctx.moveTo(tx,h); ctx.lineTo(tx+10,h); ctx.lineTo(tx+5,h-treeH); ctx.closePath(); ctx.fill()
        // Second tier
        ctx.beginPath(); ctx.moveTo(tx-2,h-treeH*0.5); ctx.lineTo(tx+12,h-treeH*0.5); ctx.lineTo(tx+5,h-treeH*1.3); ctx.closePath(); ctx.fill()
      }
      ctx.restore(); break
    }
    case 'glacier': {
      const g = ctx.createLinearGradient(0,0,0,h)
      g.addColorStop(0,'rgba(180,210,255,0.12)'); g.addColorStop(0.4,'rgba(100,170,230,0.06)'); g.addColorStop(1,'rgba(60,110,200,0.10)')
      ctx.fillStyle = g; ctx.fillRect(0,0,w,h)
      // Ice sheen light columns
      ctx.save(); ctx.globalAlpha = 0.04
      for (let gi=0;gi<8;gi++) {
        const sx = w*(gi/8)+Math.sin(t*0.0005+gi*0.8)*w*0.04
        ctx.strokeStyle = 'rgba(200,230,255,1)'; ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(sx,0); ctx.lineTo(sx+w*0.08,h); ctx.stroke()
      }
      ctx.restore(); break
    }
    case 'volcano': {
      const g = ctx.createRadialGradient(w*0.5,h*1.2,0,w*0.5,h*0.5,h*1.0)
      g.addColorStop(0,'rgba(255,80,0,0.55)'); g.addColorStop(0.3,'rgba(180,30,0,0.30)'); g.addColorStop(0.6,'rgba(80,10,0,0.15)'); g.addColorStop(1,'rgba(0,0,0,0)')
      ctx.fillStyle = g; ctx.fillRect(0,0,w,h)
      // Smoke billows at top
      ctx.save(); ctx.globalAlpha = 0.10
      for (let vi=0;vi<4;vi++) {
        const sr = 35+vi*18+Math.sin(t*0.001+vi)*10
        const scx = w*(0.25+vi*0.18)+Math.sin(t*0.0008+vi)*25
        const sg = ctx.createRadialGradient(scx,h*0.08,0,scx,h*0.08,sr)
        sg.addColorStop(0,'rgba(22,22,22,1)'); sg.addColorStop(1,'rgba(0,0,0,0)')
        ctx.fillStyle = sg; ctx.fillRect(0,0,w,h)
      }
      ctx.restore(); break
    }
    case 'inferno': {
      const g = ctx.createLinearGradient(0,0,0,h)
      g.addColorStop(0,'rgba(5,0,0,1)'); g.addColorStop(0.5,'rgba(30,5,0,1)'); g.addColorStop(1,'rgba(80,15,0,1)')
      ctx.fillStyle = g; ctx.fillRect(0,0,w,h)
      const pulse = 0.4+0.2*Math.sin(t*0.003)
      const ig = ctx.createRadialGradient(w*0.5,h*1.1,0,w*0.5,h*0.6,h*0.7)
      ig.addColorStop(0,`rgba(255,120,0,${pulse})`); ig.addColorStop(0.4,`rgba(200,40,0,${pulse*0.5})`); ig.addColorStop(1,'rgba(0,0,0,0)')
      ctx.fillStyle = ig; ctx.fillRect(0,0,w,h)
      ctx.save(); ctx.globalAlpha = 0.07
      for (let fi=0;fi<5;fi++) {
        ctx.strokeStyle = `rgba(255,${80+fi*25},0,1)`; ctx.lineWidth = 2
        ctx.beginPath()
        for (let fx=0;fx<=w;fx+=6) { const fy=h*(0.5+fi*0.08)+Math.sin(fx*0.02+t*0.006+fi*1.3)*h*0.05; fx===0?ctx.moveTo(fx,fy):ctx.lineTo(fx,fy) }
        ctx.stroke()
      }
      ctx.restore(); break
    }
    case 'aurora': {
      const g = ctx.createLinearGradient(0,0,0,h)
      g.addColorStop(0,'rgba(0,4,16,1)'); g.addColorStop(1,'rgba(0,2,8,1)')
      ctx.fillStyle = g; ctx.fillRect(0,0,w,h); break
    }
    case 'warp': {
      const g = ctx.createRadialGradient(w*0.5,h*0.5,0,w*0.5,h*0.5,h*0.7)
      g.addColorStop(0,'rgba(20,40,80,0.5)'); g.addColorStop(0.3,'rgba(5,10,30,0.3)'); g.addColorStop(1,'rgba(0,0,5,0)')
      ctx.fillStyle = g; ctx.fillRect(0,0,w,h); break
    }
    case 'abyss': {
      const g = ctx.createRadialGradient(w*0.5,h*0.5,0,w*0.5,h*0.5,h*0.6)
      g.addColorStop(0,'rgba(5,0,12,0.5)'); g.addColorStop(1,'rgba(0,0,0,0)')
      ctx.fillStyle = g; ctx.fillRect(0,0,w,h); break
    }
    default:
      ctx.fillStyle = BG_BASE[bgType]||'#000'; ctx.fillRect(0,0,w,h)
  }
}

// ── Particle factory ──────────────────────────────────────────────────────────
function makeParticle(bgType, w, h, init=false) {
  const x = Math.random()*w
  const y = init ? Math.random()*h : (
    ['storm','matrix','crystal','glacier','forest'].includes(bgType) ? -10 : h+10
  )
  switch (bgType) {
    case 'lava':   return { x, y, vx:(Math.random()-0.5)*0.5, vy:-(0.5+Math.random()*0.7), r:3+Math.random()*4, hue:10+Math.random()*25, life:1, decay:0.003+Math.random()*0.003, glow:true }
    case 'ember':  return { x, y, vx:(Math.random()-0.5)*0.8, vy:-(0.4+Math.random()*0.9), r:1.5+Math.random()*2.5, hue:5+Math.random()*40, life:1, decay:0.004+Math.random()*0.004, glow:true }
    case 'crystal':return { x, y, vx:(Math.random()-0.5)*0.2, vy:0.25+Math.random()*0.45, r:1+Math.random()*2.5, hue:200+Math.random()*70, life:1, decay:0.0025, glow:true }
    case 'quake':  return { x, y:Math.random()*h, vx:(Math.random()-0.5)*1.8, vy:(Math.random()-0.5)*1, r:2+Math.random()*4, hue:22+Math.random()*18, life:1, decay:0.009+Math.random()*0.007, glow:false }
    case 'ocean':  return { x, y, vx:(Math.random()-0.5)*0.15, vy:-(0.18+Math.random()*0.35), r:2+Math.random()*4, hue:200+Math.random()*30, life:1, decay:0.002+Math.random()*0.002, glow:true, a:0.35 }
    case 'bubbles':return { x, y, vx:(Math.random()-0.5)*0.35, vy:-(0.3+Math.random()*0.55), r:3+Math.random()*6, hue:Math.random()*360, life:0.7, decay:0.0015+Math.random()*0.002, glow:true, bubble:true }
    case 'storm':  return { x, y, vx:1.8+Math.random()*1.2, vy:5+Math.random()*4, r:0.7, hue:215, life:1, decay:0, glow:false }
    case 'clouds': return { x, y:10+Math.random()*h*0.5, vx:0.12+Math.random()*0.22, vy:0, r:10+Math.random()*20, hue:220+Math.random()*30, life:1, decay:0, glow:false, a:0.04+Math.random()*0.04 }
    case 'stars':  return { x, y:Math.random()*h, vx:0, vy:0, r:0.4+Math.random()*1.8, hue:0, life:1, decay:0, twinkle:Math.random()*Math.PI*2, color:`rgba(${200+Math.floor(Math.random()*55)},${200+Math.floor(Math.random()*55)},255,1)` }
    case 'nebula': return { x, y, vx:(Math.random()-0.5)*0.12, vy:-(0.08+Math.random()*0.16), r:5+Math.random()*12, hue:270+Math.random()*70, life:1, decay:0.0008, glow:false, a:0.055 }
    case 'blackhole': {
      const angle=Math.random()*Math.PI*2, dist=60+Math.random()*160
      return { x:w/2+Math.cos(angle)*dist, y:h/2+Math.sin(angle)*dist, angle, dist, speed:0.007+Math.random()*0.006, r:1.2+Math.random()*2.2, hue:300+Math.random()*60, life:1, decay:0.0018, glow:true }
    }
    case 'matrix': return { x, y:-(15+Math.random()*h), vx:0, vy:2.2+Math.random()*3.5, r:0, char:String.fromCharCode(0x30A0+Math.floor(Math.random()*96)), hue:120, life:1, decay:0, fontSize:9+Math.random()*7, lead:Math.random()<0.12 }
    // ── New types ─────────────────────────────────────────────────────────────
    case 'forest': {
      const isFirefly = Math.random()<0.35
      return isFirefly
        ? { x, y:Math.random()*h, vx:(Math.random()-0.5)*0.25, vy:-(0.05+Math.random()*0.15), r:0.8+Math.random()*1.2, hue:65+Math.random()*35, life:1, decay:0, subtype:'firefly', twinkle:Math.random()*Math.PI*2 }
        : { x, y, vx:(Math.random()-0.5)*0.5, vy:0.4+Math.random()*0.7, r:2+Math.random()*2.5, hue:80+Math.random()*60, life:1, decay:0.004+Math.random()*0.003, subtype:'leaf', rot:Math.random()*Math.PI*2, rotSpeed:(Math.random()-0.5)*0.06 }
    }
    case 'glacier': {
      const isFlake = Math.random()<0.65
      return { x, y, vx:(Math.random()-0.5)*0.3, vy:0.15+Math.random()*0.4, r:isFlake?(2+Math.random()*3):(0.5+Math.random()*1.5), hue:200+Math.random()*35, life:1, decay:0, subtype:isFlake?'flake':'shard', rot:Math.random()*Math.PI*2 }
    }
    case 'volcano':return { x:w*0.5+(Math.random()-0.5)*w*0.4, y:h*0.92, vx:(Math.random()-0.5)*3.5, vy:-(3+Math.random()*5), r:2+Math.random()*5, hue:10+Math.random()*30, life:1, decay:0.005+Math.random()*0.004, grav:0.07+Math.random()*0.04, glow:true }
    case 'inferno':return { x, y, vx:(Math.random()-0.5)*1.5, vy:-(1.5+Math.random()*2.5), r:3+Math.random()*8, hue:Math.random()*30, life:1, decay:0.007+Math.random()*0.006, glow:true }
    case 'aurora': return { x, y:Math.random()*h*0.6, vx:0, vy:0, r:0.4+Math.random()*1.5, hue:0, life:1, decay:0, twinkle:Math.random()*Math.PI*2, color:`rgba(${180+Math.floor(Math.random()*75)},${210+Math.floor(Math.random()*45)},255,1)` }
    case 'warp': {
      const angle = Math.random()*Math.PI*2
      return { x:w/2, y:h/2, angle, dist:Math.random()*25, speed:3+Math.random()*4, length:5+Math.random()*15, hue:200+Math.random()*60, life:1, decay:0 }
    }
    case 'abyss':  return { x, y:Math.random()*h, vx:(Math.random()-0.5)*0.08, vy:(Math.random()-0.5)*0.08, r:5+Math.random()*14, hue:260+Math.random()*80, life:Math.random(), decay:0.0015, growing:Math.random()<0.5 }
    default: return { x, y:Math.random()*h, vx:0, vy:0, r:1, hue:0, life:1, decay:0.001, glow:false }
  }
}

function createParticles(bgType, w, h) {
  const counts = { lava:120, ember:100, crystal:80, quake:70, ocean:90, bubbles:60, storm:150, clouds:30, stars:200, nebula:50, blackhole:80, matrix:120, forest:80, glacier:100, volcano:130, inferno:150, aurora:80, warp:100, abyss:45 }
  const n = counts[bgType] || 80
  return Array.from({ length:n }, () => makeParticle(bgType, w, h, true))
}

// ── Particle update — returns true if dead (should respawn) ──────────────────
function updateParticle(p, bgType, w, h, dt) {
  const s = dt/16
  if (bgType === 'blackhole') {
    p.angle += p.speed*s; p.dist -= 0.18*s
    p.x = w/2+Math.cos(p.angle)*p.dist; p.y = h/2+Math.sin(p.angle)*p.dist
    p.life -= p.decay*s; return p.dist<3 || p.life<=0
  }
  if (bgType === 'stars' || bgType === 'aurora') { p.twinkle += 0.035*s; return false }
  if (bgType === 'forest') {
    p.x += p.vx*s; p.y += p.vy*s
    if (p.subtype === 'firefly') {
      p.twinkle += 0.05*s
      if (p.x < -5) p.x = w+5; if (p.x > w+5) p.x = -5
      if (p.y < -5) p.y = h+5; if (p.y > h+5) p.y = -5
      return false
    }
    if (p.rotSpeed) p.rot = (p.rot||0)+p.rotSpeed*s
    p.life -= p.decay*s; return p.y > h+15 || p.life<=0
  }
  if (bgType === 'glacier') {
    p.x += p.vx*s; p.y += p.vy*s
    if (p.rot !== undefined) p.rot += 0.01*s
    return p.y > h+20
  }
  if (bgType === 'volcano') {
    p.vy += (p.grav||0.06)*s
    p.x += p.vx*s; p.y += p.vy*s
    p.life -= p.decay*s; return p.y > h+25 || p.life<=0
  }
  if (bgType === 'warp') {
    p.dist += (p.speed + p.dist*0.012)*s
    if (p.dist > Math.max(w,h)*0.72) { p.dist = Math.random()*22; p.angle = Math.random()*Math.PI*2; p.length = 5+Math.random()*15; p.speed = 3+Math.random()*4 }
    return false
  }
  if (bgType === 'abyss') {
    p.x += p.vx*s; p.y += p.vy*s
    if (p.growing) { p.life += 0.0018*s; if (p.life >= 0.9) p.growing=false }
    else { p.life -= 0.0018*s; if (p.life <= 0.05) p.growing=true }
    if (p.x < -p.r*2) p.x=w+p.r*2; else if (p.x > w+p.r*2) p.x=-p.r*2
    if (p.y < -p.r*2) p.y=h+p.r*2; else if (p.y > h+p.r*2) p.y=-p.r*2
    return false
  }
  p.x += p.vx*s; p.y += p.vy*s
  if (p.decay>0) p.life -= p.decay*s
  if (bgType === 'storm') return p.y > h+20
  if (bgType === 'matrix') return p.y > h+20
  if (['lava','ember','ocean','bubbles','nebula','inferno'].includes(bgType)) return p.y < -30 || p.life<=0
  if (['crystal','clouds'].includes(bgType)) return p.y > h+30 || p.x > w+30
  return p.life<=0
}

// ── Particle draw ─────────────────────────────────────────────────────────────
function drawParticle(ctx, p, bgType, w, h, beat = 0) {
  ctx.save()

  // Matrix
  if (bgType === 'matrix') {
    ctx.globalAlpha = p.lead ? 0.95 : (0.35+Math.random()*0.3)
    if (p.lead) { ctx.shadowColor='#aaffaa'; ctx.shadowBlur=8 }
    ctx.fillStyle = p.lead ? '#ccffcc' : `rgba(0,${140+Math.floor(Math.random()*115)},40,1)`
    ctx.font = `${p.fontSize}px monospace`
    if (Math.random()<0.03) p.char = String.fromCharCode(0x30A0+Math.floor(Math.random()*96))
    ctx.fillText(p.char, p.x, p.y); ctx.restore(); return
  }

  // Stars / aurora star-dots
  if (bgType === 'stars' || bgType === 'aurora') {
    const alpha = 0.25+0.55*Math.abs(Math.sin(p.twinkle))
    ctx.globalAlpha = alpha; ctx.fillStyle = p.color || '#ffffff'
    if (p.r > 1.2) { ctx.shadowColor=p.color||'#fff'; ctx.shadowBlur=6 }
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill(); ctx.restore(); return
  }

  // Bubbles
  if (bgType==='bubbles' && p.bubble) {
    ctx.globalAlpha = p.life*0.5
    ctx.strokeStyle = `hsla(${p.hue},80%,70%,0.8)`; ctx.lineWidth=1
    ctx.shadowColor = `hsla(${p.hue},80%,70%,1)`; ctx.shadowBlur=6
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.stroke(); ctx.restore(); return
  }

  // Forest firefly
  if (bgType==='forest' && p.subtype==='firefly') {
    const alpha = 0.25+0.65*Math.abs(Math.sin(p.twinkle))
    ctx.globalAlpha = Math.min(1, alpha * (1 + beat * 0.5))
    ctx.fillStyle=`hsl(${p.hue},90%,70%)`
    ctx.shadowColor=ctx.fillStyle; ctx.shadowBlur=10+beat*18
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill(); ctx.restore(); return
  }

  // Forest leaf
  if (bgType==='forest' && p.subtype==='leaf') {
    ctx.globalAlpha = p.life*0.8
    ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot||0)
    ctx.fillStyle=`hsl(${p.hue},55%,32%)`
    ctx.fillRect(-p.r,-p.r*0.4,p.r*2,p.r*0.8)
    ctx.restore(); ctx.restore(); return
  }

  // Glacier snowflake
  if (bgType==='glacier' && p.subtype==='flake') {
    ctx.globalAlpha=0.55; ctx.strokeStyle=`hsl(${p.hue},55%,82%)`; ctx.lineWidth=0.8
    ctx.save(); ctx.translate(p.x,p.y)
    for (let arm=0;arm<6;arm++) {
      const a=arm*Math.PI/3+(p.rot||0)
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(Math.cos(a)*p.r,Math.sin(a)*p.r); ctx.stroke()
    }
    ctx.restore(); ctx.restore(); return
  }

  // Glacier shard
  if (bgType==='glacier' && p.subtype==='shard') {
    ctx.globalAlpha=0.45; ctx.strokeStyle=`hsl(${p.hue},50%,75%)`; ctx.lineWidth=0.7
    ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot||0)
    ctx.beginPath(); ctx.moveTo(0,-p.r*1.8); ctx.lineTo(0,p.r*1.8); ctx.stroke()
    ctx.restore(); ctx.restore(); return
  }

  // Warp streak
  if (bgType==='warp') {
    const cx=w/2, cy=h/2
    const x1=cx+Math.cos(p.angle)*p.dist, y1=cy+Math.sin(p.angle)*p.dist
    const stretchedLen = p.length * (1 + beat * 0.9)
    const x2=cx+Math.cos(p.angle)*(p.dist+stretchedLen+p.dist*0.08)
    const y2=cy+Math.sin(p.angle)*(p.dist+stretchedLen+p.dist*0.08)
    ctx.globalAlpha=Math.min(1,p.dist/55)*(0.75+beat*0.25)
    const col=`hsl(${p.hue},75%,${65+beat*20}%)`; ctx.strokeStyle=col; ctx.shadowColor=col; ctx.shadowBlur=3+beat*10
    ctx.lineWidth=0.5+p.dist/130; ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke()
    ctx.restore(); return
  }

  // Abyss wisp
  if (bgType==='abyss') {
    ctx.globalAlpha=p.life*0.12
    const gr=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r)
    gr.addColorStop(0,`hsla(${p.hue},40%,50%,1)`); gr.addColorStop(1,'rgba(0,0,0,0)')
    ctx.fillStyle=gr; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill()
    ctx.restore(); return
  }

  // Generic glow circle (lava, ember, crystal, ocean, nebula, blackhole, inferno, volcano, quake)
  const alpha = (p.a!==undefined) ? p.a*p.life : p.life
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha * (1 + beat * 0.22)))
  const isTerrain = bgType==='quake'
  const color = `hsl(${p.hue},${isTerrain?35:90}%,${isTerrain?35:58}%)`
  ctx.fillStyle = color
  if (p.glow) { ctx.shadowColor=color; ctx.shadowBlur=(10+p.r*2)*(1+beat*3) }
  ctx.beginPath(); ctx.arc(p.x,p.y,Math.max(0.1,p.r),0,Math.PI*2); ctx.fill()
  ctx.restore()
}

// ── Layer 3: Foreground atmosphere ───────────────────────────────────────────
function drawForeground(ctx, bgType, w, h, t, beat = 0) {
  switch (bgType) {
    case 'lava':
    case 'ember': {
      ctx.save(); ctx.globalAlpha=0.08+beat*0.12; ctx.lineWidth=1
      for (let i=0;i<5;i++) {
        ctx.strokeStyle=bgType==='lava'?'rgba(255,80,0,1)':'rgba(255,160,20,1)'
        ctx.beginPath()
        for (let x=0;x<=w;x+=6) { const y=h*0.84+i*10+Math.sin(x*0.04+t*0.004+i*1.2)*6; x===0?ctx.moveTo(x,y):ctx.lineTo(x,y) }
        ctx.stroke()
      }
      ctx.restore(); break
    }
    case 'forest': {
      const fg=ctx.createLinearGradient(0,h*0.8,0,h)
      fg.addColorStop(0,'rgba(0,0,0,0)'); fg.addColorStop(1,'rgba(0,20,5,0.20)')
      ctx.fillStyle=fg; ctx.fillRect(0,0,w,h); break
    }
    case 'glacier': {
      // Mist
      const fg=ctx.createLinearGradient(0,h*0.75,0,h)
      fg.addColorStop(0,'rgba(0,0,0,0)'); fg.addColorStop(1,'rgba(160,200,255,0.10)')
      ctx.fillStyle=fg; ctx.fillRect(0,0,w,h); break
    }
    case 'storm': {
      const fg=ctx.createLinearGradient(0,h*0.75,0,h)
      fg.addColorStop(0,'rgba(30,50,90,0)'); fg.addColorStop(1,'rgba(30,50,90,0.18)')
      ctx.fillStyle=fg; ctx.fillRect(0,0,w,h); break
    }
    case 'volcano': {
      ctx.save(); ctx.globalAlpha=0.09
      for (let si=0;si<3;si++) {
        const sx=w*(0.25+si*0.25)+Math.sin(t*0.0006+si)*30
        const sg=ctx.createRadialGradient(sx,h*0.9,0,sx,h*0.4,h*0.55)
        sg.addColorStop(0,'rgba(30,30,30,1)'); sg.addColorStop(1,'rgba(0,0,0,0)')
        ctx.fillStyle=sg; ctx.fillRect(0,0,w,h)
      }
      ctx.restore(); break
    }
    case 'inferno': {
      ctx.save()
      for (let fi=0;fi<8;fi++) {
        const fx=w*(fi/8)+Math.sin(t*0.004+fi*0.7)*20
        const fh=h*(0.1+0.08*Math.sin(t*0.005+fi*1.3))
        const flameG=ctx.createLinearGradient(fx,h,fx,h-fh)
        flameG.addColorStop(0,`rgba(255,${80+fi*15},0,0.4)`); flameG.addColorStop(1,'rgba(255,255,80,0)')
        ctx.fillStyle=flameG; ctx.globalAlpha=0.13; ctx.fillRect(fx-15,h-fh,30,fh)
      }
      ctx.restore(); break
    }
    case 'aurora': {
      // Aurora ribbon bands (the main visual)
      ctx.save()
      for (let i=0;i<6;i++) {
        const baseY=h*(0.08+i*0.09)+Math.sin(t*0.0005+i*1.8)*h*0.05
        const aHue=(140+i*38+t*0.005+Math.sin(t*0.0003+i)*20)%360
        const alpha=(0.07+0.05*Math.sin(t*0.0006+i*1.5))*(1+beat*1.6)
        ctx.globalAlpha=alpha; ctx.lineWidth=h*0.07
        ctx.strokeStyle=`hsl(${aHue},90%,60%)`; ctx.shadowColor=`hsl(${aHue},90%,60%)`; ctx.shadowBlur=35
        ctx.beginPath(); ctx.moveTo(0,baseY)
        for (let x=0;x<=w;x+=8) ctx.lineTo(x, baseY+Math.sin(x*0.011+t*0.0008+i*2.1)*h*0.04)
        ctx.stroke()
      }
      ctx.restore(); break
    }
    case 'blackhole': {
      const cx=w*0.5, cy=h*0.5, hr=h*0.12
      const eg=ctx.createRadialGradient(cx,cy,0,cx,cy,hr*1.4)
      eg.addColorStop(0,'rgba(0,0,0,1)'); eg.addColorStop(0.7,'rgba(0,0,0,0.9)'); eg.addColorStop(1,'rgba(0,0,0,0)')
      ctx.fillStyle=eg; ctx.fillRect(0,0,w,h)
      ctx.save(); ctx.strokeStyle=`rgba(180,60,255,${0.25+beat*0.35})`; ctx.lineWidth=3+beat*2
      ctx.shadowColor='rgba(200,80,255,1)'; ctx.shadowBlur=20+beat*45
      ctx.beginPath(); ctx.ellipse(cx,cy,h*0.22+Math.sin(t*0.001)*5,h*0.07,-Math.PI*0.1,0,Math.PI*2); ctx.stroke()
      ctx.restore(); break
    }
    case 'matrix': {
      ctx.save(); ctx.globalAlpha=0.04; ctx.fillStyle='rgba(0,0,0,1)'
      for (let y=0;y<h;y+=4) ctx.fillRect(0,y,w,2)
      ctx.globalAlpha=0.06
      const sy=(t*0.04)%h
      const sg=ctx.createLinearGradient(0,sy,0,sy+60)
      sg.addColorStop(0,'rgba(0,255,70,0)'); sg.addColorStop(0.5,'rgba(0,255,70,0.6)'); sg.addColorStop(1,'rgba(0,255,70,0)')
      ctx.fillStyle=sg; ctx.fillRect(0,sy,w,60); ctx.restore(); break
    }
    case 'nebula': {
      ctx.save(); ctx.globalAlpha=0.03; ctx.fillStyle='#ffffff'
      for (let i=0;i<80;i++) { const sx=(Math.sin(i*37.4)*0.5+0.5)*w, sy=(Math.cos(i*23.7)*0.5+0.5)*h; ctx.beginPath(); ctx.arc(sx,sy,0.5,0,Math.PI*2); ctx.fill() }
      ctx.restore(); break
    }
    case 'warp': {
      const wg=ctx.createRadialGradient(w*0.5,h*0.5,h*0.05,w*0.5,h*0.5,h*0.5)
      wg.addColorStop(0,'rgba(40,80,150,0.12)'); wg.addColorStop(0.4,'rgba(0,0,0,0)'); wg.addColorStop(1,'rgba(0,0,10,0.30)')
      ctx.fillStyle=wg; ctx.fillRect(0,0,w,h); break
    }
    case 'abyss': {
      const breathe=0.18+0.09*Math.sin(t*0.0015)
      const ag=ctx.createRadialGradient(w*0.5,h*0.5,h*0.22,w*0.5,h*0.5,h*0.72)
      ag.addColorStop(0,'rgba(0,0,0,0)'); ag.addColorStop(1,`rgba(0,0,0,${breathe})`)
      ctx.fillStyle=ag; ctx.fillRect(0,0,w,h); break
    }
    default: break
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function BackgroundCanvas({ bgType = 'stars', style, beatRef = null }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let animId
    let particles = []
    const startTime = performance.now()
    let lastTime = startTime

    const resize = () => {
      canvas.width  = canvas.offsetWidth  || window.innerWidth
      canvas.height = canvas.offsetHeight || window.innerHeight
      particles = createParticles(bgType, canvas.width, canvas.height)
    }
    resize()
    window.addEventListener('resize', resize)

    const tick = (now) => {
      const dt = Math.min(now-lastTime, 50)
      lastTime = now
      const t = now-startTime
      const w = canvas.width, hh = canvas.height

      ctx.globalAlpha = 1
      ctx.fillStyle = BG_BASE[bgType] || '#000'
      ctx.fillRect(0,0,w,hh)

      ctx.globalAlpha = 1
      drawAmbient(ctx, bgType, w, hh, t)

      ctx.globalAlpha = 1
      for (let i=particles.length-1;i>=0;i--) {
        const dead = updateParticle(particles[i], bgType, w, hh, dt)
        if (dead) particles[i] = makeParticle(bgType, w, hh, false)
        drawParticle(ctx, particles[i], bgType, w, hh)
      }

      ctx.globalAlpha = 1
      drawForeground(ctx, bgType, w, hh, t)

      ctx.globalAlpha = 1
      animId = requestAnimationFrame(tick)
    }
    animId = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize) }
  }, [bgType])

  return (
    <canvas
      ref={canvasRef}
      style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none', ...style }}
    />
  )
}
