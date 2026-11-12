import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchApi } from './utils/apiClient'
import ChatBox from './ChatBox'
import { auth } from './firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'

const defaultCenter = { lat: 18.5204, lng: 73.8567 } // Default to Pune

export default function TripDetails() {
    const { id } = useParams()
    const navigate = useNavigate()

    // State Declarations
    const [locations, setLocations] = useState([])
    const [photos, setPhotos] = useState([])
    const [members, setMembers] = useState([])
    const [selectedTags, setSelectedTags] = useState([]) // Empty means 'ALL'
    const [loading, setLoading] = useState(true)

    const [isAdding, setIsAdding] = useState(false)
    const [newLocation, setNewLocation] = useState({ name: '', address: '', lat: null, lng: null, dayNumber: 1 })

    const [isUploading, setIsUploading] = useState(false)
    const [inviteEmail, setInviteEmail] = useState('')
    const [isInviting, setIsInviting] = useState(false)

    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState([])

    // Initial Data Fetch
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    const [locationsData, photosData, membersData] = await Promise.all([
                        fetchApi(`/trips/${id}/locations`),
                        fetchApi(`/trips/${id}/photos`),
                        fetchApi(`/trips/${id}/members`)
                    ])
                    // Sort locations by sortOrder on load
                    const sortedLocations = locationsData.locations.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
                    setLocations(sortedLocations)
                    setPhotos(photosData.photos)
                    setMembers(membersData.members)
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

    // --- SEARCH HANDLERS ---
    const handleSearch = async (e) => {
        const query = e.target.value
        setSearchQuery(query)

        if (query.length > 2) {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}`)
            const data = await res.json()
            setSearchResults(data)
        } else {
            setSearchResults([])
        }
    }

    const selectPlace = (place) => {
        setNewLocation(prev => ({
            ...prev,
            name: place.name || place.display_name.split(',')[0],
            address: place.display_name,
            lat: place.lat,
            lng: place.lon
        }))
        setSearchQuery(place.display_name)
        setSearchResults([])
    }

    // --- API HANDLERS ---

    // Tag Toggle Helper
    const toggleTag = (userId) => {
        if (!userId) return; // Can't tag placeholder users
        setSelectedTags(prev =>
            prev.includes(userId)
                ? prev.filter(uid => uid !== userId)
                : [...prev, userId]
        )
    }

    // Updated Photo Upload with Tags
    const handlePhotoUpload = async (e) => {
        const file = e.target.files[0]
        if (!file) return
        setIsUploading(true)

        const formData = new FormData()
        formData.append('photo', file)

        if (selectedTags.length > 0) {
            const validTags = selectedTags.filter(uid => uid !== null);
            formData.append('visibility', JSON.stringify(validTags))
        }

        try {
            const data = await fetchApi(`/trips/${id}/photos`, { method: 'POST', body: formData })
            setPhotos(prev => [...prev, data.photo])
            setSelectedTags([])
        } catch (error) {
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
                // Automatically assign the next sortOrder
                body: JSON.stringify({ ...newLocation, sortOrder: locations.length })
            })
            if (response.ok) {
                const data = await response.json()
                setLocations([...locations, data.location])
                setNewLocation({ name: '', address: '', lat: null, lng: null, dayNumber: 1 })
                setSearchQuery('')
            }
        } catch (error) {
            console.error('Failed to add location:', error)
        } finally {
            setIsAdding(false)
        }
    }

    const handleDeleteLocation = async (locationId) => {
        if (!window.confirm("Are you sure you want to remove this place?")) return;

        try {
            const token = await auth.currentUser.getIdToken();
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/trips/${id}/locations/${locationId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                setLocations(prev => prev.filter(loc => loc.id !== locationId));
            } else {
                alert("Failed to delete location");
            }
        } catch (error) {
            console.error("Error deleting location:", error);
        }
    };

    const handleInvite = async (e) => {
        e.preventDefault()
        setIsInviting(true)
        try {
            const token = await auth.currentUser.getIdToken()
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/trips/${id}/invite`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: inviteEmail })
            })
            if (response.ok) {
                alert('Invite sent successfully!')
                setInviteEmail('')
            }
        } catch (error) {
            console.error('Error:', error)
        } finally {
            setIsInviting(false)
        }
    }

    // --- DRAG AND DROP HANDLER ---
    const handleDragEnd = async (result) => {
        if (!result.destination) return;

        const items = Array.from(locations);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);

        // Instantly update UI 
        const updatedLocations = items.map((item, index) => ({ ...item, sortOrder: index }));
        setLocations(updatedLocations);

        // Sync with Backend
        try {
            const token = await auth.currentUser.getIdToken();
            await fetch(`${import.meta.env.VITE_API_BASE_URL}/trips/${id}/locations/reorder`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    updates: updatedLocations.map(loc => ({ id: loc.id, sortOrder: loc.sortOrder, dayNumber: loc.dayNumber })) 
                })
            });
        } catch (error) {
            console.error('Failed to save new order:', error);
        }
    };

    const mapCenter = locations.length > 0 && locations[0].lat
        ? { lat: Number(locations[0].lat), lng: Number(locations[0].lng) }
        : defaultCenter;

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

                    {/* LEFT COLUMN */}
                    <div className="flex flex-col gap-6 md:col-span-1">

                        {/* SEARCH & ADD PLACE */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit">
                            <h2 className="text-xl font-semibold mb-4 text-gray-800">Add a Place</h2>
                            <form onSubmit={handleAddLocation} className="space-y-4">
                                <div className="relative">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Search Location</label>
                                    <input
                                        required
                                        type="text"
                                        placeholder="Search for a place..."
                                        className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={searchQuery}
                                        onChange={handleSearch}
                                    />
                                    {searchResults.length > 0 && (
                                        <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                                            {searchResults.map((result) => (
                                                <li
                                                    key={result.place_id}
                                                    onClick={() => selectPlace(result)}
                                                    className="p-2 hover:bg-indigo-50 cursor-pointer text-sm border-b last:border-b-0 truncate"
                                                >
                                                    {result.display_name}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Day Number</label>
                                    <input type="number" min="1" className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none" value={newLocation.dayNumber} onChange={(e) => setNewLocation({ ...newLocation, dayNumber: Number(e.target.value) })} />
                                </div>
                                <button type="submit" disabled={isAdding || !newLocation.lat} className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition">
                                    {isAdding ? 'Adding...' : 'Add Place'}
                                </button>
                                {!newLocation.lat && searchQuery && searchResults.length === 0 && (
                                    <p className="text-xs text-red-500 mt-1">Please select a valid place from the dropdown.</p>
                                )}
                            </form>
                        </div>

                        {/* TRIP CREW BOX */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit">
                            <h2 className="text-lg font-semibold mb-4 text-gray-800 flex items-center gap-2">
                                👥 The Crew
                            </h2>
                            <div className="space-y-3">
                                {members.map(member => (
                                    <div key={member.id} className="flex justify-between items-center bg-gray-50 p-2 rounded-lg border border-gray-100">
                                        <span className="text-sm font-medium text-gray-700">{member.displayName}</span>
                                        <span className={`text-xs px-2 py-1 rounded-full font-semibold uppercase tracking-wider ${member.role === 'host' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-200 text-gray-600'
                                            }`}>
                                            {member.role.replace('_', ' ')}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* UPLOAD PHOTOS WITH TAGGING */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit">
                            <h2 className="text-lg font-semibold mb-3 text-gray-800 flex items-center gap-2">
                                📸 Trip Photos
                            </h2>

                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Who can see this? (Leave empty for everyone)</label>
                                <div className="flex flex-wrap gap-2">
                                    {members.filter(m => m.userId).map(member => (
                                        <button
                                            key={member.id}
                                            type="button"
                                            onClick={() => toggleTag(member.userId)}
                                            className={`text-xs px-3 py-1.5 rounded-full border font-medium transition ${selectedTags.includes(member.userId)
                                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                                                }`}
                                        >
                                            {member.displayName}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <label className={`w-full flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-4 cursor-pointer hover:bg-gray-50 transition ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                                <span className="text-sm font-medium text-gray-600">
                                    {isUploading ? 'Uploading...' : 'Click to Upload Photo'}
                                </span>
                                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={isUploading} />
                            </label>
                        </div>

                        {/* INVITE FRIENDS */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit">
                            <h2 className="text-lg font-semibold mb-3 text-gray-800 flex items-center gap-2">
                                ✉️ Add to Crew
                            </h2>
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    setIsInviting(true);
                                    const token = auth.currentUser.accessToken;
                                    fetchApi(`/trips/${id}/invite`, {
                                        method: 'POST',
                                        body: JSON.stringify({ name: e.target.memberName.value, email: e.target.memberEmail.value })
                                    })
                                        .then(() => {
                                            alert('Member added successfully!');
                                            e.target.reset();
                                        })
                                        .catch(console.error)
                                        .finally(() => setIsInviting(false));
                                }}
                                className="space-y-3"
                            >
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Name (Required)</label>
                                    <input required name="memberName" type="text" placeholder="John Doe" className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Email (Optional)</label>
                                    <input name="memberEmail" type="email" placeholder="friend@email.com (Leave blank for app-less)" className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                                </div>
                                <button type="submit" disabled={isInviting} className="w-full bg-green-50 text-green-700 border border-green-200 py-2 rounded-lg text-sm font-bold hover:bg-green-100 disabled:opacity-50 transition">
                                    {isInviting ? 'Adding...' : 'Add Member'}
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* MIDDLE COLUMN */}
                    <div className="md:col-span-2">

                        <div className="mb-8 bg-white p-2 rounded-2xl shadow-sm border border-gray-100 z-0">
                            <MapContainer
                                center={[mapCenter.lat, mapCenter.lng]}
                                zoom={locations.length > 0 ? 10 : 5}
                                style={{ height: '400px', width: '100%', borderRadius: '0.75rem', zIndex: 0 }}
                            >
                                <TileLayer
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                />
                                {locations.map(loc => loc.lat && loc.lng ? (
                                    <Marker key={loc.id} position={[Number(loc.lat), Number(loc.lng)]}>
                                        <Popup>
                                            <strong>Day {loc.dayNumber}:</strong> {loc.name}
                                        </Popup>
                                    </Marker>
                                ) : null)}
                            </MapContainer>
                        </div>

                        <h2 className="text-xl font-semibold mb-4 text-gray-800">Your Plan (Drag to Reorder)</h2>
                        {loading ? (
                            <p className="text-gray-500">Loading places...</p>
                        ) : locations.length === 0 ? (
                            <div className="bg-white p-8 rounded-xl border-2 border-dashed border-gray-200 text-center text-gray-500">
                                No places added yet. Start building your itinerary on the left!
                            </div>
                        ) : (
                            <DragDropContext onDragEnd={handleDragEnd}>
                                <Droppable droppableId="itinerary">
                                    {(provided) => (
                                        <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-4">
                                            {locations.map((loc, index) => (
                                                <Draggable key={loc.id} draggableId={loc.id} index={index}>
                                                    {(provided) => (
                                                        <div 
                                                            ref={provided.innerRef} 
                                                            {...provided.draggableProps} 
                                                            {...provided.dragHandleProps} 
                                                            className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center hover:shadow-md transition group"
                                                            style={{ ...provided.draggableProps.style }}
                                                        >
                                                            <div className="flex items-center gap-4">
                                                                <span className="text-gray-400 cursor-grab active:cursor-grabbing">
                                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" /></svg>
                                                                </span>
                                                                <div>
                                                                    <h3 className="font-bold text-gray-800 text-lg">{loc.name}</h3>
                                                                    {loc.address && <p className="text-sm text-gray-500">{loc.address}</p>}
                                                                </div>
                                                            </div>
                                                            
                                                            <div className="flex items-center gap-3">
                                                                <span className="bg-indigo-50 text-indigo-700 text-sm font-bold px-4 py-1.5 rounded-full border border-indigo-100">
                                                                    Day {loc.dayNumber}
                                                                </span>
                                                                <button onClick={() => handleDeleteLocation(loc.id)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity p-2 text-lg" title="Remove Place">
                                                                    🗑️
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </Draggable>
                                            ))}
                                            {provided.placeholder}
                                        </div>
                                    )}
                                </Droppable>
                            </DragDropContext>
                        )}

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

                    {/* RIGHT COLUMN */}
                    <div className="lg:col-span-1">
                        <ChatBox tripId={id} />
                    </div>

                </div>
            </div>
        </div>
    )
}