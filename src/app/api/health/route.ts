import { NextResponse } from 'next/server';

const REQUIRED_ENV = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'] as const;

function isConfigured(name: string): boolean {
  return (process.env[name] || '').trim().length > 0;
}

function getHealthPayload() {
  const env = REQUIRED_ENV.map((name) => ({
    name,
    configured: isConfigured(name),
  }));

  return {
    ok: true,
    service: 'thewhiskeyriders',
    checkedAt: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    env,
  };
}

// GET /api/health - public heartbeat endpoint for uptime checks
export async function GET() {
  return NextResponse.json(getHealthPayload(), {
    status: 200,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}

// HEAD /api/health - lightweight heartbeat for monitoring systems
export async function HEAD() {
  return new Response(null, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}

