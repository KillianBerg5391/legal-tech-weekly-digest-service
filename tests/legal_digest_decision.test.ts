import { describe, expect, it } from 'vitest';
import { buildDigestSummary } from '../src/legal_digest_decision';
import { LegalDigestRequestSchema } from '../src/legal_digest_types';

describe('buildDigestSummary', () => {
  it('marks near-term legal deadlines for follow-up in the weekly digest', () => {
    const input = LegalDigestRequestSchema.parse({
      weekOf: '2026-01-05T00:00:00.000Z',
      audience: 'legal-tech',
      recipientEmail: 'ops@example.com',
      events: [
        {
          kind: 'matter_intake',
          matterId: 'MAT-200',
          clientName: 'Lattice Counsel',
          practiceArea: 'employment',
          submittedAt: '2026-01-05T08:30:00.000Z'
        },
        {
          kind: 'signed_document',
          matterId: 'MAT-201',
          documentName: 'Engagement Letter',
          signerName: 'Jordan Kim',
          deliveredAt: '2026-01-06T14:15:00.000Z'
        },
        {
          kind: 'deadline_follow_up',
          matterId: 'MAT-202',
          deadlineLabel: 'Court filing',
          dueOn: '2026-01-07T16:00:00.000Z',
          owner: 'paralegal@example.com'
        },
        {
          kind: 'deadline_follow_up',
          matterId: 'MAT-203',
          deadlineLabel: 'Discovery response',
          dueOn: '2026-01-12T16:00:00.000Z',
          owner: 'associate@example.com'
        }
      ]
    });

    const result = buildDigestSummary(input);

    expect(result.intakeCount).toBe(1);
    expect(result.signedDocumentCount).toBe(1);
    expect(result.deadlineFollowUpCount).toBe(2);
    expect(result.urgentDeadlines).toEqual([
      {
        matterId: 'MAT-202',
        deadlineLabel: 'Court filing',
        owner: 'paralegal@example.com',
        dueOn: '2026-01-07T16:00:00.000Z'
      }
    ]);
    expect(result.lines[3]).toContain('MAT-202 Court filing');
  });
});
