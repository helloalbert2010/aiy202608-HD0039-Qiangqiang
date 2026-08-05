# AIY Submission Readiness

Checked against `C:\Users\杨博夫\Desktop\提交要求.pdf` (Builder Guide v2.0, local file updated 2026-08-04) and `AIY Hackathon 2026活动手册.pdf` (local file updated 2026-08-03).

## Organizer Hard Requirements

| Requirement | Status | Evidence / remaining action |
| --- | --- | --- |
| Public repository under a participating teammate; collaborators added | pass | GitHub API reports Public; `helloalbert2010`, `p1ter111`, and `Understanding-king` have accepted collaborator access; no invitations remain pending |
| Repository name follows `aiy202608-<team number>-<team name>` | needs organizer confirmation | Current canonical name is `aiy202608-HD0039-Qiangqiang`; the user explicitly requires it to remain unchanged, while the guide requests lowercase |
| README follows organizer template | partial | Required sections, screenshot, team table, Demo, technology, run steps, plan, and copyright are present; command company / track still needs team confirmation |
| MIT LICENSE names real participating members and 2026 | pass | GitHub detects MIT; `LICENSE` names Albert, Peter, and Vito as recorded in the pitch deck |
| Topic `aiy-hackathon-202608` | pass | GitHub API reports the exact Topic on the canonical repository |
| No keys, passwords, tokens, or private company data | pass for repository history | `.env*`, data, APKs, keys, and outputs are ignored; `npm run check:submission` scans current tracked files and every historical text blob for credential patterns |

## Additional Organizer Checks

- [x] Online Demo returns HTTP 200 at <https://www.my-archive.top/>.
- [x] Product problem, architecture, limitations, and evidence are documented.
- [x] All three team accounts have accepted collaborator access; no invitation is pending.
- [ ] Team confirms command company / track and applies the exact same name to README, PPT, Bloom task card, and competition state.
- [ ] Peter makes one truthful commit under `p1ter111`.
- [ ] Vito makes one truthful commit under `Understanding-king`.
- [ ] Core Demo succeeds three consecutive times and is recorded.
- [ ] Final PPT and product document are uploaded to Bloom.
- [ ] GitHub URL and online Demo open from a fresh browser/account.
- [ ] Repository URL is submitted to the organizer and sent to all teammates.
- [ ] Team rehearses the 10-minute presentation and 5-minute Q&A.

## Exact Organizer Question

Please confirm the registered command company / track for team HD0039 and whether the already-created canonical repository name `aiy202608-HD0039-Qiangqiang` is accepted despite the Builder Guide's lowercase naming example. No repository rename will be made without the team's explicit instruction.
