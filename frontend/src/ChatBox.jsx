import { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import { auth } from './firebase'
import { onAuthStateChanged } from 'firebase/auth'

export default function ChatBox({ tripId }) {
    const [messages, setMessages] = useState([])
    const [newMessage, setNewMessage] = useState('')
    const [socket, setSocket] = useState(null)
    const chatContainerRef = useRef(null)

    useEffect(() => {
        let activeSocket;

        const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    const token = await user.getIdToken()

                    // 1. Fetch History
                    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/trips/${tripId}/messages`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    })
                    if (response.ok) {
                        const data = await response.json()
                        setMessages(data.messages)
                    }

                    // 2. Initialize Secure Socket Connection
                    // We remove '/api/v1' from the base URL if it's there to hit the root socket server
                    const socketUrl = import.meta.env.VITE_API_BASE_URL.replace('/api/v1', '')
                    activeSocket = io(socketUrl, {
                        auth: { token } // Pass the token in the handshake!
                    })

                    setSocket(activeSocket)

                    activeSocket.emit('join_trip', tripId)
                    
                    activeSocket.on('receive_message', (message) => {
                        setMessages((prev) => [...prev, message])
                    })

                    activeSocket.on('connect_error', (err) => {
                        console.error('Socket connection error:', err.message)
                    })

                } catch (error) {
                    console.error('Failed to initialize chat:', error)
                }
            }
        })

        // 3. Cleanup everything on unmount
        return () => {
            unsubscribeAuth()
            if (activeSocket) {
                activeSocket.emit('leave_trip', tripId)
                activeSocket.disconnect()
            }
        }
    }, [tripId])

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
        }
    }, [messages])

    const sendMessage = (e) => {
        e.preventDefault()
        if (!newMessage.trim() || !socket) return

        const user = auth.currentUser
        if (!user) {
            alert("Session expired. Please refresh the page.")
            return
        }
        
        socket.emit('send_message', {
            tripId,
            displayName: user.displayName || 'Traveler',
            text: newMessage
        })

        setNewMessage('')
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col h-[600px]">
            <div className="p-4 border-b bg-indigo-50 rounded-t-xl flex justify-between items-center">
                <h2 className="text-lg font-bold text-indigo-900 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    Live Chat
                </h2>
                <span className="text-xs text-indigo-400 font-medium">
                    {socket?.connected ? 'Securely Connected' : 'Connecting...'}
                </span>
            </div>
            
            <div ref={chatContainerRef} className="flex-1 p-4 overflow-y-auto space-y-4">
                {messages.length === 0 ? (
                    <p className="text-gray-400 text-center text-sm mt-10">No messages yet. Say hi!</p>
                ) : (
                messages.map((msg, i) => {
                    const isMe = msg.senderId === auth.currentUser?.uid
                    return (
                        <div key={i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                            <span className="text-xs text-gray-500 mb-1 px-1">{msg.displayName || 'Traveler'}</span>
                            <div className={`px-4 py-2 rounded-2xl max-w-[85%] text-sm ${
                                isMe ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-gray-100 text-gray-800 rounded-bl-none'
                            }`}>
                                {msg.content} 
                            </div>
                        </div>
                    )
                })
                )}
            </div>

            <form onSubmit={sendMessage} className="p-4 border-t flex gap-2">
                <input 
                    type="text" 
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..." 
                    className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    disabled={!socket?.connected}
                />
                <button 
                    type="submit" 
                    disabled={!socket?.connected}
                    className="bg-indigo-600 text-white rounded-full w-10 h-10 flex items-center justify-center hover:bg-indigo-700 transition disabled:opacity-50"
                >
                    &#10148;
                </button>
            </form>
        </div>
    )
}