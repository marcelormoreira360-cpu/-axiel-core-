# AXIEL Next Phase

## Current Architecture Priority

The AXIEL Core is organized around two connected but separate journeys.

### Patient Journey
Lead → Form → Patient → Session → Insight → Snapshot → Next Step → Follow-up → Products → Portal → Membership

### SaaS Business Journey
Clinic Signup → Trial → Plan Selection → Billing → Upgrade/Downgrade → Subscription Management → Usage Limits

## Implementation Recommendation

Start with the practical connection:

Lead → Form → Patient → Session

Then connect:

Session → Insight → Snapshot → Next Step

Keep Billing / SaaS Commercial Layer separated from the clinical patient journey.
---

# Added — Execução 13: Results / Analytics Dashboard

The Results dashboard is now planned and scaffolded as a SaaS/business visibility layer.

It should remain simple:
- 3 primary cards at the top;
- 5 visible items per section;
- Business Insights with safe AI placeholder;
- View details for advanced analytics.

This module should support clinic owners and managers without interrupting the Patient Journey.

---

## Future Execution — Voice Notes / Dictation

Goal: allow the professional to speak notes instead of typing.

Flow:

Speak → Transcribe → Review → Edit → Save → Use for Insight / Snapshot

MVP rule: no transcription becomes final without human review. Do not save audio in the MVP. Use one clear action: **Speak note**.

Recommended timing: after Session Notes, Insight drafts, and Patient Snapshot are stable.

