import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import routes from './routes/index.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.corsOrigins.includes('*') ? true : env.corsOrigins,
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
if (!env.isProd) app.use(morgan('dev'));

// Basic abuse protection on auth endpoints.
app.use(
  '/api/auth',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true })
);

// The geocode proxy is public and forwards to free upstream providers
// (Photon/Nominatim) that ban abusive callers — throttle per IP so a single
// client can't get our server's IP blocked for everyone. Tuned for typeahead.
app.use(
  '/api/geocode',
  rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true })
);

app.use('/api', routes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
