# AXIEL CORE — EXECUÇÃO 00
## Master Patient Journey Flow

### Objective
Organize the main AXIEL Core flow connecting:

Lead → Form → Patient → Session → Insight → Snapshot → Next Step → Product Support → Follow-up → Membership

The AXIEL Core should guide the clinic. It should not wait for the user to figure out what to do next.

---

## 1. Main Flow Map

```txt
Lead
  ↓
Form
  ↓
Patient
  ↓
Session
  ↓
Insight
  ↓
Snapshot
  ↓
Next Step
  ↓
Product Support
  ↓
Follow-up
  ↓
Membership
```

### Meaning
- Lead enters the system.
- Form collects initial context.
- Lead becomes a Patient.
- Patient has a Session.
- Session and Forms generate Insight candidates.
- Human validation approves or adjusts the Insight.
- Snapshot shows the essential context.
- Next Step guides the next action.
- Product Support and Follow-up create continuity.
- Membership supports retention.

---

## 2. Data Movement

### Lead → Form
Data passed:
- name
- phone
- email
- source
- main concern
- preferred contact channel

Primary action:
- Send form

---

### Form → Patient
Data passed:
- form submission
- intake responses
- body map marks
- lead context

Primary action:
- Convert to patient

---

### Patient → Session
Data passed:
- patient profile
- latest form summary
- previous Sessions
- active Next Step

Primary action:
- Create Session

---

### Session → Insight
Data passed:
- Session notes
- key observations
- intake responses
- body map areas
- patient history

Primary action:
- Generate Insight draft

AI rule:
- Insight starts as In Review.
- It must not be treated as final until human validation.

---

### Insight → Snapshot
Data passed:
- latest Insight title
- latest Insight summary
- Insight status
- key notes
- Next Step
- attention needed

Primary action:
- Review Snapshot

---

### Snapshot → Next Step
Data passed:
- attention needed
- follow-up status
- latest Insight
- last Session summary

Primary action:
- Accept Next Step

---

### Next Step → Product Support
Data passed:
- Next Step text
- approved support category
- optional product link
- review date

Primary action:
- Add Product Support

Safety rule:
- AI may suggest a support category.
- A human chooses and approves any product.

---

### Product Support → Follow-up
Data passed:
- product support item
- review date
- refill date
- support message

Primary action:
- Create follow-up

---

### Follow-up → Membership
Data passed:
- follow-up history
- recurring need
- patient progress
- continuity opportunity

Primary action:
- Offer membership

---

## 3. Required Screens

### MVP
- `/dashboard`
- `/leads`
- `/forms`
- `/patients`
- `/patients/[id]`
- `/schedule`
- `/insights`
- `/p/[token]`

### Added / Existing Expansion
- `/products`
- `/products/new`
- `/products/orders`
- `/patients/[id]/products`

### Embedded Snapshot Locations
- Schedule Drawer
- Patient Profile
- Dashboard
- Patient Portal

---

## 4. Main Components

### Journey
- `PatientSnapshot`
- `LatestInsightCard`
- `NextStepCard`
- `PatientJourneyTimeline`

### Lead / Form
- `FormBuilder`
- `FormQuestionCard`
- `PatientFormView`
- `BodyMapField`

### Session
- `SessionCard`
- `SessionDrawer`
- `CreateSessionModal`

### Product Support
- `ProductCard`
- `PatientProductCard`
- `ProductSuggestionCard`
- `ProductRefillCard`

---

## 5. Tables Involved

### Lead
- `leads`

### Forms
- `intake_forms`
- `intake_questions`
- `form_submissions`
- `intake_responses`
- `body_map_marks`

### Patient / Session
- `patients`
- `appointments`
- `session_records`

### Insight
- `ai_insights`
- `ai_validation_events`

### Snapshot / Actions
- Snapshot is generated from existing data.
- `action_suggestions` can store Next Step actions.

### Product Support
- `products`
- `product_categories`
- `patient_products`
- `product_suggestions`
- `product_orders`
- `product_order_items`
- `product_refill_reminders`

### Retention
- `follow_ups`
- `patient_offers`
- `subscriptions`

---

## 6. User Actions by Stage

### Lead
Primary actions:
1. Contact
2. Send form
3. Convert to patient

### Form
Primary actions:
1. Create form
2. Send form
3. View answers

### Patient
Primary actions:
1. Review Snapshot
2. Create Session
3. Add note

### Session
Primary actions:
1. Start Session
2. Add note
3. Create follow-up

### Insight
Primary actions:
1. Approve
2. Request changes
3. Archive

### Snapshot
Primary actions:
1. Open patient
2. Add note
3. Create follow-up

### Product Support
Primary actions:
1. Add Product Support
2. Create Payment Link
3. View details

### Follow-up
Primary actions:
1. Complete
2. Reschedule
3. Message patient

---

## 7. AI Automations — Future Safe Path

### MVP-safe AI
- Generate Insight draft
- Summarize form responses
- Highlight attention needed
- Suggest possible Next Step

### Phase 2 AI
- Suggest Product Support category
- Suggest follow-up timing
- Prioritize dashboard actions

### Never
- diagnose
- prescribe
- promise results
- make final clinical decisions
- attach products automatically without human approval

---

## 8. UX Rules

- Max 3 primary actions per area.
- Max 5 visible items per section.
- Use `Session`, `Insight`, and `Next Step`.
- Hide advanced data inside `View details`.
- The system should guide the user.
- Patient-facing language must be simpler than professional-facing language.

---

## 9. MVP Scope

### In MVP
- Lead to Patient conversion
- Forms / Intake
- Schedule / Session
- Insight with human validation
- Patient Snapshot
- Next Step
- Basic Follow-up
- Basic Product Support structure

### Future
- Online booking
- Advanced memberships
- Stripe Checkout for product sales
- Full communication automation
- Advanced AI prioritization
- Advanced reporting

---

## 10. Product Principle

AXIEL Core is not a collection of modules.

AXIEL Core is a guided patient journey system.

The interface should always answer:

```txt
What is happening with this patient?
What needs attention?
What is the next safe step?
```
