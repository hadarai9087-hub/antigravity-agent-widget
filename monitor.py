import sqlite3
import json
import os
import sys
import time
import re
import urllib.request
import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_FILE = os.path.join(BASE_DIR, "monitor.log")

if sys.stdout is None:
    try:
        sys.stdout = open(LOG_FILE, "a", encoding="utf-8", buffering=1)
    except Exception:
        pass
if sys.stderr is None:
    try:
        sys.stderr = open(LOG_FILE, "a", encoding="utf-8", buffering=1)
    except Exception:
        pass

CONFIG_FILE = os.path.join(BASE_DIR, "config.local.json")

config_data = {}
if os.path.exists(CONFIG_FILE):
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            config_data = json.load(f)
    except Exception:
        pass

DB_PATH = r"C:\Users\hadar-server\.gemini\antigravity\conversation_summaries.db"
BRAIN_DIR = r"C:\Users\hadar-server\.gemini\antigravity\brain"
GITHUB_TOKEN = config_data.get("github_token", os.environ.get("GITHUB_TOKEN", ""))
GIST_ID = config_data.get("gist_id", "f307290d03418549eeee78997070fe96")
VERCEL_STATUS_URL = config_data.get("vercel_status_url", "https://antigravity-agent-widget.vercel.app/api/status")

last_payload_str = ""

def clean_str(s):
    if not s:
        return ""
    return str(s).strip('"\' \t\r\n')

def analyze_conversation_phase(cid, is_running):
    """
    Roo Code & OpenHands Phase Analyzer:
    1. Checks for markdown checklist items (- [x] / - [ ]).
    2. If no checklist, maps real tool calls to FSM phases:
       - Discovery/Research (read_file, search_web): 25%
       - Implementation (edit_file, write_file): 60%
       - Verification/Testing (run_command after edits): 85%
       - Finalizing (PLANNER_RESPONSE text): 95%
    """
    if not is_running:
        return {
            "progress": 0.0,
            "phase": "ממתין לפקודה",
            "action": "מוכן לפקודה הבאה",
            "status": "waiting"
        }

    transcript_path = os.path.join(BRAIN_DIR, cid, ".system_generated", "logs", "transcript.jsonl")
    if not os.path.exists(transcript_path):
        return {
            "progress": 0.30,
            "phase": "מתחיל משימה",
            "action": "מתחיל ביצוע...",
            "status": "running"
        }

    try:
        with open(transcript_path, "r", encoding="utf-8") as f:
            lines = [json.loads(l.strip()) for l in f if l.strip()]
        
        if not lines:
            return {"progress": 0.30, "phase": "מתחיל משימה", "action": "מתחיל ביצוע...", "status": "running"}

        # Find the start of the current user turn
        last_user_idx = 0
        for i, step in enumerate(lines):
            if step.get("type") == "USER_INPUT":
                last_user_idx = i

        turn_steps = lines[last_user_idx:]

        # 1. Checklist Detection (Roo Code standard)
        checklist_text = ""
        for step in reversed(turn_steps):
            content = step.get("content") or ""
            if "- [ ]" in content or "- [x]" in content or "- [X]" in content:
                checklist_text = content
                break
        
        if checklist_text:
            completed = len(re.findall(r'- \[[xX]\]', checklist_text))
            pending = len(re.findall(r'- \[ \]', checklist_text))
            total = completed + pending
            if total >= 2:
                prog = round(completed / total, 2)
                return {
                    "progress": max(0.15, min(0.95, prog)),
                    "phase": f"שלב {completed}/{total}",
                    "action": f"מבצע שלב {completed + 1} מתוך {total}",
                    "status": "running"
                }

        # 2. Phase Detection based on Tool Operations (OpenHands standard)
        tool_names = []
        last_action = "פועל ברקע..."

        for step in turn_steps:
            tcs = step.get("tool_calls", [])
            for tc in tcs:
                tool_names.append(tc.get("name"))
                summary = tc.get("args", {}).get("toolSummary") or tc.get("name")
                if summary:
                    last_action = summary

        has_written = any(t in ["write_file", "edit_file"] for t in tool_names)
        last_tool = tool_names[-1] if tool_names else ""
        last_step = turn_steps[-1] if turn_steps else {}

        if last_tool in ["edit_file", "write_file"]:
            return {
                "progress": 0.60,
                "phase": "כתיבה ועריכה",
                "action": clean_str(last_action) or "עורך ומיישם קוד",
                "status": "running"
            }
        elif last_tool in ["run_command", "run_workflow"]:
            if has_written:
                return {
                    "progress": 0.85,
                    "phase": "אימות ובדיקות",
                    "action": clean_str(last_action) or "מאמת ומריץ בדיקות",
                    "status": "running"
                }
            else:
                return {
                    "progress": 0.35,
                    "phase": "בדיקת סביבה",
                    "action": clean_str(last_action) or "בודק סביבה ומערכת",
                    "status": "running"
                }
        elif last_tool in ["read_file", "search_web", "list_plugin_accounts", "read_resource", "list_resources"]:
            return {
                "progress": 0.25,
                "phase": "מחקר וקריאה",
                "action": clean_str(last_action) or "חוקר וקורא קבצים",
                "status": "running"
            }
        elif last_step.get("type") == "PLANNER_RESPONSE" and last_step.get("status") == "DONE":
            return {
                "progress": 0.95,
                "phase": "סיכום ומענה",
                "action": "מנסח תשובה סופית",
                "status": "running"
            }
        else:
            return {
                "progress": 0.40,
                "phase": "פועל כעת",
                "action": clean_str(last_action),
                "status": "running"
            }
    except Exception as e:
        if sys.stderr:
            sys.stderr.write(f"Phase analysis error: {e}\n")
        return {
            "progress": 0.50,
            "phase": "מעבד",
            "action": "מבצע פעולות...",
            "status": "running"
        }

def get_current_agent_status():
    if not os.path.exists(DB_PATH):
        return None
    try:
        con = sqlite3.connect(DB_PATH)
        rows = con.execute("""
            SELECT conversation_id, title, status, not_fully_idle, step_count, last_modified_time 
            FROM conversation_summaries 
            ORDER BY not_fully_idle DESC, last_modified_time DESC 
            LIMIT 4
        """).fetchall()
        con.close()
        
        if not rows:
            return None
            
        tasks = []
        running_count = 0
        
        for cid, title, status, not_fully_idle, step_count, last_mod in rows:
            is_running = (not_fully_idle == 1) or (status == 'CASCADE_RUN_STATUS_RUNNING')
            if is_running:
                running_count += 1
            
            analysis = analyze_conversation_phase(cid, is_running)
            sc = int(step_count or 1)

            tasks.append({
                "conversationId": cid,
                "taskTitle": clean_str(title) or "Antigravity Task",
                "status": analysis["status"],
                "phase": analysis["phase"],
                "currentAction": analysis["action"],
                "stepCount": sc,
                "progress": analysis["progress"]
            })

        primary = tasks[0]
        overall_status = "running" if running_count > 0 else "waiting"

        return {
            "status": overall_status,
            "taskTitle": primary["taskTitle"],
            "phase": primary["phase"],
            "currentAction": primary["currentAction"],
            "stepCount": primary["stepCount"],
            "progress": primary["progress"],
            "activeCount": running_count,
            "tasks": tasks[:3],
            "updatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }
    except Exception as e:
        if sys.stderr:
            sys.stderr.write(f"Error reading DB: {e}\n")
        return None

def push_to_gist(payload):
    if not GITHUB_TOKEN:
        return False
    try:
        body = {
            "files": {
                "status.json": {
                    "content": json.dumps(payload, ensure_ascii=False, indent=2)
                }
            }
        }
        req = urllib.request.Request(
            f"https://api.github.com/gists/{GIST_ID}",
            data=json.dumps(body).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {GITHUB_TOKEN}",
                "User-Agent": "AntigravityMonitor/4.0",
                "Content-Type": "application/json"
            },
            method="PATCH"
        )
        with urllib.request.urlopen(req, timeout=5) as res:
            return res.status == 200
    except Exception as e:
        if sys.stderr:
            sys.stderr.write(f"Gist push error: {e}\n")
        return False

def push_to_vercel(payload):
    try:
        req = urllib.request.Request(
            VERCEL_STATUS_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "User-Agent": "AntigravityMonitor/4.0"
            },
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=5) as res:
            return res.status == 200
    except Exception:
        return False

def sync_once():
    global last_payload_str
    status = get_current_agent_status()
    if not status:
        return
        
    compare_key = f"{status['status']}_{status['taskTitle']}_{status['phase']}_{status['currentAction']}_{status['progress']}_{status['activeCount']}"
    if compare_key != last_payload_str:
        msg = f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Active: {status['activeCount']} | {status['status']} | {status['taskTitle']} [{status['phase']}] ({int(status['progress']*100)}%) | {status['currentAction']}\n"
        if sys.stdout:
            sys.stdout.write(msg)
            sys.stdout.flush()
        push_to_gist(status)
        push_to_vercel(status)
        last_payload_str = compare_key

def main():
    if sys.stdout:
        sys.stdout.write("🚀 Antigravity Agent Monitor v4 (Roo Code & OpenHands standard) started...\n")
        sys.stdout.flush()
    while True:
        try:
            sync_once()
        except Exception as e:
            if sys.stderr:
                sys.stderr.write(f"Loop error: {e}\n")
                sys.stderr.flush()
        time.sleep(3)

if __name__ == "__main__":
    main()
