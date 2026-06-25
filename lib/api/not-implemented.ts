import { NextResponse } from 'next/server';

export function notImplemented() {
  return NextResponse.json({ error: 'Not implemented in Etapa 01' }, { status: 501 });
}
