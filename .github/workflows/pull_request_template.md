# Pull Request — Zicket Backend

## Linked issue
Closes #<!-- issue number -->

> **Rule:** Every PR must close exactly one issue. If your changes span multiple issues, split the PR.

---

## What this PR does
<!-- One paragraph, behaviour-level not file-level.
     Bad:  "Added verify-attend endpoint and updated event service."
     Good: "Attendees can now submit a zkPassport proof to unlock gated free events.
            The backend relays the proof to the verifier, never persists raw proof data,
            and forwards the resulting claim to the event contract's verify_and_attend call." -->

---

## Change type
- [ ] New endpoint
- [ ] Auth / middleware change
- [ ] Database schema / migration
- [ ] Background job / scheduled task
- [ ] zk integration (zkPassport / zkEmail) change
- [ ] Contract integration / reconciliation change
- [ ] Bug fix
- [ ] Refactor

---

## Endpoint(s) affected
<!-- For every new or changed endpoint. -->

| Method | Path | Auth required? | Notes |
|--------|------|-----------------|-------|
| <!-- POST --> | <!-- /events/:id/verify-attend --> | <!-- none / JWT / organizer-only --> | |

> ⚠️ **Anonymous-path check:** if this endpoint is part of an anonymous browsing, discovery,
> or free-attendance flow, confirm it is explicitly excluded from JWT middleware rather than
> relying on the middleware happening not to apply. An anonymous flow that silently requires
> auth is a spec violation, not a minor bug.

---

## Data handling
<!-- Mandatory for anything touching PII, wallet addresses, zk proofs, or commitments. -->

| Data | Stored where | Retention | Erasable on request? |
|------|--------------|-----------|----------------------|
| <!-- e.g. zkPassport proof bytes --> | <!-- DB / not stored / relayed only --> | <!-- e.g. never stored --> | <!-- yes/no/n.a. --> |

- [ ] Raw proof material (zkPassport proofs, zkEmail addresses) is never persisted — only commitments/nullifiers/hashes
- [ ] Any field added to a user-facing API response was checked against what the contract layer exposes for the same privacy level (no backend field should leak more than the on-chain event does)
- [ ] If this PR adds a field that is non-erasable (e.g. mirrors on-chain wallet data), it is flagged in the privacy policy / compliance doc, not just the code

---

## Contract / on-chain consistency
<!-- Mandatory for anything touching payments, escrow, cancellation, or ticket state. -->

- [ ] The state machine / enum used here matches the actual contract states (not a simplified backend-only model)
- [ ] If this PR reads ratio, delay, or window values (e.g. `withdrawable_ratio_bps`, `anon_window_size`), those are read live from contract storage — not re-derived or hardcoded on the backend
- [ ] If this PR computes a balance, refund, or payout figure shown to a user, it was checked against the actual on-chain value, not just the backend's internal record
- [ ] N/A — this PR does not touch payment, escrow, ticket, or cancellation state

> ⚠️ Backend and contract have drifted before (reconciliation service was built against a binary
> refund model before the contract's proportional-cancellation logic existed). State assumptions
> need to be re-verified against the current contract behaviour, not assumed from a prior PR.

---

## Rate limiting / anti-abuse coordination
<!-- Mandatory for any anonymous-action or claim-style endpoint. -->

- [ ] If this endpoint has an equivalent on-chain rate limit (e.g. anonymous ticket claim window), the backend limit is configured to be equal to or looser than the contract limit — never tighter in a way that masks a contract success/failure
- [ ] Error responses distinguish "backend rate-limited" from "contract rejected" with distinct error codes the frontend can branch on
- [ ] N/A — no anonymous or rate-limited action involved

---

## Indexer / event consumption
<!-- Mandatory if this PR ingests or reacts to on-chain events. -->

- [ ] If consuming a privacy-stripped event (e.g. one with no payer/attendee field), no correlation logic (timestamp matching, sequential ID inference, session join) is used to back-fill identity
- [ ] N/A — this PR does not consume on-chain events

---

## Security checklist

- [ ] Every new authenticated endpoint checks both authentication and authorization (not just "is this a valid JWT" but "is this JWT allowed to act on this resource")
- [ ] Rate limiting applied to any endpoint that creates a resource, sends an OTP/email, or claims a ticket
- [ ] No secrets, private keys, or raw proof material appear in logs (see Privacy-Preserving Logging — confirm this PR doesn't regress it)
- [ ] Webhook/listener endpoints verify signatures before trusting payload contents
- [ ] N/A — no new attack surface introduced

---

## Test coverage

**New tests added:**
| Test name | What it actually proves |
|-----------|--------------------------|
| | |

> Tests must prove the guarantee, not the label.
>
> ❌ Weak: `test_verify_attend_returns_200` — proves the route exists
> ✅ Strong: `test_verify_attend_rejects_reused_nullifier_same_event` — proves the actual security property

**Edge cases covered:**
- [ ] Happy path for each new/changed endpoint
- [ ] Auth rejection path (missing token, wrong role, expired token)
- [ ] Anonymous path explicitly tested with no auth header present
- [ ] Idempotency / replay (same request submitted twice)
- [ ] Boundary values relevant to this change (zero, max, expiry edges)

**Test count:** <!-- e.g. "8 new, 3 updated, 142 total" -->

---

## Acceptance criteria sign-off
<!-- Copy from the linked issue. State HOW each is satisfied, not just check the box. -->

- [ ] **AC:** <!-- paste criterion -->
  - Satisfied by:
- [ ] **AC:** <!-- paste criterion -->
  - Satisfied by:

---

## What this PR deliberately does NOT cover
<!-- Name every known gap and link the follow-up issue. No silent scope-narrowing. -->

- <!-- e.g. Backend-side coordination with on-chain rate limiter — tracked in #___ -->

---

## Reviewer focus areas
<!-- Tell the reviewer exactly where to spend time. -->

1.
2.
3.

---

## Checklist

- [ ] Linting / formatting passes
- [ ] I have performed a self-review of my code
- [ ] I have commented hard-to-understand sections
- [ ] Migrations (if any) are backward-compatible / reversible
- [ ] New and existing tests pass locally
- [ ] No new warnings introduced
