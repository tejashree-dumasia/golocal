import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { fetchApi } from './utils/apiClient';

export default function Profile() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        altPhone: '',
        requireApproval: false,
        avatarUrl: '', // Add avatarUrl to state
    });

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    const data = await fetchApi('/users/me');
                    setFormData({
                        name: data.user.name || '',
                        email: data.user.email || '',
                        phone: data.user.phone || '',
                        altPhone: data.user.altPhone || '',
                        requireApproval: data.user.requireApproval || false,
                        avatarUrl: data.user.avatarUrl || '', // Set avatarUrl
                    });
                } catch (error) {
                    console.error('Error fetching profile:', error);
                } finally {
                    setLoading(false);
                }
            } else {
                navigate('/');
            }
        });
        return () => unsubscribe();
    }, [navigate]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await fetchApi('/users/me', {
                method: 'PUT',
                body: JSON.stringify({
                    name: formData.name,
                    phone: formData.phone,
                    altPhone: formData.altPhone,
                    requireApproval: formData.requireApproval
                })
            });
            alert('Profile updated successfully!');
        } catch (error) {
            console.error('Error updating profile:', error);
            alert('Failed to update profile.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleLogout = async () => {
        await signOut(auth);
        navigate('/');
    };

    // Helper to get initials if there is no avatar URL
    const getInitials = (name) => {
        if (!name) return '?';
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading profile...</div>;

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-2xl mx-auto">
                <button
                    onClick={() => navigate('/dashboard')}
                    className="text-indigo-600 mb-6 font-medium hover:underline flex items-center gap-2"
                >
                    &larr; Back to Dashboard
                </button>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
                    <div className="flex justify-between items-center mb-8 pb-4 border-b border-gray-100">
                        <h1 className="text-2xl font-bold text-gray-900">Profile Settings</h1>
                        <button onClick={handleLogout} className="text-sm font-medium text-red-600 hover:text-red-700 bg-red-50 px-3 py-1.5 rounded-lg">
                            Sign Out
                        </button>
                    </div>

                    <form onSubmit={handleSave} className="space-y-6">
                        
                        {/* --- NEW AVATAR DISPLAY --- */}
                        <div className="flex flex-col items-center mb-6">
                            {formData.avatarUrl ? (
                                <img 
                                    src={formData.avatarUrl} 
                                    alt="Profile Avatar" 
                                    className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md mb-3"
                                    referrerPolicy="no-referrer" // Prevents issues loading Google profile images
                                />
                            ) : (
                                <div className="w-24 h-24 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-2xl font-bold border-4 border-white shadow-md mb-3">
                                    {getInitials(formData.name)}
                                </div>
                            )}
                            <p className="text-sm text-gray-500">Managed via Google</p>
                        </div>
                        {/* --------------------------- */}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Email (Read Only) */}
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                                <input 
                                    type="email" 
                                    disabled 
                                    value={formData.email} 
                                    className="w-full border border-gray-200 bg-gray-50 rounded-lg p-2.5 text-gray-500 cursor-not-allowed"
                                />
                                <p className="text-xs text-gray-400 mt-1">Email cannot be changed.</p>
                            </div>

                            {/* Display Name */}
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
                                <input 
                                    type="text" 
                                    name="name"
                                    required
                                    value={formData.name} 
                                    onChange={handleChange}
                                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none transition"
                                />
                            </div>

                            {/* Phone Numbers */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                                <input 
                                    type="tel" 
                                    name="phone"
                                    placeholder="+91..."
                                    value={formData.phone} 
                                    onChange={handleChange}
                                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none transition"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Emergency / Alt Phone</label>
                                <input 
                                    type="tel" 
                                    name="altPhone"
                                    placeholder="+91..."
                                    value={formData.altPhone} 
                                    onChange={handleChange}
                                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none transition"
                                />
                            </div>
                        </div>

                        {/* Privacy Settings */}
                        <div className="pt-6 border-t border-gray-100">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">Privacy & Permissions</h3>
                            <label className="flex items-start gap-3 cursor-pointer p-4 bg-gray-50 rounded-lg border border-gray-200">
                                <input 
                                    type="checkbox" 
                                    name="requireApproval"
                                    checked={formData.requireApproval}
                                    onChange={handleChange}
                                    className="mt-1 w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                />
                                <div>
                                    <span className="block text-sm font-semibold text-gray-900">Require Approval for Trip Invites</span>
                                    <span className="block text-sm text-gray-500 mt-1">If enabled, friends cannot automatically add you to their trips. You will receive an invitation to accept or decline first.</span>
                                </div>
                            </label>
                        </div>

                        <div className="pt-4 flex justify-end">
                            <button 
                                type="submit" 
                                disabled={isSaving}
                                className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
                            >
                                {isSaving ? 'Saving Changes...' : 'Save Settings'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}