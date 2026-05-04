import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'
import catImageUrl from '../meme/oiia_cat_assets_by_awesomeconsoles7_djwlgwe-fullview.png'
import { SYNESTHESIA_EVENT, useSynesthesiaEvent } from '../logic/synesthesiaBus'
import { BGTYPE_VANTA_CONFIG, getBackgroundProfile } from '../logic/backgroundProfiles'
import '../styles/backgroundEffects.css'

// ── Base fill colour per bgType ───────────────────────────────────────────────
const BG_BASE = {
  lava:'#110200', ember:'#0f0400', crystal:'#01040f',
  quake:'#0a0804', ocean:'#00050f', bubbles:'#00060c',
  storm:'#040608', clouds:'#06080e', stars:'#000005',
  nebula:'#030008', blackhole:'#000003', matrix:'#000500',
  grid:'#020912',
  // New types
  forest:'#000802', glacier:'#000a18', volcano:'#150200',
  inferno:'#100000', aurora:'#000410', warp:'#000008', abyss:'#000000',
  oiia:'#0a0010', nyancat:'#020008', custom:'#000006',
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
      // Foamy surface ribbon
      ctx.globalAlpha = 0.24
      ctx.strokeStyle = 'rgba(180, 235, 255, 0.85)'
      ctx.lineWidth = 2
      ctx.beginPath()
      for (let x=0;x<=w;x+=6) {
        const y = h*0.22 + Math.sin(x*0.018 + t*0.0022)*h*0.02 + Math.sin(x*0.055 + t*0.0011)*4
        x===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y)
      }
      ctx.stroke()
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
    case 'grid': {
      const g = ctx.createLinearGradient(0,0,0,h)
      g.addColorStop(0,'rgba(2,18,32,1)'); g.addColorStop(1,'rgba(1,8,16,1)')
      ctx.fillStyle = g; ctx.fillRect(0,0,w,h)
      ctx.save(); ctx.globalAlpha = 0.08
      ctx.strokeStyle = 'rgba(90,220,255,0.9)'; ctx.lineWidth = 1
      const step = Math.max(24, Math.round(Math.min(w, h) * 0.06))
      const drift = (t * 0.02) % step
      for (let x = -step; x <= w + step; x += step) {
        ctx.beginPath(); ctx.moveTo(x + drift, 0); ctx.lineTo(x + drift, h); ctx.stroke()
      }
      for (let y = -step; y <= h + step; y += step) {
        ctx.beginPath(); ctx.moveTo(0, y + drift * 0.6); ctx.lineTo(w, y + drift * 0.6); ctx.stroke()
      }
      ctx.restore(); break
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
      const g = ctx.createRadialGradient(w*0.5,h*0.5,0,w*0.5,h*0.5,h*0.8)
      g.addColorStop(0,'rgba(85,140,255,0.45)'); g.addColorStop(0.28,'rgba(15,35,95,0.26)'); g.addColorStop(1,'rgba(0,0,8,0)')
      ctx.fillStyle = g; ctx.fillRect(0,0,w,h); break
    }
    case 'abyss': {
      const g = ctx.createRadialGradient(w*0.5,h*0.5,0,w*0.5,h*0.5,h*0.6)
      g.addColorStop(0,'rgba(5,0,12,0.5)'); g.addColorStop(1,'rgba(0,0,0,0)')
      ctx.fillStyle = g; ctx.fillRect(0,0,w,h); break
    }
    case 'oiia': {
      // Pink/purple dreamy pulsing glow
      const g = ctx.createRadialGradient(w*0.5+Math.sin(t*0.0006)*w*0.2, h*0.5+Math.cos(t*0.0008)*h*0.15, 0, w*0.5, h*0.5, h*0.8)
      g.addColorStop(0,`hsla(${300+Math.sin(t*0.0007)*30},90%,28%,0.6)`)
      g.addColorStop(0.5,`hsla(${330+Math.cos(t*0.0005)*20},80%,15%,0.4)`)
      g.addColorStop(1,'rgba(10,0,16,0)')
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
    ['storm','matrix','grid','crystal','glacier','forest'].includes(bgType) ? -10 : h+10
  )
  switch (bgType) {
    case 'lava':   return { x, y, vx:(Math.random()-0.5)*0.5, vy:-(0.5+Math.random()*0.7), r:3+Math.random()*4, hue:10+Math.random()*25, life:1, decay:0.003+Math.random()*0.003, glow:true }
    case 'ember':  return { x, y, vx:(Math.random()-0.5)*0.8, vy:-(0.4+Math.random()*0.9), r:1.5+Math.random()*2.5, hue:5+Math.random()*40, life:1, decay:0.004+Math.random()*0.004, glow:true }
    case 'crystal': {
      const prism = Math.random() < 0.7
      return {
        x,
        y,
        vx:(Math.random()-0.5)*0.24,
        vy:0.2+Math.random()*0.42,
        r:prism ? (1.4+Math.random()*2.8) : (0.4+Math.random()*1.2),
        hue:190+Math.random()*80,
        life:1,
        decay:0.0019+Math.random()*0.0018,
        glow:true,
        subtype: prism ? 'prism' : 'dust',
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.03,
      }
    }
    case 'quake':  return { x, y:Math.random()*h, vx:(Math.random()-0.5)*1.8, vy:(Math.random()-0.5)*1, r:2+Math.random()*4, hue:22+Math.random()*18, life:1, decay:0.009+Math.random()*0.007, glow:false }
    case 'ocean':  return { x, y, vx:(Math.random()-0.5)*0.08, vy:-(0.09+Math.random()*0.18), r:2+Math.random()*4, hue:200+Math.random()*30, life:1, decay:0.0015+Math.random()*0.0015, glow:true, a:0.35 }
    case 'bubbles': {
      const isLarge = Math.random() < 0.58
      return {
        x,
        y,
        vx:(Math.random()-0.5)*0.14,
        vy:-(0.15+Math.random()*0.3),
        r:isLarge ? (3.2+Math.random()*7.4) : (1.1+Math.random()*2.8),
        hue:180+Math.random()*45,
        life:0.7+Math.random()*0.28,
        decay:0.0009+Math.random()*0.0012,
        glow:true,
        bubble:true,
        wobble: Math.random() * Math.PI * 2,
        wobbleAmp: 0.25 + Math.random() * 0.55,
      }
    }
    case 'storm':  return { x, y, vx:1.2+Math.random()*1.6, vy:6+Math.random()*6, r:0.7+Math.random()*0.4, hue:208+Math.random()*16, life:1, decay:0, glow:false }
    case 'clouds': return { x, y:10+Math.random()*h*0.6, vx:0.03+Math.random()*0.12, vy:(Math.random()-0.5)*0.02, r:16+Math.random()*30, hue:215+Math.random()*35, life:1, decay:0, glow:false, a:0.04+Math.random()*0.05, layer:Math.random()<0.5?0:1 }
    case 'stars': {
      const shooting = Math.random() < 0.07
      if (shooting) {
        const ang = -Math.PI * (0.12 + Math.random() * 0.32)
        return {
          x: Math.random() * w,
          y: Math.random() * h * 0.45,
          vx: Math.cos(ang) * (2.6 + Math.random() * 2.8),
          vy: Math.sin(ang) * (2.6 + Math.random() * 2.8),
          len: 18 + Math.random() * 34,
          r: 1.0 + Math.random() * 1.5,
          hue: 200 + Math.random() * 30,
          life: 0.55 + Math.random() * 0.5,
          decay: 0.005 + Math.random() * 0.005,
          subtype: 'shooting',
        }
      }
      return { x, y:Math.random()*h, vx:(Math.random()-0.5)*0.03, vy:(Math.random()-0.5)*0.02, r:0.5+Math.random()*2.1, hue:0, life:1, decay:0, twinkle:Math.random()*Math.PI*2, twinkleSpeed:0.02+Math.random()*0.04, depth:0.5+Math.random()*1.1, color:`rgba(${190+Math.floor(Math.random()*65)},${205+Math.floor(Math.random()*50)},255,1)` }
    }
    case 'nebula': {
      const spark = Math.random() < 0.22
      return {
        x,
        y,
        vx:(Math.random()-0.5)*(spark ? 0.22 : 0.1),
        vy:-(0.03+Math.random()*(spark ? 0.1 : 0.05)),
        r:spark ? (0.6+Math.random()*1.6) : (4+Math.random()*10),
        hue:spark ? (200+Math.random()*70) : (260+Math.random()*80),
        life: spark ? (0.55+Math.random()*0.45) : 1,
        decay:spark ? (0.0012+Math.random()*0.0022) : 0.0006,
        glow:spark,
        a:spark ? 0.18 : 0.07,
        subtype: spark ? 'spark' : 'cloud',
        twinkle: Math.random() * Math.PI * 2,
      }
    }
    case 'blackhole': {
      const angle=Math.random()*Math.PI*2, dist=60+Math.random()*160
      return { x:w/2+Math.cos(angle)*dist, y:h/2+Math.sin(angle)*dist, angle, dist, speed:0.007+Math.random()*0.006, r:1.2+Math.random()*2.2, hue:300+Math.random()*60, life:1, decay:0.0018, glow:true }
    }
    case 'matrix': {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%*+-<>[]{}=/\\|:;'
      return {
        x,
        y:-(25+Math.random()*h),
        vx:0,
        vy:3.2+Math.random()*5.5,
        r:0,
        char: chars[Math.floor(Math.random()*chars.length)],
        hue:115+Math.random()*16,
        life:1,
        decay:0,
        fontSize:11+Math.random()*11,
        lead:Math.random()<0.18,
      }
    }
    case 'grid':
      return {
        x,
        y:-(20+Math.random()*h),
        vx:0,
        vy:2.6+Math.random()*4.2,
        r:0.7+Math.random()*1.6,
        hue:190+Math.random()*30,
        life:1,
        decay:0,
        pulse:Math.random()*Math.PI*2,
        lead:Math.random()<0.14,
      }
    // ── New types ─────────────────────────────────────────────────────────────
    case 'forest': {
      const isFirefly = Math.random()<0.35
      return isFirefly
        ? { x, y:Math.random()*h, vx:(Math.random()-0.5)*0.25, vy:-(0.05+Math.random()*0.15), r:0.8+Math.random()*1.2, hue:65+Math.random()*35, life:1, decay:0, subtype:'firefly', twinkle:Math.random()*Math.PI*2 }
        : { x, y, vx:(Math.random()-0.5)*0.5, vy:0.4+Math.random()*0.7, r:2+Math.random()*2.5, hue:80+Math.random()*60, life:1, decay:0.004+Math.random()*0.003, subtype:'leaf', rot:Math.random()*Math.PI*2, rotSpeed:(Math.random()-0.5)*0.06 }
    }
    case 'glacier': {
      const roll = Math.random()
      const subtype = roll < 0.54 ? 'flake' : roll < 0.9 ? 'shard' : 'mist'
      return {
        x,
        y,
        vx:(Math.random()-0.5)*(subtype === 'mist' ? 0.12 : 0.34),
        vy:(subtype === 'mist' ? 0.04 : 0.15)+Math.random()*(subtype === 'mist' ? 0.15 : 0.42),
        r:subtype === 'flake' ? (2+Math.random()*3.2) : subtype === 'mist' ? (7+Math.random()*12) : (0.6+Math.random()*1.6),
        hue:198+Math.random()*40,
        life:1,
        decay:subtype === 'mist' ? 0.0012 : 0,
        subtype,
        rot:Math.random()*Math.PI*2,
      }
    }
    case 'volcano':return { x:w*0.5+(Math.random()-0.5)*w*0.4, y:h*0.92, vx:(Math.random()-0.5)*3.5, vy:-(3+Math.random()*5), r:2+Math.random()*5, hue:10+Math.random()*30, life:1, decay:0.005+Math.random()*0.004, grav:0.07+Math.random()*0.04, glow:true }
    case 'inferno':return { x, y, vx:(Math.random()-0.5)*1.5, vy:-(1.5+Math.random()*2.5), r:3+Math.random()*8, hue:Math.random()*30, life:1, decay:0.007+Math.random()*0.006, glow:true }
    case 'aurora': return { x, y:Math.random()*h*0.6, vx:(Math.random()-0.5)*0.08, vy:(Math.random()-0.5)*0.04, r:0.5+Math.random()*2.2, hue:130+Math.random()*120, life:1, decay:0, twinkle:Math.random()*Math.PI*2, twinkleSpeed:0.04+Math.random()*0.05, color:`hsla(${130+Math.floor(Math.random()*120)},90%,70%,1)` }
    case 'warp': {
      const angle = Math.random()*Math.PI*2
      return { x:w/2, y:h/2, angle, dist:Math.random()*25, speed:3+Math.random()*4, length:5+Math.random()*15, hue:200+Math.random()*60, life:1, decay:0 }
    }
    case 'abyss':  return { x, y:Math.random()*h, vx:(Math.random()-0.5)*0.1, vy:(Math.random()-0.5)*0.1, r:3+Math.random()*16, hue:250+Math.random()*95, life:Math.random(), decay:0.0012+Math.random()*0.001, growing:Math.random()<0.5, pulse:Math.random()*Math.PI*2 }
    case 'oiia': {
      // Spinning cat-colored stars
      const angle = Math.random()*Math.PI*2
      return { x:Math.random()*w, y:Math.random()*h, vx:(Math.random()-0.5)*0.3, vy:(Math.random()-0.5)*0.3, r:4+Math.random()*10, hue:300+Math.random()*60, life:Math.random(), decay:0.003+Math.random()*0.003, growing:Math.random()<0.5, rot:angle, rotSpeed:(Math.random()-0.5)*0.022 }
    }
    default: return { x, y:Math.random()*h, vx:0, vy:0, r:1, hue:0, life:1, decay:0.001, glow:false }
  }
}

function createParticles(bgType, w, h, densityScale = 1) {
  const counts = {
    lava: 180, ember: 150, inferno: 220, storm: 240, quake: 130, volcano: 170,
    ocean: 70, bubbles: 120, glacier: 120, clouds: 54, deepsea: 60,
    stars: 340, nebula: 150, warp: 130, blackhole: 150, abyss: 120,
    matrix: 180, grid: 150, crystal: 150, forest: 100, aurora: 150, oiia: 80,
  }
  const n = Math.max(8, Math.round((counts[bgType] || 80) * densityScale))
  return Array.from({ length:n }, () => makeParticle(bgType, w, h, true))
}

const readRenderQuality = () => {
  try {
    const cfg = JSON.parse(localStorage.getItem('tetris-config') || '{}')
    const quality = String(cfg?.renderQuality || 'balanced')
    return ['performance', 'balanced', 'quality', 'ultra'].includes(quality) ? quality : 'balanced'
  } catch {
    return 'balanced'
  }
}

const detectLowEndDevice = () => {
  if (typeof navigator === 'undefined') return false
  const hc = Number(navigator.hardwareConcurrency || 0)
  const dm = Number(navigator.deviceMemory || 0)
  const coarsePointer = typeof matchMedia === 'function' ? matchMedia('(pointer: coarse)').matches : false
  const smallViewport = typeof window !== 'undefined' ? (window.innerWidth <= 900 || window.innerHeight <= 700) : false
  const saveData = Boolean(navigator.connection?.saveData)
  return saveData || (hc > 0 && hc <= 4) || (dm > 0 && dm <= 4) || (coarsePointer && smallViewport)
}

// ── Particle update — returns true if dead (should respawn) ──────────────────
function updateParticle(p, bgType, w, h, dt) {
  const s = dt/16
  if (bgType === 'blackhole') {
    p.angle += p.speed*s; p.dist -= 0.18*s
    p.x = w/2+Math.cos(p.angle)*p.dist; p.y = h/2+Math.sin(p.angle)*p.dist
    p.life -= p.decay*s; return p.dist<3 || p.life<=0
  }
  if (bgType === 'stars') {
    if (p.subtype === 'shooting') {
      p.x += p.vx * s
      p.y += p.vy * s
      p.life -= p.decay * s
      return p.life <= 0 || p.x > w + 30 || p.x < -30 || p.y > h + 30 || p.y < -30
    }
    p.twinkle += (p.twinkleSpeed || 0.03) * s
    p.x += (p.vx || 0) * s * (p.depth || 1)
    p.y += (p.vy || 0) * s * (p.depth || 1)
    if (p.x < -3) p.x = w + 3; else if (p.x > w + 3) p.x = -3
    if (p.y < -3) p.y = h + 3; else if (p.y > h + 3) p.y = -3
    return false
  }
  if (bgType === 'aurora') {
    p.twinkle += (p.twinkleSpeed || 0.045) * s
    p.x += (p.vx || 0) * s
    p.y += (p.vy || 0) * s
    if (p.x < -5) p.x = w + 5; else if (p.x > w + 5) p.x = -5
    if (p.y < -5) p.y = h + 5; else if (p.y > h + 5) p.y = -5
    return false
  }
  if (bgType === 'bubbles') {
    p.wobble = (p.wobble || 0) + 0.06 * s
    p.x += (p.vx || 0) * s + Math.sin(p.wobble) * (p.wobbleAmp || 0.3) * s
    p.y += p.vy * s
    p.life -= p.decay * s
    return p.y < -30 || p.life <= 0
  }
  if (bgType === 'crystal') {
    p.x += p.vx*s; p.y += p.vy*s
    if (p.rotSpeed) p.rot = (p.rot || 0) + p.rotSpeed * s
    p.life -= p.decay*s
    return p.y > h+28 || p.life <= 0
  }
  if (bgType === 'nebula') {
    p.x += p.vx * s
    p.y += p.vy * s
    p.twinkle = (p.twinkle || 0) + 0.02 * s
    if (p.subtype === 'spark') p.life -= p.decay * s
    else p.life = Math.max(0.45, Math.min(1, p.life + Math.sin(p.twinkle) * 0.0015 * s))
    if (p.x < -40) p.x = w + 40; else if (p.x > w + 40) p.x = -40
    if (p.y < -40) p.y = h + 40; else if (p.y > h + 40) p.y = -40
    return p.subtype === 'spark' ? (p.life <= 0) : false
  }
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
  if (bgType === 'grid') {
    p.y += p.vy * s
    p.pulse = (p.pulse || 0) + 0.045 * s
    return p.y > h + 22
  }
  if (bgType === 'glacier') {
    p.x += p.vx*s; p.y += p.vy*s
    if (p.rot !== undefined) p.rot += 0.01*s
    if (p.subtype === 'mist') p.life -= p.decay * s
    return p.y > h+20 || (p.subtype === 'mist' && p.life <= 0)
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
    p.pulse = (p.pulse || 0) + 0.02 * s
    if (p.growing) { p.life += 0.0018*s; if (p.life >= 0.9) p.growing=false }
    else { p.life -= 0.0018*s; if (p.life <= 0.05) p.growing=true }
    if (p.x < -p.r*2) p.x=w+p.r*2; else if (p.x > w+p.r*2) p.x=-p.r*2
    if (p.y < -p.r*2) p.y=h+p.r*2; else if (p.y > h+p.r*2) p.y=-p.r*2
    return false
  }
  if (bgType === 'oiia') {
    p.x += p.vx*s; p.y += p.vy*s
    if (p.growing) { p.life += 0.0022*s; if (p.life >= 0.9) p.growing=false }
    else { p.life -= 0.0022*s; if (p.life <= 0.05) p.growing=true }
    if (p.x < -p.r*2) p.x=w+p.r*2; else if (p.x > w+p.r*2) p.x=-p.r*2
    if (p.y < -p.r*2) p.y=h+p.r*2; else if (p.y > h+p.r*2) p.y=-p.r*2
    return false
  }
  p.x += p.vx*s; p.y += p.vy*s
  if (p.decay>0) p.life -= p.decay*s
  if (bgType === 'storm') return p.y > h+20
  if (bgType === 'matrix') return p.y > h+20
  if (bgType === 'grid') return p.y > h+20
  if (['lava','ember','ocean','bubbles','nebula','inferno'].includes(bgType)) return p.y < -30 || p.life<=0
  if (['crystal','clouds'].includes(bgType)) return p.y > h+30 || p.x > w+30
  return p.life<=0
}

// ── Particle draw ─────────────────────────────────────────────────────────────
function drawParticle(ctx, p, bgType, w, h, beat = 0) {
  ctx.save()

  // Matrix
  if (bgType === 'matrix') {
    const alpha = p.lead ? 0.95 : (0.35 + Math.random() * 0.28)
    ctx.globalAlpha = alpha
    if (p.lead) {
      ctx.shadowColor = '#9dff9d'
      ctx.shadowBlur = 10 + beat * 10
      ctx.fillStyle = '#d9ffd9'
    } else {
      ctx.fillStyle = `hsl(${p.hue}, 95%, ${38 + Math.random()*17}%)`
    }
    ctx.font = `${Math.floor(p.fontSize)}px "Courier New", monospace`
    if (Math.random() < 0.035) {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%*+-<>[]{}=/\\|:;'
      p.char = chars[Math.floor(Math.random() * chars.length)]
    }
    ctx.fillText(p.char, p.x, p.y); ctx.restore(); return
  }

  if (bgType === 'grid') {
    const pulse = 0.45 + 0.55 * Math.abs(Math.sin(p.pulse || 0))
    ctx.globalAlpha = p.lead ? 0.9 : 0.35 + pulse * 0.3
    const c = `hsl(${p.hue}, 95%, ${p.lead ? 78 : 62}%)`
    ctx.strokeStyle = c
    ctx.fillStyle = c
    if (p.lead) { ctx.shadowColor = c; ctx.shadowBlur = 10 + beat * 8 }
    const r = Math.max(0.6, p.r)
    ctx.beginPath()
    ctx.moveTo(p.x - r, p.y)
    ctx.lineTo(p.x, p.y - r)
    ctx.lineTo(p.x + r, p.y)
    ctx.lineTo(p.x, p.y + r)
    ctx.closePath()
    ctx.stroke()
    if (p.lead) {
      ctx.globalAlpha *= 0.4
      ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.35, 0, Math.PI * 2); ctx.fill()
    }
    ctx.restore(); return
  }

  // Storm rain streaks
  if (bgType === 'storm') {
    const len = 8 + p.vy * 0.8
    ctx.globalAlpha = 0.35 + Math.min(0.45, p.vy / 16)
    ctx.strokeStyle = `hsla(${p.hue}, 80%, 72%, 0.9)`
    ctx.lineWidth = Math.max(0.6, p.r)
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    ctx.lineTo(p.x - (2.5 + p.vx * 0.8), p.y - len)
    ctx.stroke()
    ctx.restore()
    return
  }

  // Clouds as soft puffs
  if (bgType === 'clouds') {
    const puffR = p.r * (1 + beat * 0.08)
    const cloud = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, puffR)
    const coreAlpha = p.layer === 1 ? Math.min(0.16, p.a + 0.05) : Math.min(0.22, p.a + 0.08)
    cloud.addColorStop(0, `rgba(228,240,255,${coreAlpha})`)
    cloud.addColorStop(1, 'rgba(200,220,255,0)')
    ctx.fillStyle = cloud
    ctx.globalAlpha = p.layer === 1 ? 0.54 : 0.78
    ctx.beginPath()
    ctx.arc(p.x, p.y, puffR, 0, Math.PI * 2)
    ctx.fill()
    if (p.layer === 0 && p.r > 26) {
      ctx.globalAlpha = 0.12
      ctx.strokeStyle = 'rgba(245,250,255,0.55)'
      ctx.lineWidth = 0.8
      ctx.beginPath()
      ctx.arc(p.x - p.r * 0.2, p.y - p.r * 0.15, p.r * 0.5, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.restore()
    return
  }

  // Stars (includes shooting stars)
  if (bgType === 'stars') {
    if (p.subtype === 'shooting') {
      const nx = p.vx / (Math.hypot(p.vx, p.vy) || 1)
      const ny = p.vy / (Math.hypot(p.vx, p.vy) || 1)
      const tail = (p.len || 24) * Math.max(0.25, p.life)
      const gx = ctx.createLinearGradient(p.x, p.y, p.x - nx * tail, p.y - ny * tail)
      gx.addColorStop(0, `hsla(${p.hue || 210},100%,85%,0.95)`)
      gx.addColorStop(1, 'rgba(150,210,255,0)')
      ctx.globalAlpha = Math.min(1, p.life * 1.1)
      ctx.strokeStyle = gx
      ctx.lineWidth = p.r
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - nx * tail, p.y - ny * tail); ctx.stroke()
      ctx.restore(); return
    }
    const alpha = 0.22 + 0.62 * Math.abs(Math.sin(p.twinkle || 0))
    ctx.globalAlpha = alpha
    ctx.fillStyle = p.color || '#ffffff'
    if (p.r > 1.2) { ctx.shadowColor = p.color || '#fff'; ctx.shadowBlur = 8 }
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill()
    if (p.r > 1.3) {
      ctx.globalAlpha = alpha * 0.35
      ctx.strokeStyle = p.color || '#fff'
      ctx.lineWidth = 0.5
      ctx.beginPath(); ctx.moveTo(p.x - p.r * 1.7, p.y); ctx.lineTo(p.x + p.r * 1.7, p.y); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(p.x, p.y - p.r * 1.7); ctx.lineTo(p.x, p.y + p.r * 1.7); ctx.stroke()
    }
    ctx.restore(); return
  }

  // Aurora spark-dots
  if (bgType === 'aurora') {
    const alpha = 0.18 + 0.5 * Math.abs(Math.sin(p.twinkle || 0))
    ctx.globalAlpha = alpha
    ctx.fillStyle = p.color || '#a8ffe9'
    if (p.r > 1.1) { ctx.shadowColor = p.color || '#b0fff0'; ctx.shadowBlur = 10 + beat * 8 }
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill(); ctx.restore(); return
  }

  // Bubbles
  if (bgType==='bubbles' && p.bubble) {
    const bubbleAlpha = Math.max(0.1, p.life * 0.6)
    ctx.globalAlpha = bubbleAlpha
    ctx.strokeStyle = `hsla(${p.hue},85%,74%,0.92)`
    ctx.lineWidth = Math.max(0.8, p.r * 0.12)
    ctx.shadowColor = `hsla(${p.hue},90%,72%,1)`
    ctx.shadowBlur = 8 + p.r * 0.4
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.stroke()
    ctx.globalAlpha = bubbleAlpha * 0.35
    ctx.fillStyle = `hsla(${p.hue},92%,80%,0.35)`
    ctx.beginPath(); ctx.arc(p.x + p.r * 0.25, p.y - p.r * 0.2, Math.max(0.4, p.r * 0.22), 0, Math.PI*2); ctx.fill()
    ctx.restore(); return
  }

  if (bgType === 'crystal' && p.subtype === 'prism') {
    ctx.globalAlpha = Math.max(0.18, p.life * 0.9)
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot || 0)
    ctx.fillStyle = `hsla(${p.hue},88%,72%,0.22)`
    ctx.strokeStyle = `hsla(${p.hue},98%,82%,0.85)`
    ctx.lineWidth = 0.7
    ctx.beginPath()
    ctx.moveTo(0, -p.r * 1.7)
    ctx.lineTo(p.r * 0.9, 0)
    ctx.lineTo(0, p.r * 1.7)
    ctx.lineTo(-p.r * 0.9, 0)
    ctx.closePath()
    ctx.fill(); ctx.stroke()
    ctx.restore(); ctx.restore(); return
  }

  if (bgType === 'crystal' && p.subtype === 'dust') {
    ctx.globalAlpha = Math.max(0.12, p.life * 0.7)
    ctx.fillStyle = `hsla(${p.hue},90%,80%,0.8)`
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill()
    ctx.restore(); return
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

  if (bgType==='glacier' && p.subtype==='mist') {
    const mg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r)
    mg.addColorStop(0, `hsla(${p.hue},55%,86%,${Math.max(0.04, p.life * 0.08)})`)
    mg.addColorStop(1, 'rgba(210,240,255,0)')
    ctx.fillStyle = mg
    ctx.globalAlpha = 0.45
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill()
    ctx.restore(); return
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

  if (bgType === 'nebula' && p.subtype === 'spark') {
    const alpha = Math.max(0.1, p.life * (0.45 + 0.35 * Math.abs(Math.sin(p.twinkle || 0))))
    ctx.globalAlpha = alpha
    ctx.fillStyle = `hsla(${p.hue},95%,78%,1)`
    ctx.shadowColor = ctx.fillStyle
    ctx.shadowBlur = 8 + beat * 10
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill()
    ctx.restore(); return
  }

  if (bgType === 'nebula' && p.subtype === 'cloud') {
    ctx.globalAlpha = Math.max(0.08, p.life * (p.a || 0.08))
    const ng = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r)
    ng.addColorStop(0, `hsla(${p.hue},80%,58%,0.6)`)
    ng.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = ng
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill()
    ctx.restore(); return
  }

  // Abyss wisp
  if (bgType==='abyss') {
    const pulse = 0.82 + 0.22 * Math.sin(p.pulse || 0)
    ctx.globalAlpha=p.life*0.14*pulse
    const gr=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r)
    gr.addColorStop(0,`hsla(${p.hue},40%,50%,1)`); gr.addColorStop(1,'rgba(0,0,0,0)')
    ctx.fillStyle=gr; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill()
    if (p.r > 8) {
      ctx.globalAlpha = p.life * 0.1 * pulse
      ctx.strokeStyle = `hsla(${p.hue + 15},55%,65%,0.7)`
      ctx.lineWidth = 0.6
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.6, 0, Math.PI*2); ctx.stroke()
    }
    ctx.restore(); return
  }

  // OIIA spinning cat-paw star shapes
  if (bgType==='oiia') {
    if (p.rot!==undefined) p.rot += (p.rotSpeed||0.014)
    const alpha = p.growing ? 0.06+p.life*0.18 : p.life*0.22
    ctx.globalAlpha = Math.max(0, alpha * (1 + beat * 0.4))
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot||0)
    // Draw 5-pointed star
    ctx.fillStyle = `hsl(${p.hue},90%,68%)`
    ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8 + p.r
    ctx.beginPath()
    for (let pt=0; pt<10; pt++) {
      const a = (pt*Math.PI/5) - Math.PI/2
      const radius = pt%2===0 ? p.r : p.r*0.45
      if (pt===0) ctx.moveTo(Math.cos(a)*radius, Math.sin(a)*radius)
      else ctx.lineTo(Math.cos(a)*radius, Math.sin(a)*radius)
    }
    ctx.closePath(); ctx.fill()
    ctx.restore(); ctx.restore(); return
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
    case 'ocean': {
      // Multi-layer rolling wave crests
      ctx.save(); ctx.globalAlpha = 0.16 + beat * 0.09
      for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = i === 0 ? 'rgba(160,235,255,0.9)' : 'rgba(70,190,245,0.75)'
        ctx.lineWidth = 1.4 + i * 0.5
        ctx.beginPath()
        for (let x = 0; x <= w; x += 6) {
          const y = h * (0.32 + i * 0.08)
            + Math.sin(x * 0.012 + t * (0.0018 + i * 0.0002)) * (9 + i * 2)
            + Math.cos(x * 0.025 + t * 0.0012 + i) * 4
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        }
        ctx.stroke()
      }
      ctx.restore()
      break
    }
    case 'clouds': {
      // Layered cloud banks so this reads as clouds even at a glance
      ctx.save()
      for (let i = 0; i < 4; i++) {
        const y = h * (0.18 + i * 0.12) + Math.sin(t * 0.00035 + i) * h * 0.018
        const band = ctx.createLinearGradient(0, y - 28, 0, y + 28)
        band.addColorStop(0, 'rgba(0,0,0,0)')
        band.addColorStop(0.45, `rgba(160,185,220,${0.09 + i * 0.01})`)
        band.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = band
        ctx.fillRect(0, y - 28, w, 56)
      }
      ctx.restore()
      break
    }
    case 'bubbles': {
      ctx.save()
      ctx.globalAlpha = 0.14 + beat * 0.08
      for (let i = 0; i < 5; i++) {
        const bx = w * ((i + 0.5) / 5) + Math.sin(t * 0.00045 + i * 0.8) * 26
        const by = h * (0.28 + i * 0.1)
        const caustic = ctx.createRadialGradient(bx, by, 0, bx, by, 90 + i * 15)
        caustic.addColorStop(0, 'rgba(170,235,255,0.45)')
        caustic.addColorStop(1, 'rgba(120,200,255,0)')
        ctx.fillStyle = caustic
        ctx.beginPath(); ctx.arc(bx, by, 90 + i * 15, 0, Math.PI * 2); ctx.fill()
      }
      ctx.restore()
      break
    }
    case 'crystal': {
      ctx.save()
      ctx.globalAlpha = 0.13 + beat * 0.09
      for (let i = 0; i < 6; i++) {
        const x = (w / 6) * i + Math.sin(t * 0.0006 + i) * 18
        const y = h * (0.12 + (i % 3) * 0.18)
        ctx.strokeStyle = `hsla(${195 + i * 10},95%,78%,0.9)`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(x - 18, y + 30)
        ctx.lineTo(x, y - 38)
        ctx.lineTo(x + 18, y + 30)
        ctx.stroke()
      }
      ctx.restore()
      break
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
    case 'stars': {
      ctx.save()
      ctx.globalAlpha = 0.08 + beat * 0.05
      for (let i = 0; i < 3; i++) {
        const sy = h * (0.2 + i * 0.22) + Math.sin(t * 0.00025 + i * 1.3) * 22
        ctx.strokeStyle = 'rgba(180,220,255,0.4)'
        ctx.lineWidth = 0.7
        ctx.beginPath()
        for (let x = -40; x <= w + 40; x += 16) {
          const y = sy + Math.sin(x * 0.01 + t * 0.0004 + i) * 6
          x === -40 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        }
        ctx.stroke()
      }
      ctx.restore()
      break
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
      // Subtle top glow only; avoid horizontal scanline look.
      ctx.save()
      const top = ctx.createLinearGradient(0, 0, 0, h * 0.3)
      top.addColorStop(0, 'rgba(80,255,120,0.08)')
      top.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = top
      ctx.fillRect(0, 0, w, h * 0.3)
      ctx.restore()
      break
    }
    case 'grid': {
      ctx.save()
      const step = Math.max(22, Math.round(Math.min(w, h) * 0.055))
      const ox = (t * 0.03) % step
      const oy = (t * 0.022) % step
      ctx.globalAlpha = 0.12 + beat * 0.08
      ctx.strokeStyle = 'rgba(100,220,255,0.65)'
      ctx.lineWidth = 0.8
      for (let x = -step; x <= w + step; x += step) {
        ctx.beginPath(); ctx.moveTo(x + ox, 0); ctx.lineTo(x + ox, h); ctx.stroke()
      }
      for (let y = -step; y <= h + step; y += step) {
        ctx.beginPath(); ctx.moveTo(0, y + oy); ctx.lineTo(w, y + oy); ctx.stroke()
      }
      ctx.restore()
      break
    }
    case 'nebula': {
      ctx.save()
      for (let n = 0; n < 3; n++) {
        const nx = w * (0.3 + n * 0.22) + Math.sin(t * 0.00018 + n * 1.4) * 50
        const ny = h * (0.24 + n * 0.2) + Math.cos(t * 0.00022 + n) * 30
        const rg = ctx.createRadialGradient(nx, ny, 0, nx, ny, 170 + n * 60)
        rg.addColorStop(0, `hsla(${270 + n * 24},90%,58%,0.11)`)
        rg.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = rg
        ctx.fillRect(0, 0, w, h)
      }
      ctx.globalAlpha = 0.04
      ctx.fillStyle = '#ffffff'
      for (let i=0;i<110;i++) {
        const sx=(Math.sin(i*37.4+t*0.00003)*0.5+0.5)*w
        const sy=(Math.cos(i*23.7+t*0.00002)*0.5+0.5)*h
        ctx.beginPath(); ctx.arc(sx,sy,0.5,0,Math.PI*2); ctx.fill()
      }
      ctx.restore(); break
    }
    case 'warp': {
      const wg=ctx.createRadialGradient(w*0.5,h*0.5,h*0.05,w*0.5,h*0.5,h*0.5)
      wg.addColorStop(0,'rgba(90,160,255,0.2)'); wg.addColorStop(0.4,'rgba(0,0,0,0)'); wg.addColorStop(1,'rgba(0,0,18,0.34)')
      ctx.fillStyle=wg; ctx.fillRect(0,0,w,h); break
    }
    case 'abyss': {
      const breathe=0.18+0.09*Math.sin(t*0.0015)
      const ag=ctx.createRadialGradient(w*0.5,h*0.5,h*0.22,w*0.5,h*0.5,h*0.72)
      ag.addColorStop(0,'rgba(0,0,0,0)'); ag.addColorStop(1,`rgba(0,0,0,${breathe})`)
      ctx.fillStyle=ag; ctx.fillRect(0,0,w,h)
      ctx.save()
      ctx.globalAlpha = 0.12
      for (let i = 0; i < 4; i++) {
        const rx = w * (0.2 + i * 0.2) + Math.sin(t * 0.00027 + i * 2) * 20
        const ry = h * (0.35 + i * 0.12)
        ctx.strokeStyle = `hsla(${265 + i * 12},55%,48%,0.5)`
        ctx.lineWidth = 0.8
        ctx.beginPath()
        ctx.ellipse(rx, ry, 35 + i * 10, 8 + i * 2, t * 0.0002 + i, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.restore()
      break
    }
    case 'oiia': {
      // Pulsing pink shimmer
      const pulse=0.06+0.04*Math.sin(t*0.0022)
      const og=ctx.createRadialGradient(w*0.5,h*0.5,h*0.1,w*0.5,h*0.5,h*0.8)
      og.addColorStop(0,'rgba(255,110,180,0.14)'); og.addColorStop(0.5,`rgba(180,50,255,${pulse})`); og.addColorStop(1,'rgba(0,0,0,0)')
      ctx.fillStyle=og; ctx.fillRect(0,0,w,h); break
    }
    default: break
  }
}

// Module-level cache for loaded Vanta effect factories (avoids re-importing)
const _vantaModCache = {}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const lerp = (a, b, t) => a + (b - a) * t
const lerpHex = (from, to, t) => {
  const f = Number(from || 0)
  const tt = Number(to || 0)
  const fr = (f >> 16) & 0xff
  const fg = (f >> 8) & 0xff
  const fb = f & 0xff
  const tr = (tt >> 16) & 0xff
  const tg = (tt >> 8) & 0xff
  const tb = tt & 0xff
  const rr = Math.round(lerp(fr, tr, t))
  const rg = Math.round(lerp(fg, tg, t))
  const rb = Math.round(lerp(fb, tb, t))
  return (rr << 16) | (rg << 8) | rb
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function BackgroundCanvas({ bgType = 'stars', style, beatRef: _beatRef = null, bpm = 120, comboStreak = 0, useVanta = false, vantaType = null, vantaOptions = null, synesthesiaEnabled = true }) {
  const canvasRef = useRef(null)
  const vantaElRef = useRef(null)
  const vantaInstRef = useRef(null)
  const sceneRef = useRef(null)
  const vantaBaseRef = useRef({})
  const synRef = useRef({ impact: 0, spin: 0, clear: 0, drop: 0 })
  const clearBurstRef = useRef({ pending: 0, power: 0 })
  const comboBoostRef = useRef(0)
  const prevComboRef = useRef(0)
  const customImgRef = useRef(null)
  const lastUrlRef = useRef('')
  const nyanImgRef = useRef(null)
  const [renderQuality, setRenderQuality] = useState(() => readRenderQuality())
  const [selectedEffects, setSelectedEffects] = useState(() => {
    try {
      const arr = JSON.parse(localStorage.getItem('selectedEffects') || '[]')
      return Array.isArray(arr) ? arr : []
    } catch {
      return []
    }
  })

  const profile = useMemo(() => getBackgroundProfile(bgType), [bgType])
  const lowEndMode = useMemo(() => renderQuality === 'performance' || detectLowEndDevice(), [renderQuality])
  const particleDensityScale = lowEndMode ? 0.5 : 1
  const parallaxStrength = profile?.parallax ?? 7
  const px = useMotionValue(0)
  const py = useMotionValue(0)
  const springX = useSpring(px, { stiffness: 60, damping: 18, mass: 1.2 })
  const springY = useSpring(py, { stiffness: 60, damping: 18, mass: 1.2 })

  useEffect(() => {
    const onStorage = (ev) => {
      if (ev.key === 'selectedEffects') {
        try {
          const arr = JSON.parse(localStorage.getItem('selectedEffects') || '[]')
          setSelectedEffects(Array.isArray(arr) ? arr : [])
        } catch {
          setSelectedEffects([])
        }
      }
      if (ev.key === 'tetris-config') {
        setRenderQuality(readRenderQuality())
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useEffect(() => {
    const nextCombo = Math.max(0, Number(comboStreak) || 0)
    const prevCombo = prevComboRef.current
    if (nextCombo > 1 && nextCombo > prevCombo) {
      const growthBoost = 0.06 + Math.min(0.24, (nextCombo - prevCombo) * 0.08)
      const streakBonus = Math.min(0.38, nextCombo * 0.03)
      comboBoostRef.current = clamp(comboBoostRef.current + growthBoost + streakBonus, 0, 1.25)
    }
    prevComboRef.current = nextCombo
  }, [comboStreak])

  useEffect(() => {
    const onMouseMove = (ev) => {
      const w = window.innerWidth || 1
      const h = window.innerHeight || 1
      const nx = (ev.clientX / w - 0.5) * 2
      const ny = (ev.clientY / h - 0.5) * 2
      px.set(-nx * parallaxStrength)
      py.set(-ny * parallaxStrength * 0.7)
    }
    const onOrientation = (ev) => {
      const gamma = clamp(Number(ev.gamma || 0), -35, 35)
      const beta = clamp(Number(ev.beta || 0), -35, 35)
      px.set(-(gamma / 35) * parallaxStrength)
      py.set(-(beta / 35) * parallaxStrength * 0.6)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('deviceorientation', onOrientation)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('deviceorientation', onOrientation)
    }
  }, [parallaxStrength, px, py])

  // Determine active Vanta type: explicit prop > bgType auto-map > null (canvas)
  const autoCfg = BGTYPE_VANTA_CONFIG[bgType] || null
  const preferCanvas = Boolean(profile?.preferCanvas)
  const activeType = (useVanta && vantaType)
    ? vantaType
    : (preferCanvas ? null : (autoCfg?.type ?? null))
  // Build merged options for Vanta (strip 'type' key from autoCfg before merging)
  let activeOpts = {}
  if (activeType) {
    if (autoCfg) { const { type: _t, ...rest } = autoCfg; activeOpts = rest }
    if (useVanta && vantaType && vantaOptions) Object.assign(activeOpts, vantaOptions)
  }

  // Vanta initialization — runs whenever activeType or bgType changes
  useEffect(() => {
    if (!activeType || !vantaElRef.current) return
    let disposed = false
    // Cleanup any existing instance
    try { vantaInstRef.current?.destroy?.() } catch {}
    vantaInstRef.current = null
    ;(async () => {
      try {
        // Load THREE (cached by browser module system)
        const threeModule = await import('three')
        const THREE = threeModule.default || threeModule
        // Load Vanta effect factory (cached in module-level map)
        if (!_vantaModCache[activeType]) {
          let mod
          if (activeType === 'waves') mod = await import('vanta/dist/vanta.waves.min')
          else if (activeType === 'cells') mod = await import('vanta/dist/vanta.cells.min')
          else if (activeType === 'net')   mod = await import('vanta/dist/vanta.net.min')
          else if (activeType === 'clouds') mod = await import('vanta/dist/vanta.clouds.min')
          else if (activeType === 'birds')  mod = await import('vanta/dist/vanta.birds.min')
          else if (activeType === 'halo')   mod = await import('vanta/dist/vanta.halo.min')
          else if (activeType === 'fog')    mod = await import('vanta/dist/vanta.fog.min')
          else if (activeType === 'dots')   mod = await import('vanta/dist/vanta.dots.min')
          if (mod) _vantaModCache[activeType] = mod.default || mod
        }
        const VANTA = _vantaModCache[activeType]
        if (!VANTA || disposed || !vantaElRef.current) return
        vantaInstRef.current = VANTA({
          el: vantaElRef.current,
          THREE,
          mouseControls: false,
          touchControls: false,
          gyroControls: false,
          minHeight: 200,
          minWidth: 200,
          scale: 1.0,
          scaleMobile: 1.0,
          ...activeOpts,
        })
        vantaBaseRef.current = {
          ...activeOpts,
          speed: activeOpts.speed ?? 1.0,
          zoom: activeOpts.zoom ?? 1.0,
          amplitude: activeOpts.amplitude ?? 1.0,
          maxDistance: activeOpts.maxDistance ?? 18,
          spacing: activeOpts.spacing ?? 18,
          size: activeOpts.size ?? 1.2,
          waveHeight: activeOpts.waveHeight ?? 20,
          waveSpeed: activeOpts.waveSpeed ?? 1.0,
          color: activeOpts.color,
          color1: activeOpts.color1,
          color2: activeOpts.color2,
          highlightColor: activeOpts.highlightColor,
          cloudColor: activeOpts.cloudColor,
        }
      } catch (e) { console.warn('[BackgroundCanvas] Vanta error:', e) }
    })()
    return () => {
      disposed = true
      try { vantaInstRef.current?.destroy?.() } catch {}
      vantaInstRef.current = null
      vantaBaseRef.current = {}
      synRef.current = { impact: 0, spin: 0, clear: 0, drop: 0 }
      clearBurstRef.current = { pending: 0, power: 0 }
    }
  }, [activeType, bgType]) // eslint-disable-line react-hooks/exhaustive-deps

  const onSynesthesiaEvent = useCallback((evt) => {
    if (!synesthesiaEnabled || !evt?.type) return
    const lines = Math.max(0, Number(evt?.payload?.lines || 0))
    const intensity = Math.max(0, Number(evt?.payload?.intensity || 1))
    const burst = clearBurstRef.current
    const s = synRef.current
    switch (evt.type) {
      case SYNESTHESIA_EVENT.MOVE:
        s.impact = clamp(s.impact + 0.08, 0, 1.5)
        break
      case SYNESTHESIA_EVENT.ROTATE:
        s.spin = clamp(s.spin + 0.2, 0, 1.7)
        s.impact = clamp(s.impact + 0.05, 0, 1.5)
        break
      case SYNESTHESIA_EVENT.SOFT_DROP:
        s.drop = clamp(s.drop + 0.1, 0, 1.2)
        break
      case SYNESTHESIA_EVENT.HARD_DROP:
        s.impact = clamp(s.impact + 0.42, 0, 1.9)
        s.drop = clamp(s.drop + 0.28, 0, 1.4)
        break
      case SYNESTHESIA_EVENT.LINE_CLEAR:
        s.clear = clamp(s.clear + 0.5, 0, 1.8)
        s.impact = clamp(s.impact + 0.16, 0, 1.9)
        {
          const clearWeight = lines >= 4 ? 1.45 : lines === 3 ? 0.95 : lines === 2 ? 0.42 : 0.22
          const clearBase = lines >= 4 ? 30 : lines === 3 ? 16 : lines === 2 ? 7 : 3
          const gain = Math.round(clearBase * (0.7 + intensity * 0.28) * clearWeight)
          const powerTarget = lines >= 4
            ? 1.65 + intensity * 0.2
            : lines === 3
              ? 1.02 + intensity * 0.14
              : lines === 2
                ? 0.5 + intensity * 0.08
                : 0.3 + intensity * 0.05
          burst.pending = clamp(burst.pending + gain, 0, 340)
          burst.power = clamp(Math.max(burst.power, powerTarget), 0, 2.35)
        }
        break
      case SYNESTHESIA_EVENT.T_SPIN:
        s.clear = clamp(s.clear + 0.64, 0, 1.95)
        s.spin = clamp(s.spin + 0.35, 0, 1.95)
        s.impact = clamp(s.impact + 0.22, 0, 1.95)
        {
          const spinLines = Math.max(lines, 1)
          const tSpinScale = spinLines >= 3 ? 1.45 : spinLines === 2 ? 1.22 : 1.0
          const gain = Math.round((26 + spinLines * 14) * (0.9 + intensity * 0.42) * tSpinScale)
          const powerTarget = 1.25 + spinLines * 0.28 + intensity * 0.16
          burst.pending = clamp(burst.pending + gain, 0, 420)
          burst.power = clamp(Math.max(burst.power, powerTarget), 0, 2.8)
        }
        break
      default:
        break
    }
  }, [synesthesiaEnabled])

  useSynesthesiaEvent(onSynesthesiaEvent)

  // Continuous tempo + synesthesia sync for Vanta (music beat + input/clear pulses)
  useEffect(() => {
    if (!activeType || !vantaInstRef.current) return
    let raf = 0
    const loop = () => {
      const beat = Math.max(0, Math.min(1.2, Number(_beatRef?.current || 0)))
      const b = Math.max(40, Math.min(260, Number(bpm) || 120))
      const t = performance.now() / 1000
      const bpmPulse = Math.pow((Math.sin(t * (b / 60) * Math.PI * 2) + 1) / 2, 2)
      const s = synRef.current
      s.impact *= 0.905
      s.spin *= 0.9
      s.clear *= 0.892
      s.drop *= 0.9
      const synEnergy = clamp(s.impact * 0.58 + s.spin * 0.48 + s.clear * 0.9 + s.drop * 0.35, 0, 1.5)
      comboBoostRef.current *= 0.94
      const comboPulse = clamp(comboBoostRef.current, 0, 1.1)
      const energy = Math.min(2.3, Math.max(beat, bpmPulse * 0.65) + synEnergy * 0.72 + comboPulse * 0.9)
      const base = vantaBaseRef.current
      try {
        const nextOpts = {}
        if (activeType === 'net') {
          nextOpts.maxDistance = (base.maxDistance ?? 18) + energy * 7.5 + s.clear * 9
          nextOpts.spacing = Math.max(8, (base.spacing ?? 18) - s.clear * 1.6)
          if (typeof base.color === 'number') {
            nextOpts.color = lerpHex(base.color, 0x66f8ff, clamp(s.clear * 0.5 + s.spin * 0.35, 0, 0.6))
          }
        } else if (activeType === 'waves') {
          nextOpts.speed = (base.speed ?? 1.0) * (1 + energy * 0.32 + s.drop * 0.26)
          nextOpts.waveSpeed = (base.waveSpeed ?? 1.0) * (1 + s.drop * 0.35)
          nextOpts.waveHeight = (base.waveHeight ?? 20) * (1 + s.impact * 0.22 + s.clear * 0.11)
          nextOpts.zoom = (base.zoom ?? 1.0) * (1 - s.clear * 0.04)
          if (typeof base.color === 'number') {
            nextOpts.color = lerpHex(base.color, 0x8ffbff, clamp(s.clear * 0.45 + s.drop * 0.18, 0, 0.5))
          }
        } else if (activeType === 'clouds' || activeType === 'fog') {
          nextOpts.speed = (base.speed ?? 1.0) * (1 + energy * 0.42)
          nextOpts.zoom = (base.zoom ?? 1.0) * (1 + s.clear * 0.06 - s.drop * 0.03)
          if (activeType === 'clouds' && typeof base.cloudColor === 'number') {
            nextOpts.cloudColor = lerpHex(base.cloudColor, 0x9ef8ff, clamp(s.clear * 0.42 + s.spin * 0.16, 0, 0.55))
          }
          if (activeType === 'fog' && typeof base.highlightColor === 'number') {
            nextOpts.highlightColor = lerpHex(base.highlightColor, 0xfff3b2, clamp(s.clear * 0.5 + s.spin * 0.2, 0, 0.6))
          }
        } else if (activeType === 'halo') {
          nextOpts.amplitude = (base.amplitude ?? 1.0) * (1 + energy * 0.56 + s.spin * 0.18)
          nextOpts.size = (base.size ?? 1.2) * (1 + s.clear * 0.08)
          if (typeof base.color === 'number') {
            nextOpts.color = lerpHex(base.color, 0xfff1ba, clamp(s.clear * 0.48 + s.spin * 0.2, 0, 0.65))
          }
        } else if (activeType === 'cells' || activeType === 'dots' || activeType === 'birds') {
          nextOpts.speed = (base.speed ?? 1.0) * (1 + energy * 0.38)
          nextOpts.size = (base.size ?? 1.2) * (1 + s.spin * 0.08 + s.clear * 0.05)
          if (typeof base.color1 === 'number') {
            nextOpts.color1 = lerpHex(base.color1, 0xb6e8ff, clamp(s.clear * 0.35 + s.spin * 0.24, 0, 0.45))
          }
          if (typeof base.color2 === 'number') {
            nextOpts.color2 = lerpHex(base.color2, 0xffffff, clamp(s.clear * 0.32, 0, 0.38))
          }
        }
        if (Object.keys(nextOpts).length) vantaInstRef.current.setOptions(nextOpts)
      } catch {}
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [activeType, bpm, _beatRef])

  // Keep legacy beat pulses compatible with existing music hooks.
  useEffect(() => {
    const onBeat = () => {
      synRef.current.impact = clamp(synRef.current.impact + 0.16, 0, 1.6)
    }
    window.addEventListener('bg-beat', onBeat)
    return () => window.removeEventListener('bg-beat', onBeat)
  }, [])

  useEffect(() => {
    // Load/refresh custom image when bgType is 'custom'
    if (bgType === 'custom') {
      try {
        const url = localStorage.getItem('custom-bg-url') || ''
        if (url && url !== lastUrlRef.current) {
          const img = new Image()
          img.crossOrigin = 'anonymous'
          img.src = url
          img.onload = () => { customImgRef.current = img }
          customImgRef.current = img
          lastUrlRef.current = url
        }
      } catch {}
    }
    if (activeType) return // Vanta handles rendering
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
      particles = createParticles(bgType, canvas.width, canvas.height, particleDensityScale)
    }
    resize()
    window.addEventListener('resize', resize)

    const tick = (now) => {
      const baseDt = Math.min(now-lastTime, 50)
      lastTime = now
      const t = now-startTime
      const beat = Math.max(0, Math.min(1.25, Number(_beatRef?.current || 0)))
      const b = Math.max(40, Math.min(260, Number(bpm) || 120))
      const bpmPulse = Math.pow((Math.sin((now / 1000) * (b / 60) * Math.PI * 2) + 1) / 2, 2)
      comboBoostRef.current *= Math.pow(0.94, baseDt / 16)
      const comboPulse = clamp(comboBoostRef.current, 0, 1.1)
      const energy = Math.min(2.2, Math.max(beat, bpmPulse * 0.65) + comboPulse * 0.9)
      const dt = baseDt * (0.9 + energy * 0.6)
      const w = canvas.width, hh = canvas.height

      const burst = clearBurstRef.current
      if (burst.pending > 0 && particles.length > 0) {
        const burstPower = clamp(burst.power, 0.2, 2.8)
        const baseBudget = particleDensityScale < 1 ? 8 : 14
        const spawnBudget = Math.max(3, Math.round((baseBudget + burstPower * 5) * (baseDt / 16)))
        const spawnNow = Math.min(burst.pending, spawnBudget)
        const power = burstPower
        for (let i = 0; i < spawnNow; i++) {
          const p = makeParticle(bgType, w, hh, false)
          p.x = w * (0.2 + Math.random() * 0.6)
          p.y = hh * (0.2 + Math.random() * 0.65)
          if (typeof p.vx === 'number') p.vx = p.vx * (1.2 + power * 0.45) + (Math.random() - 0.5) * (1.1 + power * 1.3)
          if (typeof p.vy === 'number') p.vy = p.vy * (1.15 + power * 0.35) - Math.random() * (0.7 + power * 1.2)
          if (typeof p.life === 'number') p.life = Math.min(1.25, Math.max(0.72, p.life + 0.2))
          if (typeof p.decay === 'number' && p.decay > 0) p.decay *= 0.84
          particles[(Math.random() * particles.length) | 0] = p
        }
        burst.pending = Math.max(0, burst.pending - spawnNow)
      }
      burst.power *= Math.pow(0.9, baseDt / 16)

      ctx.globalAlpha = 1
      ctx.fillStyle = BG_BASE[bgType] || '#000'
      ctx.fillRect(0,0,w,hh)

      // Special: Nyancat background — rainbow diagonals + cat sprite
      if (bgType === 'nyancat') {
        // Rainbow bands moving diagonally
        const bands = ['#ff0000','#ff7f00','#ffff00','#00ff00','#0000ff','#4b0082','#8f00ff']
        const speed = 0.08
        const off = (t*speed) % 40
        ctx.save()
        ctx.globalAlpha = 0.9
        for (let i= -w; i < w*2; i += 40) {
          const x = i - off
          for (let b=0;b<bands.length;b++) {
            ctx.fillStyle = bands[b]
            ctx.fillRect(x + b*5, 0, 5, hh)
          }
        }
        ctx.globalAlpha = 1
        ctx.restore()
        // Small cat sprite gliding with gentle bob
        if (!nyanImgRef.current) { const img = new Image(); img.src = catImageUrl; nyanImgRef.current = img }
        const img = nyanImgRef.current
        if (img && img.complete) {
          const pathY = hh*0.4 + Math.sin(t*0.0013)*hh*0.05
          const pathX = (t*0.12) % (w+120) - 120
          const iw = 96, ih = 96
          try { ctx.drawImage(img, 0, 0, img.width, img.height, pathX, pathY, iw, ih) } catch {}
        }
      }

      // Draw custom image layer (cover) if available
      if (bgType === 'custom' && customImgRef.current && customImgRef.current.complete) {
        try {
          const img = customImgRef.current
          const iw = img.naturalWidth || img.width
          const ih = img.naturalHeight || img.height
          if (iw && ih) {
            const scale = Math.max(w/iw, hh/ih)
            const dw = iw*scale, dh = ih*scale
            const dx = (w - dw)/2, dy = (hh - dh)/2
            ctx.globalAlpha = 0.96
            ctx.drawImage(img, dx, dy, dw, dh)
            ctx.globalAlpha = 1
          }
        } catch {}
      }

      if (bgType !== 'nyancat' && bgType !== 'custom') {
        ctx.globalAlpha = 1
        drawAmbient(ctx, bgType, w, hh, t)
        ctx.globalAlpha = 1
        for (let i=particles.length-1;i>=0;i--) {
          const dead = updateParticle(particles[i], bgType, w, hh, dt)
          if (dead) particles[i] = makeParticle(bgType, w, hh, false)
          drawParticle(ctx, particles[i], bgType, w, hh, energy)
        }
        ctx.globalAlpha = 1
        drawForeground(ctx, bgType, w, hh, t, energy)
      }

      ctx.globalAlpha = 1
      animId = requestAnimationFrame(tick)
    }
    animId = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize) }
  }, [bgType, activeType, bpm, _beatRef, particleDensityScale])

  const scanlinesOn = selectedEffects.includes('effect_retro_crt')
  const fluidFogOn = profile?.category === 'fluid'
  const heatHazeOn = profile?.category === 'aggressive'

  const sceneClassName = ['bg-scene', profile?.cssClass || 'bg-theme-default'].join(' ')

  return (
    <motion.div
      ref={sceneRef}
      className={sceneClassName}
      style={{ x: springX, y: springY, ...style }}
    >
      <div className="bg-visual">
        <div ref={vantaElRef} className="bg-layer" style={{ display: activeType ? 'block' : 'none' }} />
        <canvas ref={canvasRef} className="bg-layer" style={{ display: activeType ? 'none' : 'block' }} />
      </div>
      {fluidFogOn && <div className="bg-overlay bg-depth-fog" />}
      {heatHazeOn && <div className="bg-overlay bg-heat-haze-layer" />}
      <div className="bg-overlay bg-vignette" />
      <div className="bg-overlay bg-grain" />
      <div className={`bg-overlay bg-scanlines${scanlinesOn ? ' is-on' : ''}`} />
    </motion.div>
  )
}
