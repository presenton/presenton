import { NextResponse } from 'next/server';
import { authStatusForRequest } from '@/lib/server-auth-role';

export const dynamic = 'force-dynamic';

const canChangeKeys = process.env.CAN_CHANGE_KEYS !== "false";

export async function GET(request: Request) {
  const status = await authStatusForRequest(request);
  return NextResponse.json({
    canChange: status.authenticated && status.role === "admin" && canChangeKeys,
  })
}
