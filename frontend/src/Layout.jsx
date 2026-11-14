import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { auth } from './firebase';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { useTrips } from './hooks/useTrips';
import { fetchApi } from './utils/apiClient';
import { useQueryClient } from '@tanstack/react-query';

export default function Layout() {
    const navigate = useNavigate();
    const location = useLocation();
    const queryClient = useQueryClient();
    const [currentUser, setCurrentUser] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({ title: '', description: '', budget: '' });
    const [isSaving, setIsSaving] = useState(false);

    const { data, isLoading } = useTrips();
    const trips = data?.trips || [];

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (!user) navigate('/');
            else setCurrentUser(user);
        });
        return () => unsubscribe();
    }, [navigate]);

    const handleCreateTrip = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await fetchApi('/trips', {
                method: 'POST',
                body: JSON.stringify({ ...formData, budget: Number(formData.budget) || null })
            });
            queryClient.invalidateQueries(['trips']);
            setShowModal(false);
            setFormData({ title: '', description: '', budget: '' });
        } catch (error) {
            alert(error.message);
        } finally {
            setIsSaving(false);
        }
    };

    if (!currentUser) return null;

    return (
        <div className="h-screen w-full flex bg-[#FDFBF7] overflow-hidden font-sans">
            
            {/* LEFT COLUMN: Sidebar (Matches Image Exactly) */}
            <aside className="w-[300px] flex flex-col flex-shrink-0 z-20 border-r border-stone-200/50">
                <div className="p-6 pb-5 flex justify-between items-center">
                    <Link to="/dashboard" className="text-[26px] font-bold tracking-tight">
                        <span className="text-[#F28B66]">G</span>
                        <span className="text-[#F28B66]">o</span>
                        <span className="text-[#7A5B9C]">Local</span>
                    </Link>
                    <button 
                        onClick={() => setShowModal(true)}
                        className="bg-gradient-to-r from-[#FF7A7A] to-[#FCA062] text-white px-4 py-1.5 rounded-full text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity"
                    >
                        + New
                    </button>
                </div>

                <div className="px-6 mb-5">
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </span>
                        <input 
                            type="text" 
                            placeholder="Search trips or crew..." 
                            className="w-full bg-white border border-stone-200/60 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-stone-300 shadow-sm"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-1">
                    {isLoading ? (
                        <p className="text-sm text-stone-500 px-2">Loading trips...</p>
                    ) : (
                        trips.map(trip => {
                            const isActive = location.pathname.includes(`/trip/${trip.id}`); return ( <Link key={trip.id} to={`/trip/${trip.id}`}
                                    className={`block p-3 rounded-[14px] transition-all ${isActive ? 'bg-[#E3EDE7]' : 'bg-transparent hover:bg-stone-100/50'}`}
                                >
                                    <h3 className="font-bold text-[#1A1A1A] text-[15px] truncate">{trip.title}</h3>
                                    <p className="text-xs text-stone-600 truncate mb-1">Active Trip, highlighted in soft</p>
                                    <div className="flex justify-between items-end mt-2">
                                        <span className="text-xs font-semibold text-stone-800">
                                            {trip.role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                        </span>
                                        <div className="flex flex-col items-end">
                                            <div className="w-8 h-8 rounded-full bg-stone-300 border-2 border-[#E3EDE7] overflow-hidden mb-1">
                                                <img src="https://images.unsplash.com/photo-1542224566-6e85f2e6772f?w=50&h=50&fit=crop" alt="avatar" className="w-full h-full object-cover" />
                                            </div>
                                            <span className="text-[10px] text-stone-500 font-medium">12:15 PM</span>
                                        </div>
                                    </div>
                                </Link>
                            )
                        })
                    )}
                </div>

                <div className="p-4 bg-white/50 border-t border-stone-200/50 flex justify-between items-center cursor-pointer hover:bg-stone-50 transition-colors" onClick={() => navigate('/profile')}>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-stone-800 text-white flex items-center justify-center text-xs font-bold">
                            {currentUser.displayName?.charAt(0)}
                        </div>
                        <div className="text-sm font-bold text-stone-800 truncate w-32">{currentUser.displayName}</div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); signOut(auth); navigate('/'); }} className="text-xs text-stone-500 font-semibold hover:text-red-500">Sign Out</button>
                </div>
            </aside>

            {/* MAIN CONTENT AREA */}
            <main className="flex-1 h-full bg-white relative overflow-hidden flex flex-col rounded-tl-[30px] shadow-[-5px_0_20px_rgba(0,0,0,0.02)]">
                <Outlet />
            </main>

            {/* Global Create Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
                        <h2 className="text-xl font-bold mb-6">Plan a New Trip</h2>
                        <form onSubmit={handleCreateTrip} className="space-y-4">
                            <input required type="text" placeholder="Title" className="w-full border rounded-lg p-3 text-sm focus:outline-none" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
                            <div className="flex gap-3 justify-end mt-6">
                                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 text-sm text-stone-600 hover:bg-stone-100 rounded-lg font-semibold">Cancel</button>
                                <button type="submit" disabled={isSaving} className="bg-stone-900 text-white px-5 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50">Create Trip</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}