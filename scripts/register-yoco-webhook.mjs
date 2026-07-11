#!/usr/bin/env node
// Register a Yoco webhook subscription and print the signing secret.
//
// Usage:
//   YOCO_SECRET_KEY=sk_test_... node scripts/register-yoco-webhook.mjs https://<public-host>/api/payments/yoco/webhook
//
// Put the returned `secret` (whsec_...) into YOCO_WEBHOOK_SECRET in .env.local.

const url = process.argv[2];
const secretKey = process.env.YOCO_SECRET_KEY;

if (!url) {
  console.error("Usage: node scripts/register-yoco-webhook.mjs <public-webhook-url>");
  process.exit(1);
}
if (!secretKey) {
  console.error("Set YOCO_SECRET_KEY in the environment first.");
  process.exit(1);
}

const res = await fetch("https://payments.yoco.com/api/webhooks", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${secretKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ name: "entle-off-grid-estate", url }),
});

const body = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error(`Failed (${res.status}):`, JSON.stringify(body, null, 2));
  process.exit(1);
}

console.log("Webhook registered:\n", JSON.stringify(body, null, 2));
if (body.secret) {
  console.log(`\nAdd this to .env.local:\nYOCO_WEBHOOK_SECRET=${body.secret}`);
}
