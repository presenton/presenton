import { NextResponse } from 'next/server';
import {
  LocalFileAccessError,
  readReadableLocalFile,
} from '@/lib/readable-local-file';
import { authStatusForRequest } from '@/lib/server-auth-role';

export async function POST(request: Request) {
  try {
    const auth = await authStatusForRequest(request);
    if (!auth.authenticated) {
      return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
    }
    const { filePath } = await request.json();
    const content = readReadableLocalFile(filePath, {
      userId: auth.user_id,
      isAdmin: auth.role === 'admin',
    });
    return NextResponse.json({ content });
  } catch (error) {
    if (error instanceof LocalFileAccessError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    console.error('Error reading file:', error);
    return NextResponse.json(
      { error: 'Failed to read file' },
      { status: 500 }
    );
  }
}
