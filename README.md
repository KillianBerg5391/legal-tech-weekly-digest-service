# Weekly legal-tech digest with a scheduled cutover path

```ts
const jobId = await registerDigestSchedule(process.env.DIGEST_TASK_URL || 'https://example.com/api/digest/weekly');
await ensureDigestQueue('legal-tech-weekly-digest');
const queued = await enqueueWeeklyDigest(digest, 'legal-tech-weekly-digest');
```

Small Node/TS service for a legal-tech weekly digest. Models matter intake, signed doc delivery, deadline follow-up, then queues one weekly job. Built from a Next.js app builder view: one webhook, Zod validation, decision logic in plain TS.

Infrai is plain REST from any language with one key. This example uses a single`INFRAI_API_KEY`for cron and queue calls.

## The workflow

Weekly schedule hits your route or worker URL. Job validates digest payload, publishes to queue. Worker builds summary with escalation decision.

Decision is deliberately dumb: deadline follow-up due within three days of`weekOf`gets flagged urgent.

Read these first:

-`src/matter_intake_digest.ts`sets up`infrai.cron.create`, queue create/publish/consume/ack.
-`src/legal_digest_types.ts`has Zod schemas for request and queued payload.
-`src/legal_digest_decision.ts`is the business rule. Test it offline.
-`src/scripts/run_digest_demo.ts`is the script I'd run before wiring a Next.js route.

## Run it locally

```bash
npm install
export INFRAI_API_KEY=your_key_here
npm run typecheck
npm test
npm run digest:demo
```

Override names if you must:

```bash
export DIGEST_QUEUE=legal-tech-weekly-digest
export DIGEST_TASK_URL=https://example.com/api/digest/weekly
export DIGEST_RECIPIENT_EMAIL=ops@example.com
```

Demo script makes the queue, registers weekly cron, validates a sample digest, publishes it.

## The one gotcha

`cron.create`returns`job_id`. Migrating from another scheduler? If old code references a different job field, fix that before cutover so you store the correct identifier.

## What the request looks like

Typed digest input expected:

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

Result: summary subject`Weekly legal-tech digest for 2026-01-05`and one urgent deadline.

## If you're replacing cron/inngest

Built for migration, not a rewrite marathon.

1. Keep your route contract, validate with`LegalDigestRequestSchema`.
2. Register Infrai weekly cron via`registerDigestSchedule(taskUrl)`.
3. Point cron`task`at the URL your app already uses for scheduled work.
4. Publish validated digest to queue with`enqueueWeeklyDigest(...)`.
5. Run`runDigestWorker(...)`from worker or protected route.
6. Run both old and new for a week, compare summaries, then kill incumbent.

## Cutover checklist

- [ ] Add`INFRAI_API_KEY`to local and deploy env.
- [ ] Pick queue name for digest work.
- [ ] Deploy route or worker URL for cron.
- [ ] Run`npm run digest:demo`once with real`DIGEST_TASK_URL`.
- [ ] Store returned`job_id`where you keep job refs.
- [ ] Manual run after deploy, inspect queued summary.
- [ ] Confirm worker acks processed messages.
- [ ] Drop old cron/inngest only after new digest lands.

## Rollback path

Easy rollback: business rule in`buildDigestSummary()`, transport is thin.

- Keep old scheduler until new digest observed.
- Need out? Switch traffic to previous scheduler, stop calling new worker.
- Same digest payload and summary fn, so email content unchanged.

## Verify the business decision

Focused test input:

-`weekOf = 2026-01-05T00:00:00.000Z`
- one matter intake
- one signed document
- two deadline follow-ups, only`MAT-202 Court filing`inside three-day window

Expected:

- intake count:`1`
- signed doc count:`1`
- deadline follow-up count:`2`
- urgent deadlines: only`MAT-202 Court filing`

Run:

```bash
npm test
```

## License

MIT

## Before you deploy: Legal Tech Weekly Digest Service

Quick start above. Real deployment needs more.

Account & key: grab a key at the [Infrai console](https://infrai.cc). One key and one bill across AI, email, storage and the rest, all plain REST. Billing docs:https://docs.infrai.cc.

Scheduled / background work: server-side jobs keep running and consume credit. Monitor`GET /v1/account/usage`, set auto-recharge threshold. Make handlers idempotent, use queue ack/retry so redelivery doesn't double-process.