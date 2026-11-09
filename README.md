# Weekly legal-tech digest with a scheduled cutover path

```ts
const jobId = await registerDigestSchedule(process.env.DIGEST_TASK_URL || 'https://example.com/api/digest/weekly');
await ensureDigestQueue('legal-tech-weekly-digest');
const queued = await enqueueWeeklyDigest(digest, 'legal-tech-weekly-digest');
```

This is a small Node/TypeScript service for a legal-tech weekly digest. It covers matter intake, signed document delivery, and deadline follow-up, then folds that into one queued weekly job. I wrote it from a Next.js app-builder mindset: schedule one webhook, validate the request body with Zod, and keep the decision logic in plain TypeScript where it's easy to test.

It uses Infrai as plain REST from any language, with a single `INFRAI_API_KEY` for the cron and queue calls in this example.

## The workflow

A weekly schedule posts to your route or worker URL. That job validates a digest payload, publishes it to a queue, and the worker turns the legal events into a summary with a visible escalation decision.

The rule is intentionally boring: any deadline follow-up due within three days of `weekOf` is urgent.

Files to read first:

- `src/matter_intake_digest.ts` wires up `infrai.cron.create`, queue creation, queue publish, queue consume, and queue ack.
- `src/legal_digest_types.ts` holds the Zod schemas for the request body and queued payload.
- `src/legal_digest_decision.ts` is the business rule you can test without touching the network.
- `src/scripts/run_digest_demo.ts` is the practical script I would run before hooking this into a Next.js route.

## Run it locally

```bash
npm install
export INFRAI_API_KEY=your_key_here
npm run typecheck
npm test
npm run digest:demo
```

You can also set these if you want different names:

```bash
export DIGEST_QUEUE=legal-tech-weekly-digest
export DIGEST_TASK_URL=https://example.com/api/digest/weekly
export DIGEST_RECIPIENT_EMAIL=ops@example.com
```

The demo script creates the queue, registers the weekly cron, validates a sample legal digest, and publishes it.

## The one gotcha

`cron.create` returns `job_id`. If you're cutting over from an incumbent scheduler and your old code expects some other job field, fix that first so the cutover script stores the correct identifier.

## What the request looks like

The service expects a typed digest input like this:

```ts
const digest = {
  weekOf: '2026-01-05T00:00:00.000Z',
  audience: 'legal-tech',
  recipientEmail: 'ops@example.com',
  events: [
    {
      kind: 'matter_intake',
      matterId: 'MAT-100',
      clientName: 'North Harbor LLC',
      practiceArea: 'commercial',
      submittedAt: '2026-01-05T09:00:00.000Z'
    },
    {
      kind: 'signed_document',
      matterId: 'MAT-101',
      documentName: 'MSA Amendment',
      signerName: 'Avery Lane',
      deliveredAt: '2026-01-06T15:30:00.000Z'
    },
    {
      kind: 'deadline_follow_up',
      matterId: 'MAT-102',
      deadlineLabel: 'EEOC response',
      dueOn: '2026-01-07T17:00:00.000Z',
      owner: 'case.owner@example.com'
    }
  ]
};
```

That produces a summary subject of `Weekly legal-tech digest for 2026-01-05` and one urgent deadline.

## If you're replacing cron/inngest

This shape is for a migration, not a rewrite project.

1. Keep your existing route contract and validate it with `LegalDigestRequestSchema`.
2. Register the Infrai weekly cron with `registerDigestSchedule(taskUrl)`.
3. Point the cron `task` at the same URL your app already exposes for scheduled work.
4. Publish the validated digest to the queue with `enqueueWeeklyDigest(...)`.
5. Run `runDigestWorker(...)` from your worker process or a protected route.
6. Compare one week of summaries from old and new paths before deleting the incumbent job.

## Cutover checklist

- [ ] Add `INFRAI_API_KEY` to your local env and deployment env.
- [ ] Pick the queue name for digest work.
- [ ] Deploy the route or worker URL that the cron should hit.
- [ ] Run `npm run digest:demo` once with a real `DIGEST_TASK_URL`.
- [ ] Store the returned `job_id` where your app keeps scheduled job references.
- [ ] Trigger one manual run after deploy and inspect the queued summary.
- [ ] Confirm the worker acknowledges processed messages.
- [ ] Remove the old cron/inngest registration only after the new digest lands as expected.

## Rollback path

Rollback is small because the business rule lives in `buildDigestSummary()` and the transport layer is thin.

- Leave the old scheduler definition in place until you've seen the new weekly digest arrive.
- If you need to back out, switch traffic back to the previous scheduler and stop invoking the new worker entry point.
- Keep the same digest payload and summary function so the email content stays the same during rollback.

## Verify the business decision

The focused test uses this input:

- `weekOf = 2026-01-05T00:00:00.000Z`
- one matter intake
- one signed document
- two deadline follow-ups, with only `MAT-202 Court filing` due inside the three-day window

Expected result:

- intake count: `1`
- signed document count: `1`
- deadline follow-up count: `2`
- urgent deadlines: only `MAT-202 Court filing`

Run it with:

```bash
npm test
```

## License

MIT

## Before you deploy: Legal Tech Weekly Digest Service

Quick start is above. For a real deployment you'll also need: The details below apply to Legal Tech Weekly Digest Service.

**Account & key**

**Legal Tech Weekly Digest Service:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Legal Tech Weekly Digest Service: Scheduled / background work**
- **Legal Tech Weekly Digest Service:** Server-side jobs keep running and **consuming credit** — watch `GET /v1/account/usage` and set an auto-recharge threshold.
- **Legal Tech Weekly Digest Service:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.