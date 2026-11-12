import express from 'express';
import { eq, and, isNull } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { verifyToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { profileUpdateSchema } from '../validations/schemas.js';

const router = express.Router();

router.post('/sync', verifyToken, async (req, res) => {
  try {
    const { uid, email, name, picture } = req.user;
    const normalizedEmail = email.toLowerCase().trim();
    
    const existingUser = await db.select().from(schema.users).where(eq(schema.users.id, uid));
    let currentUser = existingUser[0];

    if (!currentUser) {
      const newUser = await db.insert(schema.users).values({
        id: uid,
        email: normalizedEmail,
        name: name || 'GoLocal User',
        avatarUrl: picture || null,
      }).returning();
      currentUser = newUser[0];
    }

    await db.update(schema.tripMembers)
      .set({
        userId: uid,
        inviteEmail: null,
        status: 'accepted' 
      })
      .where(
        and(
          eq(schema.tripMembers.inviteEmail, normalizedEmail),
          isNull(schema.tripMembers.userId) 
        )
      );

    res.status(200).json({ message: 'User synced and trips auto-linked', user: currentUser });
  } catch (error) {
    console.error('Error syncing user:', error);
    res.status(500).json({ error: 'Failed to sync user' });
  }
});

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

// UPDATE PROFILE (Added validate)
router.put('/me', verifyToken, validate(profileUpdateSchema), async (req, res) => {
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