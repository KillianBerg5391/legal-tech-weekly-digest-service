import { ensureDigestQueue, enqueueWeeklyDigest, registerDigestSchedule } from '../matter_intake_digest';
import { buildDigestSummary } from '../legal_digest_decision';
import { LegalDigestRequestSchema } from '../legal_digest_types';

async function main() {
  const queue = process.env.DIGEST_QUEUE || 'legal-tech-weekly-digest';
  const taskUrl = process.env.DIGEST_TASK_URL || 'https://example.com/api/digest/weekly';

  await ensureDigestQueue(queue);
  const jobId = await registerDigestSchedule(taskUrl);

  const digest = LegalDigestRequestSchema.parse({
    weekOf: '2026-01-05T00:00:00.000Z',
    audience: 'legal-tech',
    recipientEmail: process.env.DIGEST_RECIPIENT_EMAIL || 'ops@example.com',
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
  });

  const queued = await enqueueWeeklyDigest(digest, queue);
  const summary = buildDigestSummary(digest);

  console.log(JSON.stringify({
    queue,
    jobId,
    queued,
    summary
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
