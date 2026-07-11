/**
 * StoryMapHUD - Unified navigation and controls for all Story Mode season maps
 * 
 * Provides consistent:
 * - Global header with HOME, title, and progress
 * - Season navigation (previous/next) on left/right edges
 * - Map controls (zoom, reset) in bottom-right corner
 */

import { motion } from 'framer-motion'
import homeIconUrl from '../icons/home-button.png'

export default function StoryMapHUD({
  // Navigation
  onHome = () => {},
  onPreviousSeason = null, // null = no previous season
  onNextSeason = null,     // null = next season not unlocked/available
  previousSeasonName = '',
  nextSeasonName = '',
  
  // Header content
  seasonTitle = 'SEASON 1',
  seasonSubtitle = 'The Journey Begins',
  seasonColor = '#00d4ff',
  currentProgress = 0,  // completed levels
  totalProgress = 0,    // total levels in season
  
  // Map controls
  onZoomIn = () => {},
  onZoomOut = () => {},
  onResetView = () => {},
  currentZoom = 1.0,
  
  // Content
  children, // Map canvas goes here
}) {
  const progressText = totalProgress > 0 ? `${currentProgress}/${totalProgress}` : ''
  const progressPercent = totalProgress > 0 ? (currentProgress / totalProgress) * 100 : 0
  const isComplete = currentProgress >= totalProgress && totalProgress > 0
  
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100dvh',
        minHeight: '100dvh',
        overflow: 'hidden',
        background: '#000000',
      }}
    >
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* GLOBAL HEADER — Floating, transparent */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          padding: 'clamp(12px, 2vh, 20px) clamp(16px, 3vw, 32px)',
          background: 'linear-gradient(180deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)',
          backdropFilter: 'blur(8px)',
          gap: 16,
        }}
      >
        {/* Left: HOME button */}
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onHome}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.18)',
              borderRadius: 8,
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              fontFamily: 'inherit',
              color: '#fff',
              fontSize: 'clamp(0.65rem, 1.8vw, 0.8rem)',
              letterSpacing: '0.1em',
              fontWeight: 600,
              transition: 'all 0.2s',
            }}
            title="Return to Story Mode Hub"
          >
            <img src={homeIconUrl} alt="" style={{ width: 18, height: 18, objectFit: 'contain', opacity: 0.9 }} />
            <span>MENU</span>
          </motion.button>
        </div>

        {/* Center: Season Title & Subtitle */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            minWidth: 0, // Allow text truncation
          }}
        >
          <div
            style={{
              fontSize: 'clamp(0.5rem, 1.5vw, 0.65rem)',
              color: seasonColor,
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              opacity: 0.8,
              textAlign: 'center',
              whiteSpace: 'nowrap',
            }}
          >
            {seasonTitle}
          </div>
          <div
            style={{
              fontSize: 'clamp(0.9rem, 2.5vw, 1.3rem)',
              fontWeight: 900,
              letterSpacing: '0.12em',
              color: '#fff',
              textAlign: 'center',
              whiteSpace: 'nowrap',
              textShadow: `0 0 20px ${seasonColor}88`,
            }}
          >
            {seasonSubtitle}
          </div>
        </div>

        {/* Right: Progress indicator */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10 }}>
          {totalProgress > 0 && (
            <>
              <div
                style={{
                  fontSize: 'clamp(0.75rem, 2vw, 1rem)',
                  fontWeight: 700,
                  color: isComplete ? seasonColor : '#fff',
                  letterSpacing: '0.08em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {isComplete && <span style={{ fontSize: '1.2em' }}>✦</span>}
                <span>{progressText}</span>
              </div>
              {/* Mini progress bar */}
              <div
                style={{
                  width: 'clamp(40px, 8vw, 60px)',
                  height: 4,
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: 2,
                  overflow: 'hidden',
                }}
              >
                <motion.div
                  style={{
                    height: '100%',
                    background: isComplete ? seasonColor : `${seasonColor}aa`,
                    borderRadius: 2,
                  }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SEASON NAVIGATION — Left & Right edges */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      
      {/* Left: Previous Season */}
      {onPreviousSeason && (
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          whileHover={{ scale: 1.05, x: 5 }}
          whileTap={{ scale: 0.95 }}
          onClick={onPreviousSeason}
          style={{
            position: 'absolute',
            left: 'clamp(12px, 2vw, 24px)',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 95,
            background: 'rgba(0,0,0,0.85)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 10,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            cursor: 'pointer',
            fontFamily: 'inherit',
            color: '#fff',
            fontSize: 'clamp(0.6rem, 1.5vw, 0.75rem)',
            letterSpacing: '0.12em',
            fontWeight: 600,
            backdropFilter: 'blur(12px)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            transition: 'all 0.2s',
          }}
          title={`Go to ${previousSeasonName}`}
        >
          <span style={{ fontSize: '1.2em' }}>←</span>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
            <span style={{ fontSize: '0.85em', opacity: 0.6, textTransform: 'uppercase' }}>Previous</span>
            <span style={{ whiteSpace: 'nowrap' }}>{previousSeasonName}</span>
          </div>
        </motion.button>
      )}

      {/* Right: Next Season */}
      {onNextSeason && (
        <motion.button
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          whileHover={{ scale: 1.05, x: -5 }}
          whileTap={{ scale: 0.95 }}
          onClick={onNextSeason}
          disabled={!isComplete}
          style={{
            position: 'absolute',
            right: 'clamp(12px, 2vw, 24px)',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 95,
            background: isComplete ? 'rgba(0,212,255,0.15)' : 'rgba(0,0,0,0.7)',
            border: `1px solid ${isComplete ? 'rgba(0,212,255,0.4)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: 10,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            cursor: isComplete ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit',
            color: isComplete ? '#00d4ff' : '#555',
            fontSize: 'clamp(0.6rem, 1.5vw, 0.75rem)',
            letterSpacing: '0.12em',
            fontWeight: 600,
            backdropFilter: 'blur(12px)',
            boxShadow: isComplete ? '0 4px 20px rgba(0,212,255,0.3)' : '0 4px 20px rgba(0,0,0,0.5)',
            transition: 'all 0.2s',
            opacity: isComplete ? 1 : 0.5,
          }}
          title={isComplete ? `Go to ${nextSeasonName}` : `Complete ${seasonTitle} to unlock`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
            <span style={{ fontSize: '0.85em', opacity: 0.6, textTransform: 'uppercase' }}>Next</span>
            <span style={{ whiteSpace: 'nowrap' }}>{nextSeasonName}</span>
          </div>
          <span style={{ fontSize: '1.2em' }}>→</span>
        </motion.button>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MAP CONTROLS — Bottom-right corner */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div
        style={{
          position: 'absolute',
          bottom: 'clamp(16px, 3vh, 32px)',
          right: 'clamp(16px, 3vw, 32px)',
          zIndex: 90,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          background: 'rgba(0,0,0,0.75)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 10,
          padding: 10,
          backdropFilter: 'blur(10px)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
        }}
      >
        {/* Zoom In */}
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={onZoomIn}
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 6,
            width: 40,
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontFamily: 'inherit',
            color: '#fff',
            fontSize: '1.2rem',
            fontWeight: 700,
            transition: 'all 0.15s',
          }}
          title="Zoom In"
        >
          +
        </motion.button>

        {/* Zoom level indicator */}
        <div
          style={{
            fontSize: '0.55rem',
            color: '#888',
            textAlign: 'center',
            letterSpacing: '0.06em',
            fontWeight: 600,
          }}
        >
          {Math.round(currentZoom * 100)}%
        </div>

        {/* Zoom Out */}
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={onZoomOut}
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 6,
            width: 40,
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontFamily: 'inherit',
            color: '#fff',
            fontSize: '1.2rem',
            fontWeight: 700,
            transition: 'all 0.15s',
          }}
          title="Zoom Out"
        >
          −
        </motion.button>

        {/* Reset View */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onResetView}
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 6,
            padding: '6px 8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontFamily: 'inherit',
            color: '#aaa',
            fontSize: '0.55rem',
            letterSpacing: '0.1em',
            fontWeight: 600,
            textTransform: 'uppercase',
            transition: 'all 0.15s',
            marginTop: 4,
          }}
          title="Reset View"
        >
          Reset
        </motion.button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MAP CANVAS — Render area */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  )
}
