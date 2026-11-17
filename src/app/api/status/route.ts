import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export interface AgentStatus {
  status: 'running' | 'done' | 'idle';
  taskTitle: string;
  currentAction: string;
  stepCount: number;
  conversationId: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
}

// Global in-memory cache for ultra-low latency
let cachedStatus: AgentStatus = {
  status: 'idle',
  taskTitle: 'Antigravity Agent',
  currentAction: 'ממתין לפקודה',
  stepCount: 0,
  conversationId: '',
  updatedAt: new Date().toISOString()
};

const GIST_ID = 'f307290d03418549eeee78997070fe96';

export async function GET() {
  try {
    // If cache is empty or older than 30s, fetch latest from GitHub Gist fallback
    const now = Date.now();
    const cacheAge = now - new Date(cachedStatus.updatedAt).getTime();
    
    if (cacheAge > 30000) {
      try {
        const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
          headers: { 'User-Agent': 'antigravity-widget-api' },
          next: { revalidate: 0 }
        });
        if (res.ok) {
          const data = await res.json();
          const content = data?.files?.['status.json']?.content;
          if (content) {
            const parsed = JSON.parse(content);
            cachedStatus = {
              status: parsed.status || 'idle',
              taskTitle: parsed.taskTitle || 'Antigravity Agent',
              currentAction: parsed.currentAction || '',
              stepCount: Number(parsed.stepCount) || 0,
              conversationId: parsed.conversationId || '',
              updatedAt: parsed.updatedAt || new Date().toISOString(),
              startedAt: parsed.startedAt,
              completedAt: parsed.completedAt
            };
          }
        }
      } catch (err) {
        console.warn('Gist fetch fallback error:', err);
      }
    }

    return NextResponse.json(cachedStatus, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    cachedStatus = {
      status: body.status || 'idle',
      taskTitle: body.taskTitle || 'Antigravity Agent',
      currentAction: body.currentAction || '',
      stepCount: Number(body.stepCount) || 0,
      conversationId: body.conversationId || '',
      updatedAt: body.updatedAt || new Date().toISOString(),
      startedAt: body.startedAt,
      completedAt: body.completedAt
    };

    return NextResponse.json({ ok: true, status: cachedStatus });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }
}
