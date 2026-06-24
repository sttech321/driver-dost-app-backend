import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function signAuthToken(user) {
  return jwt.sign(
    { sub: user.id, phone: user.phone, email: user.email },
    env.jwt.secret,
    { expiresIn: env.jwt.expiresIn }
  );
}

export function verifyAuthToken(token) {
  return jwt.verify(token, env.jwt.secret);
}
