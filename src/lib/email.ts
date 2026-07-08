// ─── Config ───────────────────────────────────────────────────────────────────
// Gmail SMTP via Nodemailer.
// Credentials are stored in the application database (Admin Settings → Tài khoản).
// Never loaded from .env — the Admin UI is the single source of truth.
//
// The only env var used here is NEXT_PUBLIC_APP_URL, which determines the base
// URL for all links in emails (e.g. the "Verify payment" button).
//
// .env.local example:
//   NEXT_PUBLIC_APP_URL=https://yourdomain.com
//
// In development this defaults to http://localhost:3000.

const SENDER_NAME = "E83 - Câu lạc bộ Pickleball";

/**
 * Resolved once at import time. Falls back to localhost for dev.
 * In production, set NEXT_PUBLIC_APP_URL in your .env / hosting env vars.
 */
const APP_URL = (() => {
  const raw = process.env.NEXT_PUBLIC_APP_URL ?? "";
  // Strip trailing slash so link templates can always append /path
  return raw.replace(/\/+$/, "") || "http://localhost:3000";
})();

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BookingSummary {
  groupId: string;
  bookingType: "single" | "monthly";
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  date: string;       // single booking date, or monthly start date
  endDate?: string;   // monthly ticket end date
  court: string;      // "1" | "2" | "both"
  start: string;
  end: string;
  totalPrice: number;
  contactPhone?: string;
  contactFacebook?: string;
  contactZalo?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const maskPhone = (p: string) => (p.length >= 3 ? `*******${p.slice(-3)}` : p);

const formatPrice = (n: number) => n.toLocaleString("vi-VN") + " VND";

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("vi-VN", {
    weekday: "long", day: "2-digit", month: "2-digit", year: "numeric",
  });
};

const courtLabel = (court: string) =>
  court === "both" ? "Sân 1 + Sân 2" : `Sân ${court}`;

/** Format minutes-based duration as Vietnamese, e.g. 90 → "1 giờ 30 phút" */
const formatDurationMins = (totalMin: number): string => {
  const hours = Math.floor(totalMin / 60);
  const mins  = totalMin % 60;
  if (hours === 0) return `${mins} phút`;
  if (mins  === 0) return `${hours} giờ`;
  return `${hours} giờ ${mins} phút`;
};

/** Compute duration from "HH:MM"–"HH:MM" pair */
const durationFromRange = (start: string, end: string): string => {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return formatDurationMins((eh * 60 + em) - (sh * 60 + sm));
};

// ─── Shared HTML shell ────────────────────────────────────────────────────────

const emailShell = (content: string) => `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>E83 - Câu lạc bộ Pickleball</title>
</head>
<body style="margin:0;padding:0;background:#f0f4f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f0;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

          <!-- Header -->
          <tr>
            <td style="background:#0E2A21;border-radius:20px 20px 0 0;padding:28px 32px;text-align:center;">
              <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="vertical-align:middle;">
                    <img src="data:image/png;base64,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" alt="E83 Logo" width="48" height="48"
                      style="display:block;border-radius:12px;width:48px;height:48px;" />
                  </td>
                  <td style="padding-left:12px;text-align:left;vertical-align:middle;">
                    <div style="color:#ffffff;font-size:16px;font-weight:900;letter-spacing:1px;">E83</div>
                    <div style="color:#6BD5AC;font-size:11px;margin-top:2px;">Câu lạc bộ Pickleball</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:32px;border-radius:0 0 20px 20px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 0;text-align:center;">
              <p style="margin:0;font-size:11px;color:#94a3b8;">
                E83 - Câu lạc bộ Pickleball · 01 Nguyễn Phan Vinh, Sơn Trà, Đà Nẵng<br/>
                Email này được gửi tự động, vui lòng không trả lời.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// ─── Booking summary table (shared) ───────────────────────────────────────────

const bookingTable = (data: BookingSummary, opts: { showFullPhone: boolean }) => `
<table width="100%" cellpadding="0" cellspacing="0"
  style="background:#f8fdf9;border:1px solid #d1fae5;border-radius:14px;overflow:hidden;margin:20px 0;">
  ${[
    [data.bookingType === "monthly" ? "Bắt đầu" : "Ngày", formatDate(data.date)],
    ...(data.bookingType === "monthly" && data.endDate ? [["Kết thúc", formatDate(data.endDate)]] : []),
    ["Sân", courtLabel(data.court)],
    ["Giờ", `${data.start} – ${data.end}`],
    ["Thời lượng", durationFromRange(data.start, data.end)],
    ["Loại", data.bookingType === "monthly" ? "Vé tháng (30 ngày)" : "Đặt sân lẻ"],
    ["Người đặt", data.customerName],
    ["Số điện thoại", opts.showFullPhone ? data.customerPhone : maskPhone(data.customerPhone)],
  ]
    .map(
      ([label, value], i) => `
      <tr style="background:${i % 2 === 0 ? "#f8fdf9" : "#ffffff"};">
        <td style="padding:10px 16px;font-size:12px;color:#64748b;white-space:nowrap;width:40%;">${label}</td>
        <td style="padding:10px 16px;font-size:13px;color:#0f172a;font-weight:500;">${value}</td>
      </tr>`,
    )
    .join("")}
  <tr style="background:#0E2A21;">
    <td style="padding:12px 16px;font-size:12px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Tổng thanh toán</td>
    <td style="padding:12px 16px;font-size:18px;color:#6BD5AC;font-weight:900;">${formatPrice(data.totalPrice)}</td>
  </tr>
</table>
`;

// ─── Owner Email — "customer says they paid, please verify" ──────────────────

const buildOwnerVerificationEmail = (data: BookingSummary): string => {
  const verifyUrl = `${APP_URL}/admin/verify/${data.groupId}`;

  return emailShell(`
    <!-- Alert header -->
    <div style="background:#0E2A21;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0;font-size:16px;font-weight:800;color:#ffffff;">Yêu cầu xác nhận thanh toán</p>
      <p style="margin:4px 0 0;font-size:12px;color:#6BD5AC;">Khách hàng báo đã chuyển khoản — cần admin kiểm tra và xác nhận</p>
    </div>

    <p style="margin:0 0 16px;font-size:14px;color:#334155;">
      Một khách hàng vừa xác nhận đã chuyển khoản cho đơn đặt sân dưới đây. Vui lòng kiểm tra tài khoản ngân hàng, sau đó bấm nút bên dưới để xác nhận hoặc từ chối.
    </p>

    ${bookingTable(data, { showFullPhone: true })}

    <!-- Contact info -->
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:14px 16px;margin-bottom:24px;">
      <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#dc2626;font-weight:700;">Thông tin liên hệ</p>
      <p style="margin:0;font-size:14px;color:#0f172a;font-weight:600;">
        ${data.customerPhone}
        <span style="font-size:12px;color:#64748b;font-weight:400;margin-left:8px;">(${data.customerName})</span>
      </p>
      ${data.customerEmail
        ? `<p style="margin:4px 0 0;font-size:12px;color:#475569;">${data.customerEmail}</p>`
        : `<p style="margin:4px 0 0;font-size:12px;color:#94a3b8;">Khách không cung cấp email</p>`}
    </div>

    <!-- Bright CTA button -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
      <tr>
        <td align="center">
          <a href="${verifyUrl}"
             style="display:inline-block;background:#6BD5AC;color:#0E2A21;font-size:15px;font-weight:800;
                    text-decoration:none;padding:16px 40px;border-radius:999px;letter-spacing:0.5px;
                    box-shadow:0 4px 16px rgba(107,213,172,0.4);">
            Xác nhận thanh toán
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:8px 0 24px;font-size:11px;color:#94a3b8;text-align:center;">
      Link dẫn đến: ${verifyUrl}
    </p>

    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
    <p style="margin:0;font-size:11px;color:#94a3b8;text-align:center;">
      Mã đơn: <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-family:monospace;">${data.groupId}</code>
      · Thời gian: ${new Date().toLocaleString("vi-VN")}
    </p>
  `);
};


// ─── Contact block helper (avoids nested template literal bugs) ───────────────

function buildContactBlock(data: BookingSummary): string {
  const rows: string[] = [];
  if (data.contactPhone) {
    rows.push(`<p style="margin:0 0 4px;font-size:12px;color:#475569;">Điện thoại: <strong>${data.contactPhone}</strong></p>`);
  }
  if (data.contactZalo) {
    rows.push(`<p style="margin:0 0 4px;font-size:12px;color:#475569;">Zalo: <strong>${data.contactZalo}</strong></p>`);
  }
  if (data.contactFacebook) {
    rows.push(`<p style="margin:0;font-size:12px;color:#475569;">Facebook: <a href="${data.contactFacebook}" style="color:#6BD5AC;">${data.contactFacebook}</a></p>`);
  }
  if (rows.length === 0) return "";
  return `
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:14px 16px;margin-bottom:24px;">
      <p style="margin:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#6BD5AC;font-weight:700;">Liên hệ hỗ trợ</p>
      ${rows.join("")}
    </div>`;
}

// ─── Customer Email — "your booking is confirmed" ────────────────────────────

const buildCustomerConfirmedEmail = (data: BookingSummary): string =>
  emailShell(`
    <!-- Hero -->
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-block;width:64px;height:64px;background:#f0fdf4;border:2px solid #bbf7d0;border-radius:50%;margin-bottom:16px;">
        <table width="64" height="64" cellpadding="0" cellspacing="0"><tr><td align="center" valign="middle">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 14L11 19L22 8" stroke="#6BD5AC" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </td></tr></table>
      </div>
      <h1 style="margin:0;font-size:22px;font-weight:800;color:#0E2A21;line-height:1.2;">
        Thanh toán đã được xác nhận!
      </h1>
      <p style="margin:8px 0 0;font-size:14px;color:#64748b;">
        Xin chào <strong>${data.customerName}</strong>, lịch của bạn đã được xác nhận chính thức.
      </p>
    </div>

    ${bookingTable(data, { showFullPhone: false })}

    <!-- Note -->
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:14px 16px;margin-bottom:24px;">
      <p style="margin:0;font-size:12px;color:#92400e;line-height:1.6;">
        <strong>Lưu ý:</strong> Vui lòng có mặt tại sân đúng giờ đã đặt.
        Nếu cần hủy hoặc đổi lịch, liên hệ ban quản trị qua Zalo/Facebook trước ít nhất <strong>2 tiếng</strong>.
      </p>
    </div>

    <!-- Court info -->
    <div style="background:#f8fdf9;border-radius:12px;padding:14px 16px;margin-bottom:24px;">
      <p style="margin:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#6BD5AC;font-weight:700;">Thông tin sân</p>
      <p style="margin:0;font-size:12px;color:#475569;line-height:1.7;">
        01 Nguyễn Phan Vinh, Sơn Trà, Đà Nẵng<br/>
        Giờ mở cửa: 05:30 – 21:00 hàng ngày
      </p>
    </div>

    ${buildContactBlock(data)}

    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
    <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
      Cảm ơn bạn đã sử dụng E83 - Câu lạc bộ Pickleball
    </p>
  `);

// ─── SMTP transport — loaded from DB settings ─────────────────────────────────

async function createTransport() {
  // Lazy import to avoid loading nodemailer in non-server contexts
  const nodemailer = await import("nodemailer");
  // Always load settings from Turso first — on Vercel every serverless function
  // invocation starts with an empty in-process cache. Without this call,
  // getSmtpCredentials() returns DEFAULT_SETTINGS (empty credentials) and the
  // email is silently dropped. This is the defence-in-depth safety net so
  // customer emails work even if the calling route forgot ensureSettingsLoaded().
  const { ensureSettingsLoaded, getSmtpCredentials } = await import("@/lib/serverSettings");
  await ensureSettingsLoaded();
  const { user, pass } = getSmtpCredentials();
  return { transporter: nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  }), user };
}

// ─── Send with retry ──────────────────────────────────────────────────────────

const TRANSIENT_CODES = new Set(["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "ESOCKET"]);
const MAX_ATTEMPTS    = 3;
const RETRY_DELAY_MS  = 1500;

async function sendViaGmail(params: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<boolean> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const { transporter, user } = await createTransport();

      if (!user) {
        console.warn(
          "[Email] Gmail SMTP not configured — go to Admin Settings → Tài khoản and save your Gmail address + App Password.",
        );
        return false;
      }

      await transporter.sendMail({
        from: `"${SENDER_NAME}" <${user}>`,  // user = smtpEmail (the sending account)
        to: params.to,
        subject: params.subject,
        html: params.html,
        replyTo: params.replyTo,
      });

      console.log(`[Email] Sent to ${params.to} (attempt ${attempt})`);
      return true;
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException)?.code ?? "";
      const isTransient = TRANSIENT_CODES.has(code);

      console.error(
        `[Email] Send failed (attempt ${attempt}/${MAX_ATTEMPTS}):`,
        (err as Error)?.message ?? err,
      );

      if (attempt < MAX_ATTEMPTS && isTransient) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
        continue;
      }

      console.error(
        "[Email] Delivery failed. Check Admin Settings → Tài khoản — verify Gmail address and App Password are saved correctly.",
      );
      return false;
    }
  }
  return false;
}

// ─── Public send functions ────────────────────────────────────────────────────

/** Notifies the owner when a customer confirms payment — owner must verify.
 *  @param ownerEmail The NOTIFICATION email (Email nhận thông báo) — where the owner receives alerts. */
export async function sendOwnerVerificationRequest(
  data: BookingSummary,
  ownerEmail: string,
): Promise<boolean> {
  if (!ownerEmail) {
    console.warn("[Email] No owner email configured — cannot send verification request");
    return false;
  }
  return sendViaGmail({
    to: ownerEmail,
    subject: `[Cần xác nhận] ${data.customerName} · ${formatDate(data.date)} · ${data.start}–${data.end}`,
    html: buildOwnerVerificationEmail(data),
    replyTo: data.customerEmail || undefined,
  });
}

/** Sent to the customer after admin approves their booking */
export async function sendCustomerConfirmation(data: BookingSummary): Promise<boolean> {
  if (!data.customerEmail) {
    console.warn("[Email] Customer did not provide an email — skipping confirmation email");
    return false;
  }
  return sendViaGmail({
    to: data.customerEmail,
    subject: `Xác nhận đặt sân Pickleball — ${formatDate(data.date)} · ${data.start}–${data.end}`,
    html: buildCustomerConfirmedEmail(data),
  });
}
