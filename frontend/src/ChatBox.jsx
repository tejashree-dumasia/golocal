import { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import { auth } from './firebase'

const socket = io('http://localhost:3000')

export default function ChatBox({ tripId }) {
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const chatContainerRef = useRef(null)

  useEffect(() => {
    // 1. Fetch existing chat history from Postgres
    const fetchHistory = async () => {
      try {
        const user = auth.currentUser
        if (!user) return
        const token = await user.getIdToken()
        
        const response = await fetch(`http://localhost:3000/api/v1/trips/${tripId}/messages`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        
        const data = await response.json()
        if (response.ok) {
          setMessages(data.messages)
        }
      } catch (error) {
        console.error('Failed to load chat history:', error)
      }
    }

    fetchHistory()

    // 2. Connect to live socket room
    socket.emit('join_trip', tripId)

    // 3. Listen for new incoming messages
    socket.on('receive_message', (message) => {
      setMessages((prev) => [...prev, message])
    })

    return () => {
      socket.off('receive_message')
    }
  }, [tripId])

  // Auto-scroll to the bottom when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [messages])

  const sendMessage = (e) => {
    e.preventDefault()
    if (!newMessage.trim()) return

    const user = auth.currentUser
    
    socket.emit('send_message', {
      tripId,
      userId: user.uid,
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
        <span className="text-xs text-indigo-400 font-medium">History Synced</span>
      </div>
      
      <div ref={chatContainerRef} className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.length === 0 ? (
          <p className="text-gray-400 text-center text-sm mt-10">No messages yet. Say hi!</p>
        ) : (
        messages.map((msg, i) => {
            // Updated to use senderId instead of userId
            const isMe = msg.senderId === auth.currentUser?.uid
            return (
              <div key={i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <span className="text-xs text-gray-500 mb-1 px-1">{msg.displayName || 'Traveler'}</span>
                <div className={`px-4 py-2 rounded-2xl max-w-[85%] text-sm ${
                  isMe ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-gray-100 text-gray-800 rounded-bl-none'
                }`}>
                  {/* Updated to render msg.content instead of msg.text */}
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
        />
        <button type="submit" className="bg-indigo-600 text-white rounded-full w-10 h-10 flex items-center justify-center hover:bg-indigo-700 transition">
          &#10148;
        </button>
      </form>
    </div>
  )
}