import { NextRequest, NextResponse } from "next/server";

interface DraftRequestBody {
  prompt?: string;
  rolePrompt?: string;
  provider?: "gemini" | "openai";
  model?: string;
  apiKey?: string;
  taskContext?: {
    title?: string;
    description?: string;
    startDate?: string;
    dueDate?: string;
    categoryName?: string;
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as DraftRequestBody;
    const prompt = (body.prompt || "").trim();

    if (!prompt) {
      return NextResponse.json(
        { error: "กรุณาพิมพ์คำสั่ง (Prompt) ที่ต้องการให้ AI ร่างก่อนครับ" },
        { status: 400 }
      );
    }

    const provider = body.provider || "gemini";
    const rolePrompt =
      (body.rolePrompt || "").trim() ||
      "คุณคือผู้ช่วย HR มืออาชีพ พูดจาสุภาพ กระชับ ชัดเจน และพร้อมร่างข้อความหรือคำสั่งงานให้ใช้งานได้ทันที";

    const ctxLines: string[] = [];
    if (body.taskContext?.title) ctxLines.push(`ชื่องาน: ${body.taskContext.title}`);
    if (body.taskContext?.categoryName) ctxLines.push(`หมวดหมู่: ${body.taskContext.categoryName}`);
    if (body.taskContext?.startDate) ctxLines.push(`วันเริ่มงาน: ${body.taskContext.startDate}`);
    if (body.taskContext?.dueDate) ctxLines.push(`วันครบกำหนด: ${body.taskContext.dueDate}`);
    if (body.taskContext?.description)
      ctxLines.push(`รายละเอียดงานเดิม: ${body.taskContext.description}`);

    const userMessage = [
      ctxLines.length > 0 ? `ข้อมูลบริบทของงานนี้:\n${ctxLines.join("\n")}\n` : "",
      `คำสั่งที่ต้องการให้ร่าง:\n${prompt}`,
      `\nกรุณาตอบกลับเฉพาะเนื้อหาที่ร่างเสร็จแล้วพร้อมนำไปใช้งานหรือมอบหมายต่อในปฏิทินได้ทันที (ไม่ต้องมีคำเกริ่นนำที่ไม่จำเป็น)`,
    ]
      .filter(Boolean)
      .join("\n");

    if (provider === "openai") {
      const apiKey = (body.apiKey || process.env.OPENAI_API_KEY || "").trim();
      if (!apiKey) {
        return NextResponse.json(
          {
            error:
              "ยังไม่ได้ตั้งค่า OpenAI API Key กรุณากดปุ่ม 'ตั้งค่า Role AI & API Key' แล้ววาง Key ก่อนใช้งานครับ",
          },
          { status: 400 }
        );
      }

      const model = (body.model || "gpt-4o-mini").trim();
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: rolePrompt },
            { role: "user", content: userMessage },
          ],
          temperature: 0.7,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = data?.error?.message || `OpenAI API Error (${res.status})`;
        return NextResponse.json({ error: msg }, { status: res.status });
      }

      const text = data?.choices?.[0]?.message?.content?.trim() || "";
      if (!text) {
        return NextResponse.json({ error: "AI ไม่ได้ส่งข้อความกลับมา กรุณาลองใหม่อีกครั้ง" }, { status: 500 });
      }
      return NextResponse.json({ text });
    }

    // Default: Google Gemini API
    const apiKey = (body.apiKey || process.env.GEMINI_API_KEY || "").trim();
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "ยังไม่ได้ตั้งค่า Gemini API Key กรุณากดปุ่ม 'ตั้งค่า Role AI & API Key' แล้ววาง API Key ก่อนใช้งานครับ",
        },
        { status: 400 }
      );
    }

    const model = (body.model || "gemini-2.5-flash").trim();
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: rolePrompt }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: userMessage }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
        },
      }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = data?.error?.message || `Gemini API Error (${res.status})`;
      return NextResponse.json({ error: msg }, { status: res.status });
    }

    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text || "")
        .join("")
        .trim() || "";

    if (!text) {
      return NextResponse.json(
        { error: "AI ไม่ได้ส่งข้อความกลับมา กรุณาลองปรับคำสั่งแล้วลองใหม่อีกครั้ง" },
        { status: 500 }
      );
    }

    return NextResponse.json({ text });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "เกิดข้อผิดพลาดในการเชื่อมต่อระบบ AI" },
      { status: 500 }
    );
  }
}
