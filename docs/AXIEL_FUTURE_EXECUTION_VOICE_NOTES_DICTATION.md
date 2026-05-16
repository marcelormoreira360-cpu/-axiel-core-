# AXIEL Core — Future Execution: Voice Notes / Dictation

## Objective

Allow the professional to speak instead of typing when creating Session Notes, Insight drafts, or patient summaries.

This feature should reduce documentation time, make clinical note capture easier, and improve the quality of data that can later support Insights and Snapshots.

## Flow

Speak → Transcribe → Review → Edit → Save → Use for Insight / Snapshot

## Where It Appears

- Session Notes
- Patient Profile
- Insight draft
- Snapshot notes

## Core UX Rule

The transcribed text must never become final automatically.

The professional must review and edit the text before saving it.

## MVP Scope

### Include

- A clear button: **Speak note**
- Temporary transcription field
- Review and edit step
- Save final text only after human review
- Use saved text as normal note content for Session, Insight draft, or Snapshot context

### Do Not Include Yet

- Saving audio files
- Voice commands
- Automatic clinical interpretation
- Automatic finalization
- Complex dictation workflows
- Background listening
- Multi-speaker detection

## User Experience

The interface should feel calm and simple.

Example pattern:

1. User clicks **Speak note**
2. System captures speech and creates a draft transcription
3. User reviews the draft
4. User edits anything needed
5. User clicks **Save note**
6. Saved text can feed Insight and Snapshot logic

## Safety Rules

- Transcription is a draft until reviewed.
- No text is saved as final without explicit human action.
- The feature must not diagnose, prescribe, or generate clinical conclusions by itself.
- AI may help organize text later, but final use requires review.
- No audio should be stored in MVP.

## Suggested Components

Future files:

- `/components/voice-note-button.tsx`
- `/components/voice-note-review.tsx`
- `/components/dictation-draft-card.tsx`

## Suggested Services

Future files:

- `/services/dictation-service.ts`
- `/services/transcription-service.ts`

## Suggested Tables

MVP does not require saving audio.

Optional future table:

`dictation_drafts`

Suggested fields:

- id
- clinic_id
- patient_id
- appointment_id
- insight_id
- draft_text
- reviewed_text
- status
- created_by
- reviewed_by
- reviewed_at
- created_at

Status:

- draft
- reviewed
- saved
- discarded

## Product Placement

This is a future productivity layer, not a core dependency.

It should be implemented after:

1. Session Notes are stable
2. Insight drafts are stable
3. Snapshot is pulling patient context reliably

## Result Expected

Voice Notes / Dictation should:

- reduce typing time
- improve note quality
- help professionals document more naturally
- feed better inputs into Insights and Snapshots
- keep human review mandatory
