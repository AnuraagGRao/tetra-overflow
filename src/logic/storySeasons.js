import { isDevMode } from './devMode'
import { ophiuchusBeaten } from './storyData_s2'
import { isS3Complete, isS3Unlocked } from './storyData_s3'
import { isS4Complete, isS4Unlocked } from './storyData_s4'
import { isPantheonUnlocked, isS5Complete } from './storyData_s5'

const SEASON_METADATA = [
  {
    id: 's1',
    number: 1,
    title: 'THE JOURNEY',
    subtitle: 'Awakening in the Matrix',
    glyph: '◇',
    color: '#00d4ff',
    route: '/s1',
  },
  {
    id: 's2',
    number: 2,
    title: 'THE ZODIAC ARC',
    subtitle: 'Thirteen seals in the stars',
    glyph: '✦',
    color: '#a855f7',
    route: '/s2',
  },
  {
    id: 's3',
    number: 3,
    title: 'TEMPORAL FRACTURE',
    subtitle: 'War across broken time',
    glyph: '⌛',
    color: '#f59e0b',
    route: '/s3',
  },
  {
    id: 's4',
    number: 4,
    title: 'THE GENESIS PROTOCOL',
    subtitle: 'Rewrite the newborn universe',
    glyph: '⌘',
    color: '#22d3ee',
    route: '/s4',
  },
  {
    id: 's5',
    number: 5,
    title: 'THE PANTHEON ARC',
    subtitle: 'Eleven thrones await judgment',
    glyph: 'Ω',
    color: '#f0c96a',
    route: '/s5',
  },
  {
    id: 's6',
    number: 6,
    title: 'CLASSIFIED',
    subtitle: 'A signal is forming beyond the Pantheon',
    glyph: '△',
    color: '#7dd3fc',
    route: null,
    comingSoon: true,
  },
]

export function getStorySeasons(progress = {}) {
  const season2Unlocked = isDevMode() || !!progress.ch8_l1_completed
  const states = {
    s1: { unlocked: true, complete: !!progress.ch8_l1_completed },
    s2: { unlocked: season2Unlocked, complete: ophiuchusBeaten(progress) },
    s3: { unlocked: isS3Unlocked(progress), complete: isS3Complete(progress) },
    s4: { unlocked: isS4Unlocked(progress), complete: isS4Complete(progress) },
    s5: { unlocked: isPantheonUnlocked(progress), complete: isS5Complete(progress) },
    s6: { unlocked: isS5Complete(progress), complete: false },
  }

  return SEASON_METADATA.map(season => ({ ...season, ...states[season.id] }))
}

export function getLatestUnlockedStorySeason(progress = {}) {
  const seasons = getStorySeasons(progress)
  return [...seasons].reverse().find(season => season.unlocked && !season.comingSoon) ?? seasons[0]
}
