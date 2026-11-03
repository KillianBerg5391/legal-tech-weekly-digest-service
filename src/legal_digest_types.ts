import { z } from 'zod';

const MatterIntakeSchema = z.object({
  kind: z.literal('matter_intake'),
  matterId: z.string().min(1),
  clientName: z.string().min(1),
  practiceArea: z.enum(['employment', 'immigration', 'commercial', 'estate']),
  submittedAt: z.string().datetime()
});

const SignedDocumentSchema = z.object({
  kind: z.literal('signed_document'),
  matterId: z.string().min(1),
  documentName: z.string().min(1),
  signerName: z.string().min(1),
  deliveredAt: z.string().datetime()
});

const DeadlineFollowUpSchema = z.object({
  kind: z.literal('deadline_follow_up'),
  matterId: z.string().min(1),
  deadlineLabel: z.string().min(1),
  dueOn: z.string().datetime(),
  owner: z.string().email()
});

export const LegalDigestRequestSchema = z.object({
  weekOf: z.string().datetime(),
  audience: z.literal('legal-tech'),
  recipientEmail: z.string().email(),
  events: z.array(z.discriminatedUnion('kind', [MatterIntakeSchema, SignedDocumentSchema, DeadlineFollowUpSchema])).min(1)
});

export type LegalDigestRequest = z.infer<typeof LegalDigestRequestSchema>;
export type LegalDigestEvent = LegalDigestRequest['events'][number];

export const QueueEnvelopeSchema = z.object({
  queue: z.string().min(1),
  idempotencyKey: z.string().min(1),
  digest: LegalDigestRequestSchema
});

export type QueueEnvelope = z.infer<typeof QueueEnvelopeSchema>;
