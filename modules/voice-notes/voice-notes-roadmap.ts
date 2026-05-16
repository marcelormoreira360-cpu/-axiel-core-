export const voiceNotesFutureExecution = {
  name: "Voice Notes / Dictation",
  status: "future",
  goal:
    "Allow professionals to speak notes, review transcriptions, edit them, and save final text for Session Notes, Insight drafts, and Snapshot context.",
  flow: ["Speak", "Transcribe", "Review", "Edit", "Save", "Use for Insight/Snapshot"],
  primaryActionLabel: "Speak note",
  mvpRules: [
    "Transcribed text is always a draft first.",
    "Human review is required before saving.",
    "Do not save audio in the MVP.",
    "Do not support complex voice commands in the MVP.",
  ],
  surfaces: [
    "Session Notes",
    "Patient Profile",
    "Insight draft",
    "Snapshot notes",
  ],
} as const;
