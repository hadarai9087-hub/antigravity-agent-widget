// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: purple; icon-glyph: bolt;

/**
 * ⚡ Antigravity Agent - Minimalist iOS Task & Progress Widget
 * 
 * - מתעדכן בזמן אמת מול השרת על סטטוס הסוכן (עובד / סיים / ממתין)
 * - עובד כווידג'ט חי במסך הבית (Medium / Small) ובמסך הנעילה (Lock Screen)
 * - בהרצה ידנית בתוך Scriptable: מציג תפריט פעולות ובדיקה חיה
 */

// מקורות נתונים בענן (ענן חי ישיר עם ביטול מטמון לקבלת נתונים תוך שניות)
const GIST_RAW_URL = "https://gist.githubusercontent.com/hadarai9087-hub/f307290d03418549eeee78997070fe96/raw/status.json";
const VERCEL_API_URL = "https://antigravity-agent-widget.vercel.app/api/status";

// קישור לפתיחה בלחיצה על הווידג'ט
const APP_URL = "https://github.com/hadarai9087-hub/antigravity-agent-widget";

async function fetchStatus() {
  // 1. קריאה ישירה מהענן החי (ללא חסימות או עיכובי מטמון)
  try {
    const freshUrl = `${GIST_RAW_URL}?t=${Date.now()}`;
    const req = new Request(freshUrl);
    req.timeoutInterval = 4;
    req.headers = { "Cache-Control": "no-cache", "User-Agent": "AntigravityWidget/1.0" };
    const res = await req.loadJSON();
    if (res && res.status) return res;
  } catch (e) {
    console.warn("Gist raw fetch failed:", e);
  }

  // 2. פולבק ל-Vercel API
  try {
    const req = new Request(VERCEL_API_URL);
    req.timeoutInterval = 4;
    const res = await req.loadJSON();
    if (res && res.status) return res;
  } catch (e) {}

  return {
    status: "idle",
    taskTitle: "Antigravity Agent",
    currentAction: "ממתין לפקודה בשרת",
    stepCount: 0,
    updatedAt: new Date().toISOString()
  };
}

async function createWidget(family) {
  const data = await fetchStatus();
  const widget = new ListWidget();
  const targetFamily = family || config.widgetFamily || "medium";
  
  const isLockScreen = targetFamily === "accessoryRectangular" || 
                       targetFamily === "accessoryInline" || 
                       targetFamily === "accessoryCircular";

  const isRunning = data.status === "running";
  const isDone = data.status === "done";

  // לחיצה על הווידג'ט
  widget.url = APP_URL;

  if (isLockScreen) {
    widget.backgroundColor = new Color("#000000", 0);
    widget.setPadding(0, 2, 0, 2);
    renderLockScreen(widget, data, isRunning, isDone);
  } else if (targetFamily === "small") {
    widget.backgroundColor = new Color("#000000");
    widget.setPadding(14, 14, 14, 14);
    renderSmall(widget, data, isRunning, isDone);
  } else {
    // Medium (ברירת מחדל)
    widget.backgroundColor = new Color("#000000");
    widget.setPadding(16, 18, 16, 18);
    renderMedium(widget, data, isRunning, isDone);
  }

  // תזמון רענון: כל 2 דקות בזמן עבודה, כל 5 דקות בסיום
  widget.refreshAfterDate = new Date(Date.now() + 1000 * 60 * (isRunning ? 2 : 5));
  return widget;
}

// -------------------------------------------------------------
// 1. מסך הבית - מלבן רחב (Medium Widget)
// -------------------------------------------------------------
function renderMedium(widget, data, isRunning, isDone) {
  const topRow = widget.addStack();
  topRow.layoutHorizontally();
  topRow.centerAlignContent();

  const statusBadge = topRow.addStack();
  statusBadge.layoutHorizontally();
  statusBadge.centerAlignContent();
  statusBadge.setPadding(3, 8, 3, 8);
  statusBadge.cornerRadius = 99;

  let badgeBg = new Color("#8E8E93", 0.18);
  let dotColor = new Color("#8E8E93");
  let statusText = "ממתין";

  if (isRunning) {
    badgeBg = new Color("#34C759", 0.18);
    dotColor = new Color("#34C759");
    statusText = "פועל כעת";
  } else if (isDone) {
    badgeBg = new Color("#FACC15", 0.18);
    dotColor = new Color("#FACC15");
    statusText = "הושלם";
  }

  statusBadge.backgroundColor = badgeBg;

  const dot = statusBadge.addText(isRunning ? "● " : (isDone ? "✓ " : "• "));
  dot.font = Font.systemFont(11);
  dot.textColor = dotColor;

  const statusLabel = statusBadge.addText(statusText);
  statusLabel.font = Font.boldSystemFont(11);
  statusLabel.textColor = dotColor;

  topRow.addSpacer();

  if (data.stepCount > 0) {
    const stepLabel = topRow.addText(`צעד ${data.stepCount}`);
    stepLabel.font = Font.mediumSystemFont(11);
    stepLabel.textColor = new Color("#71717A");
  }

  widget.addSpacer(10);

  const title = widget.addText(data.taskTitle || "Antigravity Task");
  title.font = Font.boldSystemFont(16);
  title.textColor = new Color("#FFFFFF");
  title.lineLimit = 1;

  widget.addSpacer(4);

  const actionText = isRunning 
    ? (cleanActionName(data.currentAction) || "מבצע פעולות...") 
    : (isDone ? "כל המשימות הסתיימו בהצלחה" : "הסוכן זמין בשרת");
  
  const subtitle = widget.addText(actionText);
  subtitle.font = Font.systemFont(13);
  subtitle.textColor = isRunning ? new Color("#34C759") : new Color("#A1A1AA");
  subtitle.lineLimit = 1;

  widget.addSpacer(10);

  const bottomRow = widget.addStack();
  bottomRow.layoutHorizontally();
  bottomRow.centerAlignContent();

  const timeText = bottomRow.addText(formatRelativeTime(data.updatedAt));
  timeText.font = Font.systemFont(10);
  timeText.textColor = new Color("#52525B");

  bottomRow.addSpacer();

  const brand = bottomRow.addText("ANTIGRAVITY");
  brand.font = Font.boldSystemFont(9);
  brand.textColor = new Color("#3F3F46");
}

// -------------------------------------------------------------
// 2. מסך הבית - ריבוע קטן (Small Widget)
// -------------------------------------------------------------
function renderSmall(widget, data, isRunning, isDone) {
  const topRow = widget.addStack();
  topRow.layoutHorizontally();
  topRow.centerAlignContent();

  const dot = topRow.addText(isRunning ? "●" : (isDone ? "✓" : "•"));
  dot.font = Font.boldSystemFont(14);
  dot.textColor = isRunning ? new Color("#34C759") : (isDone ? new Color("#FACC15") : new Color("#71717A"));

  topRow.addSpacer(4);

  const statusLabel = topRow.addText(isRunning ? "מבצע..." : (isDone ? "הושלם" : "ממתין"));
  statusLabel.font = Font.boldSystemFont(12);
  statusLabel.textColor = isRunning ? new Color("#34C759") : (isDone ? new Color("#FACC15") : new Color("#8E8E93"));

  widget.addSpacer();

  const title = widget.addText(data.taskTitle || "Antigravity");
  title.font = Font.boldSystemFont(14);
  title.textColor = new Color("#FFFFFF");
  title.lineLimit = 2;

  widget.addSpacer(4);

  const actionText = isRunning ? cleanActionName(data.currentAction) : (isDone ? "הסתיים" : "פנוי");
  const sub = widget.addText(actionText);
  sub.font = Font.systemFont(11);
  sub.textColor = new Color("#A1A1AA");
  sub.lineLimit = 1;

  widget.addSpacer();

  const timeText = widget.addText(formatRelativeTime(data.updatedAt));
  timeText.font = Font.systemFont(9);
  timeText.textColor = new Color("#52525B");
}

// -------------------------------------------------------------
// 3. מסך נעילה (Lock Screen Rectangular)
// -------------------------------------------------------------
function renderLockScreen(widget, data, isRunning, isDone) {
  const stack = widget.addStack();
  stack.layoutVertically();

  const titleRow = stack.addStack();
  titleRow.layoutHorizontally();

  const icon = titleRow.addText(isRunning ? "● " : (isDone ? "✓ " : "• "));
  icon.font = Font.boldSystemFont(12);

  const head = titleRow.addText(isRunning ? "Antigravity עובד" : (isDone ? "Antigravity סיים" : "Antigravity"));
  head.font = Font.boldSystemFont(12);

  stack.addSpacer(2);

  const task = stack.addText(data.taskTitle || "אין משימה פעילה");
  task.font = Font.systemFont(11);
  task.lineLimit = 1;

  if (isRunning && data.currentAction) {
    stack.addSpacer(1);
    const act = stack.addText(cleanActionName(data.currentAction));
    act.font = Font.systemFont(9);
    act.lineLimit = 1;
  }
}

function cleanActionName(str) {
  if (!str) return "";
  return String(str).replace(/^["']|["']$/g, "").trim();
}

function formatRelativeTime(dateStr) {
  if (!dateStr) return "";
  try {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return "עודכן הרגע";
    if (diff < 3600) return `עודכן לפני ${Math.floor(diff / 60)} דק'`;
    return `עודכן לפני ${Math.floor(diff / 3600)} שעות`;
  } catch (e) {
    return "";
  }
}

// =============================================================
// מנגנון הרצה: ווידג'ט חי במסך הבית מול הרצה ידנית ב-Scriptable
// =============================================================
if (config.runsInWidget) {
  // מצב 1: הווידג'ט רץ חי על מסך הבית / מסך הנעילה של האייפון
  const widget = await createWidget();
  Script.setWidget(widget);
} else {
  // מצב 2: הרצה ידנית (Run Script) מתוך אפליקציית Scriptable
  // במקום להציג סתם "preview" חסר משמעות, מציג דיאלוג אינטראקטיבי
  const status = await fetchStatus();
  const alert = new Alert();
  alert.title = "⚡ Antigravity Agent Status";
  
  const stateHeb = status.status === "running" ? "🟢 פועל כעת" : (status.status === "done" ? "✨ הושלם בהצלחה" : "💤 ממתין לפקודה");
  alert.message = `משימה: ${status.taskTitle}\nסטטוס: ${stateHeb}\nצעד: ${status.stepCount} | ${cleanActionName(status.currentAction)}\nעודכן: ${formatRelativeTime(status.updatedAt)}`;
  
  alert.addAction("📱 הצג ווידג'ט (Medium)");
  alert.addAction("⏹️ הצג ווידג'ט (Small)");
  alert.addAction("🔒 הצג מסך נעילה (Lock Screen)");
  alert.addCancelAction("סגור");

  const choice = await alert.presentAlert();
  if (choice === 0) {
    const w = await createWidget("medium");
    await w.presentMedium();
  } else if (choice === 1) {
    const w = await createWidget("small");
    await w.presentSmall();
  } else if (choice === 2) {
    const w = await createWidget("accessoryRectangular");
    await w.presentAccessoryRectangular();
  }
}
Script.complete();
