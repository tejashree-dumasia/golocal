/* =========================================
   File: src/TripDetails.jsx
   ========================================= */

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
        html: `<div>${number}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
    });
};

function MapInteractionHandler({ onMapClick }) {
    useMapEvents({ click: (e) => { onMapClick(e.latlng); } });
    return null;
}

export default function TripDetails() {
    const { id } = useParams()
    const navigate = useNavigate()

    // UI State
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('chat') // 'chat', 'gallery', 'crew'
    const [tripDetails, setTripDetails] = useState(null)
    const [showAddForm, setShowAddForm] = useState(false) // NEW: Toggles the Add Place button

    // Data State
    const [locations, setLocations] = useState([])
    const [photos, setPhotos] = useState([])
    const [members, setMembers] = useState([])
    
    // Member & Auth State
    const [openMemberMenu, setOpenMemberMenu] = useState(null); 
    const isHost = members.find(m => m.userId === auth.currentUser?.uid)?.role === 'host' || 
                   members.find(m => m.userId === auth.currentUser?.uid)?.role === 'co_host';
    const [isInviting, setIsInviting] = useState(false)

    // Location State
    const [draftLocation, setDraftLocation] = useState(null) 
    const [isFetchingAddress, setIsFetchingAddress] = useState(false)
    const [isAdding, setIsAdding] = useState(false)
    const [newLocation, setNewLocation] = useState({ name: '', address: '', lat: null, lng: null, dayNumber: 1 })
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState([])

    // Photo State
    const [isUploading, setIsUploading] = useState(false)
    const [selectedPhoto, setSelectedPhoto] = useState(null);
    const [selectedTags, setSelectedTags] = useState([]) 
    const [modalTags, setModalTags] = useState([]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    const [locationsData, photosData, membersData, tripsData] = await Promise.all([
                        fetchApi(`/trips/${id}/locations`),
                        fetchApi(`/trips/${id}/photos`),
                        fetchApi(`/trips/${id}/members`),
                        fetchApi(`/trips`) 
                    ])
                    setLocations(locationsData.locations.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)))
                    setPhotos(photosData.photos)
                    setMembers(membersData.members)
                    setTripDetails(tripsData.trips.find(t => t.id === id) || { title: 'Trip Details' })
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

    // --- MEMBER MANAGEMENT ---
    const handleRoleChange = async (memberId, newRole) => {
        setOpenMemberMenu(null);
        try {
            await fetchApi(`/trips/${id}/members/${memberId}/role`, { method: 'PUT', body: JSON.stringify({ role: newRole }) });
            const data = await fetchApi(`/trips/${id}/members`);
            setMembers(data.members);
        } catch (error) { alert(error.message); }
    }

    const handleRemoveMember = async (memberId) => {
        setOpenMemberMenu(null);
        if (!window.confirm('Remove this member?')) return;
        try {
            await fetchApi(`/trips/${id}/members/${memberId}`, { method: 'DELETE' });
            setMembers(prev => prev.filter(m => m.id !== memberId));
        } catch (error) { alert(error.message); }
    }

    const handleInvite = async (e) => {
        e.preventDefault();
        setIsInviting(true);
        try {
            await fetchApi(`/trips/${id}/invite`, {
                method: 'POST',
                body: JSON.stringify({ name: e.target.memberName.value, email: e.target.memberEmail.value })
            });
            const data = await fetchApi(`/trips/${id}/members`);
            setMembers(data.members);
            e.target.reset();
        } catch (error) { alert(error.message); } finally { setIsInviting(false); }
    }

    // --- MAP & LOCATIONS ---
    const handleMapClick = async (latlng) => {
        const { lat, lng } = latlng;
        setShowAddForm(true); // Open form if clicking map
        setDraftLocation({ lat, lng });
        setIsFetchingAddress(true);
        setNewLocation(prev => ({ ...prev, lat, lng, name: 'Dropped Pin', address: 'Fetching location data...' }));
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
            const data = await res.json();
            setNewLocation(prev => ({ ...prev, name: data.name || (data.display_name ? data.display_name.split(',')[0] : 'Pin'), address: data.display_name }));
        } catch (error) {
            setNewLocation(prev => ({ ...prev, name: 'Custom Map Pin', address: 'Coordinates selected' }));
        } finally { setIsFetchingAddress(false); }
    };

    const handleSearch = async (e) => {
        const query = e.target.value;
        setSearchQuery(query);
        if (query.length > 2) {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}`);
            const data = await res.json();
            setSearchResults(data);
        } else { setSearchResults([]); }
    }

    const selectPlace = (place) => {
        const lat = parseFloat(place.lat);
        const lng = parseFloat(place.lon);
        setDraftLocation({ lat, lng }); 
        setNewLocation(prev => ({ ...prev, name: place.name || place.display_name.split(',')[0], address: place.display_name, lat, lng }));
        setSearchQuery('');
        setSearchResults([]);
    }

    const clearDraftSelection = () => {
        setDraftLocation(null);
        setNewLocation({ name: '', address: '', lat: null, lng: null, dayNumber: 1 });
        setSearchQuery('');
        setSearchResults([]);
        setShowAddForm(false);
    }

    const handleAddLocation = async (e) => {
        e.preventDefault();
        setIsAdding(true);
        try {
            const data = await fetchApi(`/trips/${id}/locations`, {
                method: 'POST',
                body: JSON.stringify({ ...newLocation, sortOrder: locations.length })
            });
            setLocations([...locations, data.location]);
            clearDraftSelection();
        } catch (error) { console.error(error); } finally { setIsAdding(false); }
    }

    const handleDeleteLocation = async (locationId) => {
        if (!window.confirm("Remove this place?")) return;
        try {
            await fetchApi(`/trips/${id}/locations/${locationId}`, { method: 'DELETE' });
            setLocations(prev => prev.filter(loc => loc.id !== locationId));
        } catch (error) { console.error(error); }
    };

    const handleDragEnd = async (result) => {
        if (!result.destination) return;
        const items = Array.from(locations);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);
        const updatedLocations = items.map((item, index) => ({ ...item, sortOrder: index }));
        setLocations(updatedLocations);
        try {
            await fetchApi(`/trips/${id}/locations/reorder`, {
                method: 'PUT',
                body: JSON.stringify({ updates: updatedLocations.map(loc => ({ id: loc.id, sortOrder: loc.sortOrder, dayNumber: loc.dayNumber })) })
            });
        } catch (error) {}
    };

    // --- PHOTOS ---
    const toggleTag = (userId) => {
        if (!userId) return;
        setSelectedTags(prev => prev.includes(userId) ? prev.filter(uid => uid !== userId) : [...prev, userId]);
    }
    const toggleModalTag = (userId) => {
        if (!userId) return;
        setModalTags(prev => prev.includes(userId) ? prev.filter(uid => uid !== userId) : [...prev, userId]);
    }

    const handlePhotoUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        setIsUploading(true);
        const formData = new FormData();
        files.forEach(file => formData.append('photos', file));
        if (selectedTags.length > 0) formData.append('visibility', JSON.stringify(selectedTags.filter(uid => uid !== null)));
        try {
            const data = await fetchApi(`/trips/${id}/photos`, { method: 'POST', body: formData });
            setPhotos(prev => [...prev, ...data.photos]);
            setSelectedTags([]);
        } catch (error) { alert('Upload failed'); } finally { setIsUploading(false); }
    }

    const handleUpdatePhotoTags = async (photoId) => {
        try {
            const data = await fetchApi(`/trips/${id}/photos/${photoId}`, {
                method: 'PUT',
                body: JSON.stringify({ visibility: modalTags.length === 0 ? ['ALL'] : modalTags })
            });
            setPhotos(prev => prev.map(p => p.id === photoId ? data.photo : p));
        } catch (error) {}
    }

    const handleDeletePhoto = async (photoId) => {
        if (!window.confirm("Permanently delete this photo?")) return;
        try {
            await fetchApi(`/trips/${id}/photos/${photoId}`, { method: 'DELETE' });
            setPhotos(prev => prev.filter(p => p.id !== photoId));
            setSelectedPhoto(null);
        } catch (error) {}
    }

    const handleDownloadPhoto = async (url) => {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const link = document.createElement('a');
            link.href = window.URL.createObjectURL(blob);
            link.download = `golocal-photo-${Date.now()}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) { window.open(url, '_blank'); }
    }

    const mapCenter = draftLocation ? draftLocation : (locations[0] || defaultCenter);
    const polylineCoords = locations.filter(l => l.lat && l.lng).map(l => [Number(l.lat), Number(l.lng)]);

    // Timeline node colors based on screenshot
    const nodeColors = ['bg-[#ADC1B5]', 'bg-[#D2BEA3]', 'bg-[#ADC1B5]', 'bg-[#D2BEA3]']; 

    if (loading) return <div className="p-8 text-sm text-stone-500">Loading...</div>;

    return (
        <div className="h-full flex flex-col w-full bg-white relative overflow-hidden">
            
            {/* GLOBAL HEADER */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 flex-shrink-0 bg-white z-20">
                <div className="flex items-center gap-4">
                    <div className="relative shrink-0">
                        <img src="https://images.unsplash.com/photo-1542224566-6e85f2e6772f?w=150&h=150&fit=crop" alt="Trip Cover" className="w-14 h-14 rounded-xl object-cover border border-stone-200" />
                        <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full"></span>
                    </div>
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-3">
                            <h2 className="text-xl md:text-2xl font-bold text-[#1A1A1A] font-serif tracking-tight truncate max-w-[200px] md:max-w-md">
                                {tripDetails?.title}
                            </h2>
                            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full flex-shrink-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> live
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="flex -space-x-1.5">
                                {members.slice(0, 3).map((m, i) => (
                                    <div key={m.id} className="w-6 h-6 rounded-full bg-stone-200 border-2 border-white flex items-center justify-center text-[10px] font-bold text-stone-600 relative z-[1]" style={{ zIndex: 10 - i }}>
                                        {m.displayName.charAt(0)}
                                    </div>
                                ))}
                            </div>
                            <span className="text-xs font-medium text-stone-500 ml-1">Active crew online</span>
                        </div>
                    </div>
                </div>
                {/* Icons */}
                <div className="hidden md:flex items-center gap-5 text-stone-700">
                    <button className="hover:text-black transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg></button>
                    <button className="hover:text-black transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg></button>
                    <button className="hover:text-black transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg></button>
                    <button className="hover:text-black transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg></button>
                    <button className="hover:text-black transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg></button>
                    <button className="hover:text-black transition-colors ml-2"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg></button>
                </div>
            </div>

            {/* 50/50 SPLIT CONTENT AREA */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
                
                {/* LEFT PANE (50%) */}
                <div className="w-full lg:w-1/2 flex flex-col border-r border-stone-200 min-w-0 h-full">
                    {/* Tabs */}
                    <div className="px-6 border-b border-stone-200 bg-white flex gap-6 flex-shrink-0">
                        <button onClick={() => setActiveTab('chat')} className={`py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === 'chat' ? 'border-[#E35D4A] text-[#1A1A1A]' : 'border-transparent text-stone-400 hover:text-stone-600'}`}>Trip Chat</button>
                        <button onClick={() => setActiveTab('gallery')} className={`py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === 'gallery' ? 'border-[#E35D4A] text-[#1A1A1A]' : 'border-transparent text-stone-400 hover:text-stone-600'}`}>Gallery</button>
                        <button onClick={() => setActiveTab('crew')} className={`py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === 'crew' ? 'border-[#E35D4A] text-[#1A1A1A]' : 'border-transparent text-stone-400 hover:text-stone-600'}`}>The Crew</button>
                    </div>

                    <div className="flex-1 overflow-y-auto bg-white relative">
                        {activeTab === 'chat' && <ChatBox tripId={id} />}

                        {/* GALLERY TAB */}
                        {activeTab === 'gallery' && (
                            <div className="p-6 space-y-8 animate-in fade-in duration-300">
                                <div className="bg-stone-50 p-5 rounded-xl border border-stone-200">
                                    <h3 className="text-sm font-bold text-[#1A1A1A] mb-3">Upload Memories</h3>
                                    <div className="mb-4">
                                        <label className="block text-xs font-bold text-stone-500 uppercase mb-2">Visible To</label>
                                        <div className="flex flex-wrap gap-2">
                                            {members.filter(m => m.userId).map(member => (
                                                <button key={member.id} type="button" onClick={() => toggleTag(member.userId)} className={`text-xs px-3 py-1.5 rounded-full font-bold transition-colors ${selectedTags.includes(member.userId) ? 'bg-[#1A1A1A] text-white' : 'bg-white text-stone-500 border border-stone-200 hover:bg-stone-100'}`}>
                                                    {member.displayName}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <label className={`w-full flex items-center justify-center border-2 border-dashed border-stone-300 rounded-lg p-6 cursor-pointer hover:bg-stone-100 transition-colors ${isUploading ? 'opacity-50 pointer-events-none' : 'bg-white'}`}>
                                        <span className="text-sm font-bold text-stone-600">{isUploading ? 'Uploading...' : '+ Select Photos'}</span>
                                        <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} disabled={isUploading} />
                                    </label>
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-[#1A1A1A] mb-4">Trip Gallery</h3>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        {photos.map((photo) => (
                                            <div key={photo.id} onClick={() => { setSelectedPhoto(photo); setModalTags(photo.visibility.includes('ALL') ? [] : photo.visibility); }} className="aspect-square rounded-lg overflow-hidden bg-stone-100 cursor-pointer group relative">
                                                <img src={photo.imageUrl} alt="Memory" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* CREW TAB */}
                        {activeTab === 'crew' && (
                            <div className="p-6 space-y-8 animate-in fade-in duration-300">
                                <form onSubmit={handleInvite} className="bg-stone-50 p-5 rounded-xl border border-stone-200 space-y-4">
                                    <h3 className="text-sm font-bold text-[#1A1A1A]">Invite to Crew</h3>
                                    <div><label className="block text-xs font-bold text-stone-500 uppercase mb-1">Name</label><input required name="memberName" type="text" className="w-full border border-stone-200 rounded-lg p-2 text-sm focus:outline-none focus:border-stone-400 bg-white" /></div>
                                    <div><label className="block text-xs font-bold text-stone-500 uppercase mb-1">Email</label><input name="memberEmail" type="email" className="w-full border border-stone-200 rounded-lg p-2 text-sm focus:outline-none focus:border-stone-400 bg-white" /></div>
                                    <button type="submit" disabled={isInviting} className="w-full bg-[#1A1A1A] text-white py-2 rounded-lg text-sm font-bold hover:bg-black disabled:opacity-50">Send Invite</button>
                                </form>
                                <div className="space-y-3">
                                    <h3 className="text-sm font-bold text-[#1A1A1A]">Active Members</h3>
                                    {members.map(member => (
                                        <div key={member.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-stone-200 shadow-sm relative">
                                            <span className="text-sm font-bold text-[#1A1A1A]">{member.displayName}</span>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${member.role === 'host' ? 'bg-[#527768] text-white' : member.role === 'co_host' ? 'bg-stone-200 text-stone-700' : 'bg-stone-100 text-stone-500'}`}>
                                                    {member.role.replace('_', ' ')}
                                                </span>
                                                {isHost && member.userId !== auth.currentUser?.uid && (
                                                    <div className="relative">
                                                        <button onClick={() => setOpenMemberMenu(openMemberMenu === member.id ? null : member.id)} className="p-1 text-stone-400 hover:text-stone-800">⚙️</button>
                                                        {openMemberMenu === member.id && (
                                                            <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-stone-200 rounded-lg shadow-lg z-50 overflow-hidden">
                                                                {['host', 'co_host', 'participant'].filter(r => r !== member.role).map(role => (
                                                                    <button key={role} onClick={() => handleRoleChange(member.id, role)} className="w-full text-left px-4 py-2 text-xs font-bold text-stone-600 hover:bg-stone-50">Make {role.replace('_', ' ')}</button>
                                                                ))}
                                                                <button onClick={() => handleRemoveMember(member.id)} className="w-full text-left px-4 py-2 text-xs font-bold text-[#E35D4A] hover:bg-red-50">Remove</button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT PANE (50%): Logistics (Map, Plan) */}
                <div className="w-full lg:w-1/2 flex flex-col bg-[#FAF9F7] h-full overflow-hidden relative border-l border-stone-100">
                    
                    <div className="flex-1 overflow-y-auto p-6 flex flex-col relative bg-[#FAF9F7]">
                        <h3 className="text-[17px] font-serif font-bold text-[#1A1A1A] mb-3 tracking-tight">The Plan</h3>
                        
                        {/* Map (In Frame) */}
                        <div className="h-[220px] rounded-xl overflow-hidden shadow-sm relative z-0 border border-[#EAEAEA] mb-6 flex-shrink-0">
                            <MapContainer center={[mapCenter.lat, mapCenter.lng]} zoom={locations.length > 0 || draftLocation ? 10 : 5} style={{ height: '100%', width: '100%', zIndex: 0 }}>
                                <TileLayer 
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                />
                                <MapInteractionHandler onMapClick={handleMapClick} />
                                {polylineCoords.length > 1 && <Polyline positions={polylineCoords} pathOptions={{ color: '#1A1A1A', weight: 3, dashArray: '4, 6' }} />}
                                {locations.map((loc, i) => <Marker key={loc.id} position={[Number(loc.lat), Number(loc.lng)]} icon={createNumberedIcon(i + 1)}><Popup>{loc.name}</Popup></Marker>)}
                                {draftLocation && <Marker position={[draftLocation.lat, draftLocation.lng]}><Popup>Draft Pin</Popup></Marker>}
                            </MapContainer>
                        </div>

                        <h3 className="text-[17px] font-serif font-bold text-[#1A1A1A] mb-5 tracking-tight">The Plan</h3>
                        
                        <div className="relative pl-8 flex-1">
                            {/* Vertical Line spanning entire list starting from + symbol */}
                            <div className="absolute top-[20px] bottom-[24px] left-[11px] w-[2px] bg-[#D4D4D4] z-0"></div>
                            
                            {/* The + Node */}
                            <div className="absolute top-[6px] left-[6.5px] text-[#D4D4D4] text-[18px] font-light z-10 leading-none bg-[#FAF9F7] px-1">+</div>

                            {/* Pill-shaped Add Place Button or Form (MOVED ABOVE LIST) */}
                            <div className="relative z-10 mb-5 pt-1">
                                {!showAddForm ? (
                                    <button onClick={() => setShowAddForm(true)} className="w-full bg-[#F8EFEB] border border-[#C5AFA9] text-[#333333] py-2.5 rounded-full text-[13px] font-medium hover:bg-[#F3E5E0] transition-colors shadow-sm flex items-center justify-center gap-1.5">
                                        <span className="text-[16px] font-light leading-none mb-[1px]">+</span> Add Place
                                    </button>
                                ) : (
                                    <div className="w-full bg-white p-3 rounded-2xl border border-[#C5AFA9] shadow-md animate-in fade-in zoom-in-95 duration-200">
                                        <form onSubmit={(e) => { handleAddLocation(e); setShowAddForm(false); }} className="space-y-2">
                                            <div className="flex justify-between items-center mb-1">
                                                <label className="text-[10px] font-bold text-[#C5AFA9] uppercase tracking-wider">New Location</label>
                                                <button type="button" onClick={clearDraftSelection} className="text-stone-400 hover:text-stone-700 text-xs font-bold">✕ Close</button>
                                            </div>
                                            
                                            {newLocation.lat ? (
                                                <div className="bg-stone-50 border border-stone-200 rounded-lg p-2 relative">
                                                    <input required type="text" value={newLocation.name} onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })} className="w-full bg-transparent text-[13px] font-bold text-[#1A1A1A] focus:outline-none" />
                                                </div>
                                            ) : (
                                                <div className="relative">
                                                    <input type="text" placeholder="Search a place..." value={searchQuery} onChange={handleSearch} className="w-full border border-stone-200 rounded-lg p-2 text-sm focus:outline-none focus:border-[#C5AFA9]" autoFocus />
                                                    {searchResults.length > 0 && (
                                                        <ul className="absolute top-full left-0 z-20 w-full bg-white border border-stone-200 rounded-lg shadow-xl mt-1 max-h-40 overflow-y-auto text-left">
                                                            {searchResults.map((result) => (
                                                                <li key={result.place_id} onClick={() => selectPlace(result)} className="p-2.5 hover:bg-stone-50 cursor-pointer text-xs font-medium border-b border-stone-100 last:border-b-0 truncate">
                                                                    {result.display_name}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </div>
                                            )}
                                            
                                            {newLocation.lat && (
                                                <div className="flex gap-2 pt-1">
                                                    <input type="number" min="1" placeholder="Day" className="w-20 border border-stone-200 rounded-lg p-2 text-sm focus:outline-none" value={newLocation.dayNumber} onChange={(e) => setNewLocation({ ...newLocation, dayNumber: Number(e.target.value) })} />
                                                    <button type="submit" disabled={isAdding || !newLocation.lat} className="flex-1 bg-[#1A1A1A] text-white py-2 rounded-lg text-sm font-bold hover:bg-black disabled:opacity-50 transition-colors">
                                                        {isAdding ? 'Saving...' : 'Confirm'}
                                                    </button>
                                                </div>
                                            )}
                                        </form>
                                    </div>
                                )}
                            </div>

                            <DragDropContext onDragEnd={handleDragEnd}>
                                <Droppable droppableId="itinerary">
                                    {(provided) => (
                                        <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3 relative z-10 pb-4">
                                            {locations.map((loc, index) => (
                                                <Draggable key={loc.id} draggableId={loc.id} index={index}>
                                                    {(provided) => (
                                                        <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} className="relative flex items-center group mb-3">
                                                            {/* Colored Node */}
                                                            <div className={`absolute -left-[32px] w-[14px] h-[14px] rounded-full ${nodeColors[index % nodeColors.length]} z-10`}></div>

                                                            {/* Card */}
                                                            <div className="w-full bg-white px-3 py-2.5 rounded-[10px] shadow-[0_1px_4px_rgba(0,0,0,0.08)] border border-[#EAEAEA] flex justify-between items-center transition-colors">
                                                                <div className="flex flex-col">
                                                                    <span className="text-[11px] text-stone-400 font-medium mb-0.5">Stop {index + 1}</span>
                                                                    <h4 className="text-[13px] font-bold text-[#222222]">
                                                                        {loc.name} 
                                                                        <span className="text-stone-500 font-normal ml-1">(Day {loc.dayNumber})</span>
                                                                    </h4>
                                                                </div>
                                                                
                                                                {/* 6-dot drag handle & Delete */}
                                                                <div className="flex items-center gap-3">
                                                                    <button onClick={() => handleDeleteLocation(loc.id)} className="opacity-0 group-hover:opacity-100 text-[#E35D4A] text-[10px] uppercase font-bold hover:underline transition-opacity tracking-wider">Del</button>
                                                                    <div className="text-[#D4D4D4] grid grid-cols-2 gap-[2px] px-1 cursor-grab">
                                                                        <div className="w-[3px] h-[3px] bg-[#D4D4D4] rounded-full"></div><div className="w-[3px] h-[3px] bg-[#D4D4D4] rounded-full"></div>
                                                                        <div className="w-[3px] h-[3px] bg-[#D4D4D4] rounded-full"></div><div className="w-[3px] h-[3px] bg-[#D4D4D4] rounded-full"></div>
                                                                        <div className="w-[3px] h-[3px] bg-[#D4D4D4] rounded-full"></div><div className="w-[3px] h-[3px] bg-[#D4D4D4] rounded-full"></div>
                                                                    </div>
                                                                </div>
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
                        </div>
                    </div>
                </div>

                {/* LIGHTBOX MODAL */}
                {selectedPhoto && (
                    <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 sm:p-8">
                        <button onClick={() => setSelectedPhoto(null)} className="absolute top-6 right-6 text-white/50 hover:text-white text-2xl z-10">✕</button>
                        <div className="flex flex-col md:flex-row max-w-5xl w-full h-[80vh] bg-[#F4F4F0] rounded-xl overflow-hidden">
                            <div className="flex-1 bg-black flex items-center justify-center relative p-4">
                                <img src={selectedPhoto.imageUrl} alt="Memory" className="max-w-full max-h-full object-contain" />
                            </div>
                            <div className="w-full md:w-72 bg-white p-6 flex flex-col border-l border-stone-200">
                                <h3 className="text-sm font-bold text-[#1A1A1A] mb-4">Photo Settings</h3>
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-stone-500 uppercase mb-2">Visible To</label>
                                    <div className="flex flex-wrap gap-2 mb-4">
                                        {members.filter(m => m.userId).map(member => {
                                            const canEdit = isHost || selectedPhoto.uploaderId === auth.currentUser?.uid;
                                            return (
                                                <button key={member.id} type="button" disabled={!canEdit} onClick={() => toggleModalTag(member.userId)} className={`text-xs px-3 py-1 rounded-full font-bold transition-colors ${modalTags.includes(member.userId) ? 'bg-[#1A1A1A] text-white' : 'bg-white text-stone-500 border border-stone-200'} ${!canEdit ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                                    {member.displayName}
                                                </button>
                                            )
                                        })}
                                    </div>
                                    {(isHost || selectedPhoto.uploaderId === auth.currentUser?.uid) && (
                                        <button onClick={() => handleUpdatePhotoTags(selectedPhoto.id)} className="w-full bg-stone-100 text-[#1A1A1A] py-2 rounded-lg text-xs font-bold hover:bg-stone-200 transition-colors">Save Tags</button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}