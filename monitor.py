import sqlite3
import json
import os
import sys
import time
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
            
            # Action extraction
            current_action = "מבצע פעולות..." if is_running else "ממתין לפקודה הבאה"
            transcript_path = os.path.join(BRAIN_DIR, cid, ".system_generated", "logs", "transcript.jsonl")
            if os.path.exists(transcript_path):
                try:
                    with open(transcript_path, "r", encoding="utf-8") as f:
                        lines = [l.strip() for l in f if l.strip()]
                        for line_str in reversed(lines):
                            step = json.loads(line_str)
                            tool_calls = step.get("tool_calls", [])
                            if tool_calls:
                                tc = tool_calls[-1]
                                summary = tc.get("args", {}).get("toolSummary") or tc.get("name")
                                if summary:
                                    current_action = summary
                                    break
                            elif step.get("type") == "PLANNER_RESPONSE" and step.get("status") == "DONE":
                                current_action = "מנסח תשובה..." if is_running else "ממתין לפקודה הבאה"
                                break
                except Exception:
                    pass
            
            sc = int(step_count or 1)
            if is_running:
                # Progress curve between 0.20 and 0.90 while working
                prog = min(0.90, round(0.20 + (sc / (sc + 8)) * 0.70, 2))
                task_status = "running"
            else:
                # Agent is idle/waiting for user input - NOT 100%!
                prog = 0.0
                task_status = "waiting"
                current_action = "ממתין לפקודה שלך"
                
            tasks.append({
                "conversationId": cid,
                "taskTitle": clean_str(title) or "Antigravity Task",
                "status": task_status,
                "currentAction": clean_str(current_action),
                "stepCount": sc,
                "progress": prog
            })

        primary = tasks[0]
        overall_status = "running" if running_count > 0 else "waiting"

        return {
            "status": overall_status,
            "taskTitle": primary["taskTitle"],
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
                "User-Agent": "AntigravityMonitor/3.0",
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
                "User-Agent": "AntigravityMonitor/3.0"
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
        
    compare_key = f"{status['status']}_{status['taskTitle']}_{status['currentAction']}_{status['stepCount']}_{status['progress']}_{status['activeCount']}"
    if compare_key != last_payload_str:
        msg = f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Active: {status['activeCount']} | {status['status']} | {status['taskTitle']} ({int(status['progress']*100)}%) | {status['currentAction']}\n"
        if sys.stdout:
            sys.stdout.write(msg)
            sys.stdout.flush()
        push_to_gist(status)
        push_to_vercel(status)
        last_payload_str = compare_key

def main():
    if sys.stdout:
        sys.stdout.write("🚀 Antigravity Agent Monitor v3 started...\n")
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
