import { z } from 'zod';

const optionalDate = z.iso.datetime({ offset: true }).nullish();

export const transcriptItemSchema = z.object({
  role: z.string().max(32),
  content: z.string().default(''),
  interrupted: z.boolean().default(false),
  timestamp: optionalDate,
});

/** Posted by the agent worker when a conversation ends. */
export const callIngestSchema = z.object({
  room_name: z.string().min(1).max(255),
  agent_name: z.string().max(128).default(''),
  channel: z.string().max(16).default('unknown'),
  caller_number: z.string().max(64).default('unknown'),
  called_number: z.string().max(64).default(''),
  sip_call_id: z.string().max(255).default(''),
  status: z.string().max(32).default('completed'),
  started_at: optionalDate,
  ended_at: optionalDate,
  duration_seconds: z.number().nullish(),
  items: z.array(transcriptItemSchema).max(5000).default([]),
  report: z.record(z.string(), z.unknown()).nullish(),
});

/** Posted mid-conversation by the agent's take_message tool. */
export const callerMessageSchema = z.object({
  room_name: z.string().max(255).default(''),
  caller_name: z.string().max(255).default(''),
  contact: z.string().max(255).default(''),
  message: z.string().min(1).max(10_000),
});

/** Body of the token request. The room and the agent are chosen server-side. */
export const tokenRequestSchema = z.object({
  participant_name: z.string().max(80).default(''),
});

export type CallIngest = z.infer<typeof callIngestSchema>;
export type CallerMessageInput = z.infer<typeof callerMessageSchema>;

/** Posted by the agent when a phone call connects, to apply the daily allowance. */
export const sessionClaimSchema = z.object({
  caller: z.string().min(1).max(64),
});
