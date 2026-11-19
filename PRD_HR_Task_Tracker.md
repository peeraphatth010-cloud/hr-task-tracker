# PRD: HR Task Tracker

| รายการ | รายละเอียด |
|---|---|
| ชื่อผลิตภัณฑ์ | HR Task Tracker (ชื่อชั่วคราว) |
| เวอร์ชันเอกสาร | 0.1 (Draft) |
| วันที่ | 19 พฤศจิกายน 2026 |
| ผู้จัดทำ / Product Owner | พีระภัทร ทำนาย |
| Tech stack | Supabase (Database, Auth, Storage, Edge Functions) + Vercel (Hosting) |

---

## 1. ภาพรวม (Overview)

### 1.1 ปัญหา
งาน HR ของบริษัทขนาดเล็กมีทั้งงานประจำที่วนรอบ (รายเดือน/รายปี) งานที่มี Deadline ตายตัว และงานเฉพาะกิจ ปัจจุบันขาดที่ติดตามงานแบบรวมศูนย์ ทำให้เสี่ยงลืมงานต่ออายุ/ยื่นเอกสาร (เช่น ต่ออายุ Jobthai) และต้องรวบรวมผลงานเพื่อนำเสนอทุกเดือนด้วยมือ

### 1.2 เป้าหมาย (Goals)
1. ติดตามงาน HR ทั้งหมดได้ในที่เดียว ผ่าน 4 มุมมองหลัก: **Kanban, List, Timeline, Gantt**
2. สร้างงานซ้ำๆ ได้เร็วด้วย **Preset (แม่แบบงาน)** พร้อม Checklist และกำหนดวันอัตโนมัติ
3. มี **Present Flag** เพื่อเลือกว่างานไหนจะถูกดึงไปใช้นำเสนอผลงานประจำเดือน และงานไหนไม่ต้องการแสดง (เช่น งานส่งประกันสังคม)
4. **Export เป็น Excel** ได้ในปุ่มเดียว โดยกรองเฉพาะงานที่ติด Present ได้
5. **แจ้งเตือนทางอีเมล** ล่วงหน้า 3 วัน และในวันครบกำหนด
6. มีระบบ Login แบ่งสิทธิ์ **Admin (แก้ไขได้)** และ **Viewer (ดูได้อย่างเดียว)**

### 1.3 สิ่งที่ไม่ทำในเวอร์ชันแรก (Non-goals)
- ไม่ใช่ระบบ Project Management ระดับองค์กร (ไม่มี Portfolio, Resource planning ซับซ้อน)
- ไม่มีแอปมือถือ Native (ใช้ Responsive Web / PWA)
- ไม่เชื่อมระบบภายนอก เช่น LINE, Google Calendar (เก็บไว้เป็น Phase ถัดไป)
- ไม่ดึงข้อมูลเงินเดือนหรือข้อมูลส่วนบุคคลของพนักงานเข้าระบบนี้

---

## 2. ผลการรีเสิร์ชระบบที่คล้ายกัน (Competitive Research)

สรุปจากการเปรียบเทียบระบบที่มีชื่อเสียงในปี 2026 (Asana, Monday.com, ClickUp, Trello และอื่นๆ)

| ระบบ | จุดเด่นที่เกี่ยวข้อง | ข้อสังเกต |
|---|---|---|
| **Asana** | มี 5 มุมมองหลัก (List, Board, Calendar, Timeline, Gantt) ใช้ข้อมูลชุดเดียวกันทุกมุมมอง UX เรียนรู้ง่าย Gantt มี Dependency และ Milestone | แผนฟรีจำกัดผู้ใช้และไม่มี Timeline/Gantt |
| **Monday.com** | มุมมองหลากหลาย (Table, Kanban, Timeline, Gantt, Calendar, Workload) มี Dashboard และ Automation แบบ "เมื่อเกิด X ให้ทำ Y" | บางมุมมองต้องใช้แผนที่แพงกว่า Recurring Task อยู่ในกลุ่ม Automation |
| **ClickUp** | มีมุมมองมากกว่า 15 แบบ มี Time tracking ในตัว แผนฟรีใจกว้าง | ซับซ้อนและเรียนรู้ยากสำหรับผู้เริ่มต้น |
| **Trello** | Kanban ที่ใช้ง่ายที่สุด เหมาะกับงานเบาๆ | มุมมองอื่นต้องพึ่ง Power-Up หรือแผนที่สูงขึ้น |

### สิ่งที่นำมาใช้ (Key Takeaways)
1. **ข้อมูลชุดเดียว หลายมุมมอง:** ทุก View (Kanban/List/Timeline/Gantt/Calendar) ต้องอ่านจาก Table `tasks` เดียวกัน แก้ที่หนึ่งเห็นทุกที่
2. **Recurring + Template เป็นหัวใจ:** ระบบใหญ่มักล็อกฟีเจอร์งานซ้ำไว้ในแผนแพง แต่สำหรับงาน HR ถือเป็นฟีเจอร์แกนหลัก เราทำเองให้เรียบง่ายและไม่จำกัด
3. **Dashboard สรุปภาพรวมสำคัญ:** ระบบชั้นนำมี Dashboard เป็นจุดขาย เราทำเวอร์ชันย่อที่ตอบโจทย์การนำเสนอรายเดือน
4. **หลีกเลี่ยงความซับซ้อนเกินจำเป็น:** ข้อวิจารณ์หลักของระบบใหญ่คือ Learning curve สูง ระบบของเราเป็นงาน HR ของคนๆ เดียว ต้อง "เปิดมาแล้วใช้ได้ทันที"
5. **สิ่งที่ระบบทั่วไปไม่มี และเราจะมี:** Present Flag และ Export Excel สำหรับรายงานประจำเดือนโดยเฉพาะ

> หมายเหตุ: ราคาและแผนของแต่ละระบบเปลี่ยนบ่อย ควรตรวจสอบหน้าเว็บทางการก่อนตัดสินใจเปรียบเทียบเชิงราคา

---

## 3. ผู้ใช้และสิทธิ์ (Users & Roles)

| Role | สิทธิ์ | ผู้ใช้ |
|---|---|---|
| **Admin** | สร้าง/แก้ไข/ลบงาน, จัดการ Preset, อัปโหลดไฟล์, Comment, Time tracking, Export, จัดการผู้ใช้ | เจ้าของระบบ (HR) |
| **Viewer** | ดูงานทุก View, ดู Dashboard, ดูไฟล์แนบ และ Comment ได้อย่างเดียว ไม่สามารถแก้ไขหรือลบ | ผู้ที่ได้รับเชิญ เช่น หัวหน้า/ผู้บริหาร |

### กติกาด้านสิทธิ์
- ต้อง Login ก่อนใช้งานทุกหน้า (Supabase Auth: Email + Password หรือ Magic Link)
- บังคับสิทธิ์ที่ระดับฐานข้อมูลด้วย **Row Level Security (RLS)** ไม่ใช่ซ่อนปุ่มในหน้าเว็บอย่างเดียว
- Admin เพิ่ม/เปลี่ยน Role ผู้ใช้ได้
- **ข้อเสนอ:** เพิ่มฟิลด์ `visibility` ของงาน (`team` / `admin_only`) เพื่อซ่อนงานที่ละเอียดอ่อน (เช่น งานเกี่ยวกับ Payroll) จาก Viewer *(รอยืนยันใน Open Questions)*

---

## 4. แนวคิดหลัก (Core Concepts)

| แนวคิด | ความหมาย |
|---|---|
| **Task** | งานหนึ่งชิ้น มีชื่อ, สถานะ, วันเริ่ม, วันครบกำหนด, หมวดหมู่, ความสำคัญ ฯลฯ |
| **Category** | หมวดงาน HR เช่น สรรหา, Payroll, ภาษี/ประกันสังคม, ISO/เอกสาร, Training, Employee Relations |
| **Preset (Template)** | แม่แบบงานที่บันทึกไว้ มีชื่อ, หมวด, Checklist, ระยะเวลา, ค่า Present เริ่มต้น และรอบการทำซ้ำ |
| **Recurrence** | กติกาสร้างงานซ้ำ เช่น ทุกเดือนวันที่ X, ทุกปี, ทุก N วัน |
| **Present Flag** | ตัวเลือก "นำไปแสดงในรายงานนำเสนอ" ระดับงาน (Boolean) |
| **Checklist** | รายการย่อยในงาน ติ๊กเสร็จได้ และคำนวณ % ความคืบหน้า |

---

## 5. ข้อกำหนดฟีเจอร์ (Functional Requirements)

ลำดับความสำคัญ: **P0** = ต้องมีใน MVP, **P1** = ควรมีใน Release ถัดไป, **P2** = ถ้ามีเวลา

### 5.1 Authentication & Roles (P0)
- FR-1.1: Login/Logout ด้วย Email
- FR-1.2: มี 2 Role คือ Admin และ Viewer
- FR-1.3: Admin เชิญผู้ใช้ใหม่และกำหนด Role ได้
- FR-1.4: RLS บังคับว่า Viewer ทำได้แค่ SELECT

### 5.2 Task Management พื้นฐาน (P0)
- FR-2.1: สร้าง/แก้ไข/ลบ/ทำสำเนางาน (Admin)
- FR-2.2: ฟิลด์: ชื่องาน, รายละเอียด, สถานะ, ความสำคัญ (Low/Medium/High/Urgent), หมวดหมู่, วันเริ่ม, วันครบกำหนด, Tags, Present Flag
- FR-2.3: สถานะเริ่มต้น: `To Do`, `In Progress`, `Waiting`, `Done` (ปรับชื่อได้ภายหลัง)
- FR-2.4: งานหลักมีงานย่อย (Subtask) ได้ 1 ระดับ
- FR-2.5: ค้นหา กรอง (สถานะ/หมวด/ความสำคัญ/ช่วงวัน/Present) และเรียงลำดับ
- FR-2.6: เมื่อสถานะเป็น `Done` ระบบบันทึกวันเวลาที่เสร็จจริง (`completed_at`)

### 5.3 Kanban Board (P0)
- FR-3.1: แสดงคอลัมน์ตามสถานะ ลากการ์ดข้ามคอลัมน์เพื่อเปลี่ยนสถานะ (Admin)
- FR-3.2: การ์ดแสดง ชื่อ, หมวด (สี), Due date, ความสำคัญ, % Checklist, ไอคอนไฟล์/Comment, ป้าย Present
- FR-3.3: การ์ดที่เลยกำหนดแสดงสีเตือน และที่ใกล้ครบ (≤ 3 วัน) แสดงสีเหลือง
- FR-3.4: กรองตามหมวดหมู่และ Present ได้ในหน้า Board
- FR-3.5: เรียงลำดับการ์ดภายในคอลัมน์ด้วยการลาก (เก็บ `position`)
- FR-3.6: Viewer เห็นบอร์ดแต่ลากไม่ได้

### 5.4 List View (P0)
- FR-4.1: ตารางงานทั้งหมด คอลัมน์: ชื่อ, หมวด, สถานะ, ความสำคัญ, เริ่ม, ครบกำหนด, Present, ความคืบหน้า
- FR-4.2: คลิกหัวคอลัมน์เพื่อเรียงลำดับ, มีกรองและค้นหา
- FR-4.3: จัดกลุ่มตาม สถานะ / หมวด / เดือนที่ครบกำหนด
- FR-4.4: แก้ไขเร็วในแถว (Inline edit) สำหรับ สถานะ, วันครบกำหนด, Present (Admin)
- FR-4.5: เลือกหลายแถวเพื่อเปลี่ยนสถานะหรือ Present พร้อมกัน (Bulk action) (P1)

### 5.5 Timeline View (P0)
- FR-5.1: แสดงงานเรียงตามเวลา (แกนวัน/สัปดาห์/เดือน) จัดแถวตามหมวดหมู่หรือสถานะ
- FR-5.2: แถบงานแสดงช่วง `start_date` ถึง `due_date` และมีเส้น "วันนี้"
- FR-5.3: ซูมเข้า/ออกได้ (วัน/สัปดาห์/เดือน)
- FR-5.4: คลิกแถบเพื่อเปิดรายละเอียดงาน, ลากเพื่อเลื่อนวัน (Admin) (P1)

> ความต่างจาก Gantt: Timeline เน้น "ภาพรวมงานตามช่วงเวลาและหมวด" แบบอ่านง่าย ส่วน Gantt เน้น "ความสัมพันธ์ระหว่างงาน (Dependency)"

### 5.6 Gantt Chart (P0)
- FR-6.1: แสดงงานเป็นแถบตามช่วงวัน พร้อมโครงสร้างงานหลัก/งานย่อย
- FR-6.2: รองรับ **Dependency** แบบ Finish-to-Start ระหว่างงาน (เช่น "สรรหาเสร็จ" → "Onboarding")
- FR-6.3: แสดง Progress ในแถบตาม % Checklist
- FR-6.4: ลากปรับวันเริ่ม/จบ และลากเพื่อสร้าง Dependency (Admin) (P1)
- FR-6.5: แสดง Milestone (งานที่ระยะเวลา 0 วัน)
- FR-6.6: ส่งออก Gantt เป็นรูปภาพ/PDF (P2)

### 5.7 Preset / Template งาน (P0)
- FR-7.1: Admin สร้าง Preset ได้ โดยกำหนด: ชื่อ, หมวด, รายละเอียด, Checklist, ความสำคัญ, ระยะเวลา (จำนวนวันจากวันเริ่มถึงครบกำหนด), **ค่า Present เริ่มต้น**, Tags
- FR-7.2: ปุ่ม "สร้างงานจาก Preset" เลือก Preset แล้วระบุวันครบกำหนด ระบบสร้างงานพร้อม Checklist ให้
- FR-7.3: ตั้ง **รอบการทำซ้ำ (Recurrence)** ใน Preset ได้: ไม่ซ้ำ / ทุกเดือน (ระบุวันที่) / ทุกปี (ระบุวัน-เดือน) / ทุก N วัน
- FR-7.4: ระบบสร้างงานรอบถัดไปอัตโนมัติ (Scheduled job) ล่วงหน้าตามที่ตั้ง เช่น 30 วันก่อนครบกำหนด หรือสร้างทันทีที่งานรอบก่อนเป็น `Done`
- FR-7.5: เริ่มต้นมี Preset ตัวอย่างให้แก้ไขได้ (ผู้ใช้กำหนดรายละเอียดและวันเอง):
  - ต่ออายุ Jobthai
  - ส่งประกันสังคมรายเดือน (ค่าเริ่มต้น Present = ปิด)
  - ยื่นภาษีหัก ณ ที่จ่ายรายเดือน (ภ.ง.ด.1)
  - สรุปรายงานเข้า-สาย-ลาประจำเดือน
  - ต่อสัญญาจ้าง/ประเมินผลทดลองงาน
  - ตรวจสอบเอกสาร ISO ประจำรอบ
- FR-7.6: งานที่สร้างจาก Preset จำ `preset_id` ไว้ แก้ Preset แล้วไม่กระทบงานเดิมที่สร้างไปแล้ว

### 5.8 Present Flag & Export Excel (P0)
- FR-8.1: ทุกงานมีสวิตช์ **"รวมในรายงาน Present"** (`include_in_report`) ปรับได้ที่ฟอร์มงาน, List View และ Kanban Card
- FR-8.2: ค่าเริ่มต้นมาจาก Preset (เช่น ประกันสังคม = ปิด, Jobthai = เปิด) แต่แก้เป็นรายงานได้เสมอ
- FR-8.3: ปุ่ม **"Export Excel"** มีตัวเลือก:
  - ช่วงเวลา (เลือกเดือน/ช่วงวัน)
  - เฉพาะงานที่ติด Present / งานทั้งหมด
  - สถานะที่ต้องการ (เช่น เฉพาะ Done)
- FR-8.4: ไฟล์ .xlsx มีชีตอย่างน้อย: (1) สรุปภาพรวม (จำนวนงานแต่ละสถานะ/หมวด, % เสร็จตรงเวลา) (2) รายการงาน (ชื่อ, หมวด, สถานะ, วันเริ่ม, ครบกำหนด, เสร็จจริง, ชั่วโมงที่ใช้, หมายเหตุ)
- FR-8.5: ชื่อไฟล์อัตโนมัติ เช่น `HR_Report_2026-11.xlsx`
- FR-8.6: รองรับภาษาไทยถูกต้อง (UTF-8) และจัดรูปแบบวันที่อ่านง่าย (ตัวเลือกแสดง พ.ศ.)
- FR-8.7: Viewer ใช้ปุ่ม Export ได้หรือไม่ ให้กำหนดใน Open Questions (ค่าเริ่มต้นเสนอ: Admin เท่านั้น)

### 5.9 Email Notification (P0)
- FR-9.1: ส่งอีเมลเตือน **3 วันก่อนครบกำหนด** และ **ในวันครบกำหนด** สำหรับงานที่ยังไม่ `Done`
- FR-9.2: ผู้รับ: ผู้ที่ถูกกำหนดเป็นผู้รับผิดชอบงาน (Admin) และเปิดตัวเลือกเพิ่มผู้รับอื่นได้ (P1)
- FR-9.3: อีเมลหนึ่งฉบับต่อวัน สรุปงานที่ต้องเตือนทั้งหมด (Digest) เพื่อไม่ให้ถูกส่งถี่เกินไป
- FR-9.4: เนื้อหาอีเมลมี ชื่องาน, หมวด, วันครบกำหนด, ลิงก์เปิดงานโดยตรง
- FR-9.5: ไม่ส่งซ้ำสำหรับงานและรอบเตือนเดียวกัน (เก็บ Log การส่ง)
- FR-9.6: งานที่เปลี่ยนเป็น `Done` ก่อนเวลา จะไม่ถูกส่งเตือน
- FR-9.7: เวลาส่งตั้งค่าได้ (เริ่มต้น 08:00 น. เขตเวลา Asia/Bangkok)
- FR-9.8: ตั้งค่าล่วงหน้าเพิ่ม (เช่น 7 วัน) ได้ในอนาคต (P2)

### 5.10 Dashboard สรุป (P1)
- FR-10.1: การ์ดตัวเลข: งานทั้งหมดเดือนนี้, เสร็จแล้ว, กำลังทำ, **เลยกำหนด**, ครบกำหนดใน 7 วัน
- FR-10.2: กราฟสัดส่วนงานตามหมวด และตามสถานะ
- FR-10.3: อัตราการเสร็จตรงเวลาแยกรายเดือน (6 เดือนย้อนหลัง)
- FR-10.4: รายการ "งานที่ต้องทำเร็วๆ นี้"
- FR-10.5: ตัวกรองเดือน เพื่อให้ใช้เป็นหน้าสรุปตอนนำเสนอได้

### 5.11 Calendar View (P1)
- FR-11.1: ปฏิทินรายเดือน/สัปดาห์ แสดงงานตามวันครบกำหนด
- FR-11.2: สีตามหมวดหมู่, คลิกเพื่อดูรายละเอียด
- FR-11.3: ลากเพื่อเปลี่ยนวันครบกำหนด (Admin) (P2)

### 5.12 File Attachments (P1)
- FR-12.1: แนบไฟล์ในงาน (PDF, รูป, Word, Excel) ขนาดไม่เกิน 10 MB ต่อไฟล์ (ปรับได้)
- FR-12.2: เก็บใน Supabase Storage แบบ Private ดาวน์โหลดผ่าน Signed URL
- FR-12.3: Viewer ดู/ดาวน์โหลดได้เฉพาะงานที่ตนมีสิทธิ์เห็น
- FR-12.4: ไม่ควรแนบเอกสารที่มีข้อมูลส่วนบุคคลละเอียดอ่อนโดยไม่จำเป็น (ดูหัวข้อ Security)

### 5.13 Comments (P1)
- FR-13.1: เพิ่มความคิดเห็นในงานได้ เรียงตามเวลา แสดงผู้เขียนและเวลา
- FR-13.2: Admin เขียน/ลบ Comment ได้ ส่วน Viewer เป็นอ่านอย่างเดียว *(หากต้องการให้ Viewer ตอบได้ให้แจ้งใน Open Questions)*
- FR-13.3: ระบบบันทึกกิจกรรมอัตโนมัติ (เปลี่ยนสถานะ, แก้วันครบกำหนด) แสดงในลำดับเดียวกัน

### 5.14 Time Tracking (P1)
- FR-14.1: ปุ่ม Start/Stop จับเวลาในงาน และเพิ่มเวลาด้วยมือ (วันที่, ชั่วโมง, หมายเหตุ)
- FR-14.2: แสดงเวลารวมที่ใช้ต่องาน และต่อหมวดหมู่ในเดือน
- FR-14.3: รวมชั่วโมงเข้าในรายงาน Export Excel
- FR-14.4: จับเวลาได้ครั้งละ 1 งาน หากเริ่มงานใหม่ ระบบถามว่าจะหยุดงานเดิมหรือไม่

### 5.15 Template Checklist (P0 ในตัว Preset / P1 สำหรับ Checklist ใช้ซ้ำ)
- FR-15.1: Checklist เป็นส่วนหนึ่งของ Preset (P0)
- FR-15.2: เพิ่ม/ลบ/เรียงลำดับรายการ Checklist ในงานได้ และติ๊กเสร็จได้
- FR-15.3: % ความคืบหน้างานคำนวณจาก Checklist อัตโนมัติ
- FR-15.4: คลัง Checklist กลางที่นำไปใส่ในงานใดก็ได้ (P1)

---

## 6. โมเดลข้อมูล (Data Model - Supabase / PostgreSQL)

```sql
-- ผู้ใช้และสิทธิ์
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text not null,
  role text not null default 'viewer' check (role in ('admin','viewer')),
  created_at timestamptz default now()
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text default '#6366f1',
  sort_order int default 0
);

create table presets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category_id uuid references categories(id),
  description text,
  priority text default 'medium',
  duration_days int default 0,            -- ระยะเวลาจากวันเริ่มถึงครบกำหนด
  include_in_report_default boolean default false,
  recurrence_type text default 'none'
    check (recurrence_type in ('none','monthly','yearly','every_n_days')),
  recurrence_day int,                     -- วันที่ของเดือน (monthly)
  recurrence_month int,                   -- เดือน (yearly)
  recurrence_interval int,                -- N วัน (every_n_days)
  create_ahead_days int default 0,        -- สร้างงานล่วงหน้ากี่วัน
  checklist jsonb default '[]',           -- [{"text":"...","order":1}]
  tags text[] default '{}',
  is_active boolean default true,
  created_at timestamptz default now()
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references tasks(id) on delete cascade,   -- งานย่อย
  preset_id uuid references presets(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'todo'
    check (status in ('todo','in_progress','waiting','done')),
  priority text default 'medium'
    check (priority in ('low','medium','high','urgent')),
  category_id uuid references categories(id),
  start_date date,
  due_date date,
  completed_at timestamptz,
  include_in_report boolean not null default false,       -- Present Flag
  visibility text not null default 'team'
    check (visibility in ('team','admin_only')),
  tags text[] default '{}',
  position numeric default 0,                              -- ลำดับใน Kanban
  assignee_id uuid references profiles(id),
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table task_dependencies (
  task_id uuid references tasks(id) on delete cascade,
  depends_on_id uuid references tasks(id) on delete cascade,
  primary key (task_id, depends_on_id),
  check (task_id <> depends_on_id)
);

create table checklist_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete cascade,
  text text not null,
  is_done boolean default false,
  sort_order int default 0
);

create table comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete cascade,
  author_id uuid references profiles(id),
  body text not null,
  created_at timestamptz default now()
);

create table attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  size_bytes bigint,
  uploaded_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table time_entries (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete cascade,
  user_id uuid references profiles(id),
  started_at timestamptz,
  ended_at timestamptz,
  minutes int,
  note text
);

create table notification_log (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete cascade,
  kind text check (kind in ('d_minus_3','due_day')),
  sent_to text,
  sent_at timestamptz default now(),
  unique (task_id, kind)
);
```

### นโยบาย RLS (สรุป)
- `tasks`, `comments`, `attachments` และตารางที่เกี่ยวข้อง: **SELECT** ได้ทุกคนที่ Login (Viewer ไม่เห็นแถวที่ `visibility = 'admin_only'`), **INSERT/UPDATE/DELETE** เฉพาะ `role = 'admin'`
- `profiles`: ผู้ใช้อ่านโปรไฟล์ตัวเองได้, Admin อ่าน/แก้ทั้งหมด
- `notification_log`: เขียนโดย Edge Function (Service role) เท่านั้น
- Storage bucket `attachments` เป็น Private ตรวจสิทธิ์ผ่าน Policy

---

## 7. สถาปัตยกรรมและเทคโนโลยี (Technical Architecture)

| ส่วน | ข้อเสนอ | เหตุผล |
|---|---|---|
| Frontend | **Next.js (React) + TypeScript + Tailwind CSS** | Deploy บน Vercel ง่าย รองรับ Responsive |
| UI components | shadcn/ui | ได้ฟอร์ม/ตาราง/Dialog สำเร็จรูป |
| Kanban drag & drop | `dnd-kit` | เบา ยืดหยุ่น |
| List/Table | TanStack Table | เรียง กรอง จัดกลุ่มได้ |
| Timeline / Gantt | ไลบรารี Gantt (เช่น Frappe Gantt) หรือ Component เขียนเอง | ต้องทดสอบรองรับ Dependency และภาษาไทย |
| Calendar | FullCalendar หรือเขียนเองด้วย date-fns | |
| Charts (Dashboard) | Recharts | |
| Excel export | ExcelJS หรือ SheetJS | สร้างหลายชีตและจัดรูปแบบได้ |
| Database / Auth / Storage | **Supabase** | ตามที่กำหนด |
| งานตามเวลา (Cron) | **Supabase `pg_cron` + Edge Function** | ใช้ทั้งสร้างงานซ้ำและส่งอีเมลเตือน ไม่ผูกกับข้อจำกัด Cron ของ Vercel |
| ส่งอีเมล | Resend (หรือ SMTP ที่มี) เรียกจาก Edge Function | ตั้งค่าง่าย มีโควตาฟรีสำหรับปริมาณน้อย |
| Hosting | **Vercel** | ตามที่กำหนด |

### Flow แจ้งเตือนอีเมล
```
pg_cron (ทุกวัน 08:00 Asia/Bangkok)
   └─> Edge Function "send-reminders"
         ├─ ค้นงานที่ due_date = วันนี้ + 3  และ status != done  → kind = d_minus_3
         ├─ ค้นงานที่ due_date = วันนี้      และ status != done  → kind = due_day
         ├─ ตัดงานที่มีใน notification_log แล้ว
         ├─ รวมเป็นอีเมล Digest ฉบับเดียว → ส่งผ่าน Resend
         └─ บันทึก notification_log
```

### Flow สร้างงานซ้ำจาก Preset
```
pg_cron (ทุกวัน 00:30)
   └─> Edge Function "generate-recurring-tasks"
         ├─ อ่าน presets ที่ is_active และ recurrence_type != 'none'
         ├─ คำนวณวันครบกำหนดรอบถัดไป - create_ahead_days
         ├─ ถ้ายังไม่มีงานรอบนั้นของ preset นี้ → สร้าง task + checklist_items
         └─ ตั้ง include_in_report จาก include_in_report_default
```

### หมายเหตุด้านการใช้งาน
- ควรตรวจสอบเงื่อนไขแผนของ Vercel (Hobby/Pro) และ Supabase (Free/Pro) เกี่ยวกับการใช้งานเชิงธุรกิจ โควตา และการ Pause โปรเจกต์ที่ไม่ได้ใช้งาน ก่อนใช้จริงกับงานบริษัท

---

## 8. ข้อกำหนดที่ไม่ใช่ฟีเจอร์ (Non-Functional Requirements)

| หมวด | ข้อกำหนด |
|---|---|
| **ประสิทธิภาพ** | โหลดหน้า Board/List ที่มีงาน ≤ 1,000 รายการภายใน 2 วินาที |
| **Responsive** | ใช้งานบนมือถือและแท็บเล็ตได้ (Kanban เลื่อนแนวนอน, List เป็นการ์ด) |
| **ภาษา** | UI เป็นภาษาไทยเป็นหลัก รองรับฟอนต์ไทย (เช่น Noto Sans Thai / Prompt) |
| **วันที่** | เก็บเป็น ค.ศ. ในฐานข้อมูล แสดงผลเป็น พ.ศ. หรือ ค.ศ. ตามตัวเลือก |
| **เขตเวลา** | Asia/Bangkok (UTC+7) ทุกการคำนวณวันครบกำหนดและเวลาแจ้งเตือน |
| **ความปลอดภัย** | HTTPS, RLS ทุกตาราง, ไม่เก็บ Service role key ฝั่ง Client, Storage แบบ Private |
| **ความเป็นส่วนตัว** | ไม่เก็บข้อมูลส่วนบุคคลละเอียดอ่อนของพนักงาน (เงินเดือน, เลขบัตรประชาชน) ในชื่อ/รายละเอียดงานโดยไม่จำเป็น และควรทบทวนให้สอดคล้องกับ PDPA |
| **สำรองข้อมูล** | เปิดใช้การสำรองข้อมูลของ Supabase (ตามแผนที่ใช้) และมีปุ่ม Export Excel เป็นสำรองเพิ่มเติม |
| **Accessibility** | คอนทราสต์สีเพียงพอ, ไม่ใช้สีอย่างเดียวบอกสถานะ (มีไอคอน/ข้อความ) |
| **Audit** | บันทึก `created_at`, `updated_at`, ผู้แก้ไขล่าสุด |

---

## 9. ประสบการณ์ผู้ใช้ (UX Notes)

- **หน้าแรกหลัง Login:** Dashboard (หรือ Board ตามที่ผู้ใช้เลือกเป็นหน้าหลัก)
- **แถบสลับมุมมองด้านบน:** `Board | List | Timeline | Gantt | Calendar` สลับแล้วคงตัวกรองเดิมไว้
- **Quick Add:** ปุ่ม "+ งานใหม่" และ "+ จาก Preset" อยู่ตำแหน่งเดียวกันทุกหน้า
- **ป้าย Present:** ไอคอน/ป้ายเล็กๆ บนการ์ดและแถว กดสลับเปิด-ปิดได้ทันที
- **สีสถานะ:** To Do (เทา), In Progress (น้ำเงิน), Waiting (เหลือง), Done (เขียว), Overdue (แดง)
- **Viewer:** ซ่อนปุ่มแก้ไขทั้งหมด แต่ยังเปิดดูรายละเอียดงานได้

---

## 10. แผนการพัฒนา (Roadmap)

### Phase 1 — MVP (เป้าหมาย 3–4 สัปดาห์)
- ตั้งค่า Supabase + Vercel + Auth + Roles + RLS
- Task CRUD + Category
- **Kanban, List View**
- **Preset + Checklist + Recurrence**
- **Present Flag + Export Excel**
- **Email Reminder (D-3 และวันครบกำหนด)**

### Phase 2 (2–3 สัปดาห์)
- **Timeline View, Gantt (พร้อม Dependency)**
- Dashboard สรุป
- Calendar View

### Phase 3 (2 สัปดาห์)
- File Attachments, Comments + Activity log
- Time Tracking
- คลัง Checklist กลาง, Bulk actions

### Phase 4 (อนาคต)
- แจ้งเตือนผ่าน LINE, ซิงก์ Google Calendar
- รายงานอัตโนมัติรายเดือนส่งทางอีเมล
- เชื่อมกับ JCW People System

> ระยะเวลาเป็นการประมาณเบื้องต้น ขึ้นกับเวลาที่ใช้พัฒนาและวิธีพัฒนา (ทำเอง/ใช้ AI ช่วยเขียนโค้ด)

---

## 11. ตัวชี้วัดความสำเร็จ (Success Metrics)

| ตัวชี้วัด | เป้าหมาย |
|---|---|
| งานที่ลืม/เลยกำหนดโดยไม่ได้ตั้งใจ | ลดลงเหลือ 0 สำหรับงานที่มี Preset |
| เวลาที่ใช้เตรียมรายงานนำเสนอรายเดือน | จากการรวบรวมด้วยมือ → ไม่เกิน 5 นาที (กด Export) |
| เวลาที่ใช้สร้างงานประจำ | ≤ 30 วินาทีต่องาน (หรือสร้างอัตโนมัติ) |
| สัดส่วนงานประจำที่สร้างจาก Preset/Recurrence | ≥ 80% |
| ความสำเร็จของอีเมลเตือน | ≥ 99% ส่งตรงเวลา |

---

## 12. เกณฑ์การยอมรับ (Acceptance Criteria) — MVP

1. Admin Login แล้วสร้างงาน ลากการ์ดเปลี่ยนสถานะใน Kanban และเห็นผลเปลี่ยนใน List View ทันทีหลังรีเฟรช
2. Viewer Login แล้วเห็นข้อมูลครบแต่แก้ไข/ลบไม่ได้ (ทดสอบทั้งผ่าน UI และเรียก API ตรง)
3. สร้าง Preset "ต่ออายุ Jobthai" ตั้งรอบรายปี เมื่อถึงเวลาที่กำหนด ระบบสร้างงานพร้อม Checklist ให้เอง
4. Preset "ส่งประกันสังคม" ตั้งค่า Present = ปิด งานที่สร้างจาก Preset นี้ไม่ปรากฏใน Excel เมื่อเลือก "เฉพาะงาน Present"
5. กดปุ่ม Export เลือกเดือน แล้วได้ไฟล์ .xlsx ภาษาไทยอ่านได้ถูกต้อง มีชีตสรุปและชีตรายการงาน
6. งานที่ครบกำหนดในอีก 3 วันได้รับอีเมลเตือน 1 ครั้ง และงานที่ครบกำหนดวันนี้ได้รับอีเมลอีก 1 ครั้ง ไม่ส่งซ้ำ และไม่ส่งถ้างานเป็น Done แล้ว

---

## 13. ความเสี่ยงและแนวทางรับมือ

| ความเสี่ยง | ผลกระทบ | แนวทางรับมือ |
|---|---|---|
| Gantt พร้อม Dependency ลงมือเองซับซ้อน | ล่าช้า | ใช้ไลบรารีสำเร็จรูป, ทำ Dependency แบบ Finish-to-Start อย่างเดียวก่อน |
| อีเมลเตือนตกกล่องสแปม | พลาด Deadline | ตั้งค่า SPF/DKIM ของโดเมนผู้ส่ง และให้ผู้ใช้ทดสอบส่งอีเมลจริงก่อนใช้งาน |
| ข้อมูลพนักงานรั่วไหลผ่านไฟล์แนบ | ผลกระทบด้านกฎหมาย/ความเชื่อมั่น | จำกัดสิทธิ์ด้วย RLS, Storage Private, มี `admin_only`, ไม่แนบเอกสารอ่อนไหวโดยไม่จำเป็น |
| โครงการ Supabase ถูก Pause หรือเกินโควตาแผนฟรี | ระบบหยุดทำงาน | ตรวจสอบเงื่อนไขแผน, ใช้งานสม่ำเสมอ หรืออัปเกรดเมื่อใช้จริง |
| ขอบเขตบวม (Scope creep) | ไม่เสร็จ | ยึด Phase และลำดับ P0/P1/P2 |

---

## 14. คำถามที่ยังเปิดอยู่ (Open Questions)

1. **Viewer** ต้อง Login เสมอ หรือต้องการลิงก์สาธารณะแบบดูอย่างเดียว (ไม่ต้อง Login)?
2. ต้องการ **ซ่อนงานบางประเภทจาก Viewer** (`admin_only`) หรือไม่ เช่น งาน Payroll หรืองานที่เกี่ยวกับตัวบุคคล?
3. Viewer สามารถ **Comment** และ **Export Excel** ได้หรือไม่?
4. อีเมลเตือนส่งถึง **เฉพาะ Admin** หรือต้องส่งถึงบุคคลอื่นด้วย (เช่น หัวหน้า)?
5. จำเป็นต้องมีมากกว่า 1 Admin หรือไม่?
6. หมวดหมู่และสถานะที่ต้องการใช้จริงมีอะไรบ้าง (เพื่อกำหนดค่าเริ่มต้นให้ตรงกับการทำงาน)?
7. มีโดเมนอีเมลของบริษัทสำหรับใช้เป็นอีเมลผู้ส่งหรือไม่ (ช่วยลดปัญหาตกสแปม)?
8. รูปแบบรายงาน Excel ที่ใช้นำเสนอจริงหน้าตาเป็นอย่างไร (ถ้ามีตัวอย่างจะออกแบบชีตให้ตรงได้)?

---

## ภาคผนวก A: ตัวอย่าง User Stories

| ID | ในฐานะ | ฉันต้องการ | เพื่อ |
|---|---|---|---|
| US-1 | Admin | สร้างงาน "ต่ออายุ Jobthai" จาก Preset ในคลิกเดียว | ไม่ต้องกรอกซ้ำทุกปี |
| US-2 | Admin | ได้อีเมลเตือน 3 วันก่อนและวันครบกำหนด | ไม่พลาดงานสำคัญ |
| US-3 | Admin | ปิด Present ในงานส่งประกันสังคม | ไม่ให้งานนี้ปรากฏในรายงานนำเสนอ |
| US-4 | Admin | กด Export Excel เฉพาะงาน Present ของเดือนนี้ | เตรียมนำเสนอผลงานได้ทันที |
| US-5 | Admin | ดูงานทั้งหมดเป็น Gantt พร้อมความสัมพันธ์ระหว่างงาน | วางแผนงานสรรหา → Onboarding ได้เห็นภาพรวม |
| US-6 | Viewer | เปิดดูความคืบหน้างาน HR แบบอ่านอย่างเดียว | ติดตามสถานะโดยไม่เผลอแก้ข้อมูล |
| US-7 | Admin | จับเวลางานแต่ละชิ้น | รู้ว่าเวลาหมดไปกับงานประเภทไหนมากที่สุด |
| US-8 | Admin | แนบเอกสารและเขียนหมายเหตุในงาน | เก็บหลักฐานและบริบทไว้ที่เดียว |
