/** GET /api/admin/shift-types/in-use — Admin only. TSK-015 RF-C CA2. */

import { auth } from '@/auth';
import { db } from '@/db';
import { shifts } from '@/db/schema';
import { isNotNull } from 'drizzle-orm';
import { ApiResponse } from '@/lib/api-response';

export async function GET(_req: Request): Promise<Response> {
  const session = await auth();
  if (!session) return ApiResponse.unauthorized();
  if (session.user.role !== 'admin') return ApiResponse.forbidden();

  const rows = await db
    .selectDistinct({ shiftTypeId: shifts.shiftTypeId })
    .from(shifts)
    .where(isNotNull(shifts.shiftTypeId));

  const inUseMap: Record<string, boolean> = {};
  for (const row of rows) {
    if (row.shiftTypeId) inUseMap[row.shiftTypeId] = true;
  }

  return ApiResponse.ok(inUseMap);
}
