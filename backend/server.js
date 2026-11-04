import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY);
import { createServer } from 'http';
import { Server } from 'socket.io';
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pkg from 'pg';
const { Pool } = pkg;
import { drizzle } from 'drizzle-orm/node-postgres';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';

// Import your schema correctly for ES Modules
import * as schema from './db/schema.js';
import { eq } from 'drizzle-orm';

// 1. Initialize Firebase Admin (Reading the JSON file in ES Modules)
const serviceAccount = JSON.parse(fs.readFileSync(new URL('./firebase-admin-key.json', import.meta.url)));

const firebaseApp = initializeApp({
  credential: cert(serviceAccount)
});

// 2. Initialize Express & DB
const app = express();
app.use(cors({
  origin: "http://localhost:5173",
  credentials: true
}));
app.use(express.json());

const server = createServer(app); // Wraps Express in a core Node HTTP server
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // Allows React to connect
    methods: ["GET", "POST"]
  }
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const db = drizzle(pool);

// 3. The Auth Middleware
const verifyToken = async (req, res, next) => {
  // TEMP BYPASS FOR THUNDER CLIENT TESTING
  if (req.headers['x-mock-uid']) {
    req.user = { uid: req.headers['x-mock-uid'], name: 'Thunder Client User', email: 'test@test.com' };
    return next();
  }

  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decodedToken = await getAuth(firebaseApp).verifyIdToken(token);
    req.user = decodedToken; 
    next();
  } catch (error) {
    res.status(403).json({ error: 'Unauthorized token' });
  }
};

// 4. Routes
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({ status: 'success', message: 'GoLocal API is live and ready.' });
});

// SYNC USER ROUTE
app.post('/api/v1/users/sync', verifyToken, async (req, res) => {
  try {
    const { uid, email, name, picture } = req.user;

    // Check if user already exists
    const existingUser = await db.select().from(schema.users).where(eq(schema.users.id, uid));

    if (existingUser.length > 0) {
      return res.status(200).json({ message: 'User already exists', user: existingUser[0] });
    }

    // Insert new user
    const newUser = await db.insert(schema.users).values({
      id: uid,
      email: email,
      name: name || 'GoLocal User',
      avatarUrl: picture || null,
    }).returning();

    res.status(201).json({ message: 'User created in database', user: newUser[0] });
  } catch (error) {
    console.error('Error syncing user:', error);
    res.status(500).json({ error: 'Failed to sync user' });
  }
});

// CREATE TRIP ROUTE
app.post('/api/v1/trips', verifyToken, async (req, res) => {
  try {
    const { title, description, budget } = req.body;
    const userId = req.user.uid; 

    // 1. Insert the new trip into the database
    const newTrip = await db.insert(schema.trips).values({
      title,
      description: description || null,
      budget: budget || null,
    }).returning();

    const tripId = newTrip[0].id;

    // 2. Automatically add the creator as the 'host' in trip_members
    await db.insert(schema.tripMembers).values({
      tripId: tripId,
      userId: userId,
      displayName: req.user.name || 'Host',
      role: 'host',
      status: 'accepted'
    });

    res.status(201).json({ message: 'Trip created successfully', trip: newTrip[0] });
  } catch (error) {
    console.error('Error creating trip:', error);
    res.status(500).json({ error: 'Failed to create trip' });
  }
});
// GET ALL TRIPS FOR LOGGED-IN USER
app.get('/api/v1/trips', verifyToken, async (req, res) => {
  try {
    const userId = req.user.uid;

    // Join the trips and trip_members tables to find the user's trips
    const userTrips = await db
      .select({
        id: schema.trips.id,
        title: schema.trips.title,
        description: schema.trips.description,
        budget: schema.trips.budget,
        role: schema.tripMembers.role,
        status: schema.tripMembers.status
      })
      .from(schema.trips)
      .innerJoin(schema.tripMembers, eq(schema.trips.id, schema.tripMembers.tripId))
      .where(eq(schema.tripMembers.userId, userId));

    res.status(200).json({ trips: userTrips });
  } catch (error) {
    console.error('Error fetching trips:', error);
    res.status(500).json({ error: 'Failed to fetch trips' });
  }
});

// GET ALL LOCATIONS FOR A SPECIFIC TRIP
app.get('/api/v1/trips/:tripId/locations', verifyToken, async (req, res) => {
  try {
    const { tripId } = req.params;
    
    // Fetch all locations linked to this trip
    const locations = await db.select()
      .from(schema.tripLocations)
      .where(eq(schema.tripLocations.tripId, tripId));

    res.status(200).json({ locations });
  } catch (error) {
    console.error('Error fetching locations:', error);
    res.status(500).json({ error: 'Failed to fetch locations' });
  }
});

// ADD A NEW LOCATION TO A TRIP
app.post('/api/v1/trips/:tripId/locations', verifyToken, async (req, res) => {
  try {
    const { tripId } = req.params;
    const { name, address, lat, lng, dayNumber, sortOrder } = req.body;

    // Insert the new place into the database
    const newLocation = await db.insert(schema.tripLocations).values({
      tripId,
      name,
      address: address || null,
      lat: lat ? String(lat) : null,
      lng: lng ? String(lng) : null,
      dayNumber: dayNumber || 1,
      sortOrder: sortOrder || 0
    }).returning();

    res.status(201).json({ message: 'Location added successfully', location: newLocation[0] });
  } catch (error) {
    console.error('Error adding location:', error);
    res.status(500).json({ error: 'Failed to add location' });
  }
});

 // GET ALL MESSAGES FOR A TRIP
app.get('/api/v1/trips/:tripId/messages', verifyToken, async (req, res) => {
  try {
    const { tripId } = req.params;
    
    // Fetch chat history from the database
    const chatHistory = await db.select()
      .from(schema.messages)
      .where(eq(schema.messages.tripId, tripId));

    res.status(200).json({ messages: chatHistory });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});
// INVITE A FRIEND VIA EMAIL
// app.post('/api/v1/trips/:tripId/invite', verifyToken, async (req, res) => {
//   try {
//     const { tripId } = req.params;
//     const { email } = req.body;

//     const { data, error } = await resend.emails.send({
//       from: 'GoLocal <onboarding@resend.dev>', // Resend's testing email
//       to: email, // Enter your own email when testing on the free tier
//       subject: 'You have been invited to a GoLocal trip!',
//       html: `
//         <h2>Pack your bags! 🎒</h2>
//         <p>Your friend has invited you to collaborate on a trip itinerary.</p>
//         <a href="http://localhost:5173/trip/${tripId}" style="display:inline-block; padding:10px 20px; background-color:#4f46e5; color:white; text-decoration:none; border-radius:5px;">
//           Open Trip Workspace
//         </a>
//       `
//     });

//     if (error) {
//       console.error('Resend error:', error);
//       return res.status(400).json({ error });
//     }

//     res.status(200).json({ message: 'Invite sent successfully', data });
//   } catch (error) {
//     console.error('Error sending invite:', error);
//     res.status(500).json({ error: 'Failed to send invite' });
//   }
// });

// INVITE A FRIEND VIA EMAIL
app.post('/api/v1/trips/:tripId/invite', verifyToken, async (req, res) => {
  try {
    const { tripId } = req.params;
    const { email } = req.body;

    const { data, error } = await resend.emails.send({
      // 1. Update the 'from' email to use your verified domain
      from: 'GoLocal <itejashreedumasia.me>', 
      // 2. You can now pass the user's input email directly
      to: email, 
      subject: 'You have been invited to a GoLocal trip!',
      html: `
        <h2>Pack your bags! 🎒</h2>
        <p>Your friend has invited you to collaborate on a trip itinerary.</p>
        <a href="http://localhost:5173/trip/${tripId}" style="display:inline-block; padding:10px 20px; background-color:#4f46e5; color:white; text-decoration:none; border-radius:5px;">
          Open Trip Workspace
        </a>
      `
    });

    if (error) {
      console.error('Resend error:', error);
      return res.status(400).json({ error });
    }

    res.status(200).json({ message: 'Invite sent successfully', data });
  } catch (error) {
    console.error('Error sending invite:', error);
    res.status(500).json({ error: 'Failed to send invite' });
  }
});

// SOCKET.IO REAL-TIME CHAT HUB
io.on('connection', (socket) => {
  
  // 1. User joins a specific trip's chat room
  socket.on('join_trip', (tripId) => {
    socket.join(tripId);
  });

  
 // 2. User sends a message
  socket.on('send_message', async (data) => {
    try {
      const newMessage = await db.insert(schema.messages).values({
        tripId: data.tripId,
        senderId: data.userId, // Matches database schema
        content: data.text     // Matches database schema
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

// START SERVER
const port = process.env.PORT || 3000; // <-- Added this missing line back
server.listen(port, () => {
  console.log(`🚀 Server & WebSockets running on http://localhost:${port}`);
});