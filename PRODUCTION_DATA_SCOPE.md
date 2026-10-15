# Production Data Scope

Last updated: 2026-08-13

## Pilot users and integrations

- The pharmacy owner is the only application user.
- The owner must use one named administrator account. Shared accounts are not permitted.
- Customers and staff do not receive application accounts or passwords.
- Customer login, customer portal, public order tracking, public feedback, and customer payment endpoints are disabled.
- Staff registration, staff login, staff account management, and delivery assignment are disabled.
- Manual payment recording remains available to the owner.
- Razorpay and other live customer payment gateways are disabled for the pilot.
- WhatsApp messaging and configuration are disabled for the pilot, including local Chromium automation.

## Customer fields

The pilot may store only the following customer profile fields:

- name;
- mobile number;
- postal address;
- state;
- GST number when required for invoicing;
- operational notes;
- credit limit; and
- default recurring-order interval.

Customer passwords, authentication roles, portal credentials, and provider tokens are not customer data fields and must not be collected.

## Retention and deletion

- Keep a customer profile while there is an active business relationship or an unresolved order, invoice, payment, balance, tax, or dispute requirement.
- Review inactive customer profiles at least annually.
- When no business or legal retention need remains, the owner must export any records that still require retention and delete the application profile through the authenticated owner interface.
- Backup generations expire under the backup retention schedule; deletion from the live database does not retroactively rewrite encrypted backups.
- Access to exports and deletion is restricted to the named owner.
- The owner must confirm jurisdiction-specific tax, accounting, privacy, and pharmacy-record retention periods before production go-live. This document is an operating rule, not legal advice.
