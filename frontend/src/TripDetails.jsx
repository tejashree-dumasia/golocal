import ChatBox from './ChatBox'
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { auth } from './firebase'

export default function TripDetails() {
    const { id } = useParams() // Grabs the trip ID from the URL
    const navigate = useNavigate()

    const [locations, setLocations] = useState([])
    const [loading, setLoading] = useState(true)
    const [isAdding, setIsAdding] = useState(false)
    const [newLocation, setNewLocation] = useState({ name: '', address: '', dayNumber: 1 })
    
    // Invite state
    const [inviteEmail, setInviteEmail] = useState('')
    const [isInviting, setIsInviting] = useState(false)

    useEffect(() => {
        const fetchLocations = async () => {
            try {
                const user = auth.currentUser
                if (!user) return // Prevents crash before auth loads

                const token = await user.getIdToken()
                const response = await fetch(`http://localhost:3000/api/v1/trips/${id}/locations`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
                const data = await response.json()
                if (response.ok) {
                    setLocations(data.locations)
                }
            } catch (error) {
                console.error('Failed to fetch locations:', error)
            } finally {
                setLoading(false)
            }
        }
        fetchLocations()
    }, [id])

    const handleAddLocation = async (e) => {
        e.preventDefault()
        setIsAdding(true)
        try {
            const token = await auth.currentUser.getIdToken()
            const response = await fetch(`http://localhost:3000/api/v1/trips/${id}/locations`, {
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
                setNewLocation({ name: '', address: '', dayNumber: 1 }) // Reset form
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
            const response = await fetch(`http://localhost:3000/api/v1/trips/${id}/invite`, {
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
            <div className="max-w-7xl mx-auto"> {/* Widened to max-w-7xl for 4 columns */}
                <button
                    onClick={() => navigate('/dashboard')}
                    className="text-indigo-600 mb-6 font-medium hover:underline flex items-center gap-2"
                >
                    &larr; Back to Dashboard
                </button>

                <h1 className="text-3xl font-bold text-gray-900 mb-8">Trip Itinerary</h1>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

                    {/* LEFT COLUMN: Add Place & Invite Forms */}
                    <div className="flex flex-col gap-6 md:col-span-1">
                        
                        {/* Add Place Box */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit">
                            <h2 className="text-xl font-semibold mb-4 text-gray-800">Add a Place</h2>
                            <form onSubmit={handleAddLocation} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Place Name</label>
                                    <input
                                        required
                                        type="text"
                                        placeholder="e.g. Baga Beach"
                                        className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={newLocation.name}
                                        onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Address / Notes</label>
                                    <input
                                        type="text"
                                        placeholder="North Goa"
                                        className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={newLocation.address}
                                        onChange={(e) => setNewLocation({ ...newLocation, address: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Day Number</label>
                                    <input
                                        type="number"
                                        min="1"
                                        className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={newLocation.dayNumber}
                                        onChange={(e) => setNewLocation({ ...newLocation, dayNumber: Number(e.target.value) })}
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={isAdding}
                                    className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
                                >
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
                                <input
                                    required
                                    type="email"
                                    placeholder="friend@email.com"
                                    className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                />
                                <button
                                    type="submit"
                                    disabled={isInviting}
                                    className="w-full bg-green-50 text-green-700 border border-green-200 py-2 rounded-lg text-sm font-bold hover:bg-green-100 disabled:opacity-50 transition"
                                >
                                    {isInviting ? 'Sending...' : 'Send Invite'}
                                </button>
                            </form>
                        </div>
                    </div> {/* End Left Column */}

                    {/* MIDDLE COLUMN: Itinerary List */}
                    <div className="md:col-span-2">
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
                                    .sort((a, b) => a.dayNumber - b.dayNumber) // Sort by Day Number
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
                    </div> {/* End Middle Column */}

                    {/* RIGHT COLUMN: Live Chat */}
                    <div className="lg:col-span-1">
                        <ChatBox tripId={id} />
                    </div> {/* End Right Column */}

                </div> {/* End Grid */}
            </div> {/* End Max Width */}
        </div>
    )
}