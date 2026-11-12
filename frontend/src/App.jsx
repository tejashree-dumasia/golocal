import { useState, useEffect } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import { signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth'
import { auth, googleProvider } from './firebase'

import Layout from './Layout'
import Dashboard from './Dashboard'
import TripDetails from './TripDetails'
import Profile from './Profile'

export default function App() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('') 
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
    setError('')
    try {
      const result = await signInWithPopup(auth, googleProvider)
      const token = await result.user.getIdToken()
      
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/users/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      // Force an error if backend returns a bad status
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Backend synchronization failed')
      }

      navigate('/dashboard')
    } catch (error) {
      console.error('Login error:', error)
      // Clean up Firebase auth state so they aren't stuck half-logged-in
      await signOut(auth) 
      setError(error.message || 'Login failed. Please try again.')
      setLoading(false)
    }
  }

  return (
    <Routes>
      {/* Unauthenticated Login Route */}
      <Route path="/" element={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">GoLocal</h1>
            <p className="text-gray-600 mb-8">Plan your next trip locally.</p>
            
            {/* Display error message if sync fails */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

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

      {/* Authenticated Routes wrapped in the Global Layout */}
      <Route element={<Layout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/trip/:id" element={<TripDetails />} />
        <Route path="/profile" element={<Profile />} />
      </Route>
    </Routes>
  )
}