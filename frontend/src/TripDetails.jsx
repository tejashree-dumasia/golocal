import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchApi } from './utils/apiClient'
import ChatBox from './ChatBox'
import { auth } from './firebase'
import { onAuthStateChanged } from 'firebase/auth'

export default function TripDetails() {
    const { id } = useParams() 
    const navigate = useNavigate()

    const [locations, setLocations] = useState([])
    const [photos, setPhotos] = useState([]) 
    const [loading, setLoading] = useState(true)
    
    const [isAdding, setIsAdding] = useState(false)
    const [newLocation, setNewLocation] = useState({ name: '', address: '', dayNumber: 1 })
    
    const [isUploading, setIsUploading] = useState(false)
    
    const [inviteEmail, setInviteEmail] = useState('')
    const [isInviting, setIsInviting] = useState(false)

    // 1. Fetch Locations & Photos in parallel
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    // Promise.all fetches both endpoints simultaneously for better performance
                    const [locationsData, photosData] = await Promise.all([
                        fetchApi(`/trips/${id}/locations`),
                        fetchApi(`/trips/${id}/photos`)
                    ])
                    setLocations(locationsData.locations)
                    setPhotos(photosData.photos)
                } catch (error) {
                    console.error('Failed to fetch trip data:', error)
                } finally {
                    setLoading(false)
                }
            } else {
                navigate('/')
            }
        })

        return () => unsubscribe()
    }, [id, navigate])

    const handlePhotoUpload = async (e) => {
        const file = e.target.files[0]
        if (!file) return

        setIsUploading(true)
        const formData = new FormData()
        formData.append('photo', file)

        try {
            const data = await fetchApi(`/trips/${id}/photos`, {
                method: 'POST',
                body: formData 
            })

            setPhotos(prev => [...prev, data.photo])
        } catch (error) {
            console.error('Upload failed:', error)
            alert('Failed to upload photo')
        } finally {
            setIsUploading(false)
        }
    }

    const handleAddLocation = async (e) => {
        e.preventDefault()
        setIsAdding(true)
        try {
            const token = await auth.currentUser.getIdToken()
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/trips/${id}/locations`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(newLocation)
            })
            const data = await response.json()
            if (response.ok) {
                setLocations([...locations, data.location])
                setNewLocation({ name: '', address: '', dayNumber: 1 }) 
            }
        } catch (error) {
            console.error('Failed to add location:', error)
        } finally {
            setIsAdding(false)
        }
    }

    const handleInvite = async (e) => {
        e.preventDefault()
        setIsInviting(true)
        try {
            const token = await auth.currentUser.getIdToken()
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/trips/${id}/invite`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email: inviteEmail })
            })
            if (response.ok) {
                alert('Invite sent successfully!')
                setInviteEmail('')
            } else {
                alert('Failed to send invite. Check backend console.')
            }
        } catch (error) {
            console.error('Error:', error)
        } finally {
            setIsInviting(false)
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-7xl mx-auto">
                <button
                    onClick={() => navigate('/dashboard')}
                    className="text-indigo-600 mb-6 font-medium hover:underline flex items-center gap-2"
                >
                    &larr; Back to Dashboard
                </button>

                <h1 className="text-3xl font-bold text-gray-900 mb-8">Trip Itinerary</h1>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

                    {/* LEFT COLUMN: Add Place, Photos & Invite Forms */}
                    <div className="flex flex-col gap-6 md:col-span-1">
                        
                        {/* Upload Photos Box */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit">
                            <h2 className="text-lg font-semibold mb-3 text-gray-800 flex items-center gap-2">
                                📸 Trip Photos
                            </h2>
                            <label className={`w-full flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-4 cursor-pointer hover:bg-gray-50 transition ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                                <span className="text-sm font-medium text-gray-600">
                                    {isUploading ? 'Uploading...' : 'Click to Upload Photo'}
                                </span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handlePhotoUpload}
                                    disabled={isUploading}
                                />
                            </label>
                        </div>

                        {/* Add Place Box */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit">
                            <h2 className="text-xl font-semibold mb-4 text-gray-800">Add a Place</h2>
                            <form onSubmit={handleAddLocation} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Place Name</label>
                                    <input required type="text" placeholder="e.g. Baga Beach" className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none" value={newLocation.name} onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Address / Notes</label>
                                    <input type="text" placeholder="North Goa" className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none" value={newLocation.address} onChange={(e) => setNewLocation({ ...newLocation, address: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Day Number</label>
                                    <input type="number" min="1" className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none" value={newLocation.dayNumber} onChange={(e) => setNewLocation({ ...newLocation, dayNumber: Number(e.target.value) })} />
                                </div>
                                <button type="submit" disabled={isAdding} className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition">
                                    {isAdding ? 'Adding...' : 'Add Place'}
                                </button>
                            </form>
                        </div>

                        {/* Invite Friends Box */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit">
                            <h2 className="text-lg font-semibold mb-3 text-gray-800 flex items-center gap-2">
                                ✉️ Invite Friends
                            </h2>
                            <form onSubmit={handleInvite} className="space-y-3">
                                <input required type="email" placeholder="friend@email.com" className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
                                <button type="submit" disabled={isInviting} className="w-full bg-green-50 text-green-700 border border-green-200 py-2 rounded-lg text-sm font-bold hover:bg-green-100 disabled:opacity-50 transition">
                                    {isInviting ? 'Sending...' : 'Send Invite'}
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* MIDDLE COLUMN: Itinerary List & Photo Gallery */}
                    <div className="md:col-span-2">
                        {/* Itinerary Section */}
                        <h2 className="text-xl font-semibold mb-4 text-gray-800">Your Plan</h2>
                        {loading ? (
                            <p className="text-gray-500">Loading places...</p>
                        ) : locations.length === 0 ? (
                            <div className="bg-white p-8 rounded-xl border-2 border-dashed border-gray-200 text-center text-gray-500">
                                No places added yet. Start building your itinerary on the left!
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {locations
                                    .sort((a, b) => a.dayNumber - b.dayNumber) 
                                    .map((loc) => (
                                        <div key={loc.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center hover:shadow-md transition">
                                            <div>
                                                <h3 className="font-bold text-gray-800 text-lg">{loc.name}</h3>
                                                {loc.address && <p className="text-sm text-gray-500">{loc.address}</p>}
                                            </div>
                                            <span className="bg-indigo-50 text-indigo-700 text-sm font-bold px-4 py-1.5 rounded-full border border-indigo-100">
                                                Day {loc.dayNumber}
                                            </span>
                                        </div>
                                    ))}
                            </div>
                        )}

                        {/* 2. Photo Gallery Section */}
                        <div className="mt-12">
                            <h2 className="text-xl font-semibold mb-4 text-gray-800">Trip Gallery</h2>
                            {photos.length === 0 ? (
                                <div className="bg-white p-6 rounded-xl border-2 border-dashed border-gray-200 text-center text-gray-500">
                                    No photos uploaded yet.
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {photos.map((photo) => (
                                        <div key={photo.id} className="aspect-square rounded-xl overflow-hidden shadow-sm border border-gray-200 bg-gray-100">
                                            <img 
                                                src={photo.imageUrl} 
                                                alt="Trip Memory" 
                                                className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                                                loading="lazy"
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Live Chat */}
                    <div className="lg:col-span-1">
                        <ChatBox tripId={id} />
                    </div>

                </div> 
            </div> 
        </div>
    )
}