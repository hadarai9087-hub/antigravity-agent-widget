import sqlite3
import json
import os
import time
import urllib.request
import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_FILE = os.path.join(BASE_DIR, "config.local.json")

# Load local config
config_data = {}
if os.path.exists(CONFIG_FILE):
    with open(CONFIG_FILE, "r", encoding="utf-8") as f:
        config_data = json.load(f)

DB_PATH = r"C:\Users\hadar-server\.gemini\antigravity\conversation_summaries.db"
BRAIN_DIR = r"C:\Users\hadar-server\.gemini\antigravity\brain"
GITHUB_TOKEN = config_data.get("github_token", os.environ.get("GITHUB_TOKEN", ""))
GIST_ID = config_data.get("gist_id", "f307290d03418549eeee78997070fe96")
VERCEL_STATUS_URL = config_data.get("vercel_status_url", "https://antigravity-agent-widget.vercel.app/api/status")

last_payload_str = ""

def get_current_agent_status():
    if not os.path.exists(DB_PATH):
        return None
    try:
        con = sqlite3.connect(DB_PATH)
        row = con.execute("""
            SELECT conversation_id, title, status, not_fully_idle, step_count, last_modified_time 
            FROM conversation_summaries 
            ORDER BY last_modified_time DESC 
            LIMIT 1
        """).fetchone()
        con.close()
        
        if not row:
            return None
            
        cid, title, status, not_fully_idle, step_count, last_mod = row
        is_running = (not_fully_idle == 1) or (status == 'CASCADE_RUN_STATUS_RUNNING')
        
        current_action = "מבצע פעולות..." if is_running else "פנוי למשימה חדשה"
        
        transcript_path = os.path.join(BRAIN_DIR, cid, ".system_generated", "logs", "transcript.jsonl")
        if os.path.exists(transcript_path):
            try:
                with open(transcript_path, "r", encoding="utf-8") as f:
                    lines = [l.strip() for l in f if l.strip()]
                    if lines:
                        last_step = json.loads(lines[-1])
                        tool_calls = last_step.get("tool_calls", [])
                        if tool_calls:
                            last_tc = tool_calls[-1]
                            summary = last_tc.get("args", {}).get("toolSummary") or last_tc.get("name")
                            if summary:
                                current_action = summary
                        elif last_step.get("type") == "PLANNER_RESPONSE":
                            current_action = "מנסח תשובה..."
            except Exception:
                pass
        
        final_status = "running" if is_running else "done"

        return {
            "status": final_status,
            "taskTitle": title or "Antigravity Agent",
            "currentAction": str(current_action).strip('"\''),
            "stepCount": int(step_count or 0),
            "conversationId": cid,
            "updatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }
    except Exception as e:
        print(f"Error reading DB: {e}")
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
                "User-Agent": "hadar-server-monitor",
                "Content-Type": "application/json"
            },
            method="PATCH"
        )
        with urllib.request.urlopen(req, timeout=5) as res:
            return res.status == 200
    except Exception as e:
        print(f"Gist push error: {e}")
        return False

def push_to_vercel(payload):
    try:
        req = urllib.request.Request(
            VERCEL_STATUS_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "User-Agent": "hadar-server-monitor"
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
        
    compare_key = f"{status['status']}_{status['taskTitle']}_{status['currentAction']}_{status['stepCount']}"
    if compare_key != last_payload_str:
        print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Updating status: {status['status']} | {status['taskTitle']} | {status['currentAction']}")
        push_to_gist(status)
        push_to_vercel(status)
        last_payload_str = compare_key

def main():
    print("🚀 Antigravity Agent Monitor started...")
    while True:
        try:
            sync_once()
        except Exception as e:
            print(f"Loop error: {e}")
        time.sleep(4)

if __name__ == "__main__":
    main()
