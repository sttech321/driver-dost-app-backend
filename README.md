# Driver Dost — Backend

Node.js + Express + Prisma + PostgreSQL API for the Driver Dost app.

## Stack
- **Express** (REST API, ESM)
- **Prisma** ORM + **PostgreSQL**
- **Firebase Admin** to verify phone-OTP & Google ID tokens (with a built-in OTP fallback)
- **JWT** for our own session tokens
- **Zod** request validation, **helmet**, **cors**, **morgan**, rate limiting

## Project structure
```
prisma/
  schema.prisma        # data model (users, drivers, saved_places, bookings, chat, otp)
  seed.js              # seeds demo drivers (Sunil Kumar DDO023, etc.)
src/
  config/              # env, prisma client, firebase admin
  controllers/         # request handlers
  services/            # business logic (auth, otp, booking, driver, pricing)
  routes/              # express routers
  middleware/          # requireAuth, validate, errorHandler
  validators/          # zod schemas
  utils/               # ApiError, asyncHandler, jwt, password
  app.js               # express app
  server.js            # bootstrap
```

## Setup
```bash
npm install
cp .env.example .env          # then edit values
# create the database, then:
npm run prisma:migrate        # creates tables
npm run seed                  # demo drivers
npm run dev                   # http://localhost:4000
```

### Environment
See `.env.example`. Minimum: `DATABASE_URL`, `JWT_SECRET`.
Firebase is optional — if not configured, phone verification uses the
fallback OTP store (`/api/auth/otp/send` logs the code to the console in dev).

### Firebase (recommended)
Firebase console → Project settings → Service accounts → *Generate new private key*,
save the JSON as `firebase-service-account.json` (git-ignored) or inline the
`FIREBASE_*` vars. The app then verifies the ID token the mobile app obtains
after Google sign-in or phone-OTP.

## API
Base URL: `/api`

### Auth (`/api/auth`)
| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/config` | – | `{ firebaseEnabled }` |
| POST | `/register` | `phone, password, name?, email?, role?` | phone+password signup (`role`: USER\|DRIVER) |
| POST | `/login` | `phone, password` | |
| POST | `/firebase` | `idToken` | Google sign-in / Firebase phone OTP |
| POST | `/otp/send` | `phone` | fallback OTP (dev logs code) |
| POST | `/otp/verify` | `phone, code` | fallback OTP → session |
| POST | `/forgot-password` | `phone, newPassword, code? \| firebaseIdToken?` | |

Auth responses return `{ user, token }`. Send `Authorization: Bearer <token>` on protected routes.

### Users (`/api/users`, auth required)
- `GET /me`, `PATCH /me`
- `GET /me/saved-places`, `POST /me/saved-places`, `DELETE /me/saved-places/:id`

### Drivers (`/api/drivers`, auth required)
- `GET /recommended?lat=&lng=&limit=`
- `GET /:id`

### Geocoding (`/api/geocode`, public, rate-limited)
- `GET /search?q=&lat=&lng=&limit=` — address autocomplete (OpenStreetMap/Photon, no key)
- `GET /reverse?lat=&lng=` — coordinates → address

### Bookings (`/api/bookings`, auth required)
- `POST /one-way`, `POST /hourly`, `POST /outstation` — created as **REQUESTED** (a driver accepts them)
- `GET /`, `GET /:id`, `POST /:id/cancel`, `POST /:id/pay`
- `GET /:bookingId/messages`, `POST /:bookingId/messages` (live chat)

### Driver portal (`/api/driver`, auth + DRIVER role required)
- `GET /me` — the logged-in driver's profile
- `GET /requests` — open ride requests (REQUESTED & unassigned)
- `POST /requests/:id/accept` — atomically claim a request → ACCEPTED
- `GET /bookings` — the driver's accepted/ongoing trips
- `POST /bookings/:id/status` — `{ status: ARRIVING|ONGOING|COMPLETED|CANCELLED }`
- `GET|POST /bookings/:bookingId/messages` — chat (driver side)

## Roles
Users register as **USER** (rider) or **DRIVER**. A driver account is linked
1:1 to a `Driver` profile (`Driver.userId`). Same login for both; the app routes
by `user.role`. Demo/seeded drivers have no linked account and power
"Recommended Drivers".

## Pricing
Tariffs live in `src/services/pricing.service.js` (One Way base+per-km,
Hourly per-hour, Outstation Round ₹1200 / One-Way ₹1700 — matching the designs).
