# Test Evidence

## Test Environment

- Baseline commits: `1e5272f` for the growth-profile work, `3e296a5` for the mobile API, and `a348569` before the submission-compliance update
- Local URLs: Focused checks used temporary Vite ports from 5175 through 5178; the public Demo is `https://www.my-archive.top/`
- Cloud project: Supabase `myarchive-dev`, Tokyo `ap-northeast-1`
- Tester: Codex browser regression
- Dates: 2026-08-03 through 2026-08-06 Asia/Shanghai

## Results

| ID | Type | Input | Expected | Actual | Pass | Fix | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DB-PREP-01 | static/build | `npm run verify` | Project checks and Vite build pass | 9 pages and 31 source files checked; Vite built successfully | yes | - | Terminal output from 2026-08-03 |
| DB-PREP-02 | local normal | Add a uniquely named note from the home page | Save confirmation appears and note is visible on `notes.html` | Confirmation appeared; exactly one matching note was visible | yes | - | Browser regression from 2026-08-03 |
| DB-PREP-03 | cleanup | Delete the temporary regression note through the local archive patch API | Test note is removed and original note count is restored | Test note removed; note count returned to 31 | yes | - | Local API response and browser reload |
| DB-PREP-04 | local read | Open `library.html` | Existing records load without console errors | 35 records rendered; no browser errors captured | yes | - | Browser DOM snapshot from 2026-08-03 |
| DB-CLOUD-01 | dependency | Run migration against a real Supabase project | Tables, indexes, triggers and RLS policies are created | Migration returned success; all three tables exist with RLS enabled and four policies each; `records` and `notes` each have one update trigger | yes | - | Supabase SQL Editor result, 2026-08-03 |
| DB-CLOUD-CLIENT-01 | static/build | Install Supabase client and run `npm run verify` | All project checks and the production build pass | 9 pages and 35 source files checked; Vite production build passed | yes | - | Terminal output from 2026-08-03 |
| DB-CLOUD-SHARED-01 | structure | Run the shared-space migration and inspect all cloud tables | RLS remains enabled, no table has `user_id`, and each table has one shared policy | `records`, `notes`, `categories`, and `archive_meta` each returned RLS `true`, `has_user_id=false`, and policy count 1 | yes | - | Supabase SQL Editor result, 2026-08-03 |
| DB-CLOUD-SHARED-02 | migration | Start the Web client against empty shared tables | The local archive uploads once and cloud reads return 35 records and 31 notes | Web toast reported 35/31; independent REST counts returned 35/31 and one migration-state row | yes | - | Browser regression and direct REST counts, 2026-08-03 |
| DB-CLOUD-SHARED-03 | write/delete | Save a uniquely named note through Web, confirm it in Supabase, then remove it | Cloud count changes 31 -> 32 -> 31 and the test row is fully removed | Exactly one row appeared; cleanup deleted one row and restored 31 notes | yes | - | Browser UI plus direct REST verification, 2026-08-03 |
| DB-CLOUD-SHARED-04 | reload read | Reload home and notes pages after cleanup | Web reads the final cloud state | Home rendered 35 records and notes page rendered 31 notes | yes | - | Browser regression on `127.0.0.1:5177`, 2026-08-03 |
| DB-CLOUD-SHARED-05 | failure | Cache valid cloud data, then start the same origin with an unavailable Supabase URL | Existing cache remains and the UI explains the dependency failure | Home rendered 35 records and displayed `云端暂不可用，当前显示本地缓存` | yes | - | Isolated browser regression on `127.0.0.1:5178`, 2026-08-03 |
| DB-CLOUD-02 | privacy | Verify second-account isolation | Not applicable after the user chose a no-login single shared space | Removed from current architecture; publishable-key holders have full archive access | n/a | - | User architecture decision, 2026-08-03 |
| DB-CLOUD-03 | cross-device | Create a note on one client and read it on the other | Same account sees the same note on both clients | Not run; Web and mobile clients are not connected yet | pending | - | Pending cloud test |
| GROWTH-01 | static/build | Run `npm run verify` after adding the formal page | Project checks, scoring checks, and Vite production build pass | 10 pages and 40 source files checked; growth rules and Vite build passed | yes | - | Terminal output from 2026-08-05 |
| GROWTH-02 | deterministic rules | Run the scoring fixture twice, then run with an empty array | Same input is identical, evidence retains record IDs, new domains follow `last=0/current>0`, and empty input stays at zero | All assertions passed | yes | - | `scripts/check-growth-profile.mjs` output |
| GROWTH-03 | browser normal | Open the profile against the current shared archive | Both 8-axis radars render, default evidence follows the highest trait, and current/baseline counts are visible | 36 current records produced nonblank radars; the evidence section defaulted to creativity, the computed highest trait | yes | - | Browser DOM and screenshot, 2026-08-05 |
| GROWTH-04 | traceability interaction | Click the `技术与 AI` growth dimension | Evidence summary and source-linked cards update to that dimension | Summary changed to `2026 年 23 分 − 2025 年 9 分 = +14`; 7 cards rendered and the first linked to `robotics-2026` | yes | - | Browser DOM check, 2026-08-05 |
| GROWTH-05 | edge/year baseline | Change the current year from 2026 to 2025 | The comparison year remains earlier and a missing year is treated as a zero-record baseline | The control added 2024 and displayed `2024 vs 2025，对比 0 / 12 条经历` | yes | future-year comparison removed | Browser interaction, 2026-08-05 |
| GROWTH-06 | responsive layout | Inspect 1280×720 and 390×844 viewports | No horizontal overflow, cards stack on mobile, and radar labels do not collide | Desktop and mobile `scrollWidth` equaled `clientWidth`; mobile cards stacked and both radars returned zero label collisions | yes | - | Browser geometry and screenshot, 2026-08-05 |
| GROWTH-07 | browser action | Click `生成画像` after restoring 2026 vs 2025 | Current records are recalculated and the control returns from loading | Button returned to `生成画像`; toast displayed `画像已基于当前经历库重新生成` | yes | - | Browser state check, 2026-08-05 |
| CHAT-VOICE-01 | static/build | Add a microphone control to the AI chat composer and run `npm run verify` | Chat reuses the existing MediaRecorder -> WAV -> sequential GLM-ASR path; checks and build pass | Project, audio-chunk, growth, mobile API, and Vite build checks passed | yes | Added shared voice setup and transcription-state guard | Commit `a348569`, 2026-08-06 |
| CHAT-VOICE-02 | responsive layout | Inspect the chat composer on desktop and 390 x 844 mobile viewport | Voice and send controls remain visible and fixed-size without overlap | Both buttons had 42 x 42 geometry; desktop/mobile screenshots showed no composer overlap | yes | - | Browser geometry check, 2026-08-06 |
| SUBMISSION-01 | repository metadata | Query the canonical GitHub repository | Repository is Public, uses `main`, and participating teammates have collaborator access | Public repository verified; collaborators were `helloalbert2010`, `p1ter111`, and `Understanding-king` | yes | - | GitHub API/CLI, 2026-08-06 |
| SUBMISSION-02 | privacy/secret | Scan candidate repository files and Git history for token/key patterns | No actual API key, token, private key, APK, or local secret file is included | Tracked history scan found only documentation terms/placeholders; automated candidate-file check added | yes | Added `scripts/check-submission.mjs` and ignore rules | Local Git scan, 2026-08-06 |
| SUBMISSION-03 | online availability | Request the public Demo URL | The URL returns a successful response | `https://www.my-archive.top/` returned HTTP 200 | yes | - | Node fetch, 2026-08-06 |

## Claims

The Web shared-cloud schema, initial import, read/write/delete path, reload behavior, cache fallback, one evidence-grounded growth-profile run, chat voice layout, mobile API contract, public repository metadata, and public URL are verified. The growth scores are deterministic keyword-rule summaries of source records, not validated personality or learning measurements. Android device/ADB validation, deployment hardening, abuse protection, attachment sharing, and three-run Demo stability are not yet supported claims. The current no-login design provides no user isolation.

## Demo Repetition

- Run 1: Web shared-cloud read/write/delete and cleanup succeeded
- Run 2: not run
- Run 3: not run
- Growth-profile focused run: source interaction, year edge case, generation action, and responsive layout succeeded once on 2026-08-05
- Remaining unstable behavior: mobile synchronization and three consecutive full Demo runs are not yet verified
