/**
 * app/(admin)/reports/page.tsx — Entry point area Report admin (TSK-027).
 *
 * RSC: redirect al sottopercorso /admin/reports/overtime (unico report disponibile
 * nella wave corrente). Screen 12 inventario RF-I.
 *
 * Admin only: la protezione è già applicata dal layout (admin)/layout.tsx.
 */

import { redirect } from 'next/navigation';

export default function ReportsIndexPage() {
  redirect('/admin/reports/overtime');
}
