import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(fs.readFileSync(new URL('../firebase-admin-key.json', import.meta.url)));
export const firebaseApp = initializeApp({
  credential: cert(serviceAccount)
});

// The Auth Middleware
export const verifyToken = async (req, res, next) => {
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