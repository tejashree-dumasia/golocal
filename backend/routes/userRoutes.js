import express from 'express';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// Existing Sync Route
router.post('/sync', verifyToken, async (req, res) => {
  try {
    const { uid, email, name, picture } = req.user;
    const existingUser = await db.select().from(schema.users).where(eq(schema.users.id, uid));

    if (existingUser.length > 0) {
      return res.status(200).json({ message: 'User already exists', user: existingUser[0] });
    }

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

// NEW: Get Current User Profile
router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await db.select().from(schema.users).where(eq(schema.users.id, req.user.uid));
    
    if (user.length === 0) return res.status(404).json({ error: 'User not found in database' });
    
    res.status(200).json({ user: user[0] });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// NEW: Update Current User Profile
router.put('/me', verifyToken, async (req, res) => {
  try {
    const { name, phone, altPhone, requireApproval } = req.body;
    
    const updatedUser = await db.update(schema.users).set({
      name,
      phone: phone || null,
      altPhone: altPhone || null,
      requireApproval: requireApproval || false,
      updatedAt: new Date(),
    })
    .where(eq(schema.users.id, req.user.uid))
    .returning();

    res.status(200).json({ message: 'Profile updated successfully', user: updatedUser[0] });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

export default router;