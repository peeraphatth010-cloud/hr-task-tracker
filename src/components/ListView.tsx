"use client";

import React, { useState } from "react";
import { Category, Task, TaskStatus } from "@/lib/types";
import { formatThaiDate, getDaysDiffFromToday } from "@/lib/excel-export";

interface ListViewProps {
  tasks: Task[];
  categories: Category[];
  useBuddhistEra: boolean;
  isViewer: boolean;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onBulkUpdate: (taskIds: string[], patch: Partial<Task>) => void;
  onDeleteTask: (taskId: string) => void;
  onBulkDelete: (taskIds: string[]) => void;
  onSelectTask: (task: Task) => void;
}

const PRIORITY_BADGE: Record<
  Task["priority"],
  { label: string; badgeClass: string }
> = {
  urgent: {
    label: "🔥 ด่วนที่สุด (Urgent)",
    badgeClass: "bg-red-600 text-white",
  },
  high: {
    label: "⚡ สำคัญสูง (High)",
    badgeClass: "bg-amber-500 text-slate-950",
  },
  medium: {
    label: "📌 ปานกลาง",
    badgeClass: "bg-blue-100 text-blue-800",
  },
  low: {
    label: "ทั่วไป",
    badgeClass: "bg-slate-100 text-slate-700",
  },
};

export default function ListView({
  tasks,
  categories,
  useBuddhistEra,
  isViewer,
  onStatusChange,
  onBulkUpdate,
  onDeleteTask,
  onBulkDelete,
  onSelectTask,
}: ListViewProps) {
  const [selectedCatId, setSelectedCatId] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tableSearch, setTableSearch] = useState<string>("");
  const [sortBy, setSortBy] = useState<"priority" | "due_date" | "title" | "status">("priority");
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const inProgressCount = tasks.filter(
    (t) => t.status === "in_progress" || t.status === "waiting" || t.status === "todo"
  ).length;
  const doneCount = tasks.filter((t) => t.status === "done").length;
  const urgentCount = tasks.filter(
    (t) => t.priority === "urgent" || t.priority === "high"
  ).length;

  const filtered = tasks
    .filter((t) => {
      if (selectedCatId !== "all" && t.category_id !== selectedCatId) return false;
      if (statusFilter === "active" && t.status === "done") return false;
      if (statusFilter === "done" && t.status !== "done") return false;
      if (statusFilter === "urgent" && t.priority !== "urgent" && t.priority !== "high")
        return false;
      if (tableSearch.trim()) {
        const q = tableSearch.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchCode = (t.code || "").toLowerCase().includes(q);
        const matchDesc = (t.description || "").toLowerCase().includes(q);
        if (!matchTitle && !matchCode && !matchDesc) return false;
      }
      return true;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortBy === "priority") {
        const rank = { urgent: 1, high: 2, medium: 3, low: 4 };
        cmp = rank[a.priority] - rank[b.priority];
        if (cmp === 0) {
          cmp = (a.due_date || "9999").localeCompare(b.due_date || "9999");
        }
      } else if (sortBy === "due_date") {
        cmp = (a.due_date || "9999").localeCompare(b.due_date || "9999");
      } else if (sortBy === "title") {
        cmp = a.title.localeCompare(b.title);
      } else if (sortBy === "status") {
        cmp = a.status.localeCompare(b.status);
      }
      return sortAsc ? cmp : -cmp;
    });

  const toggleSort = (col: "priority" | "due_date" | "title" | "status") => {
    if (sortBy === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(col);
      setSortAsc(true);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((t) => t.id)));
    }
  };

  const toggleSelectRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  return (
    <div className="flex flex-col w-full pb-12 space-y-5">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
            ตารางรายการงานทั้งหมด (List View)
          </h1>
          <p className="text-base text-slate-600">
            แสดงรายการงานทั้งหมด {tasks.length} งาน • คลิกที่ชื่องานเพื่อเปิดดูรายละเอียดและเช็กลิสต์
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Quick Status Filter Tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { id: "all", label: `ทั้งหมด (${tasks.length})` },
            { id: "urgent", label: `🔥 งานด่วน/สำคัญสูง (${urgentCount})` },
            { id: "active", label: `⏳ กำลังทำ (${inProgressCount})` },
            { id: "done", label: `✅ เสร็จแล้ว (${doneCount})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-4 py-2.5 rounded-2xl text-sm font-bold transition-all ${
                statusFilter === tab.id
                  ? "bg-primary-container text-white shadow-sm"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Category Dropdown & Search */}
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={selectedCatId}
            onChange={(e) => setSelectedCatId(e.target.value)}
            className="px-4 py-2.5 rounded-2xl bg-slate-100 text-slate-800 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">ทุกหมวดหมู่ HR</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <input
            type="text"
            value={tableSearch}
            onChange={(e) => setTableSearch(e.target.value)}
            placeholder="ค้นหาชื่องานในตาราง..."
            className="px-4 py-2.5 rounded-2xl bg-slate-100 text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary min-w-[220px]"
          />
        </div>
      </div>

      {/* Bulk Action Bar when rows are selected */}
      {!isViewer && selectedIds.size > 0 && (
        <div className="bg-blue-900 text-white rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3 shadow-md">
          <span className="text-base font-bold">
            ☑️ เลือกไว้ {selectedIds.size} รายการ:
          </span>
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => {
                onBulkUpdate(Array.from(selectedIds), {
                  status: "in_progress",
                });
                setSelectedIds(new Set());
              }}
              className="px-4 py-2 rounded-xl bg-white/15 text-white text-sm font-bold hover:bg-white/25"
            >
              เปลี่ยนเป็น กำลังทำ
            </button>
            <button
              onClick={() => {
                onBulkUpdate(Array.from(selectedIds), {
                  status: "done",
                  completed_at: new Date().toISOString(),
                });
                setSelectedIds(new Set());
              }}
              className="px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-extrabold hover:bg-emerald-600"
            >
              ✓ เปลี่ยนสถานะเป็น เสร็จสมบูรณ์
            </button>
            <button
              onClick={() => {
                if (
                  window.confirm(
                    `ต้องการลบงานที่เลือกทั้ง ${selectedIds.size} รายการใช่หรือไม่?`
                  )
                ) {
                  onBulkDelete(Array.from(selectedIds));
                  setSelectedIds(new Set());
                }
              }}
              className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-extrabold hover:bg-red-700"
            >
              🗑️ ลบงานที่เลือก ({selectedIds.size})
            </button>
          </div>
        </div>
      )}

      {/* High-Readability Master Table */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[820px]">
          <thead>
            <tr className="border-b-2 border-slate-200 text-slate-700 text-sm font-extrabold">
              <th className="py-4 px-3 w-12">
                <input
                  type="checkbox"
                  disabled={isViewer}
                  checked={filtered.length > 0 && selectedIds.size === filtered.length}
                  onChange={toggleSelectAll}
                  className="w-5 h-5 rounded accent-primary cursor-pointer"
                />
              </th>
              <th
                onClick={() => toggleSort("priority")}
                className="py-4 px-3 w-44 cursor-pointer hover:text-primary"
              >
                ความสำคัญ {sortBy === "priority" && (sortAsc ? "↑" : "↓")}
              </th>
              <th
                onClick={() => toggleSort("title")}
                className="py-4 px-3 cursor-pointer hover:text-primary"
              >
                ชื่องาน (คลิกเพื่อดูรายละเอียด) {sortBy === "title" && (sortAsc ? "↑" : "↓")}
              </th>
              <th className="py-4 px-3 w-48">หมวดหมู่</th>
              <th
                onClick={() => toggleSort("status")}
                className="py-4 px-3 w-48 cursor-pointer hover:text-primary"
              >
                สถานะ {sortBy === "status" && (sortAsc ? "↑" : "↓")}
              </th>
              <th
                onClick={() => toggleSort("due_date")}
                className="py-4 px-3 w-44 cursor-pointer hover:text-primary"
              >
                วันครบกำหนด {sortBy === "due_date" && (sortAsc ? "↑" : "↓")}
              </th>
              <th className="py-4 px-3 w-36 text-right">ความคืบหน้า</th>
              <th className="py-4 px-3 w-16 text-center">ลบ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/80">
            {filtered.map((task) => {
              const isDone = task.status === "done";
              const diff = getDaysDiffFromToday(task.due_date);
              const isOverdue = !isDone && diff !== null && diff < 0;
              const isBlinkRed = !isDone && diff !== null && diff <= 1; // <= 1 day, today, or overdue
              const isD3 = !isDone && diff !== null && diff >= 0 && diff <= 3;

              const items = task.checklist_items || [];
              const doneItems = items.filter((i) => i.is_done).length;
              const pct =
                items.length > 0
                  ? Math.round((doneItems / items.length) * 100)
                  : isDone
                  ? 100
                  : 0;

              const pInfo = PRIORITY_BADGE[task.priority];

              return (
                <tr
                  key={task.id}
                  className={`transition-colors ${
                    isBlinkRed
                      ? "bg-red-50/60 hover:bg-red-50"
                      : isDone
                      ? "bg-emerald-50/20 hover:bg-emerald-50/40"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <td className="py-4 px-3">
                    <input
                      type="checkbox"
                      disabled={isViewer}
                      checked={selectedIds.has(task.id)}
                      onChange={() => toggleSelectRow(task.id)}
                      className="w-5 h-5 rounded accent-primary cursor-pointer"
                    />
                  </td>

                  {/* Priority Badge */}
                  <td className="py-4 px-3">
                    {isDone ? (
                      <span className="px-3 py-1.5 rounded-xl text-sm font-extrabold inline-block bg-emerald-100 text-emerald-800">
                        ✅ เสร็จแล้ว
                      </span>
                    ) : (
                      <span
                        className={`px-3 py-1.5 rounded-xl text-sm font-extrabold inline-block ${pInfo.badgeClass}`}
                      >
                        {pInfo.label}
                      </span>
                    )}
                  </td>

                  {/* Task Title & Description */}
                  <td
                    onClick={() => onSelectTask(task)}
                    className="py-4 px-3 cursor-pointer"
                  >
                    <div className="text-lg font-extrabold text-slate-900 hover:text-primary transition-colors">
                      {task.title}
                    </div>
                    {task.description && (
                      <div className="text-sm text-slate-600 mt-0.5 line-clamp-1">
                        {task.description}
                      </div>
                    )}
                  </td>

                  {/* Category */}
                  <td className="py-4 px-3">
                    {task.category ? (
                      <span
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold"
                        style={{
                          backgroundColor: `${task.category.color}18`,
                          color: task.category.color,
                        }}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: task.category.color }}
                        ></span>
                        {task.category.name}
                      </span>
                    ) : (
                      <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-sm font-bold">
                        ทั่วไป
                      </span>
                    )}
                  </td>

                  {/* Inline Status Selector */}
                  <td className="py-4 px-3">
                    <select
                      disabled={isViewer}
                      value={task.status}
                      onChange={(e) =>
                        onStatusChange(task.id, e.target.value as TaskStatus)
                      }
                      className={`px-3.5 py-2 rounded-xl text-sm font-extrabold cursor-pointer border focus:outline-none ${
                        task.status === "done"
                          ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                          : task.status === "in_progress"
                          ? "bg-blue-100 text-blue-900 border-blue-300"
                          : task.status === "waiting"
                          ? "bg-amber-100 text-amber-900 border-amber-300"
                          : "bg-slate-100 text-slate-800 border-slate-300"
                      }`}
                    >
                      <option value="todo">รอดำเนินการ (To Do)</option>
                      <option value="in_progress">กำลังทำ (In Progress)</option>
                      <option value="waiting">รออนุมัติ (Waiting)</option>
                      <option value="done">✓ เสร็จสมบูรณ์ (Done)</option>
                    </select>
                  </td>

                  {/* Due Date */}
                  <td className="py-4 px-3">
                    <div
                      className={`text-base font-extrabold ${
                        isOverdue
                          ? "text-red-700"
                          : isD3
                          ? "text-amber-800"
                          : "text-slate-900"
                      }`}
                    >
                      {formatThaiDate(task.due_date, useBuddhistEra)}
                    </div>
                    {!isDone && diff !== null && (
                      <div className="mt-1">
                        {isBlinkRed ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-600 text-white text-xs font-extrabold animate-pulse shadow-sm">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-90"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                            </span>
                            <span>
                              {diff < 0
                                ? `เลยกำหนด ${Math.abs(diff)} วัน!`
                                : diff === 0
                                ? "ครบกำหนดวันนี้!"
                                : "เหลืออีก 1 วัน!"}
                            </span>
                          </span>
                        ) : (
                          <span
                            className={`text-sm font-bold ${
                              isD3 ? "text-amber-700" : "text-slate-500"
                            }`}
                          >
                            {`อีก ${diff} วัน`}
                          </span>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Checklist Progress */}
                  <td className="py-4 px-3 text-right">
                    <div className="inline-flex flex-col items-end w-28">
                      <span className="text-sm font-extrabold text-slate-800 mb-1">
                        {items.length > 0
                          ? `${doneItems}/${items.length} ข้อ (${pct}%)`
                          : `${pct}%`}
                      </span>
                      <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            task.status === "done" ? "bg-emerald-600" : "bg-blue-600"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* Delete Button */}
                  <td className="py-4 px-3 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`ต้องการลบงาน "${task.title}" ใช่หรือไม่?`)) {
                          onDeleteTask(task.id);
                        }
                      }}
                      title="ลบงานนี้"
                      className="w-8 h-8 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 inline-flex items-center justify-center transition-colors"
                    >
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
