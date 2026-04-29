import { useEffect, useRef, useState } from 'react'

const INSTALL_SCRIPTS = [
  {
    lang: 'python',
    lines: [
      { text: '$ pip install tetra-overflow', delay: 0, type: 'cmd' },
      { text: 'Collecting tetra-overflow...', delay: 600, type: 'out' },
      { text: 'Downloading tetra_overflow-∞.0.0-py3-none-any.whl (3.1 MB)', delay: 900, type: 'out' },
      { text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  3.1/3.1 MB 12.4 MB/s', delay: 1300, type: 'progress' },
      { text: 'Successfully installed tetra-overflow-∞.0.0', delay: 1700, type: 'success' },
      { text: '$ _', delay: 2000, type: 'cursor' },
    ],
  },
  {
    lang: 'go',
    lines: [
      { text: '$ go get github.com/tetra-overflow/ultra', delay: 0, type: 'cmd' },
      { text: 'go: downloading tetra-overflow v∞.0.0', delay: 700, type: 'out' },
      { text: 'go: added tetra-overflow v∞.0.0', delay: 1100, type: 'out' },
      { text: 'go: adding module requirements to go.mod', delay: 1400, type: 'out' },
      { text: '✓ Build successful. Have fun.', delay: 1800, type: 'success' },
      { text: '$ _', delay: 2100, type: 'cursor' },
    ],
  },
]

export default function LoadingScreen({ onDone }) {
  const [visibleLines, setVisibleLines] = useState([])
  const [exiting, setExiting] = useState(false)
  const script = useRef(INSTALL_SCRIPTS[Math.floor(Math.random() * INSTALL_SCRIPTS.length)])
  const doneRef  = useRef(false)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    const timers = []
    const s = script.current

    s.lines.forEach((line) => {
      timers.push(setTimeout(() => {
        setVisibleLines(prev => [...prev, line])
      }, line.delay))
    })

    // exit shortly after last line
    const lastDelay = s.lines[s.lines.length - 1].delay + 700
    timers.push(setTimeout(() => {
      if (doneRef.current) return
      setExiting(true)
      setTimeout(() => {
        doneRef.current = true
        onDoneRef.current?.()
      }, 420)
    }, lastDelay))

    return () => timers.forEach(clearTimeout)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])  // run once on mount only

  return (
    <div className={`loading-screen${exiting ? ' loading-exit' : ''}`}>
      <div className="loading-inner">
        <div className="terminal-window">
          <div className="terminal-titlebar">
            <span className="tb-dot tb-red" />
            <span className="tb-dot tb-yellow" />
            <span className="tb-dot tb-green" />
            <span className="tb-title">~ /tetra-overflow</span>
          </div>
          <div className="terminal-body">
            {visibleLines.map((line, i) => (
              <div
                key={i}
                className={`tl tl-${line.type}`}
                style={{ animationDelay: '0ms' }}
              >
                {line.text}
              </div>
            ))}
          </div>
        </div>
        <div className="loading-app-name">
          TETRA <span className="lname-overflow">OVERFLOW</span>
          <sup className="lname-ultra">Ultra</sup>
        </div>
      </div>
    </div>
  )
}
