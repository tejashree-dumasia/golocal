import { useState, useEffect } from 'react';
import { auth } from './firebase';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { useTrips } from './hooks/useTrips';
import { fetchApi } from './utils/apiClient';
import { useQueryClient } from '@tanstack/react-query'; 

export default function Dashboard() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const { data, isLoading, error } = useTrips();
    const trips = data?.trips || [];

    const [currentUser, setCurrentUser] = useState(null); 
    
    // Modal & Form State
    const [showModal, setShowModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editingTripId, setEditingTripId] = useState(null);
    const [formData, setFormData] = useState({ title: '', description: '', budget: '' });

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (!user) navigate('/');
            else setCurrentUser(user);
        });
        return () => unsubscribe();
    }, [navigate]);

    const handleLogout = async () => {
        await signOut(auth);
        navigate('/');
    };

    // Open Modal for New Trip
    const openCreateModal = () => {
        setEditingTripId(null);
        setFormData({ title: '', description: '', budget: '' });
        setShowModal(true);
    };

    // Open Modal for Editing (Pre-fill data)
    const openEditModal = (e, trip) => {
        e.stopPropagation(); // Prevent navigating to trip details
        setEditingTripId(trip.id);
        setFormData({ title: trip.title, description: trip.description || '', budget: trip.budget || '' });
        setShowModal(true);
    };

    // Handle both Create and Edit submissions
    const handleSaveTrip = async (e) => {
        e.preventDefault();
        setIsSaving(true);

        const payload = {
            title: formData.title,
            description: formData.description,
            budget: Number(formData.budget) || null
        };

        try {
            if (editingTripId) {
                await fetchApi(`/trips/${editingTripId}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                });
            } else {
                await fetchApi('/trips', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
            }

            queryClient.invalidateQueries(['trips']); 
            setShowModal(false);
        } catch (error) {
            console.error('Failed to save trip:', error);
            alert(error.message);
        } finally {
            setIsSaving(false);
        }
    };

    // Handle Trip Deletion
    const handleDeleteTrip = async (e, tripId) => {
        e.stopPropagation(); 
        if (!window.confirm("Are you sure you want to delete this entire trip? This cannot be undone.")) return;

        try {
            await fetchApi(`/trips/${tripId}`, { method: 'DELETE' });
            queryClient.invalidateQueries(['trips']);
        } catch (error) {
            console.error('Failed to delete trip:', error);
            alert(error.message);
        }
    };

    if (isLoading) return <div className="p-8 text-center text-gray-500">Loading your trips...</div>;
    if (error) return <div className="p-8 text-center text-red-500">Error loading trips!</div>;

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Your Trips</h1>
                    
                    <div className="flex gap-3 sm:gap-4 items-center">
                        <button onClick={openCreateModal} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-medium transition shadow-sm">
                            + New Trip
                        </button>
                        <div className="h-8 w-px bg-gray-200 mx-1 hidden sm:block"></div>

                        {currentUser && (
                            <button onClick={() => navigate('/profile')} className="flex items-center gap-2 sm:gap-3 hover:bg-gray-100 p-1.5 sm:pr-4 rounded-full sm:rounded-xl transition group text-left" title="Profile Settings">
                                {currentUser.photoURL ? (
                                    <img src={currentUser.photoURL} alt="Profile" className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm group-hover:border-indigo-100 transition" referrerPolicy="no-referrer" />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold border-2 border-white shadow-sm group-hover:border-indigo-200 transition">
                                        {currentUser.displayName ? currentUser.displayName.charAt(0).toUpperCase() : '?'}
                                    </div>
                                )}
                                <span className="text-sm font-semibold text-gray-700 hidden sm:block group-hover:text-indigo-600 transition">
                                    {currentUser.displayName?.split(' ')[0]} 
                                </span>
                            </button>
                        )}
                        <button onClick={handleLogout} className="text-red-600 hover:text-red-700 font-medium bg-red-50 hover:bg-red-100 px-3 sm:px-4 py-2 rounded-lg transition text-sm sm:text-base">
                            Sign Out
                        </button>
                    </div>
                </div>

                {trips.length === 0 ? (
                    <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 text-center">
                        <p className="text-gray-600 mb-4">You haven't created any trips yet.</p>
                        <button onClick={openCreateModal} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-medium">
                            Create New Trip
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {trips.map((trip) => (
                            <div
                                key={trip.id}
                                onClick={() => navigate(`/trip/${trip.id}`)}
                                className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition cursor-pointer relative group flex flex-col justify-between"
                            >
                                {/* Quick Actions Menu (Top Right) */}
                                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {(trip.role === 'host' || trip.role === 'co_host') && (
                                        <button onClick={(e) => openEditModal(e, trip)} className="bg-white border border-gray-200 text-gray-600 hover:text-indigo-600 p-1.5 rounded-md shadow-sm hover:border-indigo-200 transition">
                                            ✏️
                                        </button>
                                    )}
                                    {trip.role === 'host' && (
                                        <button onClick={(e) => handleDeleteTrip(e, trip.id)} className="bg-white border border-gray-200 text-gray-600 hover:text-red-600 p-1.5 rounded-md shadow-sm hover:border-red-200 transition">
                                            🗑️
                                        </button>
                                    )}
                                </div>

                                <div>
                                    <h2 className="text-xl font-bold text-gray-800 pr-16">{trip.title}</h2>
                                    <p className="text-gray-500 mt-2 text-sm truncate">{trip.description || 'No description'}</p>
                                </div>

                                <div className="mt-6 flex items-center justify-between border-t pt-4">
                                    <span className={`text-xs font-semibold px-2 py-1 rounded-full uppercase tracking-wider ${
                                        trip.role === 'host' ? 'bg-indigo-100 text-indigo-700' : 'bg-green-100 text-green-700'
                                    }`}>
                                        {trip.role.replace('_', ' ')}
                                    </span>
                                    {trip.budget && (
                                        <span className="text-sm font-medium text-gray-700">₹{trip.budget}</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Multi-purpose Save Trip Modal */}
                {showModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
                            <h2 className="text-2xl font-bold mb-4">{editingTripId ? 'Edit Trip' : 'Plan a New Trip'}</h2>
                            <form onSubmit={handleSaveTrip} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Destination / Title</label>
                                    <input required type="text" placeholder="e.g. Pune to Lonavala" className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                                    <textarea placeholder="Weekend getaway with friends" className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Budget in ₹ (Optional)</label>
                                    <input type="number" placeholder="5000" className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.budget} onChange={(e) => setFormData({ ...formData, budget: e.target.value })} />
                                </div>

                                <div className="flex gap-3 justify-end mt-6">
                                    <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Cancel</button>
                                    <button type="submit" disabled={isSaving} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50">
                                        {isSaving ? 'Saving...' : (editingTripId ? 'Save Changes' : 'Create Trip')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}