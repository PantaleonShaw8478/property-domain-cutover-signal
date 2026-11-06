import test from "node:test";
import assert from "node:assert/strict";
import { cutoverChecklist } from "./property_onboarding.ts";

test("cutover keeps a concrete rollback step after verification", () => {
  const checklist = cutoverChecklist({ domain: "portal.example.com", zone_id: "zone-7", webhook_id: "wh-2" });
  assert.equal(checklist[0], "Confirm portal.example.com has zone zone-7");
  assert.match(checklist[3], /Rollback/);
});
