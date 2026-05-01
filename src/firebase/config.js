import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { initializeFirestore, setLogLevel } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyDYiN707IZOis3CZWTltrZog45RZpN2FiY',
  authDomain: 'tetra-overflow-ultra.firebaseapp.com',
  projectId: 'tetra-overflow-ultra',
  storageBucket: 'tetra-overflow-ultra.firebasestorage.app',
  messagingSenderId: '33152682340',
  appId: '1:33152682340:web:8e1aa415987d586367d271',
  measurementId: 'G-XM2KE3N6LR',
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)

// Firestore: use auto long-polling detection to avoid WebChannel/extension blocks
// and reduce console spam to errors only.
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
  useFetchStreams: false,
})
setLogLevel('error')
export default app
