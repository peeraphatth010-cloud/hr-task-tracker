"use client";

import React from "react";
import { Category, Task } from "@/lib/types";
import { formatThaiDate, getDaysDiffFromToday } from "@/lib/excel-export";

interface DashboardViewProps {
  tasks: Task[];
  categories: Category[];
  useBuddhistEra: boolean;
  isViewer: boolean;
  onSelectTask: (task: Task) => void;
  onNavigateView: (
    view: "dashboard" | "kanban" | "list" | "gantt" | "presets" | "calendar",
    categoryId?: string
  ) => void;
}

const PRIORITY_BADGE: Record<
  Task["priority"],
  { label: string; bg: string; text: string }
> = {
  urgent: {
    label: "🔥 ด่วนที่สุด (Urgent)",
    bg: "bg-red-100",
    text: "text-red-700",
  },
  high: {
    label: "⚡ สำคัญสูง (High)",
    bg: "bg-amber-100",
    text: "text-amber-800",
  },
  medium: {
    label: "📌 ปานกลาง (Medium)",
    bg: "bg-blue-50",
    text: "text-blue-700",
  },
  low: {
    label: "ทั่วไป (Low)",
    bg: "bg-slate-100",
    text: "text-slate-600",
  },
};

export default function DashboardView({
  tasks,
  categories,
  useBuddhistEra,
  onSelectTask,
  onNavigateView,
}: DashboardViewProps) {
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === "done");
  const inProgressTasks = tasks.filter((t) => t.status === "in_progress" || t.status === "waiting");
  const todoTasks = tasks.filter((t) => t.status === "todo");

  const urgentAndOverdueTasks = tasks.filter((t) => {
    if (t.status === "done") return false;
    const diff = getDaysDiffFromToday(t.due_date);
    return (diff !== null && diff <= 3) || t.priority === "urgent";
  });

  const overdueTasks = tasks.filter((t) => {
    if (t.status === "done") return false;
    const diff = getDaysDiffFromToday(t.due_date);
    return diff !== null && diff < 0;
  });

  const d3Tasks = tasks.filter((t) => {
    if (t.status === "done") return false;
    const diff = getDaysDiffFromToday(t.due_date);
    return diff !== null && diff >= 0 && diff <= 3;
  });

  const donePct = totalTasks > 0 ? Math.round((doneTasks.length / totalTasks) * 100) : 0;

  // Sort upcoming tasks so Overdue & Urgent come first
  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
  const upcomingTasks = [...tasks]
    .filter((t) => t.status !== "done")
    .sort((a, b) => {
      const diffA = getDaysDiffFromToday(a.due_date) ?? 999;
      const diffB = getDaysDiffFromToday(b.due_date) ?? 999;
      if (diffA !== diffB) return diffA - diffB;
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    })
    .slice(0, 6);

  // Category breakdown
  const catStats = categories.map((cat) => {
    const catTasks = tasks.filter((t) => t.category_id === cat.id);
    const catDone = catTasks.filter((t) => t.status === "done").length;
    const pct = totalTasks > 0 ? Math.round((catTasks.length / totalTasks) * 100) : 0;
    return {
      ...cat,
      total: catTasks.length,
      done: catDone,
      pct,
    };
  });

  return (
    <div className="flex flex-col w-full pb-12 space-y-6">
      {/* Top Executive Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <div>
          <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-50 text-primary font-label-md font-bold mb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse"></span>
            ประจำเดือน พฤศจิกายน {useBuddhistEra ? "2569" : "2026"}
          </span>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
            สรุปภาพรวมงาน HR (Dashboard)
          </h1>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => onNavigateView("kanban", "all")}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-primary-container text-white font-label-md font-bold shadow-md hover:bg-primary transition-all"
          >
            <span className="material-symbols-outlined text-xl">view_kanban</span>
            <span>เปิดกระดานงาน (Kanban)</span>
          </button>
          <button
            onClick={() => onNavigateView("list")}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-100 text-slate-800 font-label-md font-bold hover:bg-slate-200 transition-all"
          >
            <span className="material-symbols-outlined text-xl">format_list_bulleted</span>
            <span>ดูตารางงานทั้งหมด</span>
          </button>
        </div>
      </div>

      {/* 4 Big & Clear KPI Metric Cards with Hover Light Sweep & Glowing Rim */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* 1. Urgent / Overdue */}
        <div
          onClick={() => onNavigateView("kanban", "all")}
          className="card-hover-beam bg-red-50/90 rounded-3xl p-6 border-2 border-red-200 shadow-sm cursor-pointer hover:border-red-400 hover:shadow-[0_14px_30px_-6px_rgba(239,68,68,0.28)] flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-base font-bold text-red-700">
              🚨 งานด่วน / ต้องรีบทำ
            </span>
            <div className="w-11 h-11 rounded-2xl bg-red-600 text-white flex items-center justify-center shadow-sm">
              <span className="material-symbols-outlined text-2xl">priority_high</span>
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-extrabold text-red-700">
                {urgentAndOverdueTasks.length}
              </span>
              <span className="text-base font-bold text-red-600">รายการ</span>
            </div>
            <p className="text-sm font-semibold text-red-700/90 mt-2">
              เลยกำหนด {overdueTasks.length} งาน • ครบใน 3 วัน {d3Tasks.length} งาน
            </p>
          </div>
        </div>

        {/* 2. Total Tasks */}
        <div
          onClick={() => onNavigateView("list")}
          className="card-hover-beam bg-white rounded-3xl p-6 border-2 border-slate-200 shadow-sm cursor-pointer hover:border-blue-400 hover:shadow-[0_14px_30px_-6px_rgba(37,99,235,0.22)] flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-base font-bold text-slate-700">
              📋 งานทั้งหมดเดือนนี้
            </span>
            <div className="w-11 h-11 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">assignment</span>
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-extrabold text-slate-900">
                {totalTasks}
              </span>
              <span className="text-base font-semibold text-slate-600">งาน</span>
            </div>
            <p className="text-sm text-slate-500 mt-2">
              รอดำเนินการ {todoTasks.length} งาน
            </p>
          </div>
        </div>

        {/* 3. In Progress */}
        <div
          onClick={() => onNavigateView("kanban", "all")}
          className="card-hover-beam bg-white rounded-3xl p-6 border-2 border-slate-200 shadow-sm cursor-pointer hover:border-blue-500 hover:shadow-[0_14px_30px_-6px_rgba(37,99,235,0.25)] flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-base font-bold text-blue-700">
              ⏳ กำลังดำเนินการ
            </span>
            <div className="w-11 h-11 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">pending_actions</span>
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-extrabold text-slate-900">
                {inProgressTasks.length}
              </span>
              <span className="text-base font-semibold text-slate-600">งาน</span>
            </div>
            <p className="text-sm text-slate-500 mt-2">
              กำลังทำหรือรออนุมัติ
            </p>
          </div>
        </div>

        {/* 4. Completed */}
        <div
          onClick={() => onNavigateView("list")}
          className="card-hover-beam bg-white rounded-3xl p-6 border-2 border-slate-200 shadow-sm cursor-pointer hover:border-emerald-400 hover:shadow-[0_14px_30px_-6px_rgba(16,185,129,0.25)] flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-base font-bold text-emerald-700">
              ✅ เสร็จสมบูรณ์แล้ว
            </span>
            <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">check_circle</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-extrabold text-slate-900">
                  {doneTasks.length}
                </span>
                <span className="text-base font-semibold text-slate-600">งาน</span>
              </div>
              <p className="text-sm font-bold text-emerald-700 mt-2">
                สำเร็จ {donePct}% ของเดือนนี้
              </p>
            </div>
            <div className="w-14 h-14 rounded-full border-4 border-emerald-500 flex items-center justify-center text-base font-extrabold text-emerald-700">
              {donePct}%
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Split: Priority Action List (7 Cols) + Categories Breakdown (5 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT (7 Cols): งานที่ต้องทำเรียงตามความด่วนและวันครบกำหนด */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between gap-2 mb-5 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-red-600 text-2xl">
                  notifications_active
                </span>
                ลำดับงานที่ต้องทำเร็วๆ นี้ (เรียงตามความด่วน)
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                คลิกที่รายการงานเพื่อเปิดดูรายละเอียดและติ๊กเช็กลิสต์
              </p>
            </div>
            <button
              onClick={() => onNavigateView("list")}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-bold shrink-0"
            >
              ดูทั้งหมด →
            </button>
          </div>

          <div className="space-y-3.5">
            {upcomingTasks.map((task) => {
              const diff = getDaysDiffFromToday(task.due_date);
              const isOverdue = diff !== null && diff < 0;
              const isBlinkRed = diff !== null && diff <= 1; // <= 1 day, today, or overdue
              const isD3 = diff !== null && diff >= 0 && diff <= 3;
              const pInfo = PRIORITY_BADGE[task.priority];

              return (
                <div
                  key={task.id}
                  onClick={() => onSelectTask(task)}
                  className={`card-hover-beam p-4 rounded-2xl border-l-8 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isBlinkRed
                      ? "bg-red-50/90 border-l-red-600 border-2 border-red-300 ring-2 ring-red-400/50 hover:bg-red-50 hover:shadow-[0_10px_24px_-6px_rgba(239,68,68,0.25)]"
                      : isOverdue
                      ? "bg-red-50/70 border-l-red-600 border border-red-200 hover:bg-red-50"
                      : isD3 || task.priority === "urgent"
                      ? "bg-amber-50/60 border-l-amber-500 border border-amber-200 hover:bg-amber-50 hover:shadow-[0_10px_24px_-6px_rgba(245,158,11,0.22)]"
                      : "bg-slate-50/80 border-l-blue-600 border border-slate-200 hover:bg-blue-50/40 hover:border-blue-300 hover:shadow-[0_10px_24px_-6px_rgba(37,99,235,0.18)]"
                  }`}
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    {/* Top Badges: Due status + Priority + Category */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-3 py-1 rounded-lg text-sm font-extrabold inline-flex items-center gap-2 ${
                          isBlinkRed
                            ? "bg-red-600 text-white animate-pulse shadow-sm"
                            : isD3
                            ? "bg-amber-500 text-slate-950"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {isBlinkRed && (
                          <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-90"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
                          </span>
                        )}
                        <span>
                          {diff === null
                            ? "ไม่ระบุวัน"
                            : diff < 0
                            ? `🚨 เลยกำหนด ${Math.abs(diff)} วัน!`
                            : diff === 0
                            ? "🚨 ครบกำหนดวันนี้!"
                            : diff === 1
                            ? "🚨 ครบพรุ่งนี้ (เหลือ 1 วัน)!"
                            : `อีก ${diff} วัน (${formatThaiDate(task.due_date, useBuddhistEra)})`}
                        </span>
                      </span>

                      <span
                        className={`px-3 py-1 rounded-lg text-sm font-bold ${pInfo.bg} ${pInfo.text}`}
                      >
                        {pInfo.label}
                      </span>

                      {task.category && (
                        <span
                          className="px-3 py-1 rounded-lg text-sm font-bold"
                          style={{
                            backgroundColor: `${task.category.color}18`,
                            color: task.category.color,
                          }}
                        >
                          {task.category.name}
                        </span>
                      )}
                    </div>

                    {/* Big Task Title */}
                    <div className="text-lg font-bold text-slate-900 leading-snug">
                      {task.title}
                    </div>

                    {/* Checklist summary */}
                    {(task.checklist_items?.length || 0) > 0 && (
                      <div className="text-sm text-slate-600 flex items-center gap-4">
                        <span>
                          ☑️ เช็กลิสต์:{" "}
                          <strong>
                            {task.checklist_items?.filter((i) => i.is_done).length}/
                            {task.checklist_items?.length} ข้อ
                          </strong>
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="shrink-0">
                    <span className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-bold inline-flex items-center gap-1 shadow-sm">
                      <span>เปิดดูงาน</span>
                      <span className="material-symbols-outlined text-base">chevron_right</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT (5 Cols): หมวดหมู่งาน HR */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
            <h2 className="text-xl font-bold text-slate-900 mb-1 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-2xl">pie_chart</span>
              ความคืบหน้าแยกตามหมวดหมู่งาน HR
            </h2>
            <p className="text-sm text-slate-600 mb-4">
              คลิกที่หมวดหมู่ใด ระบบจะเปิดหน้ากระดาน Kanban เฉพาะหมวดหมู่นั้นทันที
            </p>

            <div className="space-y-3.5">
              {catStats.map((cat) => {
                const doneRatio = cat.total > 0 ? Math.round((cat.done / cat.total) * 100) : 0;
                return (
                  <div
                    key={cat.id}
                    onClick={() => onNavigateView("kanban", cat.id)}
                    style={
                      {
                        "--cat-color": cat.color,
                      } as React.CSSProperties
                    }
                    className="card-hover-beam group p-4 rounded-2xl bg-slate-50 hover:bg-white border-2 border-slate-200/80 hover:border-blue-400 hover:shadow-[0_12px_28px_-6px_rgba(37,99,235,0.22)] transition-all cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0 group-hover:scale-125 transition-transform"
                          style={{ backgroundColor: cat.color }}
                        ></span>
                        <span className="text-base font-bold text-slate-900 group-hover:text-primary transition-colors">
                          {cat.name}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-slate-700 flex items-center gap-1">
                        <span>
                          เสร็จ {cat.done} / {cat.total} งาน ({doneRatio}%)
                        </span>
                        <span className="material-symbols-outlined text-base text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                          arrow_forward
                        </span>
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${doneRatio}%`,
                          backgroundColor: cat.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
