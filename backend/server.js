import 'dotenv/config';
import { createServer } from 'http';
import { Server } from 'socket.io';
import express from 'express';
import cors from 'cors';
import { getAuth } from 'firebase-admin/auth';

// 1. Import configurations
import { db, schema } from './db/index.js';
import { firebaseApp } from './middleware/auth.js';

// 2. Import Routes
import userRoutes from './routes/userRoutes.js';
import tripRoutes from './routes/tripRoutes.js';

const app = express();

// 3. Global Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true
}));
app.use(express.json());

// 4. Mount Routes
app.get('/api/v1/health', (req, res) => res.status(200).json({ status: 'success', message: 'GoLocal API is live.' }));
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/trips', tripRoutes);

// 5. Socket.io Setup
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

// Secure Socket Middleware
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  if (socket.handshake.headers['x-mock-uid']) {
    socket.user = { uid: socket.handshake.headers['x-mock-uid'] };
    return next();
  }
  if (!token) return next(new Error("Authentication error: No token provided"));
  try {
    const decodedToken = await getAuth(firebaseApp).verifyIdToken(token);
    socket.user = decodedToken; 
    next();
  } catch (error) {
    next(new Error("Authentication error: Invalid token"));
  }
});

io.on('connection', (socket) => {
  socket.on('join_trip', (tripId) => socket.join(tripId));
  socket.on('leave_trip', (tripId) => socket.leave(tripId));
  
  socket.on('send_message', async (data) => {
    try {
      const newMessage = await db.insert(schema.messages).values({
        tripId: data.tripId,
        senderId: socket.user.uid, 
        content: data.text     
      }).returning();

      io.to(data.tripId).emit('receive_message', {
        ...newMessage[0],
        displayName: data.displayName
      });
    } catch (error) {
      console.error('Error saving message:', error);
    }
  });
});

// 6. Start Server
const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`🚀 Server & WebSockets running on http://localhost:${port}`);
});