import { Outlet, useNavigate, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { auth } from './firebase';
import { signOut, onAuthStateChanged } from 'firebase/auth';

export default function Layout() {
    const navigate = useNavigate();
    const [currentUser, setCurrentUser] = useState(null);

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

    return (
        <div className="min-h-screen bg-gray-50">
            {/* GLOBAL NAVIGATION BAR */}
            <nav className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center shadow-sm sticky top-0 z-50">
                <Link to="/dashboard" className="text-2xl font-bold text-indigo-600 hover:text-indigo-700 transition">
                    GoLocal
                </Link>
                
                {currentUser && (
                    <div className="flex gap-3 sm:gap-4 items-center">
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
                        
                        <div className="h-8 w-px bg-gray-200 mx-1 hidden sm:block"></div>
                        
                        <button onClick={handleLogout} className="text-red-600 hover:text-red-700 font-medium bg-red-50 hover:bg-red-100 px-3 sm:px-4 py-2 rounded-lg transition text-sm sm:text-base">
                            Sign Out
                        </button>
                    </div>
                )}
            </nav>

            {/* DYNAMIC PAGE CONTENT INJECTED HERE */}
            <main>
                <Outlet />
            </main>
        </div>
    );
}