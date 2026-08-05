# Architecture

## System Flow

```text
User text / voice / files / photos
-> Vite multi-page client
-> DeepSeek or GLM processing when configured
-> deterministic date, category, evidence, and fallback rules
-> Supabase shared archive or local project/browser cache
-> searchable record, cited chat result, calendar, atlas, or growth evidence
```

## Components

| Component | Responsibility | Fallback |
| --- | --- | --- |
| `home.js` / `home.css` | Home capture and current archive overview | Local cached records and notes |
| `app.js` | Shell, record flow, chat, detail, calendar, settings, storage orchestration | Local analysis and explicit error states |
| `ai-client.js` | DeepSeek and GLM request contracts, audio chunking | Caller chooses local summary or unavailable state |
| `cloud-store.js` | Supabase field mapping and shared CRUD | Browser cache remains intact on read failure |
| `growth-profile.js` | Deterministic trait/domain calculation with record evidence | Empty zero state; no AI diagnosis claim |
| `memory-atlas.js` | Three.js relationship visualization | Empty state when no records exist |
| `mobile-api/` | Loopback HTTP contract for a mobile client | Health/error JSON; no fake Agent response |
| `vite.config.js` | MPA build and local archive/media middleware | Used only when cloud config is absent |

## AI And Deterministic Boundary

- AI transcribes audio, extracts visible facts, drafts summaries, interprets queries, and generates user-requested prose.
- Code validates dates, restricts categories, preserves IDs and attachments, controls storage, segments audio, links evidence, calculates growth scores, and selects failure behavior.
- Humans review source fields, generated wording, uncertain facts, privacy, and any material used in applications or interviews.

## External Dependencies

| Dependency | Why needed | Failure behavior | Backup / limitation | Secret or config |
| --- | --- | --- | --- | --- |
| DeepSeek | Text analysis and chat | Local chat/summary mode | Output quality is reduced | `VITE_DEEPSEEK_API_KEY` for local Demo only |
| GLM | Image understanding and speech transcription | Text/manual input remains available | Media analysis unavailable | `VITE_GLM_API_KEY` for local Demo only |
| Supabase | Shared records/notes/categories | Keeps last successful browser cache | No user isolation in current shared Demo | Public URL/key; never service-role |
| Vercel | Public Web Demo | Local `npm run dev` / `npm run preview` | Deployment is not the data backup | Project configuration |
| Google Fonts / Unsplash | Typography and seed imagery | System fonts / broken seed image | External network dependent | None |

## Security Boundary

- `.env.local`, archive exports, media, generated APKs, keys, and local output are ignored.
- The public Demo has no authentication and must use synthetic or desensitized data.
- `VITE_*` values are embedded into browser bundles. They are not suitable for production secrets.
- The current mobile API binds to loopback by default. LAN/Internet exposure requires authentication, rate limiting, restricted CORS, HTTPS, and log redaction.
