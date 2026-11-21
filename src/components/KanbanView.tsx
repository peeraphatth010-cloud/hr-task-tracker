"use client";

import React, { useState } from "react";
import { Category, Task, TaskStatus } from "@/lib/types";
import { formatThaiDate, getDaysDiffFromToday } from "@/lib/excel-export";

interface KanbanViewProps {
  tasks: Task[];
  categories: Category[];
  useBuddhistEra: boolean;
  isViewer: boolean;
  selectedCategoryId?: string;
  onSelectCategory?: (catId: string) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onDeleteTask: (taskId: string) => void;
  onDeleteAllDone?: () => void;
  onSelectTask: (task: Task) => void;
  onCreateTaskInColumn: (status: TaskStatus) => void;
}

const COLUMNS: {
  key: TaskStatus;
  label: string;
  thaiLabel: string;
  headerBg: string;
  dotColor: string;
}[] = [
  {
    key: "todo",
    label: "To Do",
    thaiLabel: "รอดำเนินการ",
    headerBg: "bg-slate-200/80 text-slate-900",
    dotColor: "bg-slate-600",
  },
  {
    key: "in_progress",
    label: "In Progress",
    thaiLabel: "กำลังทำ",
    headerBg: "bg-blue-100 text-blue-950",
    dotColor: "bg-blue-600",
  },
  {
    key: "waiting",
    label: "Waiting",
    thaiLabel: "รอตรวจ / รออนุมัติ",
    headerBg: "bg-amber-100 text-amber-950",
    dotColor: "bg-amber-600",
  },
  {
    key: "done",
    label: "Done",
    thaiLabel: "เสร็จสมบูรณ์",
    headerBg: "bg-emerald-100 text-emerald-950",
    dotColor: "bg-emerald-600",
  },
];

const PRIORITY_CONFIG: Record<
  Task["priority"],
  { label: string; badgeClass: string; leftBorder: string }
> = {
  urgent: {
    label: "🔥 ด่วนที่สุด (Urgent)",
    badgeClass: "bg-red-600 text-white",
    leftBorder: "border-l-8 border-l-red-600",
  },
  high: {
    label: "⚡ สำคัญสูง (High)",
    badgeClass: "bg-amber-500 text-slate-950",
    leftBorder: "border-l-8 border-l-amber-500",
  },
  medium: {
    label: "📌 ปานกลาง",
    badgeClass: "bg-blue-100 text-blue-800",
    leftBorder: "border-l-4 border-l-blue-500",
  },
  low: {
    label: "ทั่วไป",
    badgeClass: "bg-slate-100 text-slate-700",
    leftBorder: "border-l-4 border-l-slate-300",
  },
};

// Lightweight Canvas Confetti / Fireworks Effect when a task moves to Done!
function launchCelebrationFireworks() {
  if (typeof window === "undefined") return;
  const canvas = document.createElement("canvas");
  canvas.style.position = "fixed";
  canvas.style.top = "0";
  canvas.style.left = "0";
  canvas.style.width = "100vw";
  canvas.style.height = "100vh";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "9999";
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    document.body.removeChild(canvas);
    return;
  }

  const colors = ["#10B981", "#3B82F6", "#F59E0B", "#EC4899", "#8B5CF6", "#F43F5E", "#FBBF24"];
  interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    color: string;
    alpha: number;
    rotation: number;
    vRot: number;
  }

  const particles: Particle[] = [];
  const bursts = [
    { x: canvas.width * 0.3, y: canvas.height * 0.35 },
    { x: canvas.width * 0.5, y: canvas.height * 0.28 },
    { x: canvas.width * 0.72, y: canvas.height * 0.35 },
  ];

  bursts.forEach((b) => {
    for (let i = 0; i < 55; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 9;
      particles.push({
        x: b.x,
        y: b.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        size: 5 + Math.random() * 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.25,
      });
    }
  });

  let frame = 0;
  const animate = () => {
    frame++;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let alive = false;
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.22; // gravity
      p.vx *= 0.985;
      p.rotation += p.vRot;
      p.alpha -= 0.014;

      if (p.alpha > 0) {
        alive = true;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.65);
        ctx.restore();
      }
    }

    if (alive && frame < 110) {
      requestAnimationFrame(animate);
    } else {
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }
  };

  requestAnimationFrame(animate);
}

const THAI_MONTHS_SHORT = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

function formatMonthRangeLabel(ym: string, span: 1 | 2, useBuddhistEra: boolean): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  const startLabel = `${THAI_MONTHS_SHORT[m - 1]} ${useBuddhistEra ? y + 543 : y}`;
  if (span === 1) return startLabel;
  const nextDate = new Date(y, m, 1); // m is 1-indexed, so new Date(y, m, 1) is next month
  const ny = nextDate.getFullYear();
  const nm = nextDate.getMonth() + 1;
  const endLabel = `${THAI_MONTHS_SHORT[nm - 1]} ${useBuddhistEra ? ny + 543 : ny}`;
  if (y === ny) {
    return `${THAI_MONTHS_SHORT[m - 1]}–${endLabel}`;
  }
  return `${startLabel} – ${endLabel}`;
}

function getAllowedMonths(ym: string, span: 1 | 2): string[] {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return [];
  const first = `${y}-${String(m).padStart(2, "0")}`;
  if (span === 1) return [first];
  const nextDate = new Date(y, m, 1);
  const second = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}`;
  return [first, second];
}

export default function KanbanView({
  tasks,
  categories,
  useBuddhistEra,
  isViewer,
  selectedCategoryId,
  onSelectCategory,
  onStatusChange,
  onDeleteTask,
  onDeleteAllDone,
  onSelectTask,
  onCreateTaskInColumn,
}: KanbanViewProps) {
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [internalCatId, setInternalCatId] = useState<string>("all");
  const selectedCatId = selectedCategoryId !== undefined ? selectedCategoryId : internalCatId;
  const setSelectedCatId = (catId: string) => {
    setInternalCatId(catId);
    if (onSelectCategory) onSelectCategory(catId);
  };
  const [monthMode, setMonthMode] = useState<"all" | "custom">("all");
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [monthSpan, setMonthSpan] = useState<1 | 2>(1);
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [hideDoneTasks, setHideDoneTasks] = useState<boolean>(false);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<TaskStatus | null>(null);
  const [celebratingTaskTitle, setCelebratingTaskTitle] = useState<string | null>(null);

  const allowedMonths = monthMode === "custom" ? getAllowedMonths(selectedMonth, monthSpan) : [];

  const monthFilteredTasks = tasks.filter((t) => {
    if (monthMode === "all") return true;
    const dueYm = t.due_date ? t.due_date.slice(0, 7) : null;
    const startYm = t.start_date ? t.start_date.slice(0, 7) : null;
    return (
      (dueYm !== null && allowedMonths.includes(dueYm)) ||
      (startYm !== null && allowedMonths.includes(startYm))
    );
  });

  const filteredTasks = monthFilteredTasks.filter((t) => {
    if (selectedCatId !== "all" && t.category_id !== selectedCatId) return false;
    if (priorityFilter === "urgent_high" && t.priority !== "urgent" && t.priority !== "high")
      return false;
    return true;
  });

  const overdueCount = monthFilteredTasks.filter((t) => {
    if (t.status === "done") return false;
    const diff = getDaysDiffFromToday(t.due_date);
    return diff !== null && diff < 0;
  }).length;

  const d3Count = monthFilteredTasks.filter((t) => {
    if (t.status === "done") return false;
    const diff = getDaysDiffFromToday(t.due_date);
    return diff !== null && diff >= 0 && diff <= 3;
  }).length;

  const triggerStatusChangeWithCelebration = (taskId: string, targetStatus: TaskStatus) => {
    const targetTask = tasks.find((t) => t.id === taskId);
    if (targetStatus === "done" && targetTask && targetTask.status !== "done") {
      launchCelebrationFireworks();
      setCelebratingTaskTitle(targetTask.title);
      setTimeout(() => {
        setCelebratingTaskTitle(null);
      }, 2800);
    }
    onStatusChange(taskId, targetStatus);
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    if (isViewer) return;
    setDraggedTaskId(taskId);
    e.dataTransfer.setData("text/plain", taskId);
  };

  const handleDragOver = (e: React.DragEvent, status: TaskStatus) => {
    if (isViewer) return;
    e.preventDefault();
    if (dragOverCol !== status) setDragOverCol(status);
  };

  const handleDrop = (e: React.DragEvent, targetStatus: TaskStatus) => {
    if (isViewer) return;
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text/plain") || draggedTaskId;
    setDraggedTaskId(null);
    setDragOverCol(null);
    if (taskId) {
      triggerStatusChangeWithCelebration(taskId, targetStatus);
    }
  };

  return (
    <div className="flex flex-col w-full pb-12 space-y-5 relative">
      {/* Floating Celebration Toast Banner when moving task to Done */}
      {celebratingTaskTitle && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-6 py-3.5 rounded-2xl bg-emerald-600 text-white shadow-2xl flex items-center gap-3 animate-bounce border-2 border-white">
          <span className="text-2xl">🎉</span>
          <div>
            <div className="text-sm font-extrabold">เยี่ยมมาก! ภารกิจเสร็จสมบูรณ์แล้ว</div>
            <div className="text-xs font-medium opacity-95 truncate max-w-xs">
              {celebratingTaskTitle}
            </div>
          </div>
        </div>
      )}

      {/* Header Bar */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
            กระดานติดตามงาน HR (Kanban Board)
          </h1>
          <p className="text-base text-slate-600 mt-1">
            เรียงลำดับตามงานที่ใกล้ถึงกำหนดส่งที่สุดขึ้นก่อนอัตโนมัติ • งานที่เสร็จล่าสุดจะอยู่บนสุดเสมอ
          </p>
        </div>

        {/* High Contrast Alert Counters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="px-4 py-2 rounded-2xl bg-red-100 border border-red-300 flex items-center gap-2 text-base font-bold text-red-800">
            <span>⚠️ เลยกำหนด:</span>
            <span className="text-lg font-extrabold">{overdueCount} งาน</span>
          </div>
          <div className="px-4 py-2 rounded-2xl bg-amber-100 border border-amber-300 flex items-center gap-2 text-base font-bold text-amber-900">
            <span>⏰ ครบใน 3 วัน:</span>
            <span className="text-lg font-extrabold">{d3Count} งาน</span>
          </div>
        </div>
      </div>

      {/* Clear Filter Bar */}
      <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200 flex flex-col gap-3.5">
        {/* Row 1: Month Filter Bar (All / 1 Month / 2 Months / Custom Month Picker) */}
        <div className="flex items-center justify-between gap-3 flex-wrap pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-extrabold text-slate-700 flex items-center gap-1.5 mr-1">
              <span className="material-symbols-outlined text-lg text-primary">calendar_month</span>
              ช่วงเดือน:
            </span>

            <button
              type="button"
              onClick={() => setMonthMode("all")}
              className={`px-3.5 py-2 rounded-2xl text-sm font-bold transition-all ${
                monthMode === "all"
                  ? "bg-primary-container text-white shadow-sm"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              ทั้งหมด ({tasks.length})
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedMonth(currentMonthStr);
                setMonthSpan(1);
                setMonthMode("custom");
              }}
              className={`px-3.5 py-2 rounded-2xl text-sm font-bold transition-all ${
                monthMode === "custom" && selectedMonth === currentMonthStr && monthSpan === 1
                  ? "bg-primary-container text-white shadow-sm"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              เดือนนี้ ({formatMonthRangeLabel(currentMonthStr, 1, useBuddhistEra)})
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedMonth(currentMonthStr);
                setMonthSpan(2);
                setMonthMode("custom");
              }}
              className={`px-3.5 py-2 rounded-2xl text-sm font-bold transition-all ${
                monthMode === "custom" && selectedMonth === currentMonthStr && monthSpan === 2
                  ? "bg-primary-container text-white shadow-sm"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              วางแผน 2 เดือน ({formatMonthRangeLabel(currentMonthStr, 2, useBuddhistEra)})
            </button>
          </div>

          {/* Custom Month Picker + 1-Month / 2-Month Toggle */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 bg-slate-100 rounded-2xl px-3 py-1.5 border border-slate-200">
              <span className="text-xs font-bold text-slate-600 whitespace-nowrap">เลือกเดือน:</span>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => {
                  if (e.target.value) {
                    setSelectedMonth(e.target.value);
                    setMonthMode("custom");
                  }
                }}
                className="bg-white px-2.5 py-1 rounded-xl text-sm font-bold text-slate-900 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <div className="inline-flex rounded-xl bg-slate-200/80 p-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setMonthSpan(1);
                    setMonthMode("custom");
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all ${
                    monthMode === "custom" && monthSpan === 1
                      ? "bg-white text-primary shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  1 เดือน
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMonthSpan(2);
                    setMonthMode("custom");
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all ${
                    monthMode === "custom" && monthSpan === 2
                      ? "bg-white text-primary shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  2 เดือน
                </button>
              </div>
            </div>

            {monthMode === "custom" && (
              <span className="px-3 py-1.5 rounded-xl bg-blue-50 text-primary text-xs font-extrabold border border-blue-200">
                แสดง: {formatMonthRangeLabel(selectedMonth, monthSpan, useBuddhistEra)} (
                {monthFilteredTasks.length} งาน)
              </span>
            )}
          </div>
        </div>

        {/* Row 2: Category Pills & Quick Action Filters */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Category Pills — Count ONLY unfinished tasks in the active month filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setSelectedCatId("all")}
              className={`px-4 py-2.5 rounded-2xl text-sm font-bold transition-all ${
                selectedCatId === "all"
                  ? "bg-primary-container text-white shadow-sm"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              ทุกหมวดหมู่ ({monthFilteredTasks.filter((t) => t.status !== "done").length})
            </button>

            {categories.map((cat) => {
              const count = monthFilteredTasks.filter(
                (t) => t.category_id === cat.id && t.status !== "done"
              ).length;
              const active = selectedCatId === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCatId(cat.id)}
                  className={`px-4 py-2.5 rounded-2xl text-sm font-bold transition-all flex items-center gap-2 ${
                    active
                      ? "bg-primary-container text-white shadow-sm"
                      : "bg-slate-100 text-slate-800 hover:bg-slate-200"
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: active ? "#ffffff" : cat.color }}
                  ></span>
                  <span>{cat.name}</span>
                  <span className="opacity-80">({count})</span>
                </button>
              );
            })}
          </div>

          {/* Quick Priority Filter & Hide/Clear Done Tasks */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => setHideDoneTasks(!hideDoneTasks)}
              className={`px-4 py-2.5 rounded-2xl text-sm font-bold transition-all border ${
                hideDoneTasks
                  ? "bg-slate-800 text-white border-slate-800 shadow-sm"
                  : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
              }`}
            >
              {hideDoneTasks ? "👁️ แสดงงานที่เสร็จแล้ว" : "ซ่อนงานที่เสร็จแล้ว"}
            </button>

            {tasks.some((t) => t.status === "done") && onDeleteAllDone && (
              <button
                onClick={() => {
                  if (
                    window.confirm(
                      "ต้องการลบงานที่เสร็จสมบูรณ์แล้วทั้งหมดออกจากกระดานใช่หรือไม่?"
                    )
                  ) {
                    onDeleteAllDone();
                  }
                }}
                className="px-4 py-2.5 rounded-2xl text-sm font-bold transition-all border bg-white text-slate-700 border-slate-300 hover:bg-red-50 hover:text-red-700 hover:border-red-300 flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-base">delete_sweep</span>
                <span>ล้างงานที่เสร็จแล้ว</span>
              </button>
            )}

            <button
              onClick={() =>
                setPriorityFilter(priorityFilter === "urgent_high" ? "all" : "urgent_high")
              }
              className={`px-4 py-2.5 rounded-2xl text-sm font-bold transition-all border ${
                priorityFilter === "urgent_high"
                  ? "bg-red-600 text-white border-red-600 shadow-sm"
                  : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
              }`}
            >
              🔥 แสดงเฉพาะงานด่วน / สำคัญสูง
            </button>
          </div>
        </div>
      </div>

      {/* 4 Kanban Columns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 items-start">
        {COLUMNS.map((col) => {
          const priorityRank = { urgent: 0, high: 1, medium: 2, low: 3 };
          const colTasks = filteredTasks
            .filter((t) => {
              if (col.key === "done" && hideDoneTasks) return false;
              return t.status === col.key;
            })
            .sort((a, b) => {
              // 1. For "Done" column: Most recently completed task ALWAYS on top!
              if (col.key === "done") {
                const timeA = a.completed_at || a.updated_at || "";
                const timeB = b.completed_at || b.updated_at || "";
                return timeB.localeCompare(timeA);
              }

              // 2. For active columns (To Do, In Progress, Waiting):
              // Sort by closest deadline first (Overdue -> Today -> 1 day -> 5 days -> later)
              const diffA = getDaysDiffFromToday(a.due_date) ?? 9999;
              const diffB = getDaysDiffFromToday(b.due_date) ?? 9999;
              if (diffA !== diffB) return diffA - diffB;

              // Tie-breaker: higher priority first
              return priorityRank[a.priority] - priorityRank[b.priority];
            });

          const isDragOver = dragOverCol === col.key;

          return (
            <div
              key={col.key}
              onDragOver={(e) => handleDragOver(e, col.key)}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={(e) => handleDrop(e, col.key)}
              className={`rounded-3xl p-4 transition-all min-h-[560px] flex flex-col gap-4 border ${
                isDragOver
                  ? "bg-blue-50/90 border-blue-500 ring-2 ring-blue-400"
                  : "bg-slate-100/90 border-slate-200/80"
              }`}
            >
              {/* Clear Column Header */}
              <div
                className={`flex items-center justify-between px-4 py-3 rounded-2xl ${col.headerBg}`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={`w-3.5 h-3.5 rounded-full ${col.dotColor}`}></span>
                  <div>
                    <h2 className="text-lg font-extrabold leading-tight">{col.thaiLabel}</h2>
                    <span className="text-xs font-semibold opacity-75">{col.label}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-white/90 text-slate-900 text-sm font-extrabold shadow-sm">
                    {colTasks.length}
                  </span>
                  {!isViewer && (
                    <button
                      onClick={() => onCreateTaskInColumn(col.key)}
                      title={`เพิ่มงานใน ${col.thaiLabel}`}
                      className="w-8 h-8 rounded-xl bg-white/80 hover:bg-white flex items-center justify-center text-slate-900 font-bold shadow-sm"
                    >
                      +
                    </button>
                  )}
                </div>
              </div>

              {/* Cards Stack */}
              <div className="flex flex-col gap-4 flex-1">
                {colTasks.length === 0 && (
                  <div className="flex-1 rounded-2xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center p-8 text-center text-slate-500">
                    <span className="material-symbols-outlined text-4xl opacity-40 mb-2">
                      inbox
                    </span>
                    <span className="text-base font-semibold">ไม่มีงานในช่องนี้</span>
                  </div>
                )}

                {colTasks.map((task) => {
                  const isDone = task.status === "done";
                  const diff = getDaysDiffFromToday(task.due_date);
                  const isOverdue = !isDone && diff !== null && diff < 0;
                  const isBlinkRed = !isDone && diff !== null && diff <= 1; // <= 1 day, today, or overdue
                  const isD3 = !isDone && diff !== null && diff >= 0 && diff <= 3;

                  const items = task.checklist_items || [];
                  const doneCount = items.filter((i) => i.is_done).length;
                  const pct =
                    items.length > 0
                      ? Math.round((doneCount / items.length) * 100)
                      : isDone
                      ? 100
                      : 0;

                  const pCfg = PRIORITY_CONFIG[task.priority];

                  return (
                    <div
                      key={task.id}
                      draggable={!isViewer}
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onClick={() => onSelectTask(task)}
                      className={`rounded-2xl p-5 transition-all cursor-pointer shadow-sm hover:shadow-md border ${
                        isDone
                          ? "bg-emerald-50/40 border-emerald-200 border-l-8 border-l-emerald-500 opacity-95"
                          : isBlinkRed
                          ? "bg-white border-red-400 border-l-8 border-l-red-600 ring-2 ring-red-400/70"
                          : isOverdue
                          ? "bg-white border-slate-200 border-l-8 border-l-red-600 ring-2 ring-red-200"
                          : `bg-white border-slate-200 ${pCfg.leftBorder}`
                      }`}
                    >
                      {/* Row 1: Priority Badge + Category */}
                      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                        {isDone ? (
                          <span className="px-3 py-1 rounded-lg text-xs font-extrabold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                            <span>✅ ดำเนินการเสร็จสิ้น</span>
                          </span>
                        ) : (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`px-3 py-1 rounded-lg text-xs font-extrabold ${pCfg.badgeClass}`}
                            >
                              {pCfg.label}
                            </span>
                            {isBlinkRed && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-600 text-white text-xs font-extrabold animate-pulse shadow-sm">
                                <span className="relative flex h-2.5 w-2.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
                                </span>
                                <span>ด่วน! ใกล้เดดไลน์</span>
                              </span>
                            )}
                          </div>
                        )}

                        <div className="flex items-center gap-1.5">
                          {task.category && (
                            <span
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold"
                              style={{
                                backgroundColor: `${task.category.color}18`,
                                color: task.category.color,
                              }}
                            >
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: task.category.color }}
                              ></span>
                              <span>{task.category.name}</span>
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (
                                window.confirm(`ต้องการลบงาน "${task.title}" ใช่หรือไม่?`)
                              ) {
                                onDeleteTask(task.id);
                              }
                            }}
                            title="ลบงานนี้"
                            className="w-7 h-7 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-colors"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                          </button>
                        </div>
                      </div>

                      {/* Row 2: Large Task Title */}
                      <h3
                        className={`text-lg font-extrabold leading-snug mb-3.5 ${
                          isDone
                            ? "text-slate-600 line-through decoration-emerald-500/60"
                            : "text-slate-900"
                        }`}
                      >
                        {task.title}
                      </h3>

                      {/* Row 3: Due Date & Remaining Days — Cleanly Separated & Never Wrapping! */}
                      <div
                        className={`p-3 rounded-2xl mb-3.5 border ${
                          isDone
                            ? "bg-emerald-100/60 border-emerald-200"
                            : isBlinkRed
                            ? "bg-red-50 border-red-300"
                            : isD3
                            ? "bg-amber-50 border-amber-200"
                            : "bg-slate-50 border-slate-200/80"
                        }`}
                      >
                        {/* Top line: Due Date on a single clean row */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                            <span className="material-symbols-outlined text-base">event</span>
                            กำหนดส่ง
                          </span>
                          <span className="text-sm font-extrabold text-slate-900 whitespace-nowrap">
                            {formatThaiDate(task.due_date, useBuddhistEra)}
                          </span>
                        </div>

                        {/* Bottom line: Distinct Full-Width Remaining Time Pill */}
                        <div
                          className={`w-full py-1.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 whitespace-nowrap ${
                            isDone
                              ? "bg-emerald-600 text-white"
                              : isBlinkRed
                              ? "bg-red-600 text-white animate-pulse shadow-sm"
                              : isD3
                              ? "bg-amber-400 text-slate-950"
                              : "bg-white text-slate-700 border border-slate-200"
                          }`}
                        >
                          {isBlinkRed && (
                            <span className="relative flex h-2.5 w-2.5 shrink-0">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-90"></span>
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
                            </span>
                          )}
                          <span>
                            {isDone
                              ? "✓ ดำเนินการเสร็จเรียบร้อยแล้ว"
                              : diff === null
                              ? "ไม่ได้ระบุวันครบกำหนด"
                              : diff < 0
                              ? `🚨 เลยกำหนดส่งมาแล้ว ${Math.abs(diff)} วัน!`
                              : diff === 0
                              ? "🚨 ครบกำหนดส่งวันนี้!"
                              : diff === 1
                              ? "🚨 ครบกำหนดพรุ่งนี้ (เหลือ 1 วัน)!"
                              : `⏳ เหลือเวลาอีก ${diff} วัน`}
                          </span>
                        </div>
                      </div>

                      {/* Row 4: Checklist Progress */}
                      {items.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1">
                            <span>ความคืบหน้าเช็กลิสต์</span>
                            <span className="whitespace-nowrap">
                              {doneCount}/{items.length} ข้อ ({pct}%)
                            </span>
                          </div>
                          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                isOverdue
                                  ? "bg-red-600"
                                  : isDone
                                  ? "bg-emerald-600"
                                  : "bg-blue-600"
                              }`}
                              style={{ width: `${pct}%` }}
                            ></div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
