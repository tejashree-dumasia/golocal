import { MapContainer, TileLayer, Marker, Popup, useMapEvents, Polyline } from 'react-leaflet'
import L from 'leaflet'
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchApi } from './utils/apiClient'
import ChatBox from './ChatBox'
import { auth } from './firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'

const defaultCenter = { lat: 18.5204, lng: 73.8567 } 

const createNumberedIcon = (number) => {
    return L.divIcon({
        className: 'custom-marker',
        html: `<div style="background-color: #4f46e5; color: white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); font-size: 14px;">
                ${number}
               </div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
    });
};

function MapInteractionHandler({ onMapClick }) {
    useMapEvents({ click: (e) => { onMapClick(e.latlng); } });
    return null;
}

export default function TripDetails() {
    const { id } = useParams()
    const navigate = useNavigate()

    const [locations, setLocations] = useState([])
    const [photos, setPhotos] = useState([])
    const [members, setMembers] = useState([])
    const [selectedTags, setSelectedTags] = useState([]) 
    const [loading, setLoading] = useState(true)

    const [openMemberMenu, setOpenMemberMenu] = useState(null); 
    const isHost = members.find(m => m.userId === auth.currentUser?.uid)?.role === 'host' || 
                   members.find(m => m.userId === auth.currentUser?.uid)?.role === 'co_host';

    const [draftLocation, setDraftLocation] = useState(null) 
    const [isFetchingAddress, setIsFetchingAddress] = useState(false)
    const [isAdding, setIsAdding] = useState(false)
    const [newLocation, setNewLocation] = useState({ name: '', address: '', lat: null, lng: null, dayNumber: 1 })

    // --- NEW: Photo Lightbox State ---
    const [isUploading, setIsUploading] = useState(false)
    const [selectedPhoto, setSelectedPhoto] = useState(null); // The photo opened in the modal
    const [modalTags, setModalTags] = useState([]); // Temporary state for editing tags

    const [inviteEmail, setInviteEmail] = useState('')
    const [isInviting, setIsInviting] = useState(false)

    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState([])

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    const [locationsData, photosData, membersData] = await Promise.all([
                        fetchApi(`/trips/${id}/locations`),
                        fetchApi(`/trips/${id}/photos`),
                        fetchApi(`/trips/${id}/members`)
                    ])
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

    // --- MEMBER MANAGEMENT API HANDLERS ---
    const handleRoleChange = async (memberId, newRole) => {
        setOpenMemberMenu(null);
        try {
            const token = await auth.currentUser.getIdToken();
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/trips/${id}/members/${memberId}/role`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: newRole })
            });
            if (response.ok) {
                const membersData = await fetchApi(`/trips/${id}/members`);
                setMembers(membersData.members);
            } else {
                const err = await response.json();
                alert(err.error || 'Failed to update role');
            }
        } catch (error) { console.error('Error changing role:', error); }
    }

    const handleRemoveMember = async (memberId) => {
        setOpenMemberMenu(null);
        if (!window.confirm('Are you sure you want to remove this member?')) return;
        try {
            const token = await auth.currentUser.getIdToken();
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/trips/${id}/members/${memberId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                setMembers(prev => prev.filter(m => m.id !== memberId));
            } else {
                const err = await response.json();
                alert(err.error || 'Failed to remove member');
            }
        } catch (error) { console.error('Error removing member:', error); }
    }

    // --- MAP & LOCATIONS ---
    const handleMapClick = async (latlng) => {
        const { lat, lng } = latlng;
        setDraftLocation({ lat, lng });
        setIsFetchingAddress(true);
        setNewLocation(prev => ({ ...prev, lat, lng, name: 'Dropped Pin', address: 'Fetching location data...' }));
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
            const data = await res.json();
            const address = data.display_name;
            const customName = data.name || (address ? address.split(',')[0] : 'Custom Map Pin');
            setNewLocation(prev => ({ ...prev, name: customName, address }));
        } catch (error) {
            setNewLocation(prev => ({ ...prev, name: 'Custom Map Pin', address: 'Coordinates selected' }));
        } finally { setIsFetchingAddress(false); }
    };

    const handleSearch = async (e) => {
        const query = e.target.value
        setSearchQuery(query)
        if (query.length > 2) {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}`)
            const data = await res.json()
            setSearchResults(data)
        } else { setSearchResults([]) }
    }

    const selectPlace = (place) => {
        const lat = parseFloat(place.lat);
        const lng = parseFloat(place.lon);
        setDraftLocation({ lat, lng }); 
        setNewLocation(prev => ({
            ...prev, name: place.name || place.display_name.split(',')[0], address: place.display_name, lat, lng
        }))
        setSearchQuery('')
        setSearchResults([])
    }

    const clearDraftSelection = () => {
        setDraftLocation(null);
        setNewLocation({ name: '', address: '', lat: null, lng: null, dayNumber: 1 });
        setSearchQuery('');
        setSearchResults([]);
    }

    const handleAddLocation = async (e) => {
        e.preventDefault()
        setIsAdding(true)
        try {
            const token = await auth.currentUser.getIdToken()
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/trips/${id}/locations`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...newLocation, sortOrder: locations.length })
            })
            if (response.ok) {
                const data = await response.json()
                setLocations([...locations, data.location])
                clearDraftSelection() 
            }
        } catch (error) { console.error('Failed to add location:', error)
        } finally { setIsAdding(false) }
    }

    const handleDeleteLocation = async (locationId) => {
        if (!window.confirm("Are you sure you want to remove this place?")) return;
        try {
            const token = await auth.currentUser.getIdToken();
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/trips/${id}/locations/${locationId}`, {
                method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) setLocations(prev => prev.filter(loc => loc.id !== locationId));
        } catch (error) { console.error("Error deleting location:", error); }
    };

    const handleDragEnd = async (result) => {
        if (!result.destination) return;
        const items = Array.from(locations);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);

        const updatedLocations = items.map((item, index) => ({ ...item, sortOrder: index }));
        setLocations(updatedLocations);

        try {
            const token = await auth.currentUser.getIdToken();
            await fetch(`${import.meta.env.VITE_API_BASE_URL}/trips/${id}/locations/reorder`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ updates: updatedLocations.map(loc => ({ id: loc.id, sortOrder: loc.sortOrder, dayNumber: loc.dayNumber })) })
            });
        } catch (error) { console.error('Failed to save new order:', error); }
    };

    // --- PHOTO MANAGEMENT HANDLERS (NEW) ---
    const toggleTag = (userId) => {
        if (!userId) return; 
        setSelectedTags(prev => prev.includes(userId) ? prev.filter(uid => uid !== userId) : [...prev, userId])
    }
    const toggleModalTag = (userId) => {
        if (!userId) return;
        setModalTags(prev => prev.includes(userId) ? prev.filter(uid => uid !== userId) : [...prev, userId])
    }

    const handlePhotoUpload = async (e) => {
        const files = Array.from(e.target.files)
        if (!files.length) return
        setIsUploading(true)

        const formData = new FormData()
        // Append all selected files to the 'photos' key
        files.forEach(file => formData.append('photos', file))

        if (selectedTags.length > 0) {
            const validTags = selectedTags.filter(uid => uid !== null);
            formData.append('visibility', JSON.stringify(validTags))
        }

        try {
            const data = await fetchApi(`/trips/${id}/photos`, { method: 'POST', body: formData })
            setPhotos(prev => [...prev, ...data.photos]) // Add all new photos
            setSelectedTags([])
        } catch (error) {
            alert('Failed to upload photos')
        } finally {
            setIsUploading(false)
        }
    }

    const handleUpdatePhotoTags = async (photoId) => {
        try {
            const token = await auth.currentUser.getIdToken();
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/trips/${id}/photos/${photoId}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ visibility: modalTags.length === 0 ? ['ALL'] : modalTags })
            });
            if (response.ok) {
                const data = await response.json();
                setPhotos(prev => prev.map(p => p.id === photoId ? data.photo : p));
                alert("Tags saved successfully!");
            }
        } catch (error) {
            console.error("Error updating tags:", error);
        }
    }

    const handleDeletePhoto = async (photoId) => {
        if (!window.confirm("Are you sure you want to permanently delete this photo?")) return;
        try {
            const token = await auth.currentUser.getIdToken();
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/trips/${id}/photos/${photoId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                setPhotos(prev => prev.filter(p => p.id !== photoId));
                setSelectedPhoto(null); // Close modal
            }
        } catch (error) {
            console.error("Error deleting photo:", error);
        }
    }

    // Force Download image (bypasses browser "open in new tab" behavior)
    const handleDownloadPhoto = async (url) => {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = `golocal-trip-${Date.now()}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            console.error("Download failed:", err);
            // Fallback
            window.open(url, '_blank');
        }
    }

    const handleInvite = async (e) => {
        e.preventDefault()
        setIsInviting(true)
        try {
            const token = await auth.currentUser.getIdToken()
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/trips/${id}/invite`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: e.target.memberName.value, email: e.target.memberEmail.value })
            })
            if (response.ok) {
                const membersData = await fetchApi(`/trips/${id}/members`);
                setMembers(membersData.members);
                setInviteEmail('')
                e.target.reset();
                alert('Member added successfully!')
            }
        } catch (error) { console.error('Error:', error)
        } finally { setIsInviting(false) }
    }

    const mapCenter = draftLocation 
        ? { lat: draftLocation.lat, lng: draftLocation.lng }
        : locations.length > 0 && locations[0].lat
            ? { lat: Number(locations[0].lat), lng: Number(locations[0].lng) }
            : defaultCenter;

    const validLocations = locations.filter(loc => loc.lat && loc.lng);
    const polylineCoords = validLocations.map(loc => [Number(loc.lat), Number(loc.lng)]);

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

                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit">
                            <h2 className="text-xl font-semibold mb-4 text-gray-800">Add a Place</h2>
                            <p className="text-xs text-gray-500 mb-4">Search below or click anywhere on the map to drop a pin.</p>
                            
                            <form onSubmit={handleAddLocation} className="space-y-4">
                                {newLocation.lat ? (
                                    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 relative group transition-all">
                                        <button 
                                            type="button" 
                                            onClick={clearDraftSelection} 
                                            className="absolute top-2 right-2 text-indigo-400 hover:text-indigo-700 bg-indigo-100 hover:bg-indigo-200 rounded-full w-6 h-6 flex items-center justify-center transition"
                                            title="Clear Selection"
                                        >
                                            ✕
                                        </button>
                                        <label className="block text-xs font-bold text-indigo-700 mb-1 uppercase tracking-wide">
                                            📍 Selected Location
                                        </label>
                                        <input
                                            required
                                            type="text"
                                            value={newLocation.name}
                                            onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
                                            className="w-full bg-white border border-indigo-200 rounded-md p-2 text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                                            placeholder="Enter a custom name..."
                                        />
                                        <p className="text-xs text-indigo-500 mt-2 line-clamp-2" title={newLocation.address}>
                                            {isFetchingAddress ? 'Fetching details...' : newLocation.address}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Search Location</label>
                                        <input
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
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Day Number</label>
                                    <input type="number" min="1" className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none" value={newLocation.dayNumber} onChange={(e) => setNewLocation({ ...newLocation, dayNumber: Number(e.target.value) })} />
                                </div>
                                <button type="submit" disabled={isAdding || !newLocation.lat} className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition">
                                    {isAdding ? 'Saving...' : 'Add Place'}
                                </button>
                            </form>
                        </div>

                        {/* TRIP CREW BOX */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit">
                            <h2 className="text-lg font-semibold mb-4 text-gray-800 flex items-center gap-2">
                                👥 The Crew
                            </h2>
                            <div className="space-y-3">
                                {members.map(member => (
                                    <div key={member.id} className="flex justify-between items-center bg-gray-50 p-2 rounded-lg border border-gray-200 relative">
                                        <span className="text-sm font-medium text-gray-700 pl-1">{member.displayName}</span>
                                        
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xs px-2 py-1 rounded-md font-semibold uppercase tracking-wider ${
                                                member.role === 'host' ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' :
                                                member.role === 'co_host' ? 'bg-purple-100 text-purple-700 border border-purple-200' : 
                                                'bg-gray-200 text-gray-600'
                                            }`}>
                                                {member.role.replace('_', ' ')}
                                            </span>
                                            
                                            {isHost && member.userId !== auth.currentUser?.uid && (
                                                <div className="relative">
                                                    <button 
                                                        onClick={() => setOpenMemberMenu(openMemberMenu === member.id ? null : member.id)}
                                                        className="p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-800 rounded-md transition"
                                                    >
                                                        ⚙️
                                                    </button>
                                                    {openMemberMenu === member.id && (
                                                        <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-hidden">
                                                            {member.role !== 'host' && (
                                                                <button onClick={() => handleRoleChange(member.id, 'host')} className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-indigo-50 hover:text-indigo-700">
                                                                    Make Host
                                                                </button>
                                                            )}
                                                            {member.role !== 'co_host' && (
                                                                <button onClick={() => handleRoleChange(member.id, 'co_host')} className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-indigo-50 hover:text-indigo-700">
                                                                    Make Co-Host
                                                                </button>
                                                            )}
                                                            {member.role !== 'participant' && (
                                                                <button onClick={() => handleRoleChange(member.id, 'participant')} className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-indigo-50 hover:text-indigo-700">
                                                                    Make Participant
                                                                </button>
                                                            )}
                                                            <div className="border-t border-gray-100"></div>
                                                            <button onClick={() => handleRemoveMember(member.id)} className="w-full text-left px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50">
                                                                Remove Member
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* UPLOAD PHOTOS */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit">
                            <h2 className="text-lg font-semibold mb-3 text-gray-800 flex items-center gap-2">
                                📸 Add Photos
                            </h2>

                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Who can see these? (Leave empty for everyone)</label>
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
                                    {isUploading ? 'Uploading...' : 'Click to Upload Multiple Photos'}
                                </span>
                                {/* NEW: Added multiple attribute */}
                                <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} disabled={isUploading} />
                            </label>
                        </div>

                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit">
                            <h2 className="text-lg font-semibold mb-3 text-gray-800 flex items-center gap-2">
                                ✉️ Add to Crew
                            </h2>
                            <form onSubmit={handleInvite} className="space-y-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Name (Required)</label>
                                    <input required name="memberName" type="text" placeholder="John Doe" className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Email (Optional)</label>
                                    <input name="memberEmail" type="email" placeholder="friend@email.com" className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
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
                                zoom={locations.length > 0 || draftLocation ? 10 : 5}
                                style={{ height: '400px', width: '100%', borderRadius: '0.75rem', zIndex: 0 }}
                            >
                                <TileLayer
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                />
                                
                                <MapInteractionHandler onMapClick={handleMapClick} />

                                {polylineCoords.length > 1 && (
                                    <Polyline 
                                        positions={polylineCoords} 
                                        pathOptions={{ color: '#4f46e5', weight: 4, dashArray: '10, 10', lineJoin: 'round' }} 
                                    />
                                )}

                                {validLocations.map((loc, index) => (
                                    <Marker 
                                        key={loc.id} 
                                        position={[Number(loc.lat), Number(loc.lng)]}
                                        icon={createNumberedIcon(index + 1)}
                                    >
                                        <Popup><strong>Stop {index + 1} (Day {loc.dayNumber}):</strong> {loc.name}</Popup>
                                    </Marker>
                                ))}

                                {draftLocation && (
                                    <Marker position={[draftLocation.lat, draftLocation.lng]}>
                                        <Popup autoPan>
                                            <div className="text-center">
                                                <strong className="text-indigo-600 block mb-1">📍 Selected Location</strong>
                                                <span className="text-xs text-gray-600 block">Edit details on the left sidebar to save it.</span>
                                            </div>
                                        </Popup>
                                    </Marker>
                                )}
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
                                                                <div className="bg-indigo-100 text-indigo-700 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0">
                                                                    {index + 1}
                                                                </div>
                                                                <div>
                                                                    <h3 className="font-bold text-gray-800 text-lg">{loc.name}</h3>
                                                                    {loc.address && <p className="text-sm text-gray-500">{loc.address}</p>}
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <span className="bg-gray-100 text-gray-700 text-sm font-semibold px-4 py-1.5 rounded-full border border-gray-200">
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
                                        <div 
                                            key={photo.id} 
                                            onClick={() => {
                                                setSelectedPhoto(photo);
                                                setModalTags(photo.visibility.includes('ALL') ? [] : photo.visibility);
                                            }}
                                            className="aspect-square rounded-xl overflow-hidden shadow-sm border border-gray-200 bg-gray-100 cursor-pointer"
                                        >
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

            {/* --- NEW: PHOTO LIGHTBOX MODAL --- */}
            {selectedPhoto && (
                <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 sm:p-8 backdrop-blur-sm">
                    
                    {/* Close Button */}
                    <button 
                        onClick={() => setSelectedPhoto(null)} 
                        className="absolute top-4 right-4 sm:top-8 sm:right-8 text-white/70 hover:text-white bg-black/50 hover:bg-black/80 rounded-full w-10 h-10 flex items-center justify-center transition z-10"
                    >
                        ✕
                    </button>

                    <div className="bg-white rounded-2xl overflow-hidden flex flex-col md:flex-row max-w-6xl w-full max-h-full shadow-2xl">
                        
                        {/* Image Viewer (Left Side) */}
                        <div className="flex-1 bg-black flex items-center justify-center min-h-[300px] md:min-h-[500px] p-4 relative group">
                            <img 
                                src={selectedPhoto.imageUrl} 
                                alt="Selected Trip Memory" 
                                className="max-w-full max-h-[80vh] object-contain"
                            />
                            
                            {/* Floating Download Button */}
                            <button 
                                onClick={() => handleDownloadPhoto(selectedPhoto.imageUrl)}
                                className="absolute bottom-4 right-4 bg-white/90 text-gray-900 px-4 py-2 rounded-lg text-sm font-semibold shadow-lg hover:bg-white transition flex items-center gap-2"
                            >
                                ⬇️ Download
                            </button>
                        </div>

                        {/* Photo Settings (Right Side) */}
                        <div className="w-full md:w-80 bg-gray-50 p-6 flex flex-col border-l border-gray-200">
                            
                            <h3 className="text-lg font-bold text-gray-900 mb-6 border-b pb-4">Photo Settings</h3>

                            {/* Tags Section */}
                            <div className="flex-1">
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Visible to:</label>
                                <p className="text-xs text-gray-500 mb-3">Only selected members will see this photo. Leave blank for everyone.</p>
                                
                                <div className="flex flex-wrap gap-2 mb-6">
                                    {members.filter(m => m.userId).map(member => {
                                        // You can only edit tags if you are the host, or the original uploader.
                                        const canEdit = isHost || selectedPhoto.uploaderId === auth.currentUser?.uid;
                                        
                                        return (
                                            <button
                                                key={member.id}
                                                type="button"
                                                disabled={!canEdit}
                                                onClick={() => toggleModalTag(member.userId)}
                                                className={`text-xs px-3 py-1.5 rounded-full border font-medium transition ${
                                                    modalTags.includes(member.userId)
                                                        ? 'bg-indigo-600 text-white border-indigo-600'
                                                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
                                                } ${!canEdit ? 'opacity-75 cursor-not-allowed' : ''}`}
                                            >
                                                {member.displayName}
                                            </button>
                                        )
                                    })}
                                </div>

                                {(isHost || selectedPhoto.uploaderId === auth.currentUser?.uid) && (
                                    <button 
                                        onClick={() => handleUpdatePhotoTags(selectedPhoto.id)}
                                        className="w-full bg-indigo-100 text-indigo-700 hover:bg-indigo-200 py-2 rounded-lg text-sm font-semibold transition"
                                    >
                                        Save Changes
                                    </button>
                                )}
                            </div>

                            {/* Delete Section */}
                            {(isHost || selectedPhoto.uploaderId === auth.currentUser?.uid) && (
                                <div className="mt-8 pt-6 border-t border-gray-200">
                                    <button 
                                        onClick={() => handleDeletePhoto(selectedPhoto.id)}
                                        className="w-full bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 py-2.5 rounded-lg text-sm font-semibold transition"
                                    >
                                        Delete Photo
                                    </button>
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}