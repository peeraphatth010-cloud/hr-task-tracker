"use client";

import React, { useState, useEffect } from "react";
import { Category, Task, TaskPriority, TaskStatus } from "@/lib/types";
import { supabase } from "@/lib/supabase";

interface TaskDrawerProps {
  task: Task | null;
  categories: Category[];
  allTasks: Task[];
  isViewer: boolean;
  activeTimerTaskId: string | null;
  timerStartTime: number | null;
  onClose: () => void;
  onSaveTask: (updated: Partial<Task> & { id?: string }) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onDuplicateTask: (task: Task) => Promise<void>;
  onRefresh: () => Promise<void>;
  onSelectTask: (task: Task) => void;
  onStartTimer: (taskId: string) => void;
  onStopTimer: (taskId: string) => Promise<void>;
}

const REUSABLE_CHECKLIST_PACKS = [
  {
    name: "ชุดเอกสารรับพนักงานใหม่ (Onboarding Pack)",
    items: [
      "สัญญาจ้างงานและข้อตกลงรักษาความลับ (NDA)",
      "สำเนาบัตรประชาชน ทะเบียนบ้าน และวุฒิการศึกษา",
      "แบบฟอร์มขึ้นทะเบียนผู้ประกันตน สปส. 1-03",
      "แบบแจ้งรายการเพื่อการหักลดหย่อนภาษี (ล.ย.01)",
    ],
  },
  {
    name: "ชุดตรวจสอบปิดงวด Payroll ประจำเดือน",
    items: [
      "กระทบยอดสถิติขาด-ลา-มาสาย และค่าล่วงเวลา (OT)",
      "ตรวจสอบรายการปรับฐานเงินเดือนและค่าคอมมิชชัน",
      "ตรวจทานยอดหักประกันสังคม 5% และภาษี ภ.ง.ด.1",
      "ส่งไฟล์ Batch โอนเงินเดือนเข้าธนาคารและออก e-Payslip",
    ],
  },
];

export default function TaskDrawer({
  task,
  categories,
  allTasks,
  isViewer,
  activeTimerTaskId,
  timerStartTime,
  onClose,
  onSaveTask,
  onDeleteTask,
  onDuplicateTask,
  onRefresh,
  onSelectTask,
  onStartTimer,
  onStopTimer,
}: TaskDrawerProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [categoryId, setCategoryId] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");
  const [includeInReport, setIncludeInReport] = useState<boolean>(false);
  const [visibility, setVisibility] = useState<"team" | "admin_only">("team");
  const [assigneeName, setAssigneeName] = useState<string>("กานดา นวลจันทร์");
  const [tagsInput, setTagsInput] = useState<string>("");

  // Sub-items state
  const [newChecklistText, setNewChecklistText] = useState("");
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [newCommentBody, setNewCommentBody] = useState("");
  const [manualMinutes, setManualMinutes] = useState<number>(60);
  const [manualNote, setManualNote] = useState<string>("");
  const [uploadingFile, setUploadingFile] = useState<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  useEffect(() => {
    if (task) {
      setTitle(task.title || "");
      setDescription(task.description || "");
      setStatus(task.status || "todo");
      setPriority(task.priority || "medium");
      setCategoryId(task.category_id || categories[0]?.id || "");
      setStartDate(task.start_date || "");
      setDueDate(task.due_date || "");
      setIncludeInReport(Boolean(task.include_in_report));
      setVisibility(task.visibility || "team");
      setAssigneeName(task.assignee_name || "กานดา นวลจันทร์");
      setTagsInput((task.tags || []).join(", "));
    }
  }, [task, categories]);

  // Live timer tick
  useEffect(() => {
    if (!task || activeTimerTaskId !== task.id || !timerStartTime) {
      setElapsedSeconds(0);
      return;
    }
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - timerStartTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [task, activeTimerTaskId, timerStartTime]);

  // Close on Escape key
  useEffect(() => {
    if (!task) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [task, onClose]);

  if (!task) return null;

  const isNew = !task.id;
  const subtasks = allTasks.filter((t) => t.parent_id === task.id);
  const checklist = task.checklist_items || [];
  const doneCheckCount = checklist.filter((c) => c.is_done).length;
  const checkPct =
    checklist.length > 0 ? Math.round((doneCheckCount / checklist.length) * 100) : 0;

  const totalLoggedMinutes = (task.time_entries || []).reduce(
    (acc, e) => acc + (e.minutes || 0),
    0
  );

  const handleSaveMain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewer || !title.trim()) return;
    await onSaveTask({
      id: task.id || undefined,
      title: title.trim(),
      description: description.trim(),
      status,
      priority,
      category_id: categoryId || null,
      start_date: startDate || null,
      due_date: dueDate || null,
      include_in_report: includeInReport,
      visibility,
      assignee_name: assigneeName,
      tags: tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      completed_at:
        status === "done" ? task.completed_at || new Date().toISOString() : null,
    });
    onClose();
  };

  // Checklist actions (FR-15.2)
  const handleAddChecklistItem = async () => {
    if (!newChecklistText.trim() || !task.id || isViewer) return;
    await supabase.from("checklist_items").insert({
      task_id: task.id,
      text: newChecklistText.trim(),
      is_done: false,
      sort_order: checklist.length + 1,
    });
    setNewChecklistText("");
    await onRefresh();
  };

  const handleToggleChecklistItem = async (itemId: string, currentDone: boolean) => {
    if (isViewer) return;
    await supabase
      .from("checklist_items")
      .update({ is_done: !currentDone })
      .eq("id", itemId);
    await onRefresh();
  };

  const handleDeleteChecklistItem = async (itemId: string) => {
    if (isViewer) return;
    await supabase.from("checklist_items").delete().eq("id", itemId);
    await onRefresh();
  };

  const handleImportChecklistPack = async (items: string[]) => {
    if (!task.id || isViewer) return;
    await supabase.from("checklist_items").insert(
      items.map((text, idx) => ({
        task_id: task.id,
        text,
        is_done: false,
        sort_order: checklist.length + idx + 1,
      }))
    );
    await onRefresh();
  };

  // Subtask creation (FR-2.4)
  const handleAddSubtask = async () => {
    if (!newSubtaskTitle.trim() || !task.id || isViewer) return;
    const code = `TK-${Math.floor(200 + Math.random() * 799)}`;
    await supabase.from("tasks").insert({
      code,
      parent_id: task.id,
      title: newSubtaskTitle.trim(),
      status: "todo",
      priority: task.priority,
      category_id: task.category_id,
      due_date: task.due_date,
      include_in_report: false,
      assignee_name: task.assignee_name,
    });
    setNewSubtaskTitle("");
    await onRefresh();
  };

  // Comments & Activity Log (FR-13.1 - FR-13.3)
  const handleAddComment = async () => {
    if (!newCommentBody.trim() || !task.id || isViewer) return;
    await supabase.from("comments").insert({
      task_id: task.id,
      author_name: "กานดา นวลจันทร์ (Admin)",
      body: newCommentBody.trim(),
      is_activity: false,
    });
    setNewCommentBody("");
    await onRefresh();
  };

  // Manual Time Entry (FR-14.1)
  const handleAddManualTime = async () => {
    if (!task.id || isViewer || manualMinutes <= 0) return;
    await supabase.from("time_entries").insert({
      task_id: task.id,
      minutes: manualMinutes,
      note: manualNote.trim() || "บันทึกเวลาทำงานด้วยมือ",
      started_at: new Date().toISOString(),
      ended_at: new Date().toISOString(),
    });
    setManualNote("");
    await onRefresh();
  };

  // File Attachment Upload & Signed URL Download (FR-12.1 - FR-12.3)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !task.id || isViewer) return;
    if (file.size > 10 * 1024 * 1024) {
      alert("ขนาดไฟล์ต้องไม่เกิน 10 MB (FR-12.1)");
      return;
    }

    setUploadingFile(true);
    try {
      const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const storagePath = `${task.id}/${safeName}`;

      const { error: upErr } = await supabase.storage
        .from("attachments")
        .upload(storagePath, file, { upsert: true });

      if (upErr) throw upErr;

      await supabase.from("attachments").insert({
        task_id: task.id,
        storage_path: storagePath,
        file_name: file.name,
        size_bytes: file.size,
      });

      await supabase.from("comments").insert({
        task_id: task.id,
        author_name: "ระบบอัตโนมัติ",
        body: `แนบไฟล์เอกสารใหม่: ${file.name}`,
        is_activity: true,
      });

      await onRefresh();
    } catch (err: any) {
      alert(`อัปโหลดไฟล์ไม่สำเร็จ: ${err.message}`);
    } finally {
      setUploadingFile(false);
    }
  };

  const handleDownloadAttachment = async (storagePath: string, fileName: string) => {
    const { data, error } = await supabase.storage
      .from("attachments")
      .createSignedUrl(storagePath, 300);
    if (error || !data?.signedUrl) {
      alert("ไม่สามารถสร้าง Signed URL ได้");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm flex justify-end cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface-container-lowest w-full max-w-2xl h-full overflow-y-auto p-6 md:p-8 shadow-2xl flex flex-col justify-between cursor-default"
      >
        <div>
          {/* Top Bar */}
          <div className="flex items-center justify-between gap-3 pb-4 mb-5 border-b border-surface-container">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-surface-container-high text-primary font-label-sm font-bold">
                {isNew ? "สร้างงานใหม่" : task.code || "TASK DETAIL"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {!isNew && !isViewer && (
                <>
                  <button
                    type="button"
                    onClick={() => onDuplicateTask(task)}
                    className="px-3 py-1.5 rounded-full bg-surface-container-low hover:bg-surface-container-high font-label-sm font-bold flex items-center gap-1"
                    title="ทำสำเนางานนี้ (FR-2.1)"
                  >
                    <span className="material-symbols-outlined text-sm">content_copy</span>
                    <span>ทำสำเนา</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteTask(task.id)}
                    className="p-2 rounded-full text-error hover:bg-error-container/50"
                    title="ลบงานนี้"
                  >
                    <span className="material-symbols-outlined text-lg">delete</span>
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-surface-container-low hover:bg-surface-container-high flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Main Task Form */}
          <form onSubmit={handleSaveMain} className="space-y-4 mb-8">
            <div>
              <label className="font-label-sm font-bold text-on-surface-variant block mb-1">
                ชื่องาน (Task Title) *
              </label>
              <input
                type="text"
                required
                disabled={isViewer}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="ระบุชื่องาน HR..."
                className="w-full px-4 py-2.5 rounded-2xl bg-surface-container-low text-on-surface font-title-md font-bold focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="font-label-sm font-bold text-on-surface-variant block mb-1">
                รายละเอียดและหมายเหตุ
              </label>
              <textarea
                rows={2}
                disabled={isViewer}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="รายละเอียดขั้นตอน เอกสารที่เกี่ยวข้อง หรือหมายเหตุ..."
                className="w-full px-4 py-2.5 rounded-2xl bg-surface-container-low text-on-surface font-body-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="font-label-sm font-bold text-on-surface-variant block mb-1">
                  สถานะ (Status)
                </label>
                <select
                  disabled={isViewer}
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-surface-container-low text-on-surface font-label-md font-bold"
                >
                  <option value="todo">To Do (รอดำเนินการ)</option>
                  <option value="in_progress">In Progress (กำลังทำ)</option>
                  <option value="waiting">Waiting (รออนุมัติ)</option>
                  <option value="done">Done (เสร็จสมบูรณ์)</option>
                </select>
              </div>

              <div>
                <label className="font-label-sm font-bold text-on-surface-variant block mb-1">
                  ความสำคัญ (Priority)
                </label>
                <select
                  disabled={isViewer}
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-surface-container-low text-on-surface font-label-md font-bold"
                >
                  <option value="low">Low (ต่ำ)</option>
                  <option value="medium">Medium (ปานกลาง)</option>
                  <option value="high">High (สูง)</option>
                  <option value="urgent">! Urgent (ด่วนที่สุด)</option>
                </select>
              </div>

              <div>
                <label className="font-label-sm font-bold text-on-surface-variant block mb-1">
                  หมวดหมู่ HR
                </label>
                <select
                  disabled={isViewer}
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-surface-container-low text-on-surface font-label-md font-bold"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="font-label-sm font-bold text-on-surface-variant block mb-1">
                  วันเริ่มงาน (Start Date)
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-2xl bg-surface-container-low text-on-surface font-label-md"
                />
              </div>

              <div>
                <label className="font-label-sm font-bold text-on-surface-variant block mb-1">
                  วันครบกำหนด (Due Date)
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-2xl bg-surface-container-low text-on-surface font-label-md"
                />
              </div>

              <div>
                <label className="font-label-sm font-bold text-on-surface-variant block mb-1">
                  Tags (คั่นด้วยจุลภาค)
                </label>
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="เช่น สรรพากร, รายเดือน"
                  className="w-full px-3.5 py-2 rounded-2xl bg-surface-container-low text-on-surface font-label-md"
                />
              </div>
            </div>

            {!isViewer && (
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-full bg-surface-container-low font-label-md font-semibold"
                >
                  ปิดหน้าต่าง
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-full bg-primary-container text-white font-label-md font-bold shadow-md hover:opacity-95"
                >
                  {isNew ? "สร้างงานทันที" : "บันทึกการแก้ไข"}
                </button>
              </div>
            )}
          </form>

          {/* Additional Sections for Existing Tasks */}
          {!isNew && (
            <div className="space-y-6 border-t border-surface-container pt-6">
              {/* 1. Checklist Section & Reusable Checklist Library (FR-15.2 - FR-15.4) */}
              <div className="bg-surface-container-low/60 rounded-3xl p-5">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">checklist</span>
                    <h3 className="font-title-md font-bold text-on-surface">
                      รายการย่อย Checklist ({doneCheckCount}/{checklist.length} • {checkPct}%)
                    </h3>
                  </div>

                  {!isViewer && (
                    <select
                      onChange={(e) => {
                        const idx = Number(e.target.value);
                        if (!isNaN(idx) && REUSABLE_CHECKLIST_PACKS[idx]) {
                          handleImportChecklistPack(REUSABLE_CHECKLIST_PACKS[idx].items);
                        }
                        e.target.value = "";
                      }}
                      defaultValue=""
                      className="px-3 py-1 rounded-full bg-surface-container-lowest font-label-sm font-bold text-primary shadow-sm"
                    >
                      <option value="" disabled>
                        + ดึงจากคลัง Checklist กลาง (FR-15.4)
                      </option>
                      {REUSABLE_CHECKLIST_PACKS.map((pack, idx) => (
                        <option key={idx} value={idx}>
                          {pack.name} ({pack.items.length} ข้อ)
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden mb-4">
                  <div
                    className="h-full bg-primary-container rounded-full transition-all"
                    style={{ width: `${checkPct}%` }}
                  />
                </div>

                <div className="space-y-2 mb-3">
                  {checklist.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-surface-container-lowest shadow-sm"
                    >
                      <label className="flex items-center gap-2.5 cursor-pointer flex-1">
                        <input
                          type="checkbox"
                          disabled={isViewer}
                          checked={item.is_done}
                          onChange={() => handleToggleChecklistItem(item.id, item.is_done)}
                          className="w-4 h-4 accent-primary rounded"
                        />
                        <span
                          className={`font-body-md ${
                            item.is_done ? "line-through text-on-surface-variant" : "text-on-surface"
                          }`}
                        >
                          {item.text}
                        </span>
                      </label>
                      {!isViewer && (
                        <button
                          onClick={() => handleDeleteChecklistItem(item.id)}
                          className="text-on-surface-variant hover:text-error px-1"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {!isViewer && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newChecklistText}
                      onChange={(e) => setNewChecklistText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddChecklistItem()}
                      placeholder="เพิ่มรายการ Checklist ใหม่..."
                      className="flex-1 px-4 py-2 rounded-full bg-surface-container-lowest font-body-md focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddChecklistItem}
                      className="px-4 py-2 rounded-full bg-primary-container text-white font-label-md font-bold"
                    >
                      + เพิ่ม
                    </button>
                  </div>
                )}
              </div>

              {/* 2. Subtasks (1 Level - FR-2.4) */}
              <div className="bg-surface-container-low/60 rounded-3xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-primary">
                    subdirectory_arrow_right
                  </span>
                  <h3 className="font-title-md font-bold text-on-surface">
                    งานย่อย (Subtasks 1 ระดับ) ({subtasks.length})
                  </h3>
                </div>

                <div className="space-y-2 mb-3">
                  {subtasks.map((st) => (
                    <div
                      key={st.id}
                      onClick={() => onSelectTask(st)}
                      className="p-3 rounded-xl bg-surface-container-lowest flex items-center justify-between cursor-pointer hover:bg-surface-container-high/40"
                    >
                      <span className="font-label-md font-bold text-on-surface">
                        [{st.code}] {st.title}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-surface-container-low font-label-sm font-bold">
                        {st.status}
                      </span>
                    </div>
                  ))}
                </div>

                {!isViewer && !task.parent_id && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newSubtaskTitle}
                      onChange={(e) => setNewSubtaskTitle(e.target.value)}
                      placeholder="เพิ่มงานย่อยภายใต้ภารกิจนี้..."
                      className="flex-1 px-4 py-2 rounded-full bg-surface-container-lowest font-body-md focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddSubtask}
                      className="px-4 py-2 rounded-full bg-surface-container-high text-primary font-label-md font-bold"
                    >
                      + สร้างงานย่อย
                    </button>
                  </div>
                )}
              </div>

              {/* 3. Time Tracking (Start/Stop Timer & Manual Log - FR-14.1 - FR-14.4) */}
              <div className="bg-surface-container-low/60 rounded-3xl p-5">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">timer</span>
                    <h3 className="font-title-md font-bold text-on-surface">
                      จับเวลาทำงาน (Time Tracking • รวม {(totalLoggedMinutes / 60).toFixed(1)} ชม.)
                    </h3>
                  </div>

                  {!isViewer && (
                    <div>
                      {activeTimerTaskId === task.id ? (
                        <button
                          type="button"
                          onClick={() => onStopTimer(task.id)}
                          className="px-4 py-1.5 rounded-full bg-error text-white font-label-md font-bold flex items-center gap-1.5 animate-pulse"
                        >
                          <span className="material-symbols-outlined text-base">stop_circle</span>
                          <span>
                            หยุดจับเวลา ({Math.floor(elapsedSeconds / 60)}:
                            {String(elapsedSeconds % 60).padStart(2, "0")})
                          </span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onStartTimer(task.id)}
                          className="px-4 py-1.5 rounded-full bg-primary-container text-white font-label-md font-bold flex items-center gap-1.5"
                        >
                          <span className="material-symbols-outlined text-base">play_circle</span>
                          <span>Start จับเวลางานนี้</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {!isViewer && (
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 mb-3">
                    <input
                      type="number"
                      min={5}
                      step={15}
                      value={manualMinutes}
                      onChange={(e) => setManualMinutes(Number(e.target.value))}
                      className="sm:col-span-3 px-3 py-2 rounded-full bg-surface-container-lowest font-label-md"
                      placeholder="นาที"
                    />
                    <input
                      type="text"
                      value={manualNote}
                      onChange={(e) => setManualNote(e.target.value)}
                      placeholder="หมายเหตุเวลาที่ทำ (เช่น ตรวจเอกสาร 60 นาที)..."
                      className="sm:col-span-6 px-4 py-2 rounded-full bg-surface-container-lowest font-body-md"
                    />
                    <button
                      type="button"
                      onClick={handleAddManualTime}
                      className="sm:col-span-3 px-3 py-2 rounded-full bg-surface-container-high text-primary font-label-md font-bold"
                    >
                      + บันทึกเวลา
                    </button>
                  </div>
                )}

                <div className="space-y-1.5">
                  {(task.time_entries || []).map((te) => (
                    <div
                      key={te.id}
                      className="px-3 py-2 rounded-xl bg-surface-container-lowest flex items-center justify-between font-label-sm"
                    >
                      <span className="text-on-surface">{te.note || "บันทึกเวลาทำงาน"}</span>
                      <span className="font-bold text-primary">
                        {te.minutes} นาที ({(te.minutes / 60).toFixed(1)} ชม.)
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 4. Private File Attachments (Supabase Storage - FR-12.1 - FR-12.3) */}
              <div className="bg-surface-container-low/60 rounded-3xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">attach_file</span>
                    <h3 className="font-title-md font-bold text-on-surface">
                      ไฟล์แนบเอกสาร ({task.attachments?.length || 0})
                    </h3>
                  </div>

                  {!isViewer && (
                    <label className="px-4 py-1.5 rounded-full bg-surface-container-lowest text-primary font-label-sm font-bold shadow-sm cursor-pointer hover:bg-surface-container-high">
                      <span>{uploadingFile ? "กำลังอัปโหลด..." : "+ แนบไฟล์ (≤ 10MB)"}</span>
                      <input
                        type="file"
                        onChange={handleFileUpload}
                        className="hidden"
                        accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
                      />
                    </label>
                  )}
                </div>

                <div className="space-y-2">
                  {(task.attachments || []).length === 0 && (
                    <p className="font-label-sm text-on-surface-variant">
                      ยังไม่มีไฟล์แนบ (จัดเก็บใน Supabase Private Storage พร้อม Signed URL)
                    </p>
                  )}
                  {(task.attachments || []).map((att) => (
                    <div
                      key={att.id}
                      className="p-3 rounded-xl bg-surface-container-lowest flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="material-symbols-outlined text-primary">description</span>
                        <span className="font-label-md font-semibold text-on-surface truncate">
                          {att.file_name}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDownloadAttachment(att.storage_path, att.file_name)}
                        className="px-3 py-1 rounded-full bg-primary-fixed text-primary font-label-sm font-bold hover:opacity-90"
                      >
                        ดาวน์โหลด (Signed URL)
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* 5. Comments & Activity Audit Log (FR-13.1 - FR-13.3) */}
              <div className="bg-surface-container-low/60 rounded-3xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-primary">forum</span>
                  <h3 className="font-title-md font-bold text-on-surface">
                    ความคิดเห็น & ประวัติกิจกรรม ({task.comments?.length || 0})
                  </h3>
                </div>

                <div className="space-y-2.5 mb-4 max-h-60 overflow-y-auto">
                  {(task.comments || []).map((c) => (
                    <div
                      key={c.id}
                      className={`p-3 rounded-2xl ${
                        c.is_activity
                          ? "bg-surface-container-high/50 font-label-sm text-on-surface-variant"
                          : "bg-surface-container-lowest shadow-sm"
                      }`}
                    >
                      <div className="flex items-center justify-between font-label-sm mb-1">
                        <span className="font-bold text-primary">{c.author_name}</span>
                        <span className="text-on-surface-variant">
                          {new Date(c.created_at).toLocaleString("th-TH")}
                        </span>
                      </div>
                      <div className="font-body-md text-on-surface">{c.body}</div>
                    </div>
                  ))}
                </div>

                {!isViewer && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newCommentBody}
                      onChange={(e) => setNewCommentBody(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
                      placeholder="เขียนความคิดเห็นหรือบันทึกความคืบหน้า..."
                      className="flex-1 px-4 py-2 rounded-full bg-surface-container-lowest font-body-md focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddComment}
                      className="px-4 py-2 rounded-full bg-primary-container text-white font-label-md font-bold"
                    >
                      ส่งข้อความ
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
