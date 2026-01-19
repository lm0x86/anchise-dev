# Anchise — Technical Architecture Document

**Version:** 1.0  
**Last Updated:** 2025-01-07  
**Source:** Derived from `anch.md` v11

---

## 1. System Overview

Anchise is a memorial web application featuring:
- **Funeral Board**: Leaflet/OpenStreetMap-based visualization of death events
- **Memorial Pages**: Public, shareable profile pages for deceased individuals
- **Partner Portal**: B2B interface for funeral homes and churches
- **Community**: Tribute/prayer system with moderation
- **Donations**: Stripe-powered donation flow *(post-MVP, low priority)*

### MVP Priorities (v1.0)

| Priority | Feature | Status |
|----------|---------|--------|
| **P0** | Funeral Board (map + list) | MVP |
| **P0** | Memorial Pages (public view) | MVP |
| **P0** | Auth (email + password) | MVP |
| **P1** | Partner Portal (create/manage memorials) | MVP |
| **P1** | Tributes/Prayers (with moderation) | MVP |
| **P1** | INSEE Ingestion + De-duplication | MVP |
| **P2** | Donations (Stripe) | Post-MVP |
| **P3** | Profile-Maker / Legacy Builder | v2.0 |

### Architecture Style

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│              (React/Next.js, SSR for public pages)              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        API GATEWAY                               │
│                    (Express + tsyringe)                          │
├─────────────────────────────────────────────────────────────────┤
│  Auth │ Board │ Profiles │ Tributes │ Partners │ Donations │ Jobs│
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
       ┌──────────┐    ┌──────────┐    ┌──────────┐
       │PostgreSQL│    │   Redis  │    │ Object   │
       │ (Prisma) │    │ (cache)  │    │ Storage  │
       └──────────┘    └──────────┘    └──────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
       ┌──────────────┐              ┌──────────────┐
       │   Leaflet    │              │    Stripe    │
       │     + OSM    │              │   Payments   │
       └──────────────┘              └──────────────┘
```

---

## 2. Tech Stack

### Backend
| Layer | Technology | Purpose |
|-------|------------|---------|
| Runtime | Node.js 22+ | JavaScript runtime |
| Framework | Express.js | HTTP server |
| Language | TypeScript 5.x | Type safety |
| DI Container | tsyringe | Dependency injection |
| ORM | Prisma 7.x | Database access |
| Database | PostgreSQL 16 | Primary data store |
| Cache | Redis (optional v1) | Session/query cache |
| Validation | Zod | Request/response validation |
| Auth | Passport.js + JWT | Authentication |
| Logging | Winston | Structured logging |
| Docs | Swagger/OpenAPI | API documentation |

### Frontend (Planned)
| Layer | Technology | Purpose |
|-------|------------|---------|
| Framework | Next.js 14+ / React 18 | SSR + SPA |
| Styling | CSS Variables + Tailwind | Design system |
| Maps | react-leaflet + leaflet | OpenStreetMap integration |
| State | TBD (Zustand/Jotai) | Client state |
| Forms | React Hook Form + Zod | Form handling |

### External Services
| Service | Purpose |
|---------|---------|
| OpenStreetMap + Leaflet | Map display (free, open-source) |
| api-adresse.data.gouv.fr | French geocoding API (free) |
| Stripe | Payment processing, donations |
| CDN (Cloudflare/AWS) | Static assets, media delivery |
| Object Storage (S3) | Media files, INSEE archives |

---

## 3. Database Schema

### Core Entities

```prisma
// === IDENTITY & AUTH ===

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  passwordHash  String
  firstName     String    // Legal name (required)
  lastName      String    // Legal name (required)
  displayName   String?   // Optional public name
  role          UserRole  @default(USER)
  emailVerified Boolean   @default(false)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  tributes      Tribute[]
  partnerUsers  PartnerUser[]
  
  @@map("users")
}

enum UserRole {
  USER      // Regular tribute author
  PARTNER   // Partner portal access
  ADMIN     // System admin
}

// === PARTNERS ===

model Partner {
  id           String   @id @default(cuid())
  name         String   // "Pompes Funèbres Borniol"
  slug         String   @unique
  type         PartnerType
  contactEmail String
  logoUrl      String?
  verified     Boolean  @default(false)
  // stripeAccountId String?  // Post-MVP
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  
  users        PartnerUser[]
  profiles     Profile[]
  // donations Donation[]  // Post-MVP
  
  @@map("partners")
}

enum PartnerType {
  FUNERAL_HOME
  CHURCH
  HOSPITAL
  OTHER
}

model PartnerUser {
  id        String   @id @default(cuid())
  userId    String
  partnerId String
  role      PartnerRole @default(MEMBER)
  
  user      User     @relation(fields: [userId], references: [id])
  partner   Partner  @relation(fields: [partnerId], references: [id])
  
  @@unique([userId, partnerId])
  @@map("partner_users")
}

enum PartnerRole {
  OWNER
  ADMIN
  MEMBER
}

// === PROFILES (Memorial Pages) ===

model Profile {
  id              String    @id @default(cuid())
  slug            String    @unique // URL-friendly identifier
  
  // Identity (from Partner or INSEE)
  firstName       String
  lastName        String
  birthDate       DateTime?
  deathDate       DateTime
  birthPlaceCog   String?   // COG code
  birthPlaceLabel String?
  deathPlaceCog   String    // COG code (required for map)
  deathPlaceLabel String?
  sex             Sex?
  
  // Map pin (persisted, never auto-moved)
  pinLat          Float
  pinLng          Float
  
  // Provenance
  source          ProfileSource
  inseeNumActe    String?   // INSEE unique key component
  partnerId       String?
  partner         Partner?  @relation(fields: [partnerId], references: [id])
  
  // Content
  photoUrl        String?
  obituary        String?   // Partner-provided
  serviceDetails  Json?     // Funeral service info
  
  // State
  isLocked        Boolean   @default(false)
  lockedAt        DateTime?
  suppressed      Boolean   @default(false)
  // donationsEnabled Boolean  @default(false)  // Post-MVP
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  tributes        Tribute[]
  // donations    Donation[]  // Post-MVP
  viewLogs        ProfileViewLog[]
  
  @@index([deathDate])
  @@index([deathPlaceCog])
  @@index([lastName, firstName])
  @@map("profiles")
}

enum Sex {
  MALE
  FEMALE
}

enum ProfileSource {
  PARTNER   // Created by partner
  INSEE     // Imported from INSEE
  MERGED    // Partner + INSEE matched
}

// === TRIBUTES ===

model Tribute {
  id          String        @id @default(cuid())
  profileId   String
  authorId    String
  content     String
  status      TributeStatus @default(PENDING)
  moderatedBy String?
  moderatedAt DateTime?
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
  
  profile     Profile       @relation(fields: [profileId], references: [id])
  author      User          @relation(fields: [authorId], references: [id])
  
  @@index([profileId, status])
  @@map("tributes")
}

enum TributeStatus {
  PENDING
  APPROVED
  HIDDEN
  REMOVED
}

// === DONATIONS (Post-MVP) ===

// model Donation {
//   id                String   @id @default(cuid())
//   profileId         String?
//   partnerId         String?
//   amountCents       Int
//   currency          String   @default("EUR")
//   stripePaymentId   String   @unique
//   status            DonationStatus
//   createdAt         DateTime @default(now())
//   @@map("donations")
// }

// === DEDUP QUEUE ===

model DedupCandidate {
  id              String   @id @default(cuid())
  inseeRecord     Json     // Raw INSEE parsed data
  candidateIds    String[] // Potential matching profile IDs
  matchScores     Json     // { profileId: score }
  status          DedupStatus @default(PENDING)
  resolvedAction  DedupAction?
  resolvedBy      String?
  resolvedAt      DateTime?
  createdAt       DateTime @default(now())
  
  @@index([status])
  @@map("dedup_candidates")
}

enum DedupStatus {
  PENDING
  RESOLVED
  SKIPPED
}

enum DedupAction {
  MERGED
  CREATED_NEW
  DISCARDED
}

// === ANALYTICS & AUDIT ===

model ProfileViewLog {
  id        String   @id @default(cuid())
  profileId String
  viewerId  String?  // null = anonymous
  sessionId String
  ipHash    String
  userAgent String
  createdAt DateTime @default(now())
  
  profile   Profile  @relation(fields: [profileId], references: [id])
  
  @@index([profileId, createdAt])
  @@map("profile_view_logs")
}

// === INSEE IMPORT TRACKING ===

model InseeImportJob {
  id            String   @id @default(cuid())
  fileName      String
  month         String   // "2025-11"
  recordCount   Int
  processedCount Int     @default(0)
  newProfiles   Int      @default(0)
  mergedProfiles Int     @default(0)
  dedupPending  Int      @default(0)
  status        JobStatus
  startedAt     DateTime
  completedAt   DateTime?
  errorMessage  String?
  
  @@map("insee_import_jobs")
}

enum JobStatus {
  RUNNING
  COMPLETED
  FAILED
}

// === GEOCODING CACHE ===

model GeocodingCache {
  cogCode   String   @id
  lat       Float
  lng       Float
  label     String
  updatedAt DateTime @updatedAt
  
  @@map("geocoding_cache")
}
```

---

## 4. API Architecture

### Route Structure

```
/api
├── /auth
│   ├── POST   /register        # Create account
│   ├── POST   /login           # Get JWT
│   ├── POST   /logout          # Invalidate token
│   ├── POST   /refresh         # Refresh JWT
│   └── GET    /me              # Current user
│
├── /board
│   └── GET    /                # Funeral board data
│         ?from=YYYY-MM-DD
│         &to=YYYY-MM-DD
│         &cog=75101            # Filter by COG
│         &verifiedOnly=1
│         &hasDonations=1
│         &hasTributes=1
│
├── /profiles
│   ├── GET    /:idOrSlug       # Public memorial page
│   └── GET    /:id/tributes    # Tributes for profile
│
├── /tributes
│   ├── POST   /                # Create tribute (auth)
│   ├── GET    /                # Community feed
│   └── PATCH  /:id/moderate    # Moderate (partner/admin)
│
├── /partners
│   ├── GET    /memorials       # Partner's memorials
│   ├── POST   /memorials       # Create memorial
│   ├── PATCH  /memorials/:id   # Update memorial
│   ├── GET    /moderation      # Moderation queue
│   └── GET    /analytics       # Views/donations stats
│
├── /donations                  # (Post-MVP)
│   ├── POST   /checkout        # Create Stripe session
│   └── POST   /webhook         # Stripe webhook
│
├── /admin
│   ├── POST   /jobs/insee/import  # Trigger INSEE import
│   ├── GET    /dedup/queue        # De-dup candidates
│   └── POST   /dedup/:id/resolve  # Resolve de-dup
│
└── /health
    ├── GET    /                # Server health
    └── GET    /db              # Database health
```

### Response Format

```typescript
// Success
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "perPage": 20,
    "total": 150
  }
}

// Error
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    { "field": "email", "message": "Invalid email format" }
  ]
}
```

---

## 5. Authentication & Authorization

### JWT Strategy
- **Access Token**: Short-lived (15 min), stored in memory
- **Refresh Token**: Long-lived (7 days), httpOnly cookie
- **Payload**: `{ sub: userId, email, role, partnerId? }`

### Roles & Permissions

| Role | Permissions |
|------|-------------|
| `USER` | View public content, post tributes, donate |
| `PARTNER` | All USER + manage own memorials, moderate tributes on own profiles |
| `ADMIN` | All PARTNER + INSEE import, de-dup resolution, system config |

### Route Protection

```typescript
// Public routes (no auth required)
GET  /api/board
GET  /api/profiles/:id
GET  /api/profiles/:id/tributes

// Authenticated routes
POST /api/tributes              // USER+
POST /api/donations/checkout    // USER+

// Partner routes
GET  /api/partners/memorials    // PARTNER+
POST /api/partners/memorials    // PARTNER+

// Admin routes
POST /api/admin/jobs/*          // ADMIN only
```

---

## 6. Data Pipeline

### Partner Feed (Near Real-Time)

```
Partner System → Webhook/API → Validation → Geocoding → Profile Creation
                     │
                     └─→ If matching INSEE record exists → MERGE
```

### INSEE Monthly Import

```
1. Download: deces-YYYY-mMM.txt from data.gouv.fr
2. Parse: Fixed-width (198 chars/line)
3. For each record:
   a. Check deterministic match (lastName + birthDate + deathDate + COG)
   b. If no match → fuzzy match (Levenshtein on name, date proximity)
   c. Score > threshold → auto-merge
   d. Score in review range → add to DedupCandidate queue
   e. Score < threshold → create new Profile
4. Update InseeImportJob statistics
```

### INSEE Fixed-Width Parser

```typescript
interface InseeRecord {
  nomPrenoms: string;      // 1-80
  nom: string;             // Extracted from nomPrenoms
  prenoms: string[];       // Extracted from nomPrenoms
  sexe: '1' | '2';         // 81
  dateNaissance: string;   // 82-89 (YYYYMMDD)
  codeLieuNaissance: string; // 90-94
  libLieuNaissance: string;  // 95-154
  dateDeces: string;       // 155-162 (YYYYMMDD)
  codeLieuDeces: string;   // 163-167
  numActe: string;         // 168-176
}

function parseInseeLine(line: string): InseeRecord {
  const nomPrenoms = line.substring(0, 80).trim();
  const [nom, ...prenomParts] = nomPrenoms.split('*');
  const prenoms = prenomParts.join(' ').replace('/', '').trim();
  
  return {
    nomPrenoms,
    nom: nom.trim(),
    prenoms: prenoms.split(' ').filter(Boolean),
    sexe: line.charAt(80) as '1' | '2',
    dateNaissance: line.substring(81, 89),
    codeLieuNaissance: line.substring(89, 94).trim(),
    libLieuNaissance: line.substring(94, 154).trim(),
    dateDeces: line.substring(154, 162),
    codeLieuDeces: line.substring(162, 167).trim(),
    numActe: line.substring(167, 176).trim(),
  };
}
```

### De-duplication Strategy

| Match Type | Criteria | Action |
|------------|----------|--------|
| **Deterministic** | lastName + firstName[0] + birthDate + deathDate + deathCOG | Auto-merge |
| **High Confidence** | Score ≥ 0.90 | Auto-merge |
| **Review Required** | 0.70 ≤ Score < 0.90 | Queue for manual review |
| **No Match** | Score < 0.70 | Create new profile |

---

## 7. Map Integration (Leaflet + OpenStreetMap)

### Stack
| Package | Purpose | Cost |
|---------|---------|------|
| `leaflet` | Map library | Free |
| `react-leaflet` | React bindings | Free |
| OpenStreetMap tiles | Base map | Free |
| `api-adresse.data.gouv.fr` | French geocoding | Free |

### Why Leaflet + OSM?
- **100% free** - No API keys, no billing, no limits
- **Great France coverage** - OSM has excellent French data
- **Lightweight** - ~40kb vs 200kb+ for Google Maps
- **Customizable** - Full control over styling
- **Privacy-friendly** - No Google tracking

### Tile Providers (Dark Theme Options)

```typescript
// Free dark tile options
const tileProviders = {
  // CartoDB Dark Matter (recommended)
  cartoDark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  
  // Stadia Alidade Smooth Dark (needs free API key)
  stadiaDark: 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png',
  
  // Standard OSM (light, as fallback)
  osm: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
};

// Attribution (required by license)
const attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
```

### React-Leaflet Example

```tsx
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

export function FuneralBoard({ profiles }) {
  return (
    <MapContainer 
      center={[46.603354, 1.888334]} // France center
      zoom={6}
      className="h-full w-full"
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution={attribution}
      />
      {profiles.map((profile) => (
        <Marker 
          key={profile.id}
          position={[profile.pinLat, profile.pinLng]}
        >
          <Popup>
            <ProfilePreview profile={profile} />
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
```

### French Geocoding API

```typescript
// api-adresse.data.gouv.fr - Free French government API
async function geocodeFrenchAddress(query: string) {
  const res = await fetch(
    `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=5`
  );
  const data = await res.json();
  return data.features.map((f) => ({
    label: f.properties.label,
    lat: f.geometry.coordinates[1],
    lng: f.geometry.coordinates[0],
    citycode: f.properties.citycode, // COG code!
  }));
}

// Reverse geocode COG code
async function geocodeByCOG(cogCode: string) {
  const res = await fetch(
    `https://api-adresse.data.gouv.fr/search/?q=${cogCode}&type=municipality&limit=1`
  );
  const data = await res.json();
  if (data.features.length > 0) {
    const f = data.features[0];
    return {
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
      label: f.properties.label,
    };
  }
  return null;
}
```

### Candle Marker Requirements
- Custom SVG marker with animated glow effect
- Verified profiles: gold accent ring
- Clustering at zoom ≤ 10
- Pin position persisted per profile (no auto-repositioning)

---

## 8. Stripe Integration *(Post-MVP)*

> **Note**: Donations are deprioritized for MVP. This section is for future reference.

### Donation Flow (Future)

```
1. User clicks "Donate" on profile/partner page
2. Frontend calls POST /api/donations/checkout
3. Backend creates Stripe Checkout Session
4. User redirected to Stripe hosted page
5. On success, Stripe calls webhook
6. Backend updates Donation record
```

### Connected Accounts (Future)
- Partners onboard via Stripe Connect (Standard)
- Platform fee configurable

---

## 9. Design System

### Color Tokens

```css
:root {
  --color-bg: #0F0F12;
  --color-text: #FFFFFF;
  --color-muted: #AFAFB3;
  --color-accent: #C9A75E;      /* Gold */
  --color-divider: #B8924B;
  --color-danger: #D9534F;
  --color-overlay: rgba(0, 0, 0, 0.25);
}
```

### Spacing Scale

```css
:root {
  --gap-1: 8px;
  --gap-2: 12px;
  --gap-3: 16px;
  --gap-4: 24px;
  --gap-5: 32px;
  --gap-section: 48px;
  
  --pad-x-mobile: 20px;
  --pad-x-tablet: 28px;
  --pad-x-desktop: 40px;
  
  --content-max: 980px;
  --radius: 14px;
}
```

### Typography

| Style | Font | Size | Weight | Line Height |
|-------|------|------|--------|-------------|
| H1 | Noto Serif | 28px | 600 | 34px |
| H2 | Noto Serif | 20px | 600 | 26px |
| H3 | Noto Serif | 16px | 600 | 22px |
| Body L | Inter | 16px | 400 | 22px |
| Body R | Inter | 14px | 400 | 20px |
| Small | Inter | 12px | 400 | 16px |
| Quote | Noto Serif | 18px | 400 italic | 24px |

### Breakpoints

```css
/* Mobile: < 768px */
/* Tablet: 768px - 1023px */
/* Desktop: ≥ 1024px */

@media (min-width: 768px) { /* tablet */ }
@media (min-width: 1024px) { /* desktop */ }
```

### Motion

```css
:root {
  --ease: cubic-bezier(0.2, 0.8, 0.2, 1);
  --duration-fast: 160ms;
  --duration-normal: 200ms;
  --duration-smooth: 280ms;
}
```

---

## 10. Security

### Requirements

| Area | Implementation |
|------|----------------|
| Password Storage | bcrypt with cost 12 |
| JWT | RS256 signing, short expiry |
| Rate Limiting | Per authenticated user first, then IP fallback |
| Input Validation | Zod schemas on all endpoints |
| SQL Injection | Prisma parameterized queries |
| XSS | React auto-escaping, CSP headers |
| CORS | Whitelist allowed origins |
| Headers | Helmet.js for security headers |

### Anti-Scrape Strategy
- Rate limit by authenticated viewer/session
- Avoid IP-only limits (funeral crowds share NAT)
- Progressive delays on suspicious patterns

### Audit Logging

```typescript
interface AuditEvent {
  action: string;        // "profile.view", "tribute.create"
  profileId?: string;
  viewerId?: string;     // null = anonymous
  sessionId: string;
  ipHash: string;        // SHA-256 truncated
  userAgentHash: string;
  timestamp: Date;
}
```

---

## 11. Performance

### Targets

| Metric | Target |
|--------|--------|
| TTFB (public pages) | < 200ms |
| LCP (memorial page) | < 2.5s |
| API P95 latency | < 100ms |
| Board load (1000 pins) | < 1s |

### Strategies

- SSR for public memorial pages (SEO + performance)
- CDN for static assets and media
- Redis cache for board queries (5 min TTL)
- Marker clustering to reduce DOM nodes
- Lazy load tributes below fold
- WebP images with responsive srcset

---

## 12. Deployment

### Environments

| Env | Purpose | Database |
|-----|---------|----------|
| `development` | Local dev | Docker PostgreSQL |
| `staging` | Pre-production testing | Managed PostgreSQL |
| `production` | Live | Managed PostgreSQL (HA) |

### Infrastructure (Suggested)

```
                    ┌─────────────┐
                    │   CDN       │
                    │ (Cloudflare)│
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │   Load      │
                    │  Balancer   │
                    └──────┬──────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
    ┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
    │   App Node  │ │   App Node  │ │   App Node  │
    │   (API)     │ │   (API)     │ │   (API)     │
    └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
           │               │               │
           └───────────────┼───────────────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
       ┌──────▼──────┐ ┌───▼───┐ ┌──────▼──────┐
       │  PostgreSQL │ │ Redis │ │     S3      │
       │   Primary   │ │       │ │   (media)   │
       └──────┬──────┘ └───────┘ └─────────────┘
              │
       ┌──────▼──────┐
       │  PostgreSQL │
       │   Replica   │
       └─────────────┘
```

---

## 13. Folder Structure (Backend)

```
backend/
├── prisma/
│   ├── schema.prisma
│   ├── prisma.config.ts
│   └── migrations/
├── src/
│   ├── config/
│   │   ├── env.ts
│   │   ├── passport.ts
│   │   └── swagger.ts
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   ├── board.controller.ts
│   │   ├── profile.controller.ts
│   │   ├── tribute.controller.ts
│   │   ├── partner.controller.ts
│   │   ├── donation.controller.ts  # (Post-MVP)
│   │   └── admin.controller.ts
│   ├── services/
│   │   ├── auth.service.ts
│   │   ├── profile.service.ts
│   │   ├── tribute.service.ts
│   │   ├── partner.service.ts
│   │   ├── donation.service.ts     # (Post-MVP)
│   │   ├── insee.service.ts
│   │   ├── dedup.service.ts
│   │   └── geocoding.service.ts
│   ├── repositories/
│   │   ├── user.repository.ts
│   │   ├── profile.repository.ts
│   │   ├── tribute.repository.ts
│   │   └── partner.repository.ts
│   ├── middlewares/
│   │   ├── auth.middleware.ts
│   │   ├── error.middleware.ts
│   │   ├── validate.middleware.ts
│   │   └── rate-limit.middleware.ts
│   ├── routes/
│   │   ├── index.ts
│   │   ├── auth.routes.ts
│   │   ├── board.routes.ts
│   │   ├── profile.routes.ts
│   │   ├── tribute.routes.ts
│   │   ├── partner.routes.ts
│   │   ├── donation.routes.ts      # (Post-MVP)
│   │   └── admin.routes.ts
│   ├── schemas/                  # Zod validation schemas
│   │   ├── auth.schema.ts
│   │   ├── profile.schema.ts
│   │   └── tribute.schema.ts
│   ├── types/
│   │   └── index.ts
│   ├── utils/
│   │   ├── logger.ts
│   │   └── insee-parser.ts
│   ├── jobs/
│   │   └── insee-import.job.ts
│   ├── app.ts
│   ├── container.ts
│   └── index.ts
├── docker-compose.yml
├── package.json
├── tsconfig.json
└── README.md
```

---

## Appendix: Quick Reference

### Environment Variables

```bash
# Server
PORT=3000
NODE_ENV=development|staging|production

# Database
DATABASE_URL=postgresql://...

# JWT
JWT_SECRET=<min-32-chars>
JWT_EXPIRES_IN=7d

# Maps (Leaflet + OSM - no API keys needed!)
# Optional: Stadia Maps key for premium dark tiles
# STADIA_MAPS_API_KEY=...

# Stripe (Post-MVP)
# STRIPE_SECRET_KEY=sk_...
# STRIPE_WEBHOOK_SECRET=whsec_...

# Redis (optional)
REDIS_URL=redis://...
```

### Key Commands

```bash
# Development
npm run dev           # Start with hot reload
npm run db:up         # Start PostgreSQL
npm run db:down       # Stop PostgreSQL
npm run prisma:migrate # Run migrations
npm run prisma:studio  # Open Prisma Studio

# Production
npm run build         # Compile TypeScript
npm start             # Run compiled code
```

