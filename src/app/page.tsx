"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  Category,
  Preset,
  Task,
  TaskDependency,
  TaskStatus,
} from "@/lib/types";
import { getDaysDiffFromToday } from "@/lib/excel-export";
import DashboardView from "@/components/DashboardView";
import KanbanView from "@/components/KanbanView";
import ListView from "@/components/ListView";
import GanttView from "@/components/GanttView";
import PresetsView from "@/components/PresetsView";
import CalendarView from "@/components/CalendarView";
import TaskDrawer from "@/components/TaskDrawer";

type ActiveView = "dashboard" | "kanban" | "list" | "gantt" | "presets" | "calendar";

export default function HomePage() {
  const [activeView, setActiveView] = useState<ActiveView>("dashboard");
  const [kanbanCategoryId, setKanbanCategoryId] = useState<string>("all");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [dependencies, setDependencies] = useState<TaskDependency[]>([]);
  // initialLoading is ONLY true on the very first page open, so child views never unmount or reset filters!
  const [initialLoading, setInitialLoading] = useState<boolean>(true);

  const [useBuddhistEra, setUseBuddhistEra] = useState<boolean>(true);
  const [globalSearch, setGlobalSearch] = useState<string>("");

  // Active Modals / Drawers
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [presetQuickModalOpen, setPresetQuickModalOpen] = useState<boolean>(false);

  // Single-task Time Tracker State
  const [activeTimerTaskId, setActiveTimerTaskId] = useState<string | null>(null);
  const [timerStartTime, setTimerStartTime] = useState<number | null>(null);

  // Background silent refresh (never sets initialLoading back to true!)
  const fetchAllData = useCallback(async () => {
    try {
      const [catsRes, presetsRes, tasksRes, depsRes] = await Promise.all([
        supabase.from("categories").select("*").order("sort_order", { ascending: true }),
        supabase.from("presets").select("*").order("created_at", { ascending: true }),
        supabase
          .from("tasks")
          .select("*, checklist_items(*), comments(*), attachments(*), time_entries(*)")
          .order("position", { ascending: true }),
        supabase.from("task_dependencies").select("*"),
      ]);

      const cats = (catsRes.data || []) as Category[];
      const catMap = new Map(cats.map((c) => [c.id, c]));

      const enrichedTasks = ((tasksRes.data || []) as Task[]).map((t) => ({
        ...t,
        category: t.category_id ? catMap.get(t.category_id) : undefined,
        checklist_items: (t.checklist_items || []).sort(
          (a, b) => (a.sort_order || 0) - (b.sort_order || 0)
        ),
        comments: (t.comments || []).sort((a, b) =>
          (b.created_at || "").localeCompare(a.created_at || "")
        ),
      }));

      setCategories(cats);
      setPresets((presetsRes.data || []) as Preset[]);
      setTasks(enrichedTasks);
      setDependencies((depsRes.data || []) as TaskDependency[]);

      setSelectedTask((prev) => {
        if (!prev || !prev.id) return prev;
        return enrichedTasks.find((t) => t.id === prev.id) || null;
      });
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Global search filter
  const visibleTasks = tasks.filter((t) => {
    if (globalSearch.trim()) {
      const q = globalSearch.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchCode = (t.code || "").toLowerCase().includes(q);
      const matchTag = (t.tags || []).some((tag) => tag.toLowerCase().includes(q));
      if (!matchTitle && !matchCode && !matchTag) return false;
    }
    return true;
  });

  const d3AlertCount = visibleTasks.filter((t) => {
    if (t.status === "done") return false;
    const diff = getDaysDiffFromToday(t.due_date);
    return diff !== null && diff <= 3;
  }).length;

  // Note: Real-time Google Calendar sync is handled strictly by the single PostgreSQL trigger `tr_tasks_realtime_gcal_sync` on `public.tasks` so there are never duplicate concurrent sync calls!

  // Task Status Change — Instant Optimistic Update
  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    const completedAt = newStatus === "done" ? new Date().toISOString() : null;

    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, status: newStatus, completed_at: completedAt } : t
      )
    );

    await supabase
      .from("tasks")
      .update({
        status: newStatus,
        completed_at: completedAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId);

    await supabase.from("comments").insert({
      task_id: taskId,
      author_name: "ระบบ",
      body: `เปลี่ยนสถานะงานเป็น "${newStatus.toUpperCase()}"`,
      is_activity: true,
    });

    await fetchAllData();
  };

  const handleBulkUpdate = async (taskIds: string[], patch: Partial<Task>) => {
    if (taskIds.length === 0) return;

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (taskIds.includes(t.id) ? { ...t, ...patch } : t))
    );

    await supabase
      .from("tasks")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .in("id", taskIds);
    await fetchAllData();
  };

  const handleSaveTask = async (payload: Partial<Task> & { id?: string }) => {
    if (payload.id) {
      // Optimistic update
      const cat = categories.find((c) => c.id === payload.category_id);
      setTasks((prev) =>
        prev.map((t) =>
          t.id === payload.id
            ? {
                ...t,
                ...payload,
                category: cat,
              }
            : t
        )
      );

      await supabase
        .from("tasks")
        .update({
          title: payload.title,
          description: payload.description,
          status: payload.status,
          priority: payload.priority,
          category_id: payload.category_id,
          start_date: payload.start_date,
          due_date: payload.due_date,
          tags: payload.tags,
          completed_at: payload.completed_at,
          updated_at: new Date().toISOString(),
        })
        .eq("id", payload.id);

      await fetchAllData();
    } else {
      const code = `TK-${Math.floor(111 + Math.random() * 888)}`;
      await supabase
        .from("tasks")
        .insert({
          code,
          title: payload.title,
          description: payload.description,
          status: payload.status || "todo",
          priority: payload.priority || "medium",
          category_id: payload.category_id || categories[0]?.id || null,
          start_date: payload.start_date || new Date().toISOString().slice(0, 10),
          due_date: payload.due_date || new Date().toISOString().slice(0, 10),
          include_in_report: false,
          visibility: "team",
          tags: payload.tags || [],
          position: tasks.length + 1,
        });

      await fetchAllData();
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setSelectedTask(null);
    await supabase.from("tasks").delete().eq("id", taskId);
    await fetchAllData();
  };

  const handleBulkDeleteTasks = async (taskIds: string[]) => {
    if (taskIds.length === 0) return;
    setTasks((prev) => prev.filter((t) => !taskIds.includes(t.id)));
    await supabase.from("tasks").delete().in("id", taskIds);
    await fetchAllData();
  };

  const handleDeleteAllDoneTasks = async () => {
    const doneIds = tasks.filter((t) => t.status === "done").map((t) => t.id);
    if (doneIds.length === 0) return;
    await handleBulkDeleteTasks(doneIds);
  };

  const handleDuplicateTask = async (task: Task) => {
    const code = `TK-${Math.floor(200 + Math.random() * 799)}`;
    const { data: created } = await supabase
      .from("tasks")
      .insert({
        code,
        preset_id: task.preset_id,
        title: `${task.title} (สำเนา)`,
        description: task.description,
        status: "todo",
        priority: task.priority,
        category_id: task.category_id,
        start_date: task.start_date,
        due_date: task.due_date,
        include_in_report: false,
        visibility: "team",
        tags: task.tags,
        position: tasks.length + 1,
      })
      .select()
      .single();

    if (created && task.checklist_items && task.checklist_items.length > 0) {
      await supabase.from("checklist_items").insert(
        task.checklist_items.map((item) => ({
          task_id: created.id,
          text: item.text,
          is_done: false,
          sort_order: item.sort_order,
        }))
      );
    }

    setSelectedTask(null);
    await fetchAllData();
  };

  const handleLaunchPreset = async (preset: Preset, dueDateStr: string) => {
    const dueObj = new Date(`${dueDateStr}T00:00:00Z`);
    const startObj = new Date(
      dueObj.getTime() - (preset.duration_days || 5) * 24 * 60 * 60 * 1000
    );
    const startDateStr = startObj.toISOString().slice(0, 10);
    const code = `TK-${Math.floor(300 + Math.random() * 699)}`;

    const { data: created } = await supabase
      .from("tasks")
      .insert({
        code,
        preset_id: preset.id,
        title: preset.name,
        description: preset.description,
        status: "todo",
        priority: preset.priority || "high",
        category_id: preset.category_id,
        start_date: startDateStr,
        due_date: dueDateStr,
        include_in_report: false,
        visibility: "team",
        tags: preset.tags || [],
        position: tasks.length + 1,
      })
      .select()
      .single();

    if (created) {
      const checklistArr = Array.isArray(preset.checklist) ? preset.checklist : [];
      if (checklistArr.length > 0) {
        await supabase.from("checklist_items").insert(
          checklistArr.map((item, idx) => ({
            task_id: created.id,
            text: item.text,
            is_done: false,
            sort_order: item.order || idx + 1,
          }))
        );
      }
    }

    await fetchAllData();
    setPresetQuickModalOpen(false);
    setActiveView("kanban");
  };

  const handleCreatePreset = async (newPreset: Partial<Preset>) => {
    await supabase.from("presets").insert(newPreset);
    await fetchAllData();
  };

  const handleUpdatePreset = async (presetId: string, updatedPreset: Partial<Preset>) => {
    setPresets((prev) =>
      prev.map((p) => (p.id === presetId ? ({ ...p, ...updatedPreset } as Preset) : p))
    );
    await supabase.from("presets").update(updatedPreset).eq("id", presetId);
    await fetchAllData();
  };

  const handleDeletePreset = async (presetId: string) => {
    setPresets((prev) => prev.filter((p) => p.id !== presetId));
    await supabase.from("presets").delete().eq("id", presetId);
    await fetchAllData();
  };

  const handleAddDependency = async (taskId: string, dependsOnId: string) => {
    await supabase
      .from("task_dependencies")
      .upsert({ task_id: taskId, depends_on_id: dependsOnId });
    await fetchAllData();
  };

  const handleRemoveDependency = async (taskId: string, dependsOnId: string) => {
    await supabase
      .from("task_dependencies")
      .delete()
      .eq("task_id", taskId)
      .eq("depends_on_id", dependsOnId);
    await fetchAllData();
  };

  const handleStartTimer = async (taskId: string) => {
    if (activeTimerTaskId && activeTimerTaskId !== taskId) {
      const prevTask = tasks.find((t) => t.id === activeTimerTaskId);
      const confirmSwitch = window.confirm(
        `คุณกำลังจับเวลางาน "${prevTask?.title || "งานก่อนหน้า"}" อยู่ ต้องการหยุดงานเดิมและเริ่มจับเวลางานใหม่นี้หรือไม่?`
      );
      if (!confirmSwitch) return;
      await handleStopTimer(activeTimerTaskId);
    }
    setActiveTimerTaskId(taskId);
    setTimerStartTime(Date.now());
  };

  const handleStopTimer = async (taskId: string) => {
    if (!timerStartTime) return;
    const elapsedMins = Math.max(1, Math.round((Date.now() - timerStartTime) / 60000));
    await supabase.from("time_entries").insert({
      task_id: taskId,
      minutes: elapsedMins,
      note: `จับเวลาทำงานสด (${elapsedMins} นาที)`,
      started_at: new Date(timerStartTime).toISOString(),
      ended_at: new Date().toISOString(),
    });
    setActiveTimerTaskId(null);
    setTimerStartTime(null);
    await fetchAllData();
  };

  const openNewTaskDrawer = (initialStatus: TaskStatus = "todo") => {
    setSelectedTask({
      id: "",
      code: null,
      parent_id: null,
      preset_id: null,
      title: "",
      description: "",
      status: initialStatus,
      priority: "medium",
      category_id: categories[0]?.id || null,
      start_date: "2026-11-19",
      due_date: "2026-11-26",
      completed_at: null,
      include_in_report: false,
      visibility: "team",
      tags: [],
      position: tasks.length + 1,
      assignee_name: "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  };

  return (
    <div className="min-h-screen flex bg-surface">
      {/* LEFT SIDEBAR */}
      <aside className="fixed left-0 top-0 h-screen w-72 bg-surface-container-lowest/90 backdrop-blur-xl z-40 hidden lg:flex flex-col justify-between shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-r border-slate-200/80">
        <div className="flex flex-col">
          {/* Brand Logo */}
          <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-100">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-primary-container text-white flex items-center justify-center font-bold shadow-md">
              <span className="material-symbols-outlined text-xl">task_alt</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-lg font-extrabold text-slate-900 leading-none">
                HR Tracker
              </span>
              <span className="text-xs font-semibold text-slate-500 mt-1">
                ระบบติดตามงาน HR
              </span>
            </div>
          </div>

          {/* Core Views Navigation */}
          <div className="px-4 py-4">
            <div className="px-3 py-1.5 text-xs font-extrabold text-slate-500 uppercase tracking-wider">
              เมนูหลัก (MAIN MENU)
            </div>
            <nav className="mt-1 flex flex-col gap-1.5">
              {[
                { id: "dashboard", label: "หน้าสรุปภาพรวม", icon: "dashboard" },
                { id: "kanban", label: "กระดานงาน (Kanban)", icon: "view_kanban" },
                { id: "list", label: "ตารางงานทั้งหมด (List)", icon: "format_list_bulleted" },
                { id: "gantt", label: "แผนผังเวลา (Gantt)", icon: "timeline" },
                { id: "calendar", label: "ปฏิทินงานรายเดือน", icon: "calendar_month" },
                { id: "presets", label: "แม่แบบงานซ้ำ & แจ้งเตือน", icon: "smart_toy" },
              ].map((item) => {
                const isActive = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveView(item.id as ActiveView)}
                    className={`flex items-center justify-between px-4 py-3 rounded-2xl transition-all duration-150 text-left ${
                      isActive
                        ? "bg-primary-container text-white font-extrabold shadow-md"
                        : "text-slate-700 font-bold hover:bg-slate-100 hover:text-slate-950"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-2xl">{item.icon}</span>
                      <span className="text-base">{item.label}</span>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Bottom Year Format Preference */}
        <div className="p-4 m-3 rounded-2xl bg-slate-100/90 border border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
          <span>รูปแบบปีปฏิทิน:</span>
          <button
            onClick={() => setUseBuddhistEra(!useBuddhistEra)}
            className="px-3 py-1.5 rounded-xl bg-white text-primary font-extrabold border border-slate-200 shadow-sm hover:bg-blue-50"
          >
            {useBuddhistEra ? "พ.ศ. (2569)" : "ค.ศ. (2026)"}
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT SHELL */}
      <div className="lg:pl-72 flex flex-col min-h-screen w-full">
        {/* TOPBAR HEADER */}
        <header className="fixed top-0 left-0 lg:left-72 right-0 h-16 bg-surface-container-lowest/90 backdrop-blur-xl z-30 px-6 flex items-center justify-between shadow-[0_1px_8px_rgba(0,0,0,0.04)] gap-3">
          {/* Global Search Input */}
          <div className="flex items-center gap-3 flex-1 max-w-lg">
            <div className="relative w-full">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-lg">
                search
              </span>
              <input
                type="search"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="ค้นหาชื่องาน, รหัสงาน, หรือแท็ก..."
                className="w-full bg-slate-100/80 pl-10 pr-4 py-2 rounded-full text-sm font-medium text-slate-900 placeholder:text-slate-500 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {/* Mobile View Switcher */}
          <div className="lg:hidden">
            <select
              value={activeView}
              onChange={(e) => setActiveView(e.target.value as ActiveView)}
              className="px-3 py-1.5 rounded-full bg-primary-fixed text-primary text-sm font-bold"
            >
              <option value="dashboard">หน้าสรุปภาพรวม</option>
              <option value="kanban">กระดานงาน (Kanban)</option>
              <option value="list">ตารางงาน (List)</option>
              <option value="gantt">แผนผังเวลา (Gantt)</option>
              <option value="calendar">ปฏิทิน</option>
              <option value="presets">แม่แบบงานซ้ำ</option>
            </select>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2.5">
            {activeTimerTaskId && (
              <button
                onClick={() => handleStopTimer(activeTimerTaskId)}
                className="px-3 py-1.5 rounded-full bg-error text-white text-xs font-bold flex items-center gap-1 animate-pulse"
              >
                <span className="material-symbols-outlined text-sm">timer</span>
                <span>กำลังจับเวลา (คลิกเพื่อหยุด)</span>
              </button>
            )}

            <button
              onClick={() => setPresetQuickModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white text-slate-800 hover:bg-slate-100 transition-colors shadow-sm border border-slate-200"
              type="button"
            >
              <span className="material-symbols-outlined text-base text-secondary">
                bookmark_add
              </span>
              <span className="text-sm font-bold hidden sm:inline">+ จากแม่แบบ</span>
            </button>

            <button
              onClick={() => openNewTaskDrawer("todo")}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary-container text-white hover:opacity-95 transition-all shadow-md"
              type="button"
            >
              <span className="material-symbols-outlined text-base">add</span>
              <span className="text-sm font-bold">+ งานใหม่</span>
            </button>

            {/* D-3 Notification Bell */}
            <button
              onClick={() => setActiveView("presets")}
              title="ดูระบบแจ้งเตือนงานใกล้ครบกำหนด (D-3)"
              className="relative p-2 rounded-full bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
              type="button"
            >
              <span className="material-symbols-outlined text-xl">notifications</span>
              {d3AlertCount > 0 && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-red-600 text-white text-[11px] font-extrabold">
                  {d3AlertCount}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* MAIN VIEW WORKSPACE */}
        <main className="w-full pt-20 px-6 py-6 flex-1">
          {initialLoading ? (
            <div className="h-96 flex flex-col items-center justify-center gap-3 text-slate-600">
              <div className="w-10 h-10 rounded-full border-4 border-primary-container border-t-transparent animate-spin" />
              <span className="text-lg font-bold">
                กำลังโหลดข้อมูลงาน HR...
              </span>
            </div>
          ) : (
            <>
              {activeView === "dashboard" && (
                <DashboardView
                  tasks={visibleTasks}
                  categories={categories}
                  useBuddhistEra={useBuddhistEra}
                  isViewer={false}
                  onSelectTask={(t) => setSelectedTask(t)}
                  onNavigateView={(v, catId) => {
                    if (catId !== undefined) {
                      setKanbanCategoryId(catId);
                    }
                    setActiveView(v);
                  }}
                />
              )}

              {activeView === "kanban" && (
                <KanbanView
                  tasks={visibleTasks}
                  categories={categories}
                  useBuddhistEra={useBuddhistEra}
                  isViewer={false}
                  selectedCategoryId={kanbanCategoryId}
                  onSelectCategory={(catId) => setKanbanCategoryId(catId)}
                  onStatusChange={handleStatusChange}
                  onDeleteTask={handleDeleteTask}
                  onDeleteAllDone={handleDeleteAllDoneTasks}
                  onSelectTask={(t) => setSelectedTask(t)}
                  onCreateTaskInColumn={(st) => openNewTaskDrawer(st)}
                />
              )}

              {activeView === "list" && (
                <ListView
                  tasks={visibleTasks}
                  categories={categories}
                  useBuddhistEra={useBuddhistEra}
                  isViewer={false}
                  onStatusChange={handleStatusChange}
                  onBulkUpdate={handleBulkUpdate}
                  onDeleteTask={handleDeleteTask}
                  onBulkDelete={handleBulkDeleteTasks}
                  onSelectTask={(t) => setSelectedTask(t)}
                />
              )}

              {activeView === "gantt" && (
                <GanttView
                  tasks={visibleTasks}
                  categories={categories}
                  dependencies={dependencies}
                  useBuddhistEra={useBuddhistEra}
                  isViewer={false}
                  onSelectTask={(t) => setSelectedTask(t)}
                  onAddDependency={handleAddDependency}
                  onRemoveDependency={handleRemoveDependency}
                />
              )}

              {activeView === "calendar" && (
                <CalendarView
                  tasks={visibleTasks}
                  categories={categories}
                  useBuddhistEra={useBuddhistEra}
                  onSelectTask={(t) => setSelectedTask(t)}
                />
              )}

              {activeView === "presets" && (
                <PresetsView
                  presets={presets}
                  categories={categories}
                  tasks={visibleTasks}
                  isViewer={false}
                  onLaunchPreset={handleLaunchPreset}
                  onCreatePreset={handleCreatePreset}
                  onUpdatePreset={handleUpdatePreset}
                  onDeletePreset={handleDeletePreset}
                  onRefreshTasks={fetchAllData}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* SLIDE-OVER TASK DRAWER */}
      <TaskDrawer
        task={selectedTask}
        categories={categories}
        allTasks={tasks}
        isViewer={false}
        activeTimerTaskId={activeTimerTaskId}
        timerStartTime={timerStartTime}
        onClose={() => setSelectedTask(null)}
        onSaveTask={handleSaveTask}
        onDeleteTask={handleDeleteTask}
        onDuplicateTask={handleDuplicateTask}
        onRefresh={fetchAllData}
        onSelectTask={(t) => setSelectedTask(t)}
        onStartTimer={handleStartTimer}
        onStopTimer={handleStopTimer}
      />

      {/* QUICK LAUNCH FROM PRESET MODAL */}
      {presetQuickModalOpen && (
        <div
          onClick={() => setPresetQuickModalOpen(false)}
          className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-surface-container-lowest rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-white cursor-default"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-2xl">
                  bookmark_add
                </span>
                <h3 className="font-headline-sm font-bold text-on-surface">
                  สร้างงานด่วนจากแม่แบบ
                </h3>
              </div>
              <button
                onClick={() => setPresetQuickModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-surface-container-low flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {presets.map((p) => (
                <div
                  key={p.id}
                  className="p-4 rounded-2xl bg-surface-container-low/70 hover:bg-surface-container-high/50 transition-all flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-title-md font-bold text-on-surface">{p.name}</span>
                    </div>
                    <p className="font-label-sm text-on-surface-variant">
                      Checklist {Array.isArray(p.checklist) ? p.checklist.length : 0} ข้อ • ระยะเวลา{" "}
                      {p.duration_days} วัน
                    </p>
                  </div>
                  <button
                    onClick={() => handleLaunchPreset(p, "2026-11-28")}
                    className="px-4 py-2 rounded-full bg-primary-container text-white font-label-md font-bold shrink-0 shadow-sm hover:opacity-95"
                  >
                    + สร้างงาน
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
