# AXIEL Core — SaaS Commercial Layer

## Two journeys

### Patient Journey
Lead → Form → Patient → Session → Insight → Snapshot → Next Step → Follow-up → Products → Portal → Membership

This is the clinic and patient journey. It should stay calm, simple, and focused on care continuity.

### SaaS Business Journey
Clinic Signup → Trial → Plan Selection → Billing → Upgrade/Downgrade → Subscription Management → Usage Limits

This is the AXIEL business journey. It controls plans, payment status, feature access, and commercial growth.

## Product rule

Billing is a SaaS commercial layer, not part of the patient journey.

Patients should not see SaaS billing. Practitioners should not need billing details during care. Clinic owners manage plan, subscription, and usage from Settings.

## What must be planned from the start

- Every clinical table must keep `clinic_id`.
- Every feature must be able to be enabled or disabled per clinic.
- Every clinic must have one current subscription state.
- Usage should be tracked before hard limits are enforced.
- Plan limits should be checked in one central place.
- Stripe identifiers should live only in billing-related tables.
- Platform roles and clinic roles must stay separate.

## What can be implemented later

- Stripe Checkout
- Stripe Customer Portal
- automated upgrade and downgrade
- invoice history
- coupons
- failed payment recovery
- usage-based billing
- Enterprise custom contracts

## Plans

### Starter
For a small clinic getting organized.

Includes:
- leads
- patients
- schedule
- simple forms
- simple follow-ups
- limited users
- limited patients
- limited AI usage or no advanced AI

### Professional
The main AXIEL plan.

Includes:
- everything in Starter
- AI Insights
- Patient Snapshot
- Patient Portal
- Product Support
- advanced templates
- higher limits

### Enterprise
For larger clinics, multi-location clinics, and advanced operations.

Includes:
- everything in Professional
- custom limits
- advanced permissions
- multi-clinic support
- compliance support
- priority support
- custom onboarding

## MVP implementation

Build now:
- plans
- subscriptions
- feature_flags
- usage_events
- billing settings page
- usage settings page
- plan access helpers

Build later:
- Stripe Checkout
- Stripe Portal
- webhooks
- automated payment state updates
