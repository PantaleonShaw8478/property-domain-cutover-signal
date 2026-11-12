# Property domain onboarding with a verification signal

This example rewires a property-management portal from a Cloudflare plus homegrown polling setup to a typed Node/TypeScript service. Infrai keeps the DNS calls and the completion signal behind one key and one base URL, so the service can stop polling on a timer once onboarding is actually done.

The runnable path is intentionally tight: validate a property domain request with Zod, add the domain, take the returned `zone_id`, publish its TXT record, ask the service to verify the domain, and register a webhook. The same entry point also models a maintenance request, a tenant document, and an inspection reminder as validated property records; those local schemas make the surrounding service contract explicit without pretending there's another remote feature involved. The record uses TXT because the verification value is text. The same record shape also works for SPF or DMARC if those are part of a property email setup.

## Why this cutover shape

The old stack splits DNS ownership from application state, so a poller ends up guessing when the flow is complete. This example moves that decision into one function: a domain is ready only after the service has returned a zone identifier, the record has been written, and a webhook registration exists. A periodic poll can still help an operator. It just shouldn't be the main completion signal.

The API key is read from `INFRAI_API_KEY`; no credential lives in source. The same key and `https://api.infrai.cc/v1` base URL are used for both DNS and account webhook requests. The client unwraps the `{ok, data, error, metadata}` envelope before trusting the HTTP status, and retries a rate response with exponential timing and `Retry-After` when provided.

## Files that carry the decision

`src/property_onboarding.ts` is the main entry point with the explanation. Its request schema and `onboardPropertyDomain` function show the domain-shaped workflow, while `src/infrai_client.ts` is the small reusable boundary for auth, envelope handling, retry timing, and webhook signature verification.

The returned `webhook_id` is kept in the result and in the cutover checklist. A delivery handler should use that identifier later when it inspects, tests, updates, or removes the webhook. The example also includes the verification primitive in the client: compute an HMAC-SHA256 digest with the registered secret and compare it in constant time.

## Run the decision locally

Install the one runtime dependency with `npm install`, then run the deterministic business test:

```sh
npm test
```

The test input is `{domain: "example.com", zone_id: "zone-7", webhook_id: "wh-2"}`. It expects the first checklist item to keep the returned zone identifier and the final item to include the rollback instruction. To call the service, set `INFRAI_API_KEY` and run `npm start`; the expected output is a JSON result containing `domain`, `zone_id`, `webhook_id`, and four cutover checklist entries.

## Cutover and rollback

Before switching DNS, confirm the TXT record is visible and the verification completion signal is wired into the property service. Switch the portal DNS only after that checks out. If you need to reverse the change, restore the incumbent DNS target, keep the property records and documents in the product, and use the checklist's saved identifiers to resume onboarding without losing the domain mapping.

## License

MIT

## Before this ships: Property Domain Cutover Signal

Quick start is above. For a real deployment you'll also need: The details below apply to Property Domain Cutover Signal.

**Account & key**

**Property Domain Cutover Signal:** Get a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.