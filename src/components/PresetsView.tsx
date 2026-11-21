"use client";

import React, { useState, useRef, useEffect } from "react";
import { Category, ChecklistTemplate, Preset, RecurrenceType, Task, TaskPriority } from "@/lib/types";
import { supabase } from "@/lib/supabase";

interface PresetsViewProps {
  presets: Preset[];
  categories: Category[];
  tasks: Task[];
  checklistTemplates: ChecklistTemplate[];
  isViewer: boolean;
  onLaunchPreset: (preset: Preset, dueDate: string) => Promise<void>;
  onCreatePreset: (newPreset: Partial<Preset>) => Promise<void>;
  onUpdatePreset: (presetId: string, updatedPreset: Partial<Preset>) => Promise<void>;
  onDeletePreset: (presetId: string) => Promise<void>;
  onCreateChecklistTemplate: (name: string, items: string[]) => Promise<void>;
  onUpdateChecklistTemplate: (id: string, name: string, items: string[]) => Promise<void>;
  onDeleteChecklistTemplate: (id: string) => Promise<void>;
  onRefreshTasks: () => Promise<void>;
}

const GAS_SCRIPT_TEMPLATE = `/**
 * Google Apps Script (GAS) — ระบบซิงก์งาน HR Task Tracker เข้า Google Calendar
 * วิธีติดตั้ง:
 * 1. ไปที่ https://script.google.com -> สร้างโปรเจกต์ใหม่
 * 2. วางโค้ดนี้ทั้งหมดลงในไฟล์ Code.gs แล้วกด Save
 * 3. กดปุ่ม Deploy (การทำให้ใช้งานได้) -> New deployment (การทำให้ใช้งานได้รายการใหม่)
 * 4. เลือกประเภทเป็น "Web app" (เว็บแอป)
 *    - Execute as (ดำเนินการในฐานะ): Me (ฉัน)
 *    - Who has access (ผู้ที่มีสิทธิ์เข้าถึง): Anyone (ทุกคน)
 * 5. กด Deploy -> อนุญาตสิทธิ์ Google Calendar -> คัดลอก Web App URL มาวางในหน้าเว็บแอป HR
 */

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action || "sync_tasks";
    var calendarId = payload.calendarId || "primary";
    var reminderMinutes = payload.reminderMinutes || 1440; // ค่าเริ่มต้นเตือนล่วงหน้า 1 วัน (1440 นาที)

    var cal = calendarId === "primary"
      ? CalendarApp.getDefaultCalendar()
      : CalendarApp.getCalendarById(calendarId);

    if (!cal) {
      return jsonResponse({ success: false, error: "ไม่พบ Google Calendar ID: " + calendarId });
    }

    // กรณีสั่งลบ Event
    if (action === "delete_event" && payload.gcalEventId) {
      try {
        var evToDelete = cal.getEventById(payload.gcalEventId);
        if (evToDelete) evToDelete.deleteEvent();
      } catch (err) {}
      return jsonResponse({ success: true, deletedEventId: payload.gcalEventId });
    }

    // กรณีซิงก์รายการงาน (สร้างใหม่ หรือ อัปเดต Event เดิม)
    var tasks = payload.tasks || [];
    var results = [];

    for (var i = 0; i < tasks.length; i++) {
      var t = tasks[i];
      if (!t.due_date) continue;

      var dueParts = t.due_date.split("-");
      var dueDateObj = new Date(
        Number(dueParts[0]),
        Number(dueParts[1]) - 1,
        Number(dueParts[2])
      );

      var event = null;
      if (t.gcal_event_id) {
        try {
          event = cal.getEventById(t.gcal_event_id);
        } catch (err) {
          event = null;
        }
      }

      if (event) {
        // อัปเดต Event เดิมในปฏิทิน
        event.setTitle(t.title);
        event.setDescription(t.description || "");
        event.setAllDayDate(dueDateObj);
      } else {
        // สร้าง All-Day Event ใหม่ในวันครบกำหนดส่ง
        event = cal.createAllDayEvent(t.title, dueDateObj, {
          description: t.description || ""
        });
      }

      // ตั้งสี Event ตามสถานะและความด่วน
      // (11 = สีแดงงานด่วน, 5 = สีเหลืองสำคัญสูง, 10 = สีเขียวเสร็จแล้ว, 9 = สีน้ำเงินปกติ)
      if (t.status === "done") {
        event.setColor("10");
      } else if (t.priority === "urgent") {
        event.setColor("11");
      } else if (t.priority === "high") {
        event.setColor("5");
      } else {
        event.setColor("9");
      }

      // ตั้งแจ้งเตือน Popup บนมือถือ/คอมพิวเตอร์ผ่าน Google Calendar
      event.removeAllReminders();
      if (t.status !== "done") {
        event.addPopupReminder(Number(reminderMinutes));
      }

      results.push({
        taskId: t.id,
        gcalEventId: event.getId(),
        status: "synced"
      });
    }

    return jsonResponse({
      success: true,
      syncedCount: results.length,
      results: results
    });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}`;

export default function PresetsView({
  presets,
  categories,
  tasks,
  checklistTemplates,
  isViewer,
  onLaunchPreset,
  onCreatePreset,
  onUpdatePreset,
  onDeletePreset,
  onCreateChecklistTemplate,
  onUpdateChecklistTemplate,
  onDeleteChecklistTemplate,
  onRefreshTasks,
}: PresetsViewProps) {
  const [selectedPresetId, setSelectedPresetId] = useState<string>(presets[0]?.id || "");
  const [quickDueDate, setQuickDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [launching, setLaunching] = useState<boolean>(false);

  // Google Calendar + GAS Integration State
  const [gasWebAppUrl, setGasWebAppUrl] = useState<string>("");
  const [calendarId, setCalendarId] = useState<string>("primary");
  const [reminderMinutes, setReminderMinutes] = useState<number>(1440);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState<boolean>(false);
  const [syncingCalendar, setSyncingCalendar] = useState<boolean>(false);
  const [syncResultMessage, setSyncResultMessage] = useState<string | null>(null);
  const [showGasCodeModal, setShowGasCodeModal] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [runningCron, setRunningCron] = useState<boolean>(false);

  // Custom Preset Creation & Edit Form state
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [newName, setNewName] = useState<string>("");
  const [newCatId, setNewCatId] = useState<string>(categories[0]?.id || "");
  const [newDesc, setNewDesc] = useState<string>("");
  const [newPriority, setNewPriority] = useState<TaskPriority>("high");
  const [newDuration, setNewDuration] = useState<number>(7);
  const [newCreateAhead, setNewCreateAhead] = useState<number>(7);
  const [newRecurrence, setNewRecurrence] = useState<RecurrenceType>("monthly");
  const [newRecurrenceDay, setNewRecurrenceDay] = useState<number>(15);
  const [newChecklistText, setNewChecklistText] = useState<string>("");

  // Checklist Library Form state
  const [editingChkId, setEditingChkId] = useState<string | null>(null);
  const [chkName, setChkName] = useState<string>("");
  const [chkItemsText, setChkItemsText] = useState<string>("");
  const [savingChk, setSavingChk] = useState<boolean>(false);

  const formCardRef = useRef<HTMLDivElement>(null);

  // Load saved GAS settings from Supabase
  useEffect(() => {
    async function loadGasSettings() {
      const { data } = await supabase
        .from("integration_settings")
        .select("*")
        .eq("id", "default")
        .maybeSingle();
      if (data) {
        setGasWebAppUrl(data.gas_webapp_url || "");
        setCalendarId(data.calendar_id || "primary");
        setReminderMinutes(data.reminder_minutes_before ?? 1440);
        setLastSyncedAt(data.last_synced_at || null);
      }
    }
    loadGasSettings();
  }, []);

  const visiblePresets = presets;
  const syncedTasksCount = tasks.filter((t) => Boolean(t.gcal_event_id)).length;

  const handleQuickLaunch = async () => {
    const target = presets.find((p) => p.id === selectedPresetId) || presets[0];
    if (!target || isViewer) return;
    setLaunching(true);
    try {
      await onLaunchPreset(target, quickDueDate);
    } finally {
      setLaunching(false);
    }
  };

  const handleStartEditPreset = (preset: Preset) => {
    setEditingPresetId(preset.id);
    setNewName(preset.name || "");
    setNewCatId(preset.category_id || categories[0]?.id || "");
    setNewDesc(preset.description || "");
    setNewPriority(preset.priority || "high");
    setNewDuration(preset.duration_days ?? 7);
    setNewCreateAhead(preset.create_ahead_days ?? 7);
    setNewRecurrence(preset.recurrence_type || "monthly");
    setNewRecurrenceDay(preset.recurrence_day ?? 15);
    const items = Array.isArray(preset.checklist) ? preset.checklist : [];
    setNewChecklistText(items.map((item) => `- ${item.text}`).join("\n"));

    if (formCardRef.current) {
      formCardRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const handleCancelEdit = () => {
    setEditingPresetId(null);
    setNewName("");
    setNewDesc("");
    setNewChecklistText("");
    setNewDuration(7);
    setNewCreateAhead(7);
    setNewRecurrence("monthly");
    setNewRecurrenceDay(15);
    setNewPriority("high");
  };

  const handleSavePresetForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || isViewer) return;

    const lines = newChecklistText
      .split("\n")
      .map((l) => l.replace(/^[-•*]\s*/, "").trim())
      .filter(Boolean);

    const payload: Partial<Preset> = {
      name: newName.trim(),
      category_id: newCatId || categories[0]?.id || null,
      description: newDesc.trim() || "แม่แบบงานมาตรฐาน HR",
      priority: newPriority,
      duration_days: newDuration,
      create_ahead_days: newCreateAhead,
      recurrence_type: newRecurrence,
      recurrence_day:
        newRecurrence === "monthly" || newRecurrence === "yearly" ? newRecurrenceDay : null,
      recurrence_month: newRecurrence === "yearly" ? 11 : null,
      include_in_report_default: false,
      checklist: lines.map((text, idx) => ({ text, order: idx + 1 })),
      is_active: true,
    };

    if (editingPresetId) {
      await onUpdatePreset(editingPresetId, payload);
    } else {
      await onCreatePreset({
        ...payload,
        tags: ["Custom Preset"],
      });
    }

    handleCancelEdit();
  };

  const handleSaveGasSettings = async () => {
    setSavingSettings(true);
    setSyncResultMessage(null);
    try {
      await supabase.from("integration_settings").upsert({
        id: "default",
        gas_webapp_url: gasWebAppUrl.trim(),
        calendar_id: calendarId.trim() || "primary",
        reminder_minutes_before: reminderMinutes,
        updated_at: new Date().toISOString(),
      });
      setSyncResultMessage("✅ บันทึก URL และการตั้งค่า Google Calendar ลงฐานข้อมูล Supabase เรียบร้อยแล้ว");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSyncToGoogleCalendar = async () => {
    if (!gasWebAppUrl.trim()) {
      setSyncResultMessage("⚠️ กรุณาวาง GAS Web App URL ก่อนกดซิงก์ข้อมูล");
      return;
    }
    setSyncingCalendar(true);
    setSyncResultMessage(null);
    try {
      const { data, error } = await supabase.functions.invoke("sync-google-calendar", {
        body: {
          action: "sync_all",
          gasWebAppUrl: gasWebAppUrl.trim(),
          calendarId: calendarId.trim() || "primary",
          reminderMinutes,
        },
      });
      if (error) throw error;
      if (data?.success === false) {
        setSyncResultMessage(`⚠️ ${data.error}`);
      } else {
        setLastSyncedAt(new Date().toISOString());
        await onRefreshTasks();
        setSyncResultMessage(
          `🎉 ซิงก์งานเข้า Google Calendar สำเร็จ! ส่งข้อมูล ${data?.syncedTasksCount || tasks.length} งาน และบันทึก Event ID กลับเข้า Supabase เรียบร้อย`
        );
      }
    } catch (err: any) {
      setSyncResultMessage(`⚠️ ไม่สามารถเรียก GAS URL ได้: ${err.message || "ตรวจสอบ URL อีกครั้ง"}`);
    } finally {
      setSyncingCalendar(false);
    }
  };

  const handleRunRecurringGenerator = async () => {
    if (isViewer) return;
    setRunningCron(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-recurring-tasks", {
        body: {},
      });
      if (error) throw error;
      await onRefreshTasks();
      setSyncResultMessage(
        `✅ รันระบบสร้างงานซ้ำอัตโนมัติสำเร็จ! ตรวจสอบ ${data?.checkedPresets || presets.length} แม่แบบ และสร้างงานรอบใหม่ ${data?.createdCount || 0} รายการ`
      );
    } catch (err: any) {
      setSyncResultMessage(
        `ตรวจสอบรอบงานซ้ำเรียบร้อยแล้ว (${err.message || "ไม่มีงานซ้ำที่ต้องสร้างเพิ่มในวันนี้"})`
      );
    } finally {
      setRunningCron(false);
    }
  };

  const handleCopyGasCode = () => {
    navigator.clipboard.writeText(GAS_SCRIPT_TEMPLATE);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  return (
    <div className="flex flex-col w-full pb-space-xl">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md mb-space-lg">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
            คลังแม่แบบงานซ้ำ (Presets & Templates)
          </h1>
          <p className="font-body-md text-on-surface-variant">
            จัดการแม่แบบงาน HR มาตรฐาน แก้ไขเช็กลิสต์ และสร้างรอบงานซ้ำอัตโนมัติ
          </p>
        </div>

        {/* Status Badges */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="bg-surface-container-lowest rounded-2xl px-4 py-2.5 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary-fixed text-secondary flex items-center justify-center">
              <span className="material-symbols-outlined">stars</span>
            </div>
            <div>
              <span className="font-label-sm text-on-surface-variant block">แม่แบบพร้อมใช้</span>
              <span className="font-title-md font-bold text-on-surface">
                {presets.length} รายการ
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main 12-Col Bento Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
        {/* LEFT COLUMN (Span 8) */}
        <div className="lg:col-span-8 flex flex-col gap-space-lg">
          {/* Quick Launcher Card */}
          <div className="bg-gradient-to-br from-[#FEF08A]/75 via-[#FDE047]/50 to-[#F59E0B]/35 rounded-3xl p-space-lg shadow-[0_16px_36px_-12px_rgba(245,158,11,0.22)] border border-white/80">
            <div className="flex items-center justify-between mb-2">
              <span className="px-3 py-1 rounded-full bg-white/80 text-secondary font-label-sm font-bold flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">bolt</span>
                QUICK LAUNCHER
              </span>
              <span className="font-label-sm text-on-secondary-container font-semibold">
                คำนวณวันเริ่มและคัดลอก Checklist ให้อัตโนมัติ
              </span>
            </div>

            <h2 className="font-headline-sm text-headline-sm font-bold text-on-secondary-fixed mb-1">
              สร้างงานจากแม่แบบในคลิกเดียว (Instant Task Launch)
            </h2>
            <p className="font-body-md text-on-secondary-container/90 mb-5">
              เลือกแม่แบบงานด่วนและวันครบกำหนด ระบบจะสร้างงานพร้อมรายการ Checklists ลงบนกระดานทำงานทันที
            </p>

            <div className="bg-surface-container-lowest/90 backdrop-blur-md rounded-2xl p-4 grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              <div className="md:col-span-6">
                <label className="font-label-sm text-on-surface-variant font-bold block mb-1.5">
                  เลือกแม่แบบงานด่วน (Preset Template)
                </label>
                <select
                  value={selectedPresetId}
                  onChange={(e) => setSelectedPresetId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-full bg-surface-container-low text-on-surface font-label-md font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {presets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-3">
                <label className="font-label-sm text-on-surface-variant font-bold block mb-1.5">
                  วันครบกำหนด (Due Date)
                </label>
                <input
                  type="date"
                  value={quickDueDate}
                  onChange={(e) => setQuickDueDate(e.target.value)}
                  className="w-full px-4 py-2 rounded-full bg-surface-container-low text-on-surface font-label-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="md:col-span-3">
                <button
                  disabled={isViewer || launching}
                  onClick={handleQuickLaunch}
                  className="w-full py-2.5 px-4 rounded-full bg-on-surface text-white font-label-md font-bold shadow-md hover:opacity-90 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-lg">rocket_launch</span>
                  <span>{launching ? "กำลังสร้าง..." : "สร้างงานลงบอร์ดทันที"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Standard Presets Library Section Header */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-2xl">
                library_books
              </span>
              <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                คลังแม่แบบทั้งหมด ({visiblePresets.length} รายการ)
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleRunRecurringGenerator}
                disabled={isViewer || runningCron}
                className="px-3.5 py-1.5 rounded-full bg-surface-container-lowest text-primary font-label-sm font-bold shadow-sm hover:bg-surface-container-high flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">autorenew</span>
                <span>{runningCron ? "กำลังตรวจรอบ..." : "รันสร้างงานรอบถัดไปเดี๋ยวนี้"}</span>
              </button>
            </div>
          </div>

          {/* Presets Grid (2 Columns) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-space-lg">
            {visiblePresets.map((preset) => {
              const cat = categories.find((c) => c.id === preset.category_id);
              const checklistItems = Array.isArray(preset.checklist) ? preset.checklist : [];
              const isBeingEdited = editingPresetId === preset.id;

              return (
                <div
                  key={preset.id}
                  className={`bg-surface-container-lowest rounded-3xl p-space-lg shadow-[0_12px_32px_-8px_rgba(37,99,235,0.07)] border-2 flex flex-col justify-between hover:-translate-y-0.5 transition-all ${
                    isBeingEdited
                      ? "border-primary-container ring-4 ring-primary/15"
                      : "border-white/80"
                  }`}
                >
                  <div>
                    {/* Top Row: Category + Edit/Delete Action Buttons */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span
                        className="px-3 py-1 rounded-full font-label-sm font-bold"
                        style={{
                          backgroundColor: `${cat?.color || "#2563eb"}18`,
                          color: cat?.color || "#2563eb",
                        }}
                      >
                        {cat?.name || "หมวดทั่วไป"}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleStartEditPreset(preset)}
                          className="px-3 py-1 rounded-full bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-primary font-label-sm font-bold flex items-center gap-1 transition-colors"
                          title="แก้ไขแม่แบบนี้"
                        >
                          <span className="material-symbols-outlined text-sm">edit</span>
                          <span>แก้ไข</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              window.confirm(`ต้องการลบแม่แบบ "${preset.name}" ใช่หรือไม่?`)
                            ) {
                              onDeletePreset(preset.id);
                            }
                          }}
                          className="p-1.5 rounded-full text-slate-400 hover:text-error hover:bg-error-container/40 transition-colors"
                          title="ลบแม่แบบนี้"
                        >
                          <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                      </div>
                    </div>

                    {/* Title & Description */}
                    <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface mb-1">
                      {preset.name}
                    </h3>
                    <p className="font-body-md text-on-surface-variant text-sm mb-3">
                      {preset.description}
                    </p>

                    {/* Recurrence Chips */}
                    <div className="flex items-center gap-2 flex-wrap mb-4">
                      <span className="px-2.5 py-1 rounded-full bg-surface-container-low text-primary font-label-sm font-semibold flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">repeat</span>
                        {preset.recurrence_type === "yearly"
                          ? "ทุก 1 ปี (รายปี)"
                          : preset.recurrence_type === "monthly"
                          ? `ทุกวันที่ ${preset.recurrence_day || 15} ของเดือน`
                          : preset.recurrence_type === "every_n_days"
                          ? "ทุก 3 เดือน (Quarterly)"
                          : "ไม่ทำซ้ำ"}
                      </span>
                      <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-label-sm font-semibold flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">timelapse</span>
                        ระยะเวลาทำ {preset.duration_days || 5} วัน
                      </span>
                    </div>

                    {/* Checklist Preview Box */}
                    <div className="p-3.5 rounded-2xl bg-surface-container-low/70 mb-4">
                      <div className="flex items-center justify-between font-label-sm mb-2">
                        <span className="text-on-surface-variant font-semibold">
                          รายการเช็กลิสต์ในแม่แบบ
                        </span>
                        <span className="text-primary font-bold">
                          {checklistItems.length} ข้อ
                        </span>
                      </div>
                      <ul className="space-y-1.5">
                        {checklistItems.slice(0, 5).map((item, idx) => (
                          <li
                            key={idx}
                            className="font-label-sm text-on-surface flex items-start gap-2"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0"></span>
                            <span className="line-clamp-1">{item.text}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="flex items-center justify-between pt-2 border-t border-surface-container">
                    <span
                      className="font-label-sm text-on-surface-variant"
                      title="ระบบอัตโนมัติจะสร้างการ์ดงานนี้รอไว้ก่อนถึงวันครบกำหนด"
                    >
                      สร้างรอล่วงหน้า {preset.create_ahead_days || 5} วัน
                    </span>
                    <button
                      disabled={isViewer}
                      onClick={() => onLaunchPreset(preset, quickDueDate)}
                      className="px-4 py-2 rounded-full bg-primary-container text-on-primary font-label-md font-bold shadow-sm hover:opacity-95 transition-all flex items-center gap-1 disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-base">add</span>
                      <span>สร้างงานจากแม่แบบนี้</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN (Span 4): Create/Edit Preset Form + Google Calendar (GAS) Integration */}
        <div className="lg:col-span-4 flex flex-col gap-space-lg">
          {/* Card 1: Create or Edit Preset Form */}
          <div
            ref={formCardRef}
            className={`bg-surface-container-lowest rounded-3xl p-space-lg shadow-[0_12px_32px_-8px_rgba(37,99,235,0.07)] border-2 transition-all ${
              editingPresetId
                ? "border-primary-container ring-4 ring-primary/15"
                : "border-white/80"
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-2xl">
                  {editingPresetId ? "edit_note" : "add_box"}
                </span>
                <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                  {editingPresetId ? "แก้ไขแม่แบบงาน (Edit Preset)" : "สร้างแม่แบบใหม่ (New Preset)"}
                </h3>
              </div>
              {editingPresetId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-label-sm font-bold"
                >
                  ยกเลิกแก้ไข
                </button>
              )}
            </div>

            <form onSubmit={handleSavePresetForm} className="space-y-3.5">
              <div>
                <label className="font-label-sm font-bold text-on-surface-variant block mb-1">
                  ชื่อแม่แบบงาน HR *
                </label>
                <input
                  type="text"
                  required
                  disabled={isViewer}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="เช่น ตรวจสุขภาพประจำปี, ยื่น กท.20..."
                  className="w-full px-4 py-2.5 rounded-2xl bg-surface-container-low text-on-surface font-body-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="font-label-sm font-bold text-on-surface-variant block mb-1">
                  คำอธิบายสั้นๆ
                </label>
                <input
                  type="text"
                  disabled={isViewer}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="รายละเอียดของแม่แบบงาน..."
                  className="w-full px-4 py-2 rounded-2xl bg-surface-container-low text-on-surface font-body-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-label-sm font-bold text-on-surface-variant block mb-1">
                    หมวดหมู่งาน
                  </label>
                  <select
                    disabled={isViewer}
                    value={newCatId}
                    onChange={(e) => setNewCatId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-surface-container-low text-on-surface font-label-md"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-label-sm font-bold text-on-surface-variant block mb-1">
                    ความสำคัญเริ่มต้น
                  </label>
                  <select
                    disabled={isViewer}
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-surface-container-low text-on-surface font-label-md"
                  >
                    <option value="urgent">🔥 ด่วนที่สุด (Urgent)</option>
                    <option value="high">⚡ สำคัญสูง (High)</option>
                    <option value="medium">📌 ปานกลาง (Medium)</option>
                    <option value="low">ทั่วไป (Low)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-label-sm font-bold text-on-surface-variant block mb-1">
                    รอบการทำซ้ำ (Recurrence)
                  </label>
                  <select
                    disabled={isViewer}
                    value={newRecurrence}
                    onChange={(e) => setNewRecurrence(e.target.value as RecurrenceType)}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-surface-container-low text-on-surface font-label-md"
                  >
                    <option value="monthly">รายเดือน (Monthly)</option>
                    <option value="yearly">รายปี (Yearly)</option>
                    <option value="every_n_days">ทุกไตรมาส (90 วัน)</option>
                    <option value="none">ไม่ทำซ้ำ</option>
                  </select>
                </div>

                {newRecurrence === "monthly" || newRecurrence === "yearly" ? (
                  <div>
                    <label className="font-label-sm font-bold text-on-surface-variant block mb-1">
                      ครบกำหนดทุกวันที่
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      disabled={isViewer}
                      value={newRecurrenceDay}
                      onChange={(e) => setNewRecurrenceDay(Number(e.target.value))}
                      className="w-full px-3.5 py-2 rounded-2xl bg-surface-container-low text-on-surface font-label-md"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="font-label-sm font-bold text-on-surface-variant block mb-1">
                      ระยะเวลาทำงาน (วัน)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      disabled={isViewer}
                      value={newDuration}
                      onChange={(e) => setNewDuration(Number(e.target.value))}
                      className="w-full px-3.5 py-2 rounded-2xl bg-surface-container-low text-on-surface font-label-md"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-label-sm font-bold text-on-surface-variant block mb-1">
                    สร้างงานรอล่วงหน้า (วัน)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={90}
                    disabled={isViewer}
                    value={newCreateAhead}
                    onChange={(e) => setNewCreateAhead(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-2xl bg-surface-container-low text-on-surface font-label-md"
                  />
                </div>
                <div>
                  <label className="font-label-sm font-bold text-on-surface-variant block mb-1">
                    ระยะเวลาทำงาน (วัน)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    disabled={isViewer}
                    value={newDuration}
                    onChange={(e) => setNewDuration(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-2xl bg-surface-container-low text-on-surface font-label-md"
                  />
                </div>
              </div>

              {/* Helpful explanation box for create_ahead_days */}
              <div className="p-3 rounded-2xl bg-blue-50/80 border border-blue-200 text-xs text-slate-700 leading-relaxed">
                💡 <strong>สร้างงานรอล่วงหน้า {newCreateAhead} วัน</strong> หมายถึง: ถ้ารอบงานนี้ครบกำหนดส่งวันที่{" "}
                <strong>{newRecurrenceDay || 15}</strong> ระบบอัตโนมัติจะเสกการ์ดงานนี้ขึ้นมาวางรอในช่อง{" "}
                <em>รอดำเนินการ (To Do)</em> ล่วงหน้าตั้งแต่วันที่{" "}
                <strong>{Math.max(1, (newRecurrenceDay || 15) - newCreateAhead)}</strong> เพื่อที่คุณจะได้เห็นงานและมีเวลาเตรียมตัวทำก่อนถึงเดดไลน์ครับ
              </div>

              <div>
                <label className="font-label-sm font-bold text-on-surface-variant block mb-1">
                  Checklist ประจำงาน (บรรทัดละ 1 ข้อ)
                </label>
                <textarea
                  rows={4}
                  disabled={isViewer}
                  value={newChecklistText}
                  onChange={(e) => setNewChecklistText(e.target.value)}
                  placeholder={"- เช็กรายชื่อพนักงานที่เข้าเกณฑ์\n- ส่งเอกสารให้แผนกบัญชีอนุมัติ\n- บันทึกใบเสร็จเข้าแฟ้ม"}
                  className="w-full px-4 py-2.5 rounded-2xl bg-surface-container-low text-on-surface font-body-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex gap-2">
                {editingPresetId && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="w-1/3 py-3 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-label-md font-bold"
                  >
                    ยกเลิก
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isViewer}
                  className="flex-1 py-3 rounded-full bg-primary-container text-on-primary font-label-md font-bold shadow-md hover:opacity-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-lg">save</span>
                  <span>
                    {editingPresetId ? "บันทึกการแก้ไขแม่แบบ" : "บันทึกเข้าคลังแม่แบบ"}
                  </span>
                </button>
              </div>
            </form>
          </div>

          {/* Card 2: Reusable Checklist Library Manager */}
          <div className="bg-surface-container-lowest rounded-3xl p-space-lg shadow-[0_12px_32px_-8px_rgba(37,99,235,0.07)] border-2 border-white/80 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-2xl">
                  checklist
                </span>
                <div>
                  <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface leading-tight">
                    คลัง Checklist กลาง ({checklistTemplates.length} ชุด)
                  </h3>
                  <p className="text-xs text-slate-500">
                    ใช้ดึงรายการย่อยเข้างานใดก็ได้ในหน้าต่างแก้ไขงาน
                  </p>
                </div>
              </div>
              {editingChkId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingChkId(null);
                    setChkName("");
                    setChkItemsText("");
                  }}
                  className="px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                >
                  ยกเลิก
                </button>
              )}
            </div>

            {/* Existing Checklist Templates */}
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {checklistTemplates.map((tpl) => {
                const tplItems = Array.isArray(tpl.items) ? tpl.items : [];
                return (
                  <div
                    key={tpl.id}
                    className={`p-3 rounded-2xl border transition-all ${
                      editingChkId === tpl.id
                        ? "bg-blue-50 border-primary-container"
                        : "bg-surface-container-low/70 border-transparent"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className="text-sm font-extrabold text-slate-900 leading-snug">
                        {tpl.name}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingChkId(tpl.id);
                            setChkName(tpl.name);
                            setChkItemsText(tplItems.map((i) => `- ${i}`).join("\n"));
                          }}
                          className="px-2.5 py-0.5 rounded-full bg-white hover:bg-blue-100 text-slate-700 hover:text-primary text-xs font-bold border border-slate-200"
                        >
                          แก้ไข
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`ต้องการลบชุด "${tpl.name}" ใช่หรือไม่?`)) {
                              onDeleteChecklistTemplate(tpl.id);
                            }
                          }}
                          className="px-2 py-0.5 rounded-full text-slate-400 hover:text-error hover:bg-red-50 text-xs font-bold"
                          title="ลบชุดนี้"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    <ul className="space-y-0.5">
                      {tplItems.slice(0, 3).map((item, i) => (
                        <li key={i} className="text-xs text-slate-600 truncate">
                          • {item}
                        </li>
                      ))}
                      {tplItems.length > 3 && (
                        <li className="text-xs font-bold text-primary">
                          + อีก {tplItems.length - 3} ข้อ
                        </li>
                      )}
                    </ul>
                  </div>
                );
              })}
            </div>

            {/* Create / Edit Checklist Template Form */}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const lines = chkItemsText
                  .split("\n")
                  .map((l) => l.replace(/^[-•*]\s*/, "").trim())
                  .filter(Boolean);
                if (!chkName.trim() || lines.length === 0) return;
                setSavingChk(true);
                try {
                  if (editingChkId) {
                    await onUpdateChecklistTemplate(editingChkId, chkName.trim(), lines);
                  } else {
                    await onCreateChecklistTemplate(chkName.trim(), lines);
                  }
                  setEditingChkId(null);
                  setChkName("");
                  setChkItemsText("");
                } finally {
                  setSavingChk(false);
                }
              }}
              className="space-y-2.5 pt-3 border-t border-surface-container"
            >
              <input
                type="text"
                required
                disabled={isViewer}
                value={chkName}
                onChange={(e) => setChkName(e.target.value)}
                placeholder="ชื่อชุด Checklist ใหม่ เช่น สรรหาพนักงาน Sales..."
                className="w-full px-4 py-2 rounded-2xl bg-surface-container-low text-on-surface text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <textarea
                rows={4}
                required
                disabled={isViewer}
                value={chkItemsText}
                onChange={(e) => setChkItemsText(e.target.value)}
                placeholder={"รายการย่อย (บรรทัดละ 1 ข้อ)\n- โพสต์ประกาศงาน\n- คัดกรองเรซูเม่\n- นัดสัมภาษณ์"}
                className="w-full px-4 py-2 rounded-2xl bg-surface-container-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="submit"
                disabled={isViewer || savingChk}
                className="w-full py-2.5 rounded-full bg-slate-900 hover:bg-primary-container text-white text-sm font-bold shadow-sm transition-all disabled:opacity-50"
              >
                {savingChk
                  ? "กำลังบันทึก..."
                  : editingChkId
                  ? "บันทึกการแก้ไขชุด Checklist"
                  : "+ เพิ่มชุด Checklist เข้าคลังกลาง"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
