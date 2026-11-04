import { useState, useEffect } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import { signInWithPopup, onAuthStateChanged } from 'firebase/auth'
import { auth, googleProvider } from './firebase'
import Dashboard from './Dashboard'
import TripDetails from './TripDetails' // <-- 1. Added this import

export default function App() {
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser && window.location.pathname === '/') {
        navigate('/dashboard')
      }
    })
    return () => unsubscribe()
  }, [navigate])

  const handleGoogleLogin = async () => {
    setLoading(true)
    try {
      const result = await signInWithPopup(auth, googleProvider)
      const token = await result.user.getIdToken()
      
      await fetch('http://localhost:3000/api/v1/users/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      navigate('/dashboard')
    } catch (error) {
      console.error('Login error:', error)
      setLoading(false)
    }
  }

  return (
    <Routes>
      <Route path="/" element={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">GoLocal</h1>
            <p className="text-gray-600 mb-8">Plan your next trip locally.</p>
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full bg-indigo-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {loading ? 'Connecting...' : 'Sign in with Google'}
            </button>
          </div>
        </div>
      } />
      <Route path="/dashboard" element={<Dashboard />} />
      
      {/* 2. Added this route so it knows where to go */}
      <Route path="/trip/:id" element={<TripDetails />} /> 
    </Routes>
  )
}