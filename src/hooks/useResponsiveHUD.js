/**
 * useResponsiveHUD - Responsive HUD sizing and scaling values
 * 
 * Provides consistent, large, readable HUD text across all screen sizes and orientations.
 * Based on SOLO mode design which has proven to scale excellently.
 */

import { useCallback, useMemo } from 'react'

export function useResponsiveHUD(isLandscape = false) {
  // Detect if on mobile device
  const isMobile = useMemo(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth < 768
  }, [])

  // Calculate responsive values based on viewport and orientation
  const hudValues = useMemo(() => {
    if (!isMobile) {
      // Desktop: Use fixed large sizes from SOLO mode
      return {
        // HUD Bar sizing
        hudPadding: '8px 12px',
        hudFontSize: '0.75rem',
        hudMinHeight: '36px',
        
        // Stats display
        statsLabel: '0.6rem',
        statsValue: '1.35rem',
        statsGap: '0.35rem',
        
        // Zone meter
        zoneSize: '64px',
        
        // Combo/B2B badges
        comboBadge: '1.2rem',
        comboLabel: '0.65rem',
      }
    }

    if (isLandscape) {
      // Mobile Landscape: Use clamp() for fluid scaling
      // Three-panel layout: side panels hold stats/next, center holds canvas
      return {
        // HUD Bar sizing - not used in landscape (replaced with side panels)
        hudPadding: '8px 12px',
        hudFontSize: '0.75rem',
        hudMinHeight: '36px',
        
        // Stats display - scales with viewport
        statsLabel: 'clamp(0.65rem, 1.8vmin, 0.95rem)',
        statsValue: 'clamp(1.1rem, 3.5vmin, 1.6rem)',
        statsGap: 'clamp(0.25rem, 1vh, 0.5rem)',
        
        // Zone meter - adapted for vertical space
        zoneSize: 'clamp(50px, 12vh, 80px)',
        
        // Combo/B2B badges
        comboBadge: 'clamp(0.9rem, 2.5vmin, 1.3rem)',
        comboLabel: 'clamp(0.55rem, 1.5vmin, 0.8rem)',
      }
    }

    // Mobile Portrait: Top HUD bar + bottom panel
    return {
      // Top HUD bar
      hudPadding: '8px 12px',
      hudFontSize: '0.75rem',
      hudMinHeight: '48px',
      
      // Stats in top bar
      statsLabel: '0.55rem',
      statsValue: '1.1rem',
      statsGap: '0.3rem',
      
      // Zone meter - thin bar
      zoneSize: '8px',
      
      // Combo/B2B badges
      comboBadge: '0.95rem',
      comboLabel: '0.6rem',
    }
  }, [isMobile, isLandscape])

  return {
    isMobile,
    isLandscape,
    ...hudValues,
    
    // Helper to merge with existing styles
    mergeHUDStyle: useCallback((baseStyle = {}) => ({
      ...baseStyle,
      fontSize: hudValues.hudFontSize,
      padding: hudValues.hudPadding,
    }), [hudValues]),
  }
}

/**
 * Common SOLO mode HUD values for reference
 * Use these as a baseline for consistent sizing across modes
 */
export const SOLO_HUD_DEFAULTS = {
  // Desktop
  desktop: {
    statsLabel: '0.6rem',
    statsValue: '1.35rem',
    hudMinHeight: '36px',
  },
  
  // Mobile Portrait
  portrait: {
    statsLabel: '0.55rem',
    statsValue: '1.1rem',
    hudMinHeight: '48px',
  },
  
  // Mobile Landscape (uses clamp for scaling)
  landscape: {
    statsLabel: 'clamp(0.65rem, 1.8vmin, 0.95rem)',
    statsValue: 'clamp(1.1rem, 3.5vmin, 1.6rem)',
  },
}
