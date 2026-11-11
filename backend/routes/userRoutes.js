import express from 'express';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

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

export default router;