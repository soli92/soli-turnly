/**
 * lib/email-templates/index.ts — Barrel export dei template React Email (TSK-029).
 *
 * Usato da sendNotificationEmail.ts per importare i componenti template.
 * base-layout non è esportato: è un dettaglio implementativo interno.
 */

export { ShiftAssignedEmail } from './ShiftAssignedEmail';
export type { ShiftAssignedEmailProps } from './ShiftAssignedEmail';

export { RequestApprovedEmail } from './RequestApprovedEmail';
export type { RequestApprovedEmailProps } from './RequestApprovedEmail';

export { RequestRejectedEmail } from './RequestRejectedEmail';
export type { RequestRejectedEmailProps } from './RequestRejectedEmail';

export { SwapRequestEmail } from './SwapRequestEmail';
export type { SwapRequestEmailProps } from './SwapRequestEmail';
