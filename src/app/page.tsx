'use client';

import { useEffect, useState } from 'react';

interface AgentStatus {
  status: 'running' | 'done' | 'idle';
  taskTitle: string;
  currentAction: string;
  stepCount: number;
  updatedAt: string;
}

export default function StatusPage() {
  const [data, setData] = useState<AgentStatus | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const timer = setInterval(fetchStatus, 3000);
    return () => clearInterval(timer);
  }, []);

  const isRunning = data?.status === 'running';
  const isDone = data?.status === 'done';

  const copyWidgetScript = async () => {
    try {
      const res = await fetch('/widgets/antigravity-widget.js');
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      alert('נכשל בהעתקה');
    }
  };

  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      backgroundColor: '#000000',
      color: '#FFFFFF'
    }}>
      <div style={{
        maxWidth: '480px',
        width: '100%',
        backgroundColor: '#111111',
        border: '1px solid #222222',
        borderRadius: '24px',
        padding: '32px 24px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.8)',
        textAlign: 'center'
      }}>
        {/* Status Indicator */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 14px',
          borderRadius: '999px',
          backgroundColor: isRunning ? 'rgba(52, 199, 89, 0.15)' : isDone ? 'rgba(250, 204, 21, 0.15)' : 'rgba(142, 142, 147, 0.15)',
          border: `1px solid ${isRunning ? '#34C759' : isDone ? '#FACC15' : '#444444'}`,
          marginBottom: '20px'
        }}>
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: isRunning ? '#34C759' : isDone ? '#FACC15' : '#8E8E93',
            boxShadow: isRunning ? '0 0 10px #34C759' : undefined
          }} />
          <span style={{
            fontSize: '13px',
            fontWeight: 600,
            color: isRunning ? '#34C759' : isDone ? '#FACC15' : '#8E8E93'
          }}>
            {isRunning ? 'מבצע משימה כעת' : isDone ? 'המשימה הושלמה' : 'ממתין לפקודה'}
          </span>
        </div>

        {/* Task Title */}
        <h1 style={{
          fontSize: '22px',
          fontWeight: 700,
          margin: '0 0 8px 0',
          letterSpacing: '-0.02em',
          color: '#FFFFFF'
        }}>
          {loading ? 'טוען נתונים...' : data?.taskTitle || 'Antigravity Agent'}
        </h1>

        {/* Current Action / Details */}
        <p style={{
          fontSize: '15px',
          color: '#A1A1AA',
          margin: '0 0 24px 0',
          minHeight: '22px'
        }}>
          {isRunning ? (data?.currentAction || 'מעבד...') : isDone ? 'כל הפעולות בוצעו בהצלחה' : 'הסוכן מוכן בשרת'}
        </p>

        {/* Step Counter Badge */}
        {Number(data?.stepCount) > 0 && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '16px',
            padding: '12px 0',
            borderTop: '1px solid #1F1F23',
            borderBottom: '1px solid #1F1F23',
            marginBottom: '24px',
            fontSize: '14px',
            color: '#71717A'
          }}>
            <span>צעדים שבוצעו: <strong style={{ color: '#FAFAFA' }}>{data?.stepCount}</strong></span>
            <span>•</span>
            <span>עודכן: <strong style={{ color: '#FAFAFA' }}>{data?.updatedAt ? new Date(data.updatedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '-'}</strong></span>
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={copyWidgetScript}
          style={{
            width: '100%',
            height: '48px',
            borderRadius: '14px',
            backgroundColor: '#FFFFFF',
            color: '#000000',
            fontSize: '15px',
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          {copied ? '✓ הקוד הועתק!' : '📲 העתק סקריפט ל-Scriptable באייפון'}
        </button>

        <p style={{
          fontSize: '12px',
          color: '#52525B',
          margin: '16px 0 0 0'
        }}>
          מדריך: הדבק באפליקציית Scriptable, שמור בשם Antigravity והוסף כווידג׳ט.
        </p>
      </div>
    </main>
  );
}
