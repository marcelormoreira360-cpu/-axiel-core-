# AXIEL Core

AXIEL Core is a simple, multi-clinic SaaS foundation for clinic operations.

## Latest update: 4-step guided onboarding

The onboarding experience now uses a calm 4-step flow designed to help a new clinic feel successful in under 3 minutes.

### Flow

1. **Name your clinic**  
   One simple input.

2. **Choose your hours**  
   Large preset buttons. No complex schedule form.

3. **Pick a starter kit**  
   Creates generic session types and the first intake form automatically.

4. **Invite your first teammate**  
   Optional email field. The user can skip and add staff later.

### Completion

After onboarding, AXIEL Core redirects to:

```txt
/onboarding/ready
```

The final screen now gives the user a clear next action:

```txt
Your clinic is ready. Let’s get started.
```

Primary action:

```txt
Go to Dashboard
```

Secondary suggestion:

```txt
Start with your first patient
```

Both actions guide the user to `/dashboard`.

The system auto-creates:

- one sample patient
- one sample lead
- one sample session
- starter intake form
- generic session types
- working hours
- clinic settings

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Supabase

For a new project, run:

```txt
supabase/schema.sql
```

For an existing project, run migrations in order.

## Next Best Actions Dashboard Component

The dashboard now includes a dedicated `NextBestActions` component designed for an ultra-simple, guided workflow.

It shows a maximum of five action cards based on:

- pending AI insight reviews
- inactive patients who have not returned in 30+ days
- new leads that need scheduling/contact
- pending follow-ups

Each card includes:

- short title
- one-line description
- one primary action button

Clicking the action button marks the action as accepted and redirects the user to the right page, such as the patient insight page, lead profile, or follow-up list.

Primary files:

```txt
/components/next-best-actions.tsx
/app/actions/action-suggestions.ts
/modules/action-suggestions/action-rules.ts
/services/action-suggestion-service.ts
/services/ai-insight-service.ts
/app/dashboard/page.tsx
```

## AI Insight status UI update

All AI Insight screens now hide internal database status names from practitioners and clinic users.

Visible labels:

- `pending_review` shows as **In Review**
- `needs_changes` shows as **Needs Adjustment**
- `final` shows as **Final**
- `archived` insights are hidden from normal AI Insight lists

Badge colors:

- **In Review** and **Needs Adjustment** use a soft yellow badge
- **Final** uses a soft green badge

Technical status values are still used internally for database security, reporting, audit logs, and workflow logic, but they are not shown in the main user interface.

## AI Insights panel redesign

The AI Insights panel now uses a minimal card-based review experience:

- Short title
- 2–3 line summary
- Simple status badge
- Primary Approve button
- Secondary Request changes button
- Smaller Generate new draft action
- Optional View details section for advanced users

The default view avoids technical language and keeps the safety label visible: **AI-generated insights (not medical advice)**.

## Lead to patient conversion

The lead profile now includes a prominent **Convert to Patient** flow.

When the user clicks **Convert to Patient**, the interface asks:

```txt
Are you sure you want to convert this lead into a patient?
```

After confirmation, the system:

- creates a new patient record
- copies lead name, email, phone, source, main complaint, and notes
- marks the patient as active
- moves the lead to **Converted / Patient**
- stores the new `converted_patient_id` on the lead
- writes an audit event for `lead.converted`
- redirects the user to the new patient profile

If the lead was already converted, the system does not create a duplicate patient. It shows **Open patient profile** instead.

Primary files:

```txt
/app/leads/[id]/page.tsx
/app/leads/[id]/actions.ts
/components/convert-lead-button.tsx
/services/lead-service.ts
```

## Dashboard layout refinement

The main dashboard has been simplified into a calm three-part layout:

1. **Top** — greeting and three small summary cards:
   - Patients today
   - New leads
   - Pending reviews

2. **Middle** — **Next Best Actions** as the main focus.
   - Up to 5 cards
   - The first action is visually emphasized
   - Each action has one clear button

3. **Bottom** — today's schedule in a clean timeline view.

The page uses larger spacing, minimal text, soft backgrounds, and fewer competing controls so a non-technical user can quickly understand what to do next.

## Friendly Empty States

This version adds calm, guided empty states across the system so a new clinic user never lands on a blank or confusing screen.

Updated areas include:

- Patients: prompts the user to create the first patient.
- Leads: explains that marketing channels can start capturing leads and offers a first lead action.
- Schedule: guides the user to create the first session.
- Follow-ups: explains reminders and points to creating the first one.
- Intake: guides the clinic to create the first intake form.
- Communications: guides the clinic to create default message templates and shows an empty message history.
- Monetization: guides the clinic to create the first package or membership.
- Actions: confirms when there are no urgent next steps.
- Clinics and team: guides users back to onboarding when setup is incomplete.

Design rules used:

- short, friendly copy
- one clear next action
- large rounded cards
- no technical language
- no blank screens


## Soft onboarding guide

After first login, AXIEL Core now shows a small floating helper with three calm first-day steps:

1. Review your first lead
2. Create your first patient
3. Schedule your first session

The guide uses large action buttons and can be dismissed. Dismissal is saved in localStorage using `axiel-soft-onboarding-dismissed`, so the user is not overwhelmed after they close it.

## Cognitive Load Refactor

This version applies a simple usability rule across the product:

- Maximum 3 primary actions per screen.
- Maximum 5 visible items per section.
- Advanced or overflow content is hidden behind **View details**.

New shared UI helpers:

- `/components/view-details.tsx` — collapses advanced content.
- `/components/limited-list.tsx` — shows the first 5 items and hides the rest.
- `/modules/ui/cognitive-load.ts` — shared limits for product consistency.

Updated areas:

- Dashboard schedule preview
- Patients list
- Patient profile actions and timeline
- CRM pipeline columns
- Schedule day/week views
- Actions center
- Communications templates and logs
- Follow-up list
- Monetization lists
- Clinics/team lists
- Intake saved forms
- Settings page
- Main navigation simplified to 5 visible areas

The goal is to keep the default experience calm and obvious while still allowing advanced users to access more details when needed.

## Terminology Standardization

This version standardizes product language across the app:

- Use **Session** for all appointments or service encounters.
- Use **Insight** for patient-facing summaries and AI-assisted outputs.
- Use **Next Step** for guided user actions.

Implementation notes:

- UI copy was updated to avoid specific treatment names.
- Patient-facing exports now display as **Patient Insight** / **Patient Insight**.
- Action guidance now displays as **Next Steps** instead of technical suggestion language.
- Advanced implementation paths may keep legacy route names for backwards compatibility, but user-facing labels now follow the simplified terminology.

## Terminology enforcement

AXIEL Core now uses a central terminology helper for all user-facing product language:

```ts
import { getTerm } from "@/modules/ui/terminology";

getTerm("session"); // Session
getTerm("insight"); // Insight
getTerm("nextStep"); // Next Step
```

The UI should avoid hardcoded legacy terms such as "report", "analysis", and "recommendation". Use:

- `getTerm("session")` instead of treatment-specific language
- `getTerm("insight")` instead of analysis/report language
- `getTerm("nextStep")` instead of recommendation language

Run the terminology check before shipping:

```bash
npm run check:terminology
```

The standard lint command now runs the terminology check first:

```bash
npm run lint
```

## Lightweight Patient Dashboard

This version adds a mobile-first patient dashboard that works through a secure token link and does not require patient login.

Patient route:

```txt
/p/[token]
```

Clinic staff can create a secure link from:

```txt
/patients/[id]/portal-link
```

The patient dashboard includes:

- Welcome message
- Latest finalized Insight
- Previous Sessions timeline
- Next Step
- WhatsApp contact button

Security model:

- Raw tokens are only shown once in the generated URL.
- Only a SHA-256 token hash is stored in the database.
- Links expire after 7 days by default.
- Links can be revoked by clinic staff.
- Links can be regenerated. Regeneration revokes older active links and creates a new 7-day link.
- Patient portal access logs are immutable.
- The public route is excluded from login middleware, but data is loaded server-side through token validation.

New migrations:

```txt
supabase/migrations/017_patient_portal_secure_links.sql
supabase/migrations/018_patient_portal_secure_access.sql
```

Run migration 018 after migration 017 for the hardened 7-day expiration, regenerate-link flow, immutable security events, and protection against editing sensitive portal-link fields.

Optional environment variable for the WhatsApp contact button:

```env
NEXT_PUBLIC_DEFAULT_WHATSAPP_NUMBER=
```

## Patient WhatsApp contact button

The patient dashboard now includes a highly visible sticky WhatsApp button. It opens a one-click chat with the clinic and pre-fills the message:

"Hi, I have a question about my session."

Configure the clinic WhatsApp number in clinic settings using `whatsapp_number`, or set `NEXT_PUBLIC_DEFAULT_WHATSAPP_NUMBER` as a fallback.

## Patient-facing language update

All patient-facing screens now use simple words, short sentences, and a calm tone.
The patient dashboard, patient insight page, and PDF wording were rewritten so a patient can understand the content quickly without technical language.

## Patient dashboard emotional UX

The patient dashboard now uses a calmer visual style with soft green and warm neutral tones.

Patient-facing reassurance was added in a subtle way:

- "You are on the right path."
- "This is part of your progress."
- "Take your time. Your clinic is here to support you."

The goal is to make the patient feel safe and guided without exaggeration or emotional pressure.

## AXIEL Design System — Cards

All main cards now follow the AXIEL calm-premium card standard:

- `rounded-xl`
- `border border-axiel-line`
- `bg-white`
- `p-6` or larger
- `shadow-sm`
- subtle hover effect with `hover:-translate-y-0.5` and `hover:shadow-md`

Use the shared card component for new work:

```tsx
import { Card } from "@/components/card";

<Card>
  Content
</Card>
```

For custom card-like UI, reuse:

```tsx
import { AXIEL_CARD_CLASS } from "@/modules/ui/card-styles";
```

### Status badges

AI Insight status badges are standardized through `/components/status-badge.tsx`:

- **In Review** uses a soft yellow background with dark text
- **Needs Adjustment** uses the same soft yellow review tone
- **Final** uses a soft green background with dark text
- Badges are rounded, minimal, and do not show internal status names

## AXIEL Design System — Buttons

Buttons now use one shared visual hierarchy across the app.

Primary buttons:

- AXIEL blue background
- white text
- `rounded-lg`
- medium shadow
- used only for the main action on a screen or card

Secondary buttons:

- outline style
- subtle text color
- soft hover state
- used for supporting actions

Tertiary and ghost buttons are intentionally quiet and should not compete with the primary action.

Use the shared button component for future work:

```tsx
import { Button } from "@/components/button";

<Button>Save</Button>
<Button variant="secondary">Cancel</Button>
<Button variant="tertiary">View details</Button>
```

For link-based actions, use:

```tsx
import { ButtonLink } from "@/components/button-link";

<ButtonLink href="/dashboard">Go to dashboard</ButtonLink>
```

The rule is simple: each section should have one obvious primary action. Other actions should be secondary or hidden under View details.

## AXIEL color system

The app now uses the official AXIEL color tokens in `tailwind.config.ts`:

- `axiel.primary` — `#0B1F3A`
- `axiel.secondary` — `#3A5BA0`
- `axiel.background` — `#F8FAFC`
- `axiel.surface` — `#FFFFFF`
- `axiel.text.primary` — `#1A1A1A`
- `axiel.text.secondary` — `#6B7280`
- `axiel.state.success` — `#4CAF50`
- `axiel.state.warning` — `#F2C94C`
- `axiel.state.error` — `#EB5757`

Use shared helpers instead of hardcoded colors:

- `components/button.tsx`
- `components/card.tsx`
- `components/status-badge.tsx`
- `modules/ui/button-styles.ts`
- `modules/ui/card-styles.ts`

The calm gradient is available as:

```tsx
className="bg-axiel-calm"
```


## AXIEL Typography

The official AXIEL UI font is **Inter**. Tailwind now maps `font-sans` to `Inter, sans-serif`, and the root layout loads Inter through `next/font/google`.

## AXIEL spacing system

The design system now includes official spacing tokens in Tailwind:

```ts
spacing: {
  xs: "4px",
  sm: "8px",
  md: "16px",
  lg: "24px",
  xl: "32px",
}
```

Use these tokens for consistent spacing across the app:

```tsx
className="p-lg gap-md mt-xl"
```

Core UI helpers now use these tokens for cards and buttons.


## AXIEL Button Components

The design system now includes simple button helpers for consistent UI actions:

```tsx
import { ButtonPrimary, ButtonSecondary } from "@/components/button";

<ButtonPrimary>Go to Dashboard</ButtonPrimary>
<ButtonSecondary>View details</ButtonSecondary>
```

Primary buttons use AXIEL blue, white text, rounded corners, soft shadow, and a subtle hover state. Secondary buttons use a calm outline style.


## AXIEL Secondary Button

`ButtonSecondary` is now standardized as the official subtle secondary action button:

- `border border-gray-200`
- `text-axiel-text-primary`
- `px-lg py-md`
- `rounded-xl`
- `hover:bg-gray-50`
- `transition`

Use it for supporting actions only. Avoid placing multiple secondary buttons next to the primary action unless the screen truly needs them.


## AXIEL Badge Component

Use the central badge component for Insight status labels. Keep the UI simple and avoid exposing internal status names.

```tsx
import { Badge } from "@/components/status-badge";

<Badge status="review" /> // In Review
<Badge status="final" /> // Final
```

Badge styles:

- `review`: soft yellow background with dark yellow text
- `final`: soft green background with dark green text

Internal states such as `pending_review` and `needs_changes` should be mapped to `review` before rendering.

## AXIEL Insight Card

AI Insight cards now use the official `InsightCard` pattern:

- clean white card
- rounded-2xl
- short title
- 2-3 line summary
- simple Review/Final badge
- primary Approve action
- secondary Adjust action
- optional View details section

Use:

```tsx
import { InsightCard } from "@/components/insight-card";

<InsightCard
  title="Insight ready for review"
  summary="A short, simple summary appears here. It should be easy to understand in seconds."
  status="review"
/>
```

## AXIEL Calm Message

Use `CalmMessage` for soft, reassuring messages in patient-facing or onboarding screens.

```tsx
import { CalmMessage } from "@/components/calm-message";

<CalmMessage>
  You are on the right path.
</CalmMessage>
```

Design:
- `bg-axiel-calm`
- `rounded-2xl`
- `p-6`
- `shadow-sm`
- `border border-white/40`
- short, calm, human language

## AXIEL CalmMessage Component

The CalmMessage component now includes a subtle Info icon from `lucide-react` and keeps the message soft, calm, and easy to scan.

```tsx
import { CalmMessage } from "@/components/calm-message";

<CalmMessage>
  You are on the right path.
</CalmMessage>
```

Design pattern:

- `bg-axiel-calm`
- `rounded-2xl`
- `p-6`
- `shadow-sm`
- subtle Info icon
- short, reassuring text

## AXIEL Tailwind Tokens

The official AXIEL theme tokens are defined in `tailwind.config.ts` under `theme.extend`:

- `bg-axiel-background` for the app background
- `bg-axiel-surface` or `bg-white` for cards
- `text-axiel-text-primary` for primary text
- `text-axiel-text-secondary` for secondary text
- `bg-axiel-calm` for calm gradient message areas
- `bg-axiel-primary` for primary actions
- `text-axiel-secondary` for subtle accent icons and labels

Use these tokens instead of hardcoded colors in UI components.

## Patient dashboard secure links

The patient dashboard uses token-based access. Patients do not need a login.

Security rules:

- each generated link creates a unique raw token;
- only the SHA-256 token hash is stored in Supabase;
- the raw token appears only in the generated URL;
- every request to `/p/[token]` validates the token hash, expiration, and revocation status;
- links expire in 7 days;
- regenerating a link revokes the old active link and creates a new one;
- only one active patient dashboard link is allowed per patient;
- portal access logs and security events are immutable.

Run after migration 018:

```txt
supabase/migrations/019_patient_portal_token_enforcement.sql
```

## AXIEL Execução 00 — Master Flow

See `AXIEL_EXECUCAO_00_MASTER_PATIENT_JOURNEY_FLOW.md` for the architecture-mãe connecting Patient Journey and SaaS Business Journey.
