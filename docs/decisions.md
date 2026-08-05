# Key Decisions

## D01 - One Shared Demo Archive

- Decision: Use one no-login Supabase archive for the competition Demo.
- Reason: The team prioritized cross-device visibility and a short runnable path.
- Tradeoff: Anyone holding the publishable key can read or write the shared archive.
- Guardrail: Use only desensitized Demo data; public production use requires authentication and per-user policies.

## D02 - Preserve A Local Fallback

- Decision: Keep project JSON, browser cache, and IndexedDB compatibility while cloud behavior is validated.
- Reason: The core Demo should still explain dependency failure and preserve the last valid state.
- Tradeoff: Attachments and some state do not synchronize across devices.

## D03 - Evidence-Linked Growth Rules

- Decision: Calculate growth profile values with deterministic keyword/domain rules and retain source record IDs.
- Reason: Reviewers and students must be able to explain where a score came from.
- Tradeoff: The output is a reflection aid, not a validated psychological or educational measurement.

## D04 - Browser-Direct AI Is Local-Demo Only

- Decision: Keep the current direct provider calls for the time-boxed local Demo, with explicit warnings.
- Rejected production option: Shipping real provider secrets in a public Web bundle or APK.
- Next step: Move model calls to an authenticated server-side proxy before real-user deployment.

## D05 - Freeze Features For Submission

- Decision: During the submission phase, change only compliance, evidence, security, and stability material.
- Reason: The official package requires a runnable Demo, GitHub repository, product documentation, and a clear 10-minute presentation; late features would weaken reliability.
