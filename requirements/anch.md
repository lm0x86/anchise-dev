# Anchise Web App — Developer Detailed Brief (v11)

**Status: Final direction (Key Goals aligned)**

Version: v11  
Last updated: 2025-12-17 (UTC)  
Audience: Product, UX, Backend, Frontend, Data Engineering  
Scope: Web app (adaptive/responsive), text-only.

# **Change Log (v10 → v11)**

* Re-scoped MVP to match the “What are our key goals” final direction: Funeral Board \+ Memorial Pages \+ Partner Portal \+ Auth \+ Donations.  
* Made the data pipeline explicit: Partner feed (near real-time) \+ INSEE monthly file, with deterministic \+ fuzzy de-duplication when INSEE arrives.  
* Added fixed-width parsing positions for INSEE ‘deces-YYYY-mMM.txt’ and synthetic example lines (no personal data).  
* Clarified Google Maps usage (non‑negotiable), dark map styling requirements, and marker rendering rules to match the candle-board aesthetic.  
* Moved Profile‑Maker / heavy AI features to v2.0 roadmap and kept ‘My Legacy (post‑mortem locked)’ as an Appendix (optional for v1).

# **1\. Product goals (final direction summary)**

Primary outcome: a public-facing, Google‑Maps‑based “Funeral Board” plus per‑person Memorial Pages, seeded by partner data (churches/funeral homes) and then completed monthly with INSEE national death records. The experience must work on desktop and adapt cleanly to mobile.

MVP outcomes (v1.0):

* Public Funeral Board (map \+ list) driven by death events, filterable by time and location.  
* Public Memorial Page for each person (shareable URL), with tributes/prayers (requires login to post).  
* Partner Portal for churches/funeral homes to create/update verified memorials (brand badge: e.g., “Verified by Borniol”).  
* Auth: email \+ password; legal first/last name required at sign-up (for accountability on tributes).  
* Donations via Stripe (initially: church/funeral home donation targets \+ receipts).  
* Backend ingestion pipeline: partner feed (daily/real-time) \+ INSEE monthly file; strict de-duplication.

Out of scope for v1.0 (explicit):

* Full ‘Profile‑Maker’ engine and long-form legacy authoring tools (v2.0).  
* Broad ‘community jar’ / marketplace / monetization beyond donations (v3.0).  
* Complex AI features beyond basic indexing/search (keep AI minimal for v1).

# **2\. Roadmap (high level)**

| Release | Focus | Notes |
| :---- | :---- | :---- |
| v1.0 (MVP) | Funeral Board \+ Memorial Pages \+ Partner Portal \+ Auth \+ Donations \+ INSEE ingestion \+ De‑dup | Partner-first; INSEE monthly completes coverage and validates IDs. |
| v2.0 | Profile‑Maker (legacy builder), richer media capture, post‑mortem lock workflows | Can include the ‘My Legacy’ page spec (Appendix A) as the canonical module. |
| v3.0 | Community marketplace / advanced features | Only after v1 traction \+ partner distribution proven. |

# **3\. Non‑negotiables**

* Maps provider: Google Maps (no Apple Maps).  
* Visual language: dark, calm, candle-board aesthetic; map must be styled to reduce noise (roads dimmed, POIs hidden unless needed).  
* Pins: candle markers with soft glow; must not ‘jump’ between sessions (pin lat/long is persisted per profile).  
* Adaptive web: works well on desktop; on mobile, UI collapses into a single column with sticky top controls.  
* De-duplication: when INSEE data arrives, it must merge into partner profiles (not create duplicates).  
* Privacy: public pages must avoid showing sensitive data beyond what is necessary; tributes require accountable identities.

# **4\. Information architecture**

Primary navigation (tabs/sections):

* Sanctuary (Funeral Board)  
* Legacy (Memorial Page viewer)  
* Community (Tributes feed \+ moderation queue)  
* Partner (Partner Portal)  
* Me (Account/settings)

Public routes (no login required):

* / (Funeral Board)  
* /p/{profileSlugOrId} (Memorial Page)  
* /donate/{profileId|partnerId} (Donation page, if enabled)  
* /legal/\* (Terms, Privacy, moderation policy)

# **5\. Page specifications**

## **NAV SECTION: Sanctuary — Funeral Board**

Tab: Sanctuary

### **Purpose**

A map-first view of death events (pins) \+ a synchronized list. The map is the hero element, styled to match the candle-board reference UI.

### **UI components**

* Google Map canvas (full height).  
* Search: name or city (autocomplete).  
* Time filters: Yesterday / Last Month / Year (default: Last Month).  
* Filter panel: Verified-only, Donations available, Has tributes.  
* Preview drawer/panel for selected pin with CTA to memorial.  
* Marker clustering at far zoom only.

### **Key interactions**

* Click/tap candle → open preview drawer \+ highlight marker.  
* Preview CTA → open /p/{id}.  
* Search by name/city pans map and filters list.  
* Time filter refetches board by Date\_Deces range.

## **NAV SECTION: Legacy — Memorial Page (public)**

Tab: Legacy (public route: /p/{id})

### **Purpose**

Public memorial page, shareable. Shows identity basics, verification badge (partner), and tributes/prayers. Posting requires login.

### **UI components**

* Header: name, dates, place, verification badge.  
* Hero media (optional).  
* CTA: Share; Donate (if enabled); Leave a tribute (login gated).  
* Tributes list with moderation state.  
* Partner footer with service details (if provided).

### **Key interactions**

* Share copies URL.  
* Leave tribute → login flow if not authenticated.  
* Donate → Stripe checkout.

## **NAV SECTION: Community — Tributes & Moderation**

Tab: Community

### **Purpose**

Feed \+ minimal moderation queue for partners/admins.

### **UI components**

* Recent tributes feed.  
* Filters by partner/city/status.  
* Moderation actions: approve/hide with audit.

## **NAV SECTION: Partner — Partner Portal**

Tab: Partner (authenticated)

### **Purpose**

Operational UI for partners to create and maintain verified memorials, manage donations, and moderate tributes.

### **UI components**

* Memorial list \+ create new memorial.  
* Memorial editor (v1): identity fields \+ service info \+ optional photo \+ donation config.  
* Verification badge (partner name).  
* Moderation queue.  
* Basic analytics (views/donations).

## **NAV SECTION: Me — Account**

Tab: Me

### **Purpose**

Authentication and personal settings for tribute authors.

### **UI components**

* Email \+ password sign-up/login.  
* Legal first \+ last name required.  
* Optional public display name setting.  
* Account deletion/export (placeholder policy).

# **6\. Backend / data pipeline (INSEE \+ Partners \+ De‑dup)**

## **Data sources**

* Partner feed (church/funeral home): more up to date; can include richer content (photo, obituary, service details).  
* INSEE ‘fichier des personnes décédées’: official monthly static file (no real-time API).

## **INSEE file parsing (fixed-width)**

Fixed-width positions (1-based, inclusive). 198 chars per line:

| Field | Positions | Type | Notes |
| :---- | :---- | :---- | :---- |
| NOM\*PRENOMS | 1–80 | string | Split on ‘\*’; NOM in caps; prenoms Title Case; trailing ‘/’ may appear; trim spaces. |
| Sexe | 81 | char | ‘1’ male, ‘2’ female. |
| Date\_Naissance | 82–89 | YYYYMMDD | Parse; may contain invalid/unknown in edge cases → handle gracefully. |
| Code\_Lieu\_Naissance | 90–94 | COG/extended | Usually commune COG; can be 99xxx for foreign/other. |
| Lib\_Lieu\_Naissance | 95–154 | string | Human-readable place; optional; not used as key. |
| Date\_Deces | 155–162 | YYYYMMDD | Primary index for time filters. |
| Code\_Lieu\_Deces | 163–167 | COG/extended | CRITICAL map key (never postal code). |
| Num\_Acte | 168–176 | string/number | Unique key component within Code\_Lieu\_Deces \+ Date\_Deces context; keep as string. |
| Reserved | 177–198 | string | Currently blank/spaces; keep for forward compatibility. |

Synthetic example lines:

XXXXXXXX\*YYYYYYYYYYYYYYYYYYYYYYYYY/                                                    21932020973065ZZZZZZZZ                                                    2025110401004      262                     

AAAAAAAA\*BBBBBBBBBBBBBBBBBBBBBBBBB/                                                    11950010199139CCCCCCCC                                                    2025112601004      272                     

## **De‑duplication (Partner ↔ INSEE)**

* Run de-dup before creating any new Profile from INSEE import.  
* Deterministic match when strong keys exist; otherwise scored fuzzy match with thresholds \+ manual review queue.  
* Merge without moving MapPin; keep provenance; prefer INSEE for legal fields when present; prefer partner for rich content.

## **API surface (sketch)**

* GET /api/board?from=\&to=\&cog=\&verifiedOnly=1  
* GET /api/profile/{id}  
* POST /api/tribute (auth)  
* GET/POST /api/partner/memorials (partner auth)  
* POST /api/jobs/insee/import (admin/scheduled)  
* GET /api/admin/dedup/queue

# **Appendix A — Detailed ‘My Legacy’ page spec (from v10, adapted for web)**

Included for continuity. Treat sizing as tokens; implement responsively.

## **NAV SECTION: All (global)**

All memorial screens match Sanctuary Map palette and glass panels (unless explicitly Alive Mode).

Mobile uses bottom nav; desktop uses top nav; routing remains consistent.

Keyboard navigation works: focus visible, ESC closes modals, arrows navigate slides.

Google Maps only: in-app map uses Google Maps JS API; external links use Google Maps deep links.

No autoplay; Sacred Mode reduces motion and disables sound.

Performance: lazy-load media, use responsive images, and avoid blocking map render.

## **NAV SECTION: Legacy**

Source: Adapted from Carlo’s ‘Page my legacy locked post mortem’ blueprint. This appendix converts mobile-native point specs into a responsive web spec while keeping the same visual identity and business rules.

Scope

Applies to Memorial Mode only: My Legacy page is read-only when profile.isLocked \= true.

Web app: responsive layouts for desktop/tablet/mobile web. No native-only assumptions (haptics are optional).

Canonical for UI \+ backend data contract for this page.

Breakpoints (CSS)

:root { font-size: 16px; }

/\* Mobile: \< 768px \*/

/\* Tablet: 768–1023px \*/

/\* Desktop: \>= 1024px \*/

@media (min-width: 768px) { /\* tablet \*/ }

@media (min-width: 1024px) { /\* desktop \*/ }

Design tokens (CSS variables)

:root{

  \--bg: \#0F0F12;

  \--text: \#FFFFFF;

  \--muted: \#AFAFB3;

  \--accent: \#C9A75E;

  \--divider: \#B8924B;

  \--danger: \#D9534F;

  \--cover-overlay: rgba(0,0,0,0.25);

  \--radius: 14px;

  \--gap-1: 8px;

  \--gap-2: 12px;

  \--gap-3: 16px;

  \--gap-4: 24px;

  \--gap-5: 32px;

  \--gap-section: 48px;

  \--pad-x-mobile: 20px;

  \--pad-x-tablet: 28px;

  \--pad-x-desktop: 40px;

  \--content-max: 980px;

  \--ease: cubic-bezier(.2,.8,.2,1);

}

Typography (web)

Fonts: Inter (UI/body) \+ Noto Serif (headings/quotes). Prefer self-hosted fonts; fallback: system-ui and serif.

H1: 1.75rem (28px), 600, line-height 2.125rem (34px) — Noto Serif

H2: 1.25rem (20px), 600, line-height 1.625rem (26px) — Noto Serif

H3: 1.0rem (16px), 600, line-height 1.375rem (22px) — Noto Serif

Body L: 1.0rem (16px), 400, line-height 1.375rem (22px) — Inter

Body R: 0.875rem (14px), 400, line-height 1.25rem (20px) — Inter

Small: 0.75rem (12px), 400, line-height 1.0rem (16px) — Inter

Quote: 1.125rem (18px), italic, 400, line-height 1.5rem (24px) — Noto Serif

Accessibility: respect user font scaling (up to 200%) and never hide critical info without an expand/collapse control.

Layout rules (responsive)

Background: solid near-black (\#0F0F12). No drop shadows in memorial mode; use subtle inner glow only for active states.

Mobile: single-column long scroll; padding X \= 20px; sections separated by 48px.

Tablet: single-column with wider padding (28px) and larger tiles where possible.

Desktop: constrain content to max-width 980px, centered; optional right-side sticky ‘Section index’ for fast navigation.

Cover is full-bleed across viewport width on all breakpoints.

Section 1 — Opening Moment

Cover: full-bleed; height \= clamp(280px, 40vh, 420px); object-fit: cover; apply overlay var(--cover-overlay).

Intro audio: centered control overlapping cover bottom edge; button 64×64px circle, 2px white outline; label ‘Play Intro’.

Audio: never autoplay; stream cached standard rendition (AAC 128kbps). On play start, 1s fade-in. Show scrub bar while playing.

Pinned statement: title ‘In My Own Words’ (H2) \+ body (Body L). Enforce max 120 words at creation; if exceeded by legacy data, truncate \+ ‘Full text’ modal.

Section 2 — Who I Was

Values mosaic: up to 6 tiles; 2 columns on \>=480px, 1 column on smaller; gap 12px; tile min-height 84px.

Tile tap opens modal: original value note \+ creation timestamp.

Principle paragraph: default clamp to \~3 lines; provide expand/collapse.

Selected quote: centered, italic, accent gold; max 120 chars; attribution Small muted.

Section 3 — Verified Milestones Timeline

Timeline line: 2px divider gold; left gutter \~28px; cards to the right; responsive widths (100% mobile, max 520px desktop).

Card: year Small bold; title Noto Serif 16/600; description Inter 14; optional thumbnail 56×56px.

Group by pillar; sort newest→oldest; show max 6 then ‘See archived milestones’ modal.

Evidence: PDFs/images/link snapshots. PDFs via viewer; links may show archivedUrl only.

Section 4 — Impact on Others

Voice notes: horizontal scroller; item circle 84×84px with 3px border; tap plays inline player below; skeleton shimmer on buffer.

Limits: preview max 90s; longer allowed only with consent and explicit ‘Listen full message’.

Processing: 64kbps preview, 128kbps standard, 320kbps high; waveform SVG cached.

Tribute themes: stacked blocks; title 18px; up to three excerpts; include provenance tags; anonymize if requested.

Community albums: responsive 3-column thumbs; show max 9 then modal; read-only, moderation role-gated.

Section 5 — Creations and Works

Signature work: full-width card; height clamp(180px, 28vh, 260px); CTA ‘Open work’ opens viewer.

Artefact grid: responsive 2-column cards; viewer shows metadata and download if allowed.

Files: thumbnails 300px shortest side; PDFs stored as archival snapshots; DRM disables download and shows watermarked preview.

Section 6 — Message to the Future

Primary player: 100% width, max 720px; controls minimal (play, scrub, volume, transcript toggle); download/share conditional.

Transcript: 140px scroll container; timecodes every 30s; ‘Download transcript’ if allowed.

Private letters: list rows 56px with lock icon; unauthorized sees ‘Locked’ \+ ‘Request access’; authorized opens viewer.

Unlock: auto via strong verification (2FA \+ ID) or delegate release; all access events logged.

Section 7 — Footprint Summary

Responsive grid: 2×3 on \>=480px, else 1 column. Metrics frozen at lockedAt.

CTA ‘Download legacy as PDF’ only for authorized roles; PDF includes signature work \+ principle \+ metrics.

Interactions & motion (web)

Single long scroll; anchor smooth scroll 280ms ease.

Modal open: 160ms scale+fade using cubic-bezier(.2,.8,.2,1).

Audio fade-in: 1s volume ramp; UI transitions \~200ms.

No required haptics on web. Optional vibration on supported mobile browsers (non-blocking).

Accessibility (must)

Keyboard \+ screen reader accessible; aria-label every control.

Captions for video; transcripts for audio; visible focus states.

Do not truncate critical information without expand controls; ensure AA contrast for muted text.

Network, caching & archival

At lockedAt run freeze job: thumbnails, transcripts, audio/video renditions, PDF export.

Serve cover \+ intro audio via CDN with immutable keys. Thumbs WebP by default; originals in cold storage with signed URLs.

Streaming: HLS for video; segmented audio; fallback to download if allowed.

External link archiving: default to archivedUrl \+ metadata; full-content snapshots require explicit legal review and takedown process.

Audit, logging & security

Log access events server-side (viewerId or anon session id, timestamp, action, profileId, IP hash, UA hash). Do not return logs in legacy payload.

Private letter access notifies delegates.

Anti-scrape: rate limit by authenticated viewer/session first; avoid IP-only limits that can block funeral crowds behind NAT.

SSR allowed for public memorial pages; private sections must remain gated server-side.

Data model (JSON contract) — Legacy payload

Note: access logs are not returned in the payload; they live in an audit store/table. All timestamps ISO 8601 UTC.

{

  "profileId": "string",

  "personId": "string",

  "ownerId": "string",

  "isLocked": true,

  "lockedAt": "ISODate",

  "suppressed": false,

  "consent": {"legacyPageEnabled": true, "mediaArchivalConsent": true, "publicListingConsent": false},

  "cover": {"image": {"id":"string","url":"string","thumbnailUrl":"string"}, "overlayOpacity": 0.25},

  "introAudio": {"id":"string","durationSec":12,"renditions":{"preview":"url","standard":"url","high":"url"},"transcriptId":"string"},

  "pinnedStatement": {"text":"string","createdAt":"ISODate"},

  "coreNarrative": {

    "values": \[{"key":"string","label":"string","meaning":"string","createdAt":"ISODate"}\],

    "principleParagraph": {"text":"string","compiledAt":"ISODate"},

    "selectedQuote": {"text":"string","attribution":"string"}

  },

  "milestones": \[{"pillar":"professional|personal|service","title":"string","date":"ISODate","description":"string","thumbnailUrl":"url","evidence":\[{"type":"pdf|image|link","url":"string","archivedUrl":"string"}\]}\],

  "impact": {

    "voiceNotes": \[{"id":"string","contributorId":"string","nameDisplay":"string","durationSec":45,"renditions":{"preview":"url","standard":"url","high":"url"},"waveformSvgUrl":"url"}\],

    "tributeThemes": \[{"theme":"string","excerpts":\["string"\],"derivedAt":"ISODate","provenance":\["string"\]}\],

    "communityAlbums": \[{"id":"string","title":"string","thumbnailUrl":"string","count":12}\]

  },

  "creations": {

    "signatureWork": {"id":"string","type":"image|video|document|audio","title":"string","contextNote":"string","fileUrl":"string"},

    "items": \[{"id":"string","title":"string","year":2020,"type":"string","thumbnailUrl":"string","downloadAllowed":false}\]

  },

  "messageToFuture": {

    "primary": {"type":"video|audio|text","id":"string","fileUrl":"string","transcriptId":"string"},

    "privateLetters": \[{"letterId":"string","recipientId":"string","recipientName":"string","locked":true,"releaseRule":"auto|delegate","releasedAt":null}\]

  },

  "footprintSummary": {"connectionsCount":276,"causesCount":5,"placesLived":3,"worksCreated":12,"yearsActive":38,"donationsTotalMinorUnits":1040000}

}

API endpoints (suggested)

GET /api/profiles/{profileId}/legacy → returns legacy payload (read-only).

GET /api/media/{mediaId}/manifest → returns signed URLs / HLS manifests (role-gated).

POST /api/legacy/{profileId}/letters/{letterId}/request-access → audited request.

POST /api/legacy/{profileId}/letters/{letterId}/delegate-decision → approve/deny (delegate-only).

POST /api/legacy/{profileId}/pdf/export → create PDF (authorized roles).