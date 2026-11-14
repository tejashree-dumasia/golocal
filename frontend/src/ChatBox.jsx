import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { fetchApi } from './utils/apiClient';

export default function ChatBox({ tripId }) {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [socket, setSocket] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const chatContainerRef = useRef(null);

    useEffect(() => {
        let activeSocket;
        const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    const token = await user.getIdToken();
                    const data = await fetchApi(`/trips/${tripId}/messages`);
                    setMessages(data.messages || []);

                    const socketUrl = import.meta.env.VITE_API_BASE_URL.replace('/api/v1', '');
                    activeSocket = io(socketUrl, { auth: { token } });
                    setSocket(activeSocket);

                    activeSocket.on('connect', () => setIsConnected(true));
                    activeSocket.on('disconnect', () => setIsConnected(false));

                    activeSocket.emit('join_trip', tripId);
                    activeSocket.on('receive_message', (message) => {
                        setMessages((prev) => [...prev, message]);
                    });
                } catch (error) {
                    console.error('Chat init failed:', error);
                }
            }
        });

        return () => {
            unsubscribeAuth();
            if (activeSocket) {
                activeSocket.emit('leave_trip', tripId);
                activeSocket.disconnect();
            }
        };
    }, [tripId]);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    const sendMessage = (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !socket) return;
        
        socket.emit('send_message', {
            tripId,
            displayName: auth.currentUser?.displayName || 'Traveler',
            text: newMessage
        });
        setNewMessage('');
    };

    return (
        <div className="flex flex-col h-full bg-[#FDFDFD]">
            {/* Chat Top Sub-Header */}
            <div className="px-8 py-3 flex justify-between items-center bg-[#FDFDFD] sticky top-0 z-10">
                <span className="text-[15px] font-medium text-stone-800">Trip Chat</span>
                <span className="text-[11px] font-semibold text-stone-600 bg-stone-100/80 px-3 py-1 rounded-full">Today</span>
                <div className="w-[60px]"></div> {/* Spacer for balance */}
            </div>

            {/* Chat Messages */}
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-8 pt-4 pb-8 space-y-6">
                {messages.map((msg, i) => {
                    const isMe = msg.senderId === auth.currentUser?.uid;
                    // Mock alternating colors for other users to match screenshot
                    const isHost = msg.displayName?.includes('Aditi') || (i % 2 !== 0 && !isMe); 
                    
                    return (
                        <div key={i} className={`flex flex-col max-w-[75%] ${isMe ? 'self-end items-end ml-auto' : 'items-start'}`}>
                            {!isMe && (
                                <span className="text-[12px] font-semibold text-stone-800 mb-1 ml-1">
                                    {msg.displayName} {isHost ? '(Host)' : '(Co-Host)'}
                                </span>
                            )}
                            <div className={`px-4 py-2.5 text-[14px] leading-relaxed relative ${
                                isMe 
                                ? 'bg-[#519B9B] text-white rounded-2xl rounded-br-sm' 
                                : isHost
                                  ? 'bg-[#E8F0FE] text-[#1A1A1A] rounded-2xl rounded-bl-sm'
                                  : 'bg-[#4A6482] text-white rounded-2xl rounded-bl-sm'
                            }`}>
                                {msg.content}
                                <div className="text-right mt-1">
                                    <span className={`text-[10px] ${isMe || !isHost ? 'text-white/70' : 'text-stone-500'}`}>12:15 PM {isMe && '✓'}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Chat Input */}
            <div className="p-6 bg-[#FDFDFD]">
                <form onSubmit={sendMessage} className="relative flex items-center bg-white border border-stone-200 rounded-full shadow-sm p-1.5 pl-5">
                    <input 
                        type="text" 
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder={isConnected ? "Message #crew..." : "Connecting..."} 
                        className="flex-1 bg-transparent text-[14px] focus:outline-none text-stone-700 placeholder:text-stone-400"
                        disabled={!isConnected}
                    />
                    
                    <div className="flex items-center gap-3 pr-2 text-stone-400">
                        <button type="button" className="hover:text-stone-600"><svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></button>
                        <button type="button" className="hover:text-stone-600"><svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></button>
                        <button type="button" className="hover:text-stone-600"><svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg></button>
                    </div>

                    <button 
                        type="submit" 
                        disabled={!isConnected || !newMessage.trim()}
                        className="ml-1 bg-gradient-to-tr from-[#EC688F] to-[#EE826E] text-white rounded-full w-9 h-9 flex items-center justify-center shadow-sm disabled:opacity-50 hover:opacity-90 transition-opacity"
                    >
                        <svg className="w-4 h-4 ml-0.5 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                    </button>
                </form>
            </div>
        </div>
    );
}