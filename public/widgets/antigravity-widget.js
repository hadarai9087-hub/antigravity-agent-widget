// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: purple; icon-glyph: bolt;

/**
 * ⚡ Antigravity Agent - Minimalist iOS Task & Progress Widget
 * 
 * - תומך במסך נעילה (Lock Screen) ובמסך הבית (Small / Medium)
 * - מציג בזמן אמת: האם הסוכן עובד כרגע, מה שם המשימה, איזה צעד מתבצע, ומסמן ב-✓ כשהסתיים
 * - עיצוב Apple HIG מינימליסטי יוקרתי (OLED Black, טיפוגרפיה נקייה)
 * - לחיצה על הווידג'ט פותחת את Antigravity
 */

// כתובות ה-API (בודק קודם ב-Vercel, ונופל אוטומטית ל-GitHub Gist לזמינות מיידית)
const VERCEL_API_URL = "https://antigravity-agent-widget.vercel.app/api/status";
const GIST_API_URL = "https://api.github.com/gists/f307290d03418549eeee78997070fe96";

// כתובת לפתיחת Antigravity בלחיצה על הווידג'ט
const APP_URL = "https://antigravity-agent-widget.vercel.app";

async function fetchStatus() {
  // 1. ניסיון קריאה מ-Vercel
  try {
    const req = new Request(VERCEL_API_URL);
    req.timeoutInterval = 4;
    const res = await req.loadJSON();
    if (res && res.status) return res;
  } catch (e) {
    // ממשיך לפולבק
  }

  // 2. פולבק מיידי ל-GitHub Gist (עובד מיידית 100%)
  try {
    const req = new Request(GIST_API_URL);
    req.timeoutInterval = 5;
    const res = await req.loadJSON();
    const content = res?.files?.["status.json"]?.content;
    if (content) {
      return JSON.parse(content);
    }
  } catch (e) {
    console.warn("Fetch fallback failed:", e);
  }

  return {
    status: "idle",
    taskTitle: "Antigravity Agent",
    currentAction: "ממתין לפקודה בשרת",
    stepCount: 0,
    updatedAt: new Date().toISOString()
  };
}

async function createWidget() {
  const data = await fetchStatus();
  const widget = new ListWidget();
  
  const isLockScreen = config.widgetFamily === "accessoryRectangular" || 
                       config.widgetFamily === "accessoryInline" || 
                       config.widgetFamily === "accessoryCircular";

  const isRunning = data.status === "running";
  const isDone = data.status === "done";

  // לחיצה על הווידג'ט
  widget.url = APP_URL;

  // הגדרת רקע וריווחים לפי סוג הווידג'ט
  if (isLockScreen) {
    widget.backgroundColor = new Color("#000000", 0);
    widget.setPadding(0, 2, 0, 2);
    renderLockScreen(widget, data, isRunning, isDone);
  } else if (config.widgetFamily === "small") {
    widget.backgroundColor = new Color("#000000");
    widget.setPadding(14, 14, 14, 14);
    renderSmall(widget, data, isRunning, isDone);
  } else {
    // Medium (ברירת מחדל מומלצת)
    widget.backgroundColor = new Color("#000000");
    widget.setPadding(16, 18, 16, 18);
    renderMedium(widget, data, isRunning, isDone);
  }

  // תזמון רענון: כל 2 דקות בזמן עבודה, כל 5 דקות בסיום
  widget.refreshAfterDate = new Date(Date.now() + 1000 * 60 * (isRunning ? 2 : 5));
  return widget;
}

// -------------------------------------------------------------
// 1. מסך הבית - מלבן רחב (Medium Widget - תצוגה עשירה ונקייה)
// -------------------------------------------------------------
function renderMedium(widget, data, isRunning, isDone) {
  // שורה עליונה: סטטוס + מועד עדכון
  const topRow = widget.addStack();
  topRow.layoutHorizontally();
  topRow.centerAlignContent();

  // נורית סטטוס
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

  // צעד נוכחי / מונה
  if (data.stepCount > 0) {
    const stepLabel = topRow.addText(`צעד ${data.stepCount}`);
    stepLabel.font = Font.mediumSystemFont(11);
    stepLabel.textColor = new Color("#71717A");
  }

  widget.addSpacer(10);

  // כותרת המשימה
  const title = widget.addText(data.taskTitle || "Antigravity Task");
  title.font = Font.boldSystemFont(16);
  title.textColor = new Color("#FFFFFF");
  title.lineLimit = 1;

  widget.addSpacer(4);

  // פעולה נוכחית או פירוט
  const actionText = isRunning 
    ? (cleanActionName(data.currentAction) || "מבצע פעולות...") 
    : (isDone ? "כל המשימות הסתיימו בהצלחה" : "הסוכן זמין בשרת");
  
  const subtitle = widget.addText(actionText);
  subtitle.font = Font.systemFont(13);
  subtitle.textColor = isRunning ? new Color("#34C759") : new Color("#A1A1AA");
  subtitle.lineLimit = 1;

  widget.addSpacer(10);

  // שורת תחתית: פס התקדמות מינימליסטי ושעת עדכון
  const bottomRow = widget.addStack();
  bottomRow.layoutHorizontally();
  bottomRow.centerAlignContent();

  const timeStr = formatRelativeTime(data.updatedAt);
  const timeText = bottomRow.addText(timeStr);
  timeText.font = Font.systemFont(10);
  timeText.textColor = new Color("#52525B");

  bottomRow.addSpacer();

  const brand = bottomRow.addText("ANTIGRAVITY");
  brand.font = Font.boldSystemFont(9);
  brand.textColor = new Color("#3F3F46");
}

// -------------------------------------------------------------
// 2. מסך הבית - ריבוע קטן (Small Widget - קומפקטי)
// -------------------------------------------------------------
function renderSmall(widget, data, isRunning, isDone) {
  // אינדיקטור עליון
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

  // כותרת משימה
  const title = widget.addText(data.taskTitle || "Antigravity");
  title.font = Font.boldSystemFont(14);
  title.textColor = new Color("#FFFFFF");
  title.lineLimit = 2;

  widget.addSpacer(4);

  // פעולה נוכחית
  const actionText = isRunning ? cleanActionName(data.currentAction) : (isDone ? "הסתיים" : "פנוי");
  const sub = widget.addText(actionText);
  sub.font = Font.systemFont(11);
  sub.textColor = new Color("#A1A1AA");
  sub.lineLimit = 1;

  widget.addSpacer();

  // זמן בתחתית
  const timeText = widget.addText(formatRelativeTime(data.updatedAt));
  timeText.font = Font.systemFont(9);
  timeText.textColor = new Color("#52525B");
}

// -------------------------------------------------------------
// 3. מסך נעילה (Lock Screen Rectangular Accessory)
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

// ניקוי טקסט פעולה מגרשיים
function cleanActionName(str) {
  if (!str) return "";
  return String(str).replace(/^["']|["']$/g, "").trim();
}

// חישוב זמן יחסי ידידותי
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

// הפעלת הווידג'ט
if (config.runsInWidget) {
  const widget = await createWidget();
  Script.setWidget(widget);
} else {
  // הרצה ידנית בתוך האפליקציה לבדיקה
  const widget = await createWidget();
  await widget.presentMedium();
}
Script.complete();
