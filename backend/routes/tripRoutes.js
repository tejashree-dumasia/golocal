import express from 'express';
import { eq, and, or, arrayContains } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { verifyToken } from '../middleware/auth.js';
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import { Resend } from 'resend';
import 'dotenv/config';

const router = express.Router();
const resend = new Resend(process.env.RESEND_API_KEY);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.post('/', verifyToken, async (req, res) => {
  try {
    const { title, description, budget } = req.body;
    const userId = req.user.uid; 

    const newTrip = await db.insert(schema.trips).values({
      title,
      description: description || null,
      budget: budget || null,
    }).returning();

    await db.insert(schema.tripMembers).values({
      tripId: newTrip[0].id,
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

router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.uid;
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

router.get('/:tripId/locations', verifyToken, async (req, res) => {
  try {
    const locations = await db.select().from(schema.tripLocations).where(eq(schema.tripLocations.tripId, req.params.tripId));
    res.status(200).json({ locations });
  } catch (error) {
    console.error('Error fetching locations:', error);
    res.status(500).json({ error: 'Failed to fetch locations' });
  }
});

router.post('/:tripId/locations', verifyToken, async (req, res) => {
  try {
    const { tripId } = req.params;
    const { name, address, lat, lng, dayNumber, sortOrder } = req.body;

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

// DELETE LOCATION
router.delete('/:tripId/locations/:locationId', verifyToken, async (req, res) => {
  try {
    const { tripId, locationId } = req.params;

    await db.delete(schema.tripLocations)
      .where(
        eq(schema.tripLocations.id, locationId)
      );

    res.status(200).json({ message: 'Location deleted successfully' });
  } catch (error) {
    console.error('Error deleting location:', error);
    res.status(500).json({ error: 'Failed to delete location' });
  }
});

// NEW: GET MEMBERS
router.get('/:tripId/members', verifyToken, async (req, res) => {
  try {
    const members = await db
      .select({
        id: schema.tripMembers.id,
        userId: schema.tripMembers.userId,
        displayName: schema.tripMembers.displayName,
        role: schema.tripMembers.role,
        status: schema.tripMembers.status
      })
      .from(schema.tripMembers)
      .where(eq(schema.tripMembers.tripId, req.params.tripId));
      
    res.status(200).json({ members });
  } catch (error) {
    console.error('Error fetching members:', error);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// UPDATED: GET PHOTOS WITH PRIVACY FILTER
router.get('/:tripId/photos', verifyToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    
    const tripPhotos = await db.select().from(schema.photos)
      .where(
        and(
          eq(schema.photos.tripId, req.params.tripId),
          or(
            arrayContains(schema.photos.visibility, ['ALL']),
            arrayContains(schema.photos.visibility, [userId]),
            eq(schema.photos.uploaderId, userId)
          )
        )
      );
      
    res.status(200).json({ photos: tripPhotos });
  } catch (error) {
    console.error('Error fetching photos:', error);
    res.status(500).json({ error: 'Failed to fetch photos' });
  }
});

// UPDATED: POST PHOTOS WITH TAGS
router.post('/:tripId/photos', verifyToken, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image file provided' });

    let visibilityArray = ['ALL'];
    if (req.body.visibility) {
       try {
         visibilityArray = JSON.parse(req.body.visibility);
       } catch (e) {
         visibilityArray = req.body.visibility.split(',');
       }
    }

    const uploadToCloudinary = (buffer) => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: `golocal/trips/${req.params.tripId}` }, 
          (error, result) => result ? resolve(result) : reject(error)
        );
        stream.end(buffer);
      });
    };

    const cloudResult = await uploadToCloudinary(req.file.buffer);

    const newPhoto = await db.insert(schema.photos).values({
      tripId: req.params.tripId,
      uploaderId: req.user.uid,
      imageUrl: cloudResult.secure_url,
      visibility: visibilityArray
    }).returning();

    res.status(201).json({ message: 'Photo uploaded', photo: newPhoto[0] });
  } catch (error) {
    console.error('Error uploading photo:', error);
    res.status(500).json({ error: 'Failed to upload photo' });
  }
});

router.get('/:tripId/messages', verifyToken, async (req, res) => {
  try {
    const chatHistory = await db
      .select({
        id: schema.messages.id,
        tripId: schema.messages.tripId,
        senderId: schema.messages.senderId,
        content: schema.messages.content,
        createdAt: schema.messages.createdAt,
        displayName: schema.users.name 
      })
      .from(schema.messages)
      .leftJoin(schema.users, eq(schema.messages.senderId, schema.users.id))
      .where(eq(schema.messages.tripId, req.params.tripId))
      .orderBy(schema.messages.createdAt); 

    res.status(200).json({ messages: chatHistory });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

router.post('/:tripId/invite', verifyToken, async (req, res) => {
  try {
    const { email } = req.body;
    const { data, error } = await resend.emails.send({
      from: 'GoLocal <invite@tejashreedumasia.me>', 
      to: email, 
      subject: 'You have been invited to a GoLocal trip!',
      html: `
        <h2>Pack your bags! 🎒</h2>
        <p>Your friend has invited you to collaborate on a trip itinerary.</p>
        <a href="http://localhost:5173/trip/${req.params.tripId}" style="display:inline-block; padding:10px 20px; background-color:#4f46e5; color:white; text-decoration:none; border-radius:5px;">
          Open Trip Workspace
        </a>
      `
    });

    if (error) return res.status(400).json({ error });
    res.status(200).json({ message: 'Invite sent successfully', data });
  } catch (error) {
    console.error('Error sending invite:', error);
    res.status(500).json({ error: 'Failed to send invite' });
  }
});

export default router;