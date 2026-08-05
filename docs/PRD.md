# Product Requirements

## Problem

- Target user: High-school or university students with many activities but no consistent experience-organizing habit.
- Situation: Preparing an activity showcase, resume, application essay, interview, or project presentation under time pressure.
- Pain evidence: The team reported having to search notes, chats, albums, and documents while preparing academy materials; missing dates, roles, outcomes, and supporting details reduced the usefulness of the material.
- Existing alternative and gap: Notes apps store fragments but do not reorganize them for a specific application goal. A general AI chat lacks a durable, source-linked personal archive and may fill gaps with unsupported details.
- Product promise: Store an experience once, then retrieve and reorganize only the recorded facts for later reflection and communication.

Source: the team's `AIY黑客松·问题定义卡-强强组.docx`, completed 2026-08-04. The repository does not claim external user interviews or measured time savings.

## Core Workflow

1. User input: Text, voice, document references, or photos describing an experience.
2. AI action: Transcribe, extract facts, summarize, classify, and support semantic retrieval.
3. Tool action: DeepSeek and GLM calls are made sequentially where applicable; the experience is stored in the shared archive or local fallback.
4. Deterministic rule: Dates, categories, storage keys, evidence links, fallback behavior, and growth-profile scoring remain code-controlled and reviewable.
5. User-visible result: A saved experience, searchable archive, source-linked conversation result, calendar/atlas view, or evidence-backed growth profile.
6. Record or next action: The user can edit source fields, add attachments, follow a cited record, or continue the conversation.

## MVP

- Included: Experience capture, quick notes, archive/search, record detail editing, AI conversation, calendar, event atlas, growth profile, cloud/local fallback, and a mobile-facing API contract.
- Non-goals: Production authentication, public multi-user isolation, cloud attachment storage, medical/financial advice, and validated psychological assessment.
- Three-minute Demo: Create a desensitized experience -> wait for AI organization -> retrieve it in AI chat -> open the linked growth evidence.

## Pages And States

| Page / state | User goal | Visible output | Failure or uncertainty handling |
| --- | --- | --- | --- |
| Record | Capture an experience | Saved record and AI summary | Retains input; falls back to factual local summary when the model is unavailable |
| Chat | Discuss or retrieve experiences | Reply with cited record cards or generated document | Switches to local mode and avoids claiming a successful model call |
| Library / Detail | Find and verify source material | Searchable cards and editable source fields | Empty state, missing-record state, and explicit save failures |
| Growth | Review change with evidence | Rule-based radar and source-linked cards | Zero-data state and clear limitation that scores are not validated assessment |
| Atlas / Calendar | Explore relationships and time | Interactive graph or dated agenda | Empty state and local/cloud cache fallback |

## AI Contract

- Models: DeepSeek V4 Pro, GLM-5V-Turbo, and GLM-ASR-2512 in the current local Demo.
- Grounding: Prompts require source facts; record IDs and evidence cards let users return to saved material.
- Human review: Users can edit titles, dates, categories, descriptions, and attachments; generated language is not treated as ground truth.
- Model unavailable fallback: Local summaries, deterministic retrieval, cached records, and explicit dependency messages.
- Security limitation: Browser-direct model calls are local-Demo only. Public production use requires a server-side proxy.

## Acceptance

| Core capability | Acceptance condition | Evidence |
| --- | --- | --- |
| Capture | A desensitized record can be saved and reopened | `docs/test-evidence.md` |
| Retrieval | A query returns relevant saved records without inventing IDs | Focused chat and retrieval tests; full three-run Demo pending |
| Traceability | Growth evidence links back to source records | `GROWTH-02` through `GROWTH-06` |
| Dependency failure | Cached/local data remains visible with an explicit error | `DB-CLOUD-SHARED-05` |
| Submission safety | Candidate repository files contain no detected token/key pattern | `npm run check:submission` |
