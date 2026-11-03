import { infrai } from './infrai';
import { buildDigestSummary } from './legal_digest_decision';
import { LegalDigestRequestSchema, QueueEnvelopeSchema, type LegalDigestRequest, type QueueEnvelope } from './legal_digest_types';

export async function registerDigestSchedule(taskUrl: string): Promise<string> {
  const result = await infrai.cron.create({
    cron_expr: '0 13 * * 1',
    task: taskUrl
  });
  return result.job_id;
}

export async function ensureDigestQueue(queue: string): Promise<void> {
  await infrai.queue.create({ name: queue });
}

export async function enqueueWeeklyDigest(input: LegalDigestRequest, queue: string): Promise<{ summarySubject: string; idempotencyKey: string }> {
  const digest = LegalDigestRequestSchema.parse(input);
  const summary = buildDigestSummary(digest);
  const idempotencyKey = `digest:${digest.weekOf}:${digest.recipientEmail}`;
  const envelope: QueueEnvelope = {
    queue,
    idempotencyKey,
    digest
  };

  QueueEnvelopeSchema.parse(envelope);

  await infrai.queue.publish({
    queue,
    payload: envelope as unknown as Record<string, unknown>
  });

  return {
    summarySubject: summary.subject,
    idempotencyKey
  };
}

export async function runDigestWorker(queue: string): Promise<Array<{ messageId: string; subject: string; urgentCount: number }>> {
  const consumed = await infrai.queue.consume({
    queue,
    max_messages: 10,
    visibility_timeout: 60
  });

  const messages = consumed.messages || [];
  const handled: Array<{ messageId: string; subject: string; urgentCount: number }> = [];

  for (const message of messages) {
    const parsed = QueueEnvelopeSchema.parse(message.payload);
    if (parsed.queue !== queue) {
      continue;
    }

    const summary = buildDigestSummary(parsed.digest);
    await infrai.queue.ack({ queue, message_id: message.message_id });
    handled.push({
      messageId: message.message_id,
      subject: summary.subject,
      urgentCount: summary.urgentDeadlines.length
    });
  }

  return handled;
}

export async function triggerDigestNow(jobId: string): Promise<void> {
  await infrai.cron.trigger(jobId);
}
