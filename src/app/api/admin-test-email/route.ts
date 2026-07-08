import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/adminSession";
import { getSmtpCredentials, getNotificationEmail, ensureSettingsLoaded } from "@/lib/serverSettings";

// Prevent Next.js from statically caching this route at build time.
// All these routes read live data from Turso — caching would serve stale responses.
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isAdminSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureSettingsLoaded();

  const { to } = await req.json();
  if (!to) return NextResponse.json({ ok: false, error: "Missing 'to' field" }, { status: 400 });

  // Load credentials from DB (never from .env)
  const { user: GMAIL_USER, pass: GMAIL_PASS } = getSmtpCredentials();
  const SENDER_NAME = "E83 - Câu lạc bộ Pickleball";

  const notificationEmail = getNotificationEmail();
  const credStatus: Record<string, string> = {
    "Email gửi đi (smtpEmail)":    GMAIL_USER ? `${GMAIL_USER.slice(0, 4)}…`                                      : "(not set)",
    "Email nhận thông báo":         notificationEmail ? `${notificationEmail.slice(0, 4)}…`                       : "(not set)",
    "App Password":                 GMAIL_PASS ? `${GMAIL_PASS.slice(0, 4)}… (${GMAIL_PASS.length} chars stored)` : "(not set)",
    "APP_URL":                      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000 (default)",
  };

  if (!GMAIL_USER || !GMAIL_PASS) {
    return NextResponse.json({
      ok: false,
      error: "Gmail credentials not configured. Go to Admin Settings → Tài khoản, enter your Gmail address and 16-char App Password, then click Lưu cấu hình email.",
      credStatus,
    });
  }

  try {
    const nodemailer = await import("nodemailer");

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: GMAIL_USER, pass: GMAIL_PASS },
    });

    // Verify SMTP credentials before sending
    await transporter.verify();

    const info = await transporter.sendMail({
      from: `"${SENDER_NAME}" <${GMAIL_USER}>`,
      to,
      subject: "[E83 Test] Kiểm tra gửi email",
      html: `
        <div style="font-family:sans-serif;padding:24px;background:#f0f4f0;">
          <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:24px;">
            <h2 style="color:#0E2A21;margin:0 0 12px;">Test email thành công</h2>
            <p style="color:#475569;margin:0 0 12px;">
              Email này được gửi từ <strong>${GMAIL_USER}</strong> qua Gmail SMTP.<br/>
              Nếu bạn nhận được email này, cấu hình hoạt động đúng.
            </p>
            <p style="color:#94a3b8;font-size:12px;margin:0;">
              Thời gian: ${new Date().toLocaleString("vi-VN")}
            </p>
          </div>
        </div>
      `,
    });

    return NextResponse.json({
      ok: true,
      message: `Email đã gửi đến ${to}`,
      messageId: info.messageId,
      credStatus,
    });

  } catch (err: unknown) {
    const e = err as Error & { code?: string; responseCode?: number; response?: string };
    return NextResponse.json({
      ok: false,
      error: e.message,
      code: e.code,
      responseCode: e.responseCode,
      smtpResponse: e.response,
      credStatus,
      hint: getHint(e),
    }, { status: 500 });
  }
}

function getHint(err: { message?: string; code?: string; responseCode?: number }): string {
  const msg = (err.message ?? "").toLowerCase();
  if (err.responseCode === 535 || msg.includes("invalid credentials") || msg.includes("username and password"))
    return "Xác thực thất bại. Hãy chắc chắn GMAIL_APP_PASSWORD là App Password 16 ký tự (không phải mật khẩu Gmail thường). Cũng cần đảm bảo đã bật 2-Step Verification trên tài khoản Google.";
  if (msg.includes("less secure") || msg.includes("application-specific"))
    return "Gmail đang chặn đăng nhập. Bạn phải dùng App Password, không phải mật khẩu thường.";
  if (err.code === "ECONNREFUSED" || err.code === "ETIMEDOUT")
    return "Không thể kết nối smtp.gmail.com:465. Kiểm tra tường lửa hoặc thử port 587.";
  if (msg.includes("certificate") || msg.includes("ssl"))
    return "Lỗi TLS/SSL. Liên hệ hỗ trợ hoặc kiểm tra xem hosting có chặn SSL outbound không.";
  return "Kiểm tra console server để biết thêm chi tiết.";
}
