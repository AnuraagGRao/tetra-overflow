import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'

const INPUT_STYLE = {
  width: '100%', boxSizing: 'border-box',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8, color: '#fff', padding: '10px 12px',
  fontSize: '0.88rem', fontFamily: 'inherit', outline: 'none',
  transition: 'border-color 0.2s',
}

const BTN_PRIMARY = {
  width: '100%', padding: '11px', borderRadius: 8, border: 'none',
  background: 'linear-gradient(135deg, #00d4ff, #a855f7)',
  color: '#fff', fontWeight: 700, fontSize: '0.9rem',
  letterSpacing: '0.12em', cursor: 'pointer', fontFamily: 'inherit',
  textTransform: 'uppercase', transition: 'opacity 0.15s',
}

const BTN_SECONDARY = {
  width: '100%', padding: '10px', borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.15)',
  background: 'rgba(255,255,255,0.04)',
  color: '#ccc', fontSize: '0.85rem', cursor: 'pointer',
  fontFamily: 'inherit', letterSpacing: '0.08em', transition: 'border-color 0.2s, background 0.2s',
}

function ErrorBox({ msg }) {
  if (!msg) return null
  return (
    <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid #f87171', borderRadius: 8, padding: '9px 12px', fontSize: '0.8rem', color: '#fca5a5', letterSpacing: '0.04em' }}>
      {msg}
    </div>
  )
}

function TabButton({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: '8px', background: 'none',
        border: 'none', borderBottom: `2px solid ${active ? '#00d4ff' : 'transparent'}`,
        color: active ? '#00d4ff' : '#555', cursor: 'pointer',
        fontSize: '0.8rem', letterSpacing: '0.15em', fontFamily: 'inherit',
        textTransform: 'uppercase', transition: 'all 0.18s',
      }}
    >
      {label}
    </button>
  )
}

// ─── Login form ────────────────────────────────────────────────────────────────
function LoginForm({ onSuccess }) {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setErr(''); setBusy(true)
    try { await signIn(email, pass); onSuccess() }
    catch (ex) { setErr(friendlyError(ex?.code)) }
    finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <ErrorBox msg={err} />
      <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required style={INPUT_STYLE} />
      <input type="password" placeholder="Password" value={pass} onChange={e => setPass(e.target.value)} required style={INPUT_STYLE} />
      <button type="submit" disabled={busy} style={{ ...BTN_PRIMARY, opacity: busy ? 0.6 : 1 }}>
        {busy ? '…' : 'LOG IN'}
      </button>
    </form>
  )
}

// ─── Sign-up form ──────────────────────────────────────────────────────────────
function SignUpForm({ onSuccess }) {
  const { signUp } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (pass.length < 6) { setErr('Password must be at least 6 characters.'); return }
    setErr(''); setBusy(true)
    try { await signUp(email, pass, name || 'Player'); onSuccess() }
    catch (ex) { setErr(friendlyError(ex?.code)) }
    finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <ErrorBox msg={err} />
      <input type="text" placeholder="Display name" value={name} onChange={e => setName(e.target.value)} style={INPUT_STYLE} />
      <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required style={INPUT_STYLE} />
      <input type="password" placeholder="Password (min. 6 chars)" value={pass} onChange={e => setPass(e.target.value)} required style={INPUT_STYLE} />
      <button type="submit" disabled={busy} style={{ ...BTN_PRIMARY, opacity: busy ? 0.6 : 1 }}>
        {busy ? '…' : 'CREATE ACCOUNT'}
      </button>
    </form>
  )
}

function friendlyError(code) {
  const map = {
    // Legacy codes (Firebase < v9.6)
    'auth/user-not-found':          'No account with that email.',
    'auth/wrong-password':          'Incorrect password.',
    // Modern unified credential error (Firebase v9.6+)
    'auth/invalid-credential':      'Email or password is incorrect.',
    'auth/invalid-login-credentials':'Email or password is incorrect.',
    // Sign-up
    'auth/email-already-in-use':    'Email already registered.',
    'auth/invalid-email':           'Invalid email address.',
    'auth/weak-password':           'Password must be at least 6 characters.',
    'auth/missing-password':        'Please enter a password.',
    'auth/missing-email':           'Please enter your email.',
    // Provider not enabled in Firebase Console
    'auth/configuration-not-found': 'This sign-in method is not enabled. Contact support.',
    'auth/operation-not-allowed':   'This sign-in method is not enabled. Contact support.',
    // Other
    'auth/user-disabled':           'This account has been disabled.',
    'auth/too-many-requests':       'Too many attempts. Try again later.',
    'auth/network-request-failed':  'Network error. Check your connection.',
    'auth/popup-closed-by-user':    'Sign-in window closed.',
    'auth/popup-blocked':           'Popup was blocked. Please allow popups for this site.',
    'auth/cancelled-popup-request': 'Sign-in cancelled.',
  }
  return map[code] || `Something went wrong (${code ?? 'unknown'}). Please try again.`
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AuthPage() {
  const navigate = useNavigate()
  const { signInGoogle, signInGuest } = useAuth()
  const [tab, setTab] = useState('login')
  const [googleErr, setGoogleErr] = useState('')
  const [busy, setBusy] = useState(false)

  const onSuccess = () => navigate('/')

  const handleGoogle = async () => {
    setGoogleErr(''); setBusy(true)
    try { await signInGoogle(); onSuccess() }
    catch (ex) { setGoogleErr(friendlyError(ex?.code)) }
    finally { setBusy(false) }
  }

  const handleGuest = async () => {
    setBusy(true)
    try { await signInGuest(); onSuccess() }
    catch { /* silent */ }
    finally { setBusy(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0a0a14', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"Courier New", monospace', padding: '1rem' }}>
      {/* Back button */}
      <button onClick={() => navigate('/')} style={{ position: 'absolute', top: 16, left: 16, background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '0.75rem', letterSpacing: '0.12em', fontFamily: 'inherit' }}>
        ← BACK
      </button>

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        style={{ background: '#10101c', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '2rem', width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 20 }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 900, letterSpacing: '0.1em', background: 'linear-gradient(135deg,#00d4ff,#a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            TETRA OVERFLOW
          </div>
          <div style={{ fontSize: '0.6rem', color: '#444', letterSpacing: '0.3em', marginTop: 2 }}>ULTRA</div>
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <TabButton label="LOG IN" active={tab === 'login'} onClick={() => setTab('login')} />
          <TabButton label="SIGN UP" active={tab === 'signup'} onClick={() => setTab('signup')} />
        </div>

        {/* Form */}
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, x: tab === 'login' ? -12 : 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: tab === 'login' ? 12 : -12 }}
            transition={{ duration: 0.2 }}
          >
            {tab === 'login'
              ? <LoginForm onSuccess={onSuccess} />
              : <SignUpForm onSuccess={onSuccess} />
            }
          </motion.div>
        </AnimatePresence>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
          <span style={{ fontSize: '0.65rem', color: '#444', letterSpacing: '0.12em' }}>OR</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
        </div>

        {/* OAuth + Guest */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <ErrorBox msg={googleErr} />
          <button onClick={handleGoogle} disabled={busy} style={{ ...BTN_SECONDARY, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: busy ? 0.6 : 1 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            CONTINUE WITH GOOGLE
          </button>
          <button onClick={handleGuest} disabled={busy} style={{ ...BTN_SECONDARY, opacity: busy ? 0.6 : 1 }}>
            PLAY AS GUEST
          </button>
        </div>

        <p style={{ margin: 0, fontSize: '0.62rem', color: '#444', textAlign: 'center', lineHeight: 1.5 }}>
          Guest progress is not saved between sessions.
        </p>
      </motion.div>
    </div>
  )
}
