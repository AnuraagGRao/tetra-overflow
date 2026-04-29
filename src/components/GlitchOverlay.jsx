import { useEffect, useRef, useState } from 'react'

// Code snippet pool — Python tracebacks and Go error logs
const SNIPPETS = [
  // Python tracebacks
  `Traceback (most recent call last):
  File "game.py", line 42, in <module>
    engine.tick()
  File "engine.py", line 108, in tick
    self._spawn_piece()
BlockOverflowError: board capacity exceeded`,

  `Traceback (most recent call last):
  File "tetra.py", line 7, in run
    while not board.is_full():
RecursionError: maximum recursion depth exceeded
  (board depth: ∞)`,

  `Warning: MemoryError in zone_buffer
  at tetra/zone.py:224
  ZoneBuffer overflow — clearing stack
  ... 19 more frames`,

  `RuntimeWarning: divide by zero encountered in gravity_calc
  gravity = (level ** 2) / remaining_rows
  ZeroDivisionError: remaining_rows = 0`,

  `AssertionError: piece spawn position (4, -1) is out of bounds
  assert 0 <= y < BOARD_HEIGHT
  BOARD_HEIGHT = 20, y = -1`,

  // Go error logs
`panic: runtime error: index out of range [20] with length 20

goroutine 1 [running]:
tetra/engine.(*Board).SpawnPiece(...)
        engine/board.go:88 +0x144
exit status 2`,

`go: tetra-overflow/ultra: build failed
./engine/zone.go:42:18: undefined: ZoneMeter
./engine/zone.go:55:9: cannot use ∞ (type float64)
        as type int in assignment`,

`2026/04/29 03:14:59 FATAL board.go:201:
  board stack overflow at row 0
  goroutine stack trace:
  tetra.(*Engine).tick +0x2c8
  tetra.(*Engine).loop +0x174`,

`panic: assignment to entry in nil map
  piece.cells[y][x] = block  // y=-1
goroutine 7 [chan receive]:
tetra/engine.go:317 +0x4a1`,

`go: finding module for package tetra-overflow/ultra
go: downloading tetra-overflow ∞.0.0
go: FAIL — gravity function returned NaN`,
]

const COLORS = [
  'rgba(255, 70, 70, 0.50)',
  'rgba(255, 120, 50, 0.45)',
  'rgba(200, 80, 255, 0.45)',
  'rgba(255, 60, 120, 0.42)',
  'rgba(80,  200, 255, 0.30)',
]

function randomBetween(a, b) {
  return a + Math.random() * (b - a)
}

export default function GlitchOverlay({ active }) {
  const [pieces, setPieces] = useState([])
  const counterRef = useRef(0)
  const timerRef = useRef(null)

  useEffect(() => {
    if (!active) {
      setPieces([])
      clearInterval(timerRef.current)
      return
    }

    const spawnOne = () => {
      const id = counterRef.current++
      const snippet = SNIPPETS[Math.floor(Math.random() * SNIPPETS.length)]
      const x = randomBetween(2, 70)  // % from left
      const y = randomBetween(10, 80) // % from top
      const dur = randomBetween(3.5, 6.5)
      const delay = randomBetween(0, 0.4)
      const color = COLORS[Math.floor(Math.random() * COLORS.length)]

      setPieces(prev => [...prev.slice(-6), { id, snippet, x, y, dur, delay, color }])
    }

    spawnOne()
    timerRef.current = setInterval(spawnOne, 1400)
    return () => clearInterval(timerRef.current)
  }, [active])

  if (!active || pieces.length === 0) return null

  return (
    <div className="glitch-overlay">
      {pieces.map(p => (
        <div
          key={p.id}
          className="glitch-snippet"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            '--dur': `${p.dur}s`,
            '--delay': `${p.delay}s`,
            '--gc': p.color,
          }}
        >
          {p.snippet}
        </div>
      ))}
    </div>
  )
}
