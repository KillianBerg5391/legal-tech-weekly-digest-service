import type { LegalDigestEvent, LegalDigestRequest } from './legal_digest_types';

export type DeadlineAttention = {
  matterId: string;
  deadlineLabel: string;
  owner: string;
  dueOn: string;
};

export type DigestSummary = {
  subject: string;
  intakeCount: number;
  signedDocumentCount: number;
  deadlineFollowUpCount: number;
  urgentDeadlines: DeadlineAttention[];
  lines: string[];
};

function isUrgentDeadline(
  event: LegalDigestEvent,
  weekOf: string
): event is LegalDigestEvent & DeadlineAttention & { kind: 'deadline_follow_up' } {
  if (event.kind !== 'deadline_follow_up') return false;
  const due = new Date(event.dueOn).getTime();
  const start = new Date(weekOf).getTime();
  const end = start + 3 * 24 * 60 * 60 * 1000;
  return due <= end;
}

export function buildDigestSummary(input: LegalDigestRequest): DigestSummary {
  const intake = input.events.filter((event) => event.kind === 'matter_intake');
  const signed = input.events.filter((event) => event.kind === 'signed_document');
  const deadlines = input.events.filter((event) => event.kind === 'deadline_follow_up');
  const urgentDeadlines = input.events
    .filter((event) => isUrgentDeadline(event, input.weekOf))
    .map((event) => ({
      matterId: event.matterId,
      deadlineLabel: event.deadlineLabel,
      owner: event.owner,
      dueOn: event.dueOn
    }));

  const lines = [
    `Matter intake this week: ${intake.length}`,
    `Signed documents delivered: ${signed.length}`,
    `Deadline follow-ups due: ${deadlines.length}`,
    urgentDeadlines.length
      ? `Escalate now: ${urgentDeadlines.map((item) => `${item.matterId} ${item.deadlineLabel}`).join(', ')}`
      : 'No deadlines need same-window escalation.'
  ];

  return {
    subject: `Weekly legal-tech digest for ${input.weekOf.slice(0, 10)}`,
    intakeCount: intake.length,
    signedDocumentCount: signed.length,
    deadlineFollowUpCount: deadlines.length,
    urgentDeadlines,
    lines
  };
}
