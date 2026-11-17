// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: purple; icon-glyph: bolt;

/**
 * ⚡ Antigravity Agent - Minimalist iOS Task, Progress Bar & Live Status Widget
 * 
 * - משיכת נתוני זמן אמת ישירה מ-GitHub API
 * - Timeout מורחב (8 שניות) לעבודה אמינה ברשת סלולרית ברקע
 * - הגדרת תזמון רענון תקני מול מערכת iOS
 */

const GIST_ID = "f307290d03418549eeee78997070fe96";
const GIST_API_URL = `https://api.github.com/gists/${GIST_ID}`;
const GIST_RAW_URL = `https://gist.githubusercontent.com/hadarai9087-hub/${GIST_ID}/raw/status.json`;

const APP_URL = "https://github.com/hadarai9087-hub/antigravity-agent-widget";

async function fetchStatus() {
  // 1. קריאה ישירה מ-GitHub API
  try {
    const req = new Request(`${GIST_API_URL}?t=${Date.now()}`);
    req.timeoutInterval = 8;
    req.headers = {
      "User-Agent": "AntigravityWidget/5.0",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache"
    };
    const res = await req.loadJSON();
    const rawContent = res?.files?.["status.json"]?.content;
    if (rawContent) {
      return JSON.parse(rawContent);
    }
  } catch (e) {
    console.warn("Direct API fetch failed, trying raw fallback:", e);
  }

  // 2. פולבק
  try {
    const req = new Request(`${GIST_RAW_URL}?t=${Date.now()}`);
    req.timeoutInterval = 8;
    req.headers = { "Cache-Control": "no-cache", "User-Agent": "AntigravityWidget/5.0" };
    const res = await req.loadJSON();
    if (res && res.status) return res;
  } catch (e) {}

  return {
    status: "waiting",
    taskTitle: "Antigravity Agent",
    phase: "ממתין לפקודה",
    currentAction: "מוכן לפקודה הבאה",
    stepCount: 0,
    progress: 0,
    activeCount: 0,
    tasks: [],
    updatedAt: new Date().toISOString()
  };
}

function drawProgressBar(progress, width, height, fillColor, trackColor) {
  const dc = new DrawContext();
  dc.size = new Size(width, height);
  dc.opaque = false;
  dc.respectScreenScale = true;

  const radius = height / 2;

  const trackPath = new Path();
  trackPath.addRoundedRect(new Rect(0, 0, width, height), radius, radius);
  dc.addPath(trackPath);
  dc.setFillColor(trackColor || new Color("#FFFFFF", 0.18));
  dc.fillPath();

  const p = Math.max(0.04, Math.min(1.0, Number(progress) || 0.05));
  const fillWidth = Math.max(height, width * p);
  const fillPath = new Path();
  fillPath.addRoundedRect(new Rect(0, 0, fillWidth, height), radius, radius);
  dc.addPath(fillPath);
  dc.setFillColor(fillColor || new Color("#34C759"));
  dc.fillPath();

  return dc.getImage();
}

async function createWidget(family) {
  const data = await fetchStatus();
  const widget = new ListWidget();
  const targetFamily = family || config.widgetFamily || "medium";
  
  const isLockScreen = targetFamily === "accessoryRectangular" || 
                       targetFamily === "accessoryInline" || 
                       targetFamily === "accessoryCircular";

  const isRunning = data.status === "running";
  const tasks = Array.isArray(data.tasks) && data.tasks.length > 0 ? data.tasks : [data];

  widget.url = APP_URL;

  if (isLockScreen) {
    widget.backgroundColor = new Color("#000000", 0);
    widget.setPadding(0, 2, 0, 2);
    renderLockScreen(widget, data, tasks, isRunning);
  } else if (targetFamily === "small") {
    widget.backgroundColor = new Color("#000000");
    widget.setPadding(12, 12, 12, 12);
    renderSmall(widget, data, isRunning);
  } else {
    widget.backgroundColor = new Color("#000000");
    widget.setPadding(14, 16, 14, 16);
    renderMedium(widget, data, tasks, isRunning);
  }

  // הגדרת תאריך רענון תקני ש-iOS מכבדת
  const nextRefresh = new Date();
  nextRefresh.setMinutes(nextRefresh.getMinutes() + (isRunning ? 2 : 5));
  widget.refreshAfterDate = nextRefresh;

  return widget;
}

function renderLockScreen(widget, data, tasks, isRunning) {
  const activeTasks = tasks.filter(t => t.status === "running");
  const isMulti = activeTasks.length >= 2;

  const stack = widget.addStack();
  stack.layoutVertically();

  if (isMulti) {
    const header = stack.addStack();
    header.layoutHorizontally();
    const dot = header.addText("● ");
    dot.font = Font.boldSystemFont(10);
    const headTitle = header.addText(`${activeTasks.length} משימות במקביל`);
    headTitle.font = Font.boldSystemFont(10);

    stack.addSpacer(3);

    for (let i = 0; i < Math.min(2, activeTasks.length); i++) {
      const t = activeTasks[i];
      if (i > 0) stack.addSpacer(3);

      const row = stack.addStack();
      row.layoutHorizontally();
      row.centerAlignContent();

      const name = row.addText(truncate(t.taskTitle, 16));
      name.font = Font.systemFont(9);
      row.addSpacer();

      const pct = row.addText(`${Math.round(t.progress * 100)}%`);
      pct.font = Font.boldSystemFont(8);

      stack.addSpacer(1.5);
      const barImg = drawProgressBar(t.progress, 135, 3, new Color("#FFFFFF"), new Color("#FFFFFF", 0.2));
      const bar = stack.addImage(barImg);
      bar.imageSize = new Size(135, 3);
    }
  } else {
    const t = activeTasks[0] || tasks[0] || data;

    const titleRow = stack.addStack();
    titleRow.layoutHorizontally();
    titleRow.centerAlignContent();

    const icon = titleRow.addText(isRunning ? "● " : "💤 ");
    icon.font = Font.boldSystemFont(11);

    const phaseText = isRunning ? (t.phase || "עובד") : "ממתין";
    const head = titleRow.addText(`Antigravity • ${phaseText}`);
    head.font = Font.boldSystemFont(11);

    titleRow.addSpacer();

    if (isRunning && t.progress > 0) {
      const pct = titleRow.addText(`${Math.round(t.progress * 100)}%`);
      pct.font = Font.boldSystemFont(10);
    }

    stack.addSpacer(2);

    const taskText = stack.addText(truncate(t.taskTitle, 22));
    taskText.font = Font.systemFont(10);
    taskText.lineLimit = 1;

    stack.addSpacer(1);

    const actText = stack.addText(isRunning ? cleanActionName(t.currentAction) : "מוכן לפקודה הבאה");
    actText.font = Font.systemFont(8);
    actText.textColor = new Color("#A1A1AA");
    actText.lineLimit = 1;

    if (isRunning && t.progress > 0) {
      stack.addSpacer(3);
      const barImg = drawProgressBar(t.progress, 138, 3.5, new Color("#FFFFFF"), new Color("#FFFFFF", 0.22));
      const bar = stack.addImage(barImg);
      bar.imageSize = new Size(138, 3.5);
    }
  }
}

function renderMedium(widget, data, tasks, isRunning) {
  const activeTasks = tasks.filter(t => t.status === "running");
  const isMulti = activeTasks.length >= 2;

  const topRow = widget.addStack();
  topRow.layoutHorizontally();
  topRow.centerAlignContent();

  const statusBadge = topRow.addStack();
  statusBadge.layoutHorizontally();
  statusBadge.centerAlignContent();
  statusBadge.setPadding(3, 8, 3, 8);
  statusBadge.cornerRadius = 99;

  let badgeBg = isRunning ? new Color("#34C759", 0.18) : new Color("#8E8E93", 0.18);
  let dotColor = isRunning ? new Color("#34C759") : new Color("#8E8E93");
  
  const currentTask = activeTasks[0] || tasks[0] || data;
  let statusText = isRunning 
    ? (isMulti ? `${activeTasks.length} משימות במקביל` : `עובד • ${currentTask.phase || "בביצוע"}`) 
    : "ממתין לפקודה";

  statusBadge.backgroundColor = badgeBg;

  const dot = statusBadge.addText(isRunning ? "● " : "💤 ");
  dot.font = Font.systemFont(11);
  dot.textColor = dotColor;

  const statusLabel = statusBadge.addText(statusText);
  statusLabel.font = Font.boldSystemFont(11);
  statusLabel.textColor = dotColor;

  topRow.addSpacer();

  const brand = topRow.addText("ANTIGRAVITY");
  brand.font = Font.boldSystemFont(9);
  brand.textColor = new Color("#52525B");

  widget.addSpacer(10);

  if (isMulti) {
    for (let i = 0; i < Math.min(2, activeTasks.length); i++) {
      const t = activeTasks[i];
      if (i > 0) widget.addSpacer(8);

      const card = widget.addStack();
      card.layoutVertical = true;

      const row = card.addStack();
      row.layoutHorizontally();
      row.centerAlignContent();

      const name = row.addText(truncate(t.taskTitle, 22));
      name.font = Font.boldSystemFont(13);
      name.textColor = new Color("#FFFFFF");

      row.addSpacer();

      const pct = row.addText(`${t.phase ? t.phase + " • " : ""}${Math.round(t.progress * 100)}%`);
      pct.font = Font.boldSystemFont(11);
      pct.textColor = new Color("#34C759");

      card.addSpacer(2);

      const sub = card.addText(cleanActionName(t.currentAction));
      sub.font = Font.systemFont(11);
      sub.textColor = new Color("#A1A1AA");
      sub.lineLimit = 1;

      card.addSpacer(4);

      const barImg = drawProgressBar(t.progress, 275, 4.5, new Color("#34C759"), new Color("#27272A"));
      const bar = card.addImage(barImg);
      bar.imageSize = new Size(275, 4.5);
    }
  } else {
    const t = currentTask;

    const row = widget.addStack();
    row.layoutHorizontally();
    row.centerAlignContent();

    const title = row.addText(truncate(t.taskTitle, 26));
    title.font = Font.boldSystemFont(16);
    title.textColor = new Color("#FFFFFF");
    title.lineLimit = 1;

    row.addSpacer();

    if (isRunning && t.progress > 0) {
      const pct = row.addText(`${Math.round(t.progress * 100)}%`);
      pct.font = Font.boldSystemFont(13);
      pct.textColor = new Color("#34C759");
    }

    widget.addSpacer(4);

    const actionText = isRunning 
      ? (cleanActionName(t.currentAction) || "מבצע פעולות...") 
      : "הסוכן מוכן לפקודה הבאה";
    
    const subtitle = widget.addText(actionText);
    subtitle.font = Font.systemFont(12);
    subtitle.textColor = isRunning ? new Color("#34C759") : new Color("#A1A1AA");
    subtitle.lineLimit = 1;

    widget.addSpacer(8);

    if (isRunning && t.progress > 0) {
      const barImg = drawProgressBar(t.progress, 275, 6, new Color("#34C759"), new Color("#27272A"));
      const bar = widget.addImage(barImg);
      bar.imageSize = new Size(275, 6);
      widget.addSpacer(8);
    }

    const botRow = widget.addStack();
    botRow.layoutHorizontally();
    if (isRunning && t.phase) {
      const phaseBadge = botRow.addText(`שלב: ${t.phase}`);
      phaseBadge.font = Font.mediumSystemFont(10);
      phaseBadge.textColor = new Color("#A1A1AA");
    }
    botRow.addSpacer();
    const timeText = botRow.addText(formatRelativeTime(data.updatedAt));
    timeText.font = Font.systemFont(10);
    timeText.textColor = new Color("#52525B");
  }
}

function renderSmall(widget, data, isRunning) {
  const t = data.tasks?.[0] || data;

  const topRow = widget.addStack();
  topRow.layoutHorizontally();
  topRow.centerAlignContent();

  const dot = topRow.addText(isRunning ? "●" : "💤");
  dot.font = Font.boldSystemFont(14);
  dot.textColor = isRunning ? new Color("#34C759") : new Color("#8E8E93");

  topRow.addSpacer(4);

  const statusLabel = topRow.addText(isRunning ? (t.phase || "מבצע...") : "ממתין");
  statusLabel.font = Font.boldSystemFont(11);
  statusLabel.textColor = isRunning ? new Color("#34C759") : new Color("#8E8E93");

  topRow.addSpacer();

  if (isRunning && t.progress > 0) {
    const pct = topRow.addText(`${Math.round(t.progress * 100)}%`);
    pct.font = Font.boldSystemFont(11);
    pct.textColor = new Color("#34C759");
  }

  widget.addSpacer();

  const title = widget.addText(truncate(t.taskTitle, 18));
  title.font = Font.boldSystemFont(13);
  title.textColor = new Color("#FFFFFF");
  title.lineLimit = 2;

  widget.addSpacer(4);

  const actionText = isRunning ? cleanActionName(t.currentAction) : "פנוי";
  const sub = widget.addText(actionText);
  sub.font = Font.systemFont(10);
  sub.textColor = new Color("#A1A1AA");
  sub.lineLimit = 1;

  if (isRunning && t.progress > 0) {
    widget.addSpacer(6);
    const barImg = drawProgressBar(t.progress, 125, 4, new Color("#34C759"), new Color("#27272A"));
    const bar = widget.addImage(barImg);
    bar.imageSize = new Size(125, 4);
  }

  widget.addSpacer();

  const timeText = widget.addText(formatRelativeTime(data.updatedAt));
  timeText.font = Font.systemFont(9);
  timeText.textColor = new Color("#52525B");
}

function truncate(str, max) {
  if (!str) return "";
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
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
    if (diff < 3600) return `לפני ${Math.floor(diff / 60)} דק'`;
    return `לפני ${Math.floor(diff / 3600)} ש'`;
  } catch (e) {
    return "";
  }
}

if (config.runsInWidget) {
  const widget = await createWidget();
  Script.setWidget(widget);
} else {
  const status = await fetchStatus();
  const alert = new Alert();
  alert.title = "⚡ Antigravity Agent Status";
  
  const stateHeb = status.status === "running" ? `🟢 ${status.phase || "פועל כעת"}` : "💤 ממתין לפקודה שלך";
  const progText = status.status === "running" ? `\nהתקדמות: ${Math.round((status.progress || 0) * 100)}%` : "";
  alert.message = `משימה: ${status.taskTitle}\nסטטוס: ${stateHeb}${progText}\nפעולה: ${cleanActionName(status.currentAction)}\nעודכן: ${formatRelativeTime(status.updatedAt)}`;
  
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
