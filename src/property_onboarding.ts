import { z } from "zod";
import { InfraiClient } from "./infrai_client.ts";

const onboardingBody = z.object({
  domain: z.string().min(3),
  verificationRecord: z.string().min(1)
});

export const maintenanceRequest = z.object({
  propertyId: z.string().min(1),
  tenantId: z.string().min(1),
  summary: z.string().min(1),
  priority: z.enum(["low", "normal", "urgent"])
});

export const tenantDocument = z.object({
  propertyId: z.string().min(1),
  tenantId: z.string().min(1),
  documentType: z.string().min(1),
  expiresOn: z.string().date()
});

export const inspectionReminder = z.object({
  propertyId: z.string().min(1),
  dueOn: z.string().date(),
  assignee: z.string().min(1)
});

type Onboarding = { domain: string; verificationRecord: string };
type Domain = { zone_id: string };
type Webhook = { webhook_id: string };

export async function onboardPropertyDomain(input: unknown, client: InfraiClient): Promise<{ domain: string; zone_id: string; webhook_id: string }> {
  const request = onboardingBody.parse(input);
  const domain = await client.request<Domain>("POST", "/dns/domain/add", { domain: request.domain });
  await client.request("PUT", "/dns/record/upsert", {
    zone_id: domain.zone_id,
    record_type: "TXT",
    name: request.domain,
    content: request.verificationRecord,
    ttl: 300
  });
  await client.request("POST", "/dns/domain/verify", { domain: request.domain });
  const webhook = await client.request<Webhook>("POST", "/account/webhooks/register", {
    url: "https://property.example.com/infra/onboarding",
    events: ["system.vendor.down"],
    description: "Property domain verification completion signal"
  });
  return { domain: request.domain, zone_id: domain.zone_id, webhook_id: webhook.webhook_id };
}

export function cutoverChecklist(result: { domain: string; zone_id: string; webhook_id: string }): string[] {
  return [
    `Confirm ${result.domain} has zone ${result.zone_id}`,
    "Confirm the TXT record is visible and domain verification is complete",
    `Keep webhook ${result.webhook_id} enabled, then switch the property portal DNS`,
    "Rollback: restore the incumbent DNS target and keep request/document data in the product"
  ];
}

if (process.argv[1]?.endsWith("property_onboarding.ts")) {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("Set INFRAI_API_KEY before running the onboarding example");
  const domain = process.env.INFRAI_DOMAIN;
  if (!domain) throw new Error("Set INFRAI_DOMAIN before running the onboarding example");
  const verificationRecord = process.env.INFRAI_VERIFICATION_RECORD ?? "property-verification";
  const result = await onboardPropertyDomain({ domain, verificationRecord }, new InfraiClient(key));
  console.log(JSON.stringify({ result, checklist: cutoverChecklist(result) }, null, 2));
}
