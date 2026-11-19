"use client";

import React, { useState } from "react";
import { Category, Task, TaskDependency } from "@/lib/types";
import { formatThaiDate, getDaysDiffFromToday } from "@/lib/excel-export";

interface GanttViewProps {
  tasks: Task[];
  categories: Category[];
  dependencies: TaskDependency[];
  useBuddhistEra: boolean;
  isViewer: boolean;
  onSelectTask: (task: Task) => void;
  onAddDependency: (taskId: string, dependsOnId: string) => Promise<void>;
  onRemoveDependency: (taskId: string, dependsOnId: string) => Promise<void>;
}

const THAI_MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

export default function GanttView({
  tasks,
  categories,
  dependencies,
  useBuddhistEra,
  onSelectTask,
  onAddDependency,
  onRemoveDependency,
}: GanttViewProps) {
  const [selectedCatId, setSelectedCatId] = useState<string>("all");
  const [hideDone, setHideDone] = useState<boolean>(false);
  const [collapseCategories, setCollapseCategories] = useState<Record<string, boolean>>({});
  const [showDepModal, setShowDepModal] = useState<boolean>(false);
  const [depSourceId, setDepSourceId] = useState<string>("");
  const [depTargetId, setDepTargetId] = useState<string>("");

  const year = 2026;
  const month = 11; // November
  const daysInMonth = 30;
  const todayDay = 19; // Nov 19, 2026

  const priorityRank = { urgent: 0, high: 1, medium: 2, low: 3 };

  const filteredTasks = tasks
    .filter((t) => {
      if (selectedCatId !== "all" && t.category_id !== selectedCatId) return false;
      if (hideDone && t.status === "done") return false;
      return true;
    })
    .sort((a, b) => {
      const startA = a.start_date || a.due_date || "9999";
      const startB = b.start_date || b.due_date || "9999";
      if (startA !== startB) return startA.localeCompare(startB);
      return priorityRank[a.priority] - priorityRank[b.priority];
    });

  const groupedSections = categories
    .map((cat) => ({
      id: cat.id,
      name: cat.name,
      color: cat.color,
      items: filteredTasks.filter((t) => t.category_id === cat.id),
    }))
    .filter((g) => g.items.length > 0);

  const getDayOfMonth = (dateStr: string | null): number => {
    if (!dateStr) return todayDay;
    const parts = dateStr.split("-").map(Number);
    if (parts.length !== 3) return todayDay;
    if (parts[1] < month) return 1;
    if (parts[1] > month) return daysInMonth;
    return Math.min(Math.max(parts[2], 1), daysInMonth);
  };

  const toggleCategoryCollapse = (catId: string) => {
    setCollapseCategories((prev) => ({
      ...prev,
      [catId]: !prev[catId],
    }));
  };

  const handleCreateDep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!depSourceId || !depTargetId || depSourceId === depTargetId) return;
    await onAddDependency(depTargetId, depSourceId);
    setShowDepModal(false);
    setDepSourceId("");
    setDepTargetId("");
  };

  return (
    <div className="flex flex-col w-full pb-12 space-y-5">
      {/* Top Header & Quick Filters */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-3 py-1 rounded-xl bg-blue-50 text-primary text-xs font-extrabold">
              📅 {THAI_MONTHS[month - 1]} {useBuddhistEra ? year + 543 : year}
            </span>
            <span className="px-3 py-1 rounded-xl bg-blue-600 text-white text-xs font-extrabold">
              วันนี้: วันที่ {todayDay} พ.ย.
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
            แผนผังเวลาและลำดับงาน (Timeline & Gantt Chart)
          </h1>
          <p className="text-base text-slate-600 mt-0.5">
            แสดงช่วงเวลาเริ่มงานถึงวันครบกำหนด • คลิกที่แถบงานเพื่อเปิดดูรายละเอียดและปรับวันที่ได้ทันที
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={selectedCatId}
            onChange={(e) => setSelectedCatId(e.target.value)}
            className="px-4 py-2.5 rounded-2xl bg-slate-100 text-slate-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">ทุกหมวดหมู่ ({tasks.length} งาน)</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setHideDone(!hideDone)}
            className={`px-4 py-2.5 rounded-2xl text-sm font-bold border transition-all ${
              hideDone
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
            }`}
          >
            {hideDone ? "👁️ แสดงงานที่เสร็จแล้วด้วย" : "ซ่อนงานที่เสร็จแล้ว"}
          </button>

          <button
            type="button"
            onClick={() => setShowDepModal(true)}
            className="px-4 py-2.5 rounded-2xl bg-primary-container hover:bg-primary text-white text-sm font-bold shadow-sm flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-lg">add_link</span>
            <span>+ เชื่อมลำดับงานก่อน-หลัง</span>
          </button>
        </div>
      </div>

      {/* Main Gantt Chart Table Card */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
        <div className="overflow-x-auto">
          <div className="min-w-[1120px]">
            {/* ================================================================= */}
            {/* STICKY TIMELINE HEADER (1 - 30 Horizontal Row!)                   */}
            {/* ================================================================= */}
            <div className="grid grid-cols-12 border-b-2 border-slate-200 pb-3 mb-3 items-end">
              {/* Left Column Header (Span 4) */}
              <div className="col-span-4 px-3 flex items-center justify-between text-sm font-extrabold text-slate-700">
                <span>ชื่องานและช่วงเวลา (TASK & DATES)</span>
                <span>สถานะ</span>
              </div>

              {/* Right Column Timeline Axis (Span 8) */}
              <div className="col-span-8">
                {/* 4 Weeks Header */}
                <div className="grid grid-cols-4 gap-1 text-center text-xs font-extrabold mb-2">
                  <div className="bg-slate-100 text-slate-700 py-1.5 rounded-l-xl">
                    สัปดาห์ที่ 1 (1 – 7 พ.ย.)
                  </div>
                  <div className="bg-slate-100/70 text-slate-700 py-1.5">
                    สัปดาห์ที่ 2 (8 – 14 พ.ย.)
                  </div>
                  <div className="bg-blue-100 text-blue-900 py-1.5 ring-1 ring-blue-300">
                    สัปดาห์ปัจจุบัน (15 – 21 พ.ย.)
                  </div>
                  <div className="bg-slate-100 text-slate-700 py-1.5 rounded-r-xl">
                    สัปดาห์ที่ 4 (22 – 30 พ.ย.)
                  </div>
                </div>

                {/* 30 Days Horizontal Strip — FIXED: flex flex-row w-full */}
                <div className="flex flex-row items-center w-full border-t border-slate-100 pt-1.5">
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
                    const isToday = d === todayDay;
                    const isWeekend = d % 7 === 0 || d % 7 === 1;
                    return (
                      <div
                        key={d}
                        style={{ width: `${100 / daysInMonth}%` }}
                        className="flex justify-center"
                      >
                        <span
                          className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-extrabold ${
                            isToday
                              ? "bg-blue-600 text-white shadow-sm ring-2 ring-blue-300"
                              : isWeekend
                              ? "text-slate-400"
                              : "text-slate-700"
                          }`}
                        >
                          {d}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ================================================================= */}
            {/* GROUPED TASK ROWS + VERTICAL GRID LINES                           */}
            {/* ================================================================= */}
            <div className="space-y-4">
              {groupedSections.map((group) => {
                const isCollapsed = Boolean(collapseCategories[group.id]);

                return (
                  <div
                    key={group.id}
                    className="rounded-2xl border border-slate-200/80 overflow-hidden"
                  >
                    {/* Category Group Header (Clickable to collapse/expand) */}
                    <button
                      type="button"
                      onClick={() => toggleCategoryCollapse(group.id)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-slate-100/90 hover:bg-slate-200/70 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="material-symbols-outlined text-slate-600 text-xl">
                          {isCollapsed ? "expand_more" : "expand_less"}
                        </span>
                        <span
                          className="w-3.5 h-3.5 rounded-full"
                          style={{ backgroundColor: group.color }}
                        ></span>
                        <span className="text-base font-extrabold text-slate-900">
                          {group.name}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full bg-white text-slate-800 text-xs font-extrabold shadow-sm">
                          {group.items.length} งาน
                        </span>
                      </div>
                      <span className="text-xs font-bold text-slate-500">
                        {isCollapsed ? "คลิกเพื่อกางดูงาน" : "คลิกเพื่อย่อหมวดนี้"}
                      </span>
                    </button>

                    {/* Tasks inside Category */}
                    {!isCollapsed && (
                      <div className="divide-y divide-slate-100 bg-white">
                        {group.items.map((task) => {
                          const isDone = task.status === "done";
                          const startDay = getDayOfMonth(task.start_date || task.due_date);
                          const endDay = Math.max(startDay, getDayOfMonth(task.due_date));
                          const durationDays = endDay - startDay + 1;

                          const leftPct = ((startDay - 1) / daysInMonth) * 100;
                          const widthPct = Math.max((durationDays / daysInMonth) * 100, 3.33);

                          const items = task.checklist_items || [];
                          const doneItems = items.filter((i) => i.is_done).length;
                          const pct =
                            items.length > 0
                              ? Math.round((doneItems / items.length) * 100)
                              : isDone
                              ? 100
                              : 0;

                          const taskDeps = dependencies.filter((d) => d.task_id === task.id);
                          const prereqTitles = taskDeps
                            .map(
                              (d) =>
                                tasks.find((t) => t.id === d.depends_on_id)?.title || "งานก่อนหน้า"
                            )
                            .join(", ");

                          const diff = getDaysDiffFromToday(task.due_date);
                          const isOverdue = !isDone && diff !== null && diff < 0;
                          const isBlinkRed = !isDone && diff !== null && diff <= 1;

                          return (
                            <div
                              key={task.id}
                              onClick={() => onSelectTask(task)}
                              className={`grid grid-cols-12 items-center py-3 transition-colors cursor-pointer ${
                                isBlinkRed
                                  ? "bg-red-50/40 hover:bg-red-50/80"
                                  : isDone
                                  ? "bg-emerald-50/20 hover:bg-emerald-50/40"
                                  : "hover:bg-slate-50"
                              }`}
                            >
                              {/* Left Task Metadata (Span 4) */}
                              <div className="col-span-4 px-4 flex items-center justify-between gap-3 border-r border-slate-100">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    {isBlinkRed && (
                                      <span className="relative flex h-2.5 w-2.5 shrink-0">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-600 opacity-90"></span>
                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
                                      </span>
                                    )}
                                    <span
                                      className={`text-base font-extrabold truncate ${
                                        isDone
                                          ? "text-slate-500 line-through"
                                          : "text-slate-900"
                                      }`}
                                    >
                                      {task.title}
                                    </span>
                                  </div>

                                  <div className="text-xs font-semibold text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                                    <span>
                                      📅 {startDay} – {endDay} พ.ย. ({durationDays} วัน)
                                    </span>
                                    {taskDeps.length > 0 && (
                                      <span
                                        className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-bold truncate max-w-[190px]"
                                        title={`ทำต่อจาก: ${prereqTitles}`}
                                      >
                                        🔗 ต่อจาก: {prereqTitles}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Clear Status Badge */}
                                <span
                                  className={`px-2.5 py-1 rounded-xl text-xs font-extrabold shrink-0 ${
                                    isDone
                                      ? "bg-emerald-100 text-emerald-800"
                                      : isBlinkRed
                                      ? "bg-red-600 text-white animate-pulse"
                                      : task.status === "in_progress"
                                      ? "bg-blue-100 text-blue-800"
                                      : task.status === "waiting"
                                      ? "bg-amber-100 text-amber-900"
                                      : "bg-slate-100 text-slate-700"
                                  }`}
                                >
                                  {isDone
                                    ? "✓ เสร็จแล้ว"
                                    : isOverdue
                                    ? `เลย ${Math.abs(diff!)} วัน!`
                                    : diff === 0
                                    ? "วันนี้!"
                                    : diff === 1
                                    ? "พรุ่งนี้!"
                                    : task.status === "in_progress"
                                    ? "กำลังทำ"
                                    : task.status === "waiting"
                                    ? "รออนุมัติ"
                                    : "รอดำเนินการ"}
                                </span>
                              </div>

                              {/* Right Timeline Bar Track (Span 8) */}
                              <div className="col-span-8 relative h-11 flex items-center">
                                {/* Background 30-day vertical grid cells for easy visual alignment */}
                                <div className="absolute inset-0 flex flex-row pointer-events-none">
                                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(
                                    (d) => (
                                      <div
                                        key={d}
                                        style={{ width: `${100 / daysInMonth}%` }}
                                        className={`h-full border-r border-slate-100 ${
                                          d === todayDay
                                            ? "bg-blue-50/70"
                                            : d % 7 === 0 || d % 7 === 1
                                            ? "bg-slate-50/50"
                                            : ""
                                        }`}
                                      />
                                    )
                                  )}
                                </div>

                                {/* Today Vertical Highlight Line */}
                                <div
                                  style={{
                                    left: `${((todayDay - 0.5) / daysInMonth) * 100}%`,
                                  }}
                                  className="absolute top-0 bottom-0 w-0.5 bg-blue-600 z-10 pointer-events-none"
                                  title="วันนี้ (19 พ.ย.)"
                                />

                                {/* Dashed Dependency Arrow before bar */}
                                {taskDeps.length > 0 && (
                                  <div
                                    style={{
                                      left: `${Math.max(0, leftPct - 4)}%`,
                                      width: "4%",
                                    }}
                                    className="absolute h-0.5 border-t-2 border-dashed border-amber-600 z-10 flex items-center justify-end"
                                  >
                                    <span className="w-2 h-2 rotate-45 border-t-2 border-r-2 border-amber-600 -mr-1"></span>
                                  </div>
                                )}

                                {/* Task Duration Bar */}
                                <div
                                  style={{
                                    left: `${leftPct}%`,
                                    width: `${widthPct}%`,
                                  }}
                                  className={`absolute z-20 h-8 rounded-xl px-3 flex items-center justify-between text-xs font-extrabold shadow-sm transition-transform hover:scale-[1.01] overflow-hidden ${
                                    isDone
                                      ? "bg-emerald-500 text-white"
                                      : isBlinkRed
                                      ? "bg-red-600 text-white ring-2 ring-red-300"
                                      : task.priority === "urgent"
                                      ? "bg-red-500 text-white"
                                      : task.priority === "high"
                                      ? "bg-amber-500 text-slate-950"
                                      : "bg-blue-600 text-white"
                                  }`}
                                  title={`${task.title} (${startDay} - ${endDay} พ.ย.)`}
                                >
                                  {/* Progress Fill Overlay */}
                                  {!isDone && pct > 0 && (
                                    <div
                                      style={{ width: `${pct}%` }}
                                      className="absolute left-0 top-0 bottom-0 bg-black/20 pointer-events-none"
                                    />
                                  )}
                                  <span className="relative z-10 truncate">
                                    {startDay === endDay
                                      ? `${startDay} พ.ย.`
                                      : `${startDay}–${endDay} พ.ย.`}
                                    {widthPct > 14 ? ` • ${task.title}` : ""}
                                  </span>
                                  {widthPct > 8 && (
                                    <span className="relative z-10 ml-1 shrink-0">
                                      {pct}%
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Simple Legend & Active Dependencies List */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-5 mt-5 border-t border-slate-200 text-xs font-bold text-slate-600">
          <div className="flex items-center gap-5 flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-md bg-red-600"></span>
              งานด่วนที่สุด / ใกล้เดดไลน์
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-md bg-amber-500"></span>
              งานสำคัญสูง (High)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-md bg-blue-600"></span>
              งานปกติ (กำลังดำเนินการ)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-md bg-emerald-500"></span>
              เสร็จสมบูรณ์แล้ว (Done)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-0.5 h-4 bg-blue-600 inline-block"></span>
              เส้นวันนี้ (19 พ.ย.)
            </span>
          </div>

          {dependencies.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span>ลำดับงานที่เชื่อมไว้ ({dependencies.length}):</span>
              {dependencies.map((d) => {
                const fromT = tasks.find((t) => t.id === d.depends_on_id);
                const toT = tasks.find((t) => t.id === d.task_id);
                if (!fromT || !toT) return null;
                return (
                  <span
                    key={`${d.depends_on_id}-${d.task_id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 text-slate-800 font-bold"
                  >
                    <span className="truncate max-w-[110px]">{fromT.title}</span>
                    <span>→</span>
                    <span className="truncate max-w-[110px]">{toT.title}</span>
                    <button
                      onClick={() => onRemoveDependency(d.task_id, d.depends_on_id)}
                      className="text-red-600 hover:opacity-75 ml-1 font-extrabold"
                      title="ลบการเชื่อมลำดับงานนี้"
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Create Dependency Modal */}
      {showDepModal && (
        <div
          onClick={() => setShowDepModal(false)}
          className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-surface-container-lowest rounded-3xl p-6 max-w-md w-full shadow-2xl border border-white cursor-default"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-slate-900">
                เชื่อมลำดับงานก่อน-หลัง (Finish-to-Start)
              </h3>
              <button
                onClick={() => setShowDepModal(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateDep} className="space-y-4">
              <div>
                <label className="text-sm font-bold text-slate-700 block mb-1">
                  1. งานที่ต้องทำเสร็จก่อน (งานต้นทาง)
                </label>
                <select
                  required
                  value={depSourceId}
                  onChange={(e) => setDepSourceId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-100 text-slate-900 text-base font-medium"
                >
                  <option value="">-- เลือกงานต้นทาง --</option>
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-bold text-slate-700 block mb-1">
                  2. งานที่ทำต่อเมื่อข้อ 1 เสร็จ (งานถัดไป)
                </label>
                <select
                  required
                  value={depTargetId}
                  onChange={(e) => setDepTargetId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-100 text-slate-900 text-base font-medium"
                >
                  <option value="">-- เลือกงานถัดไป --</option>
                  {tasks
                    .filter((t) => t.id !== depSourceId)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDepModal(false)}
                  className="px-4 py-2 rounded-full bg-slate-100 text-sm font-bold"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-full bg-primary-container text-white text-sm font-bold shadow-md"
                >
                  บันทึกการเชื่อมงาน
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
