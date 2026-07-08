import * as XLSX from "xlsx";
import { BookingRecord } from "@/lib/db";

// ═════════════════════════════════════════════════════════════════════════════
// REPORTING LIBRARY — E83 Pickleball
// ═════════════════════════════════════════════════════════════════════════════

// ─── Date helpers ─────────────────────────────────────────────────────────────

export function localDateStr(d: Date): string {
  return (
    d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

export interface DateRange {
  startDate: string;
  endDate: string;
  label: string;
}

export type PeriodPreset =
  | "today" | "yesterday"
  | "this_week" | "last_week"
  | "this_month" | "last_month"
  | "this_year" | "custom";

export function getDateRange(preset: PeriodPreset, custom?: { start: string; end: string }): DateRange {
  const now = new Date();
  const today = localDateStr(now);

  switch (preset) {
    case "today":
      return { startDate: today, endDate: today, label: `Hôm nay (${today})` };

    case "yesterday": {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      const ys = localDateStr(y);
      return { startDate: ys, endDate: ys, label: `Hôm qua (${ys})` };
    }

    case "this_week": {
      const dow = (now.getDay() + 6) % 7;
      const mon = new Date(now); mon.setDate(now.getDate() - dow);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      return { startDate: localDateStr(mon), endDate: localDateStr(sun), label: "Tuần này" };
    }

    case "last_week": {
      const dow  = (now.getDay() + 6) % 7;
      const lMon = new Date(now); lMon.setDate(now.getDate() - dow - 7);
      const lSun = new Date(lMon); lSun.setDate(lMon.getDate() + 6);
      return { startDate: localDateStr(lMon), endDate: localDateStr(lSun), label: "Tuần trước" };
    }

    case "this_month": {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const last  = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const VN_MONTHS = ["Tháng 1","Tháng 2","Tháng 3","Tháng 4","Tháng 5","Tháng 6",
                         "Tháng 7","Tháng 8","Tháng 9","Tháng 10","Tháng 11","Tháng 12"];
      return { startDate: localDateStr(first), endDate: localDateStr(last),
               label: `${VN_MONTHS[now.getMonth()]} ${now.getFullYear()}` };
    }

    case "last_month": {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last  = new Date(now.getFullYear(), now.getMonth(), 0);
      const VN_MONTHS = ["Tháng 1","Tháng 2","Tháng 3","Tháng 4","Tháng 5","Tháng 6",
                         "Tháng 7","Tháng 8","Tháng 9","Tháng 10","Tháng 11","Tháng 12"];
      return { startDate: localDateStr(first), endDate: localDateStr(last),
               label: `${VN_MONTHS[first.getMonth()]} ${first.getFullYear()} (tháng trước)` };
    }

    case "this_year": {
      const first = new Date(now.getFullYear(), 0, 1);
      const last  = new Date(now.getFullYear(), 11, 31);
      return { startDate: localDateStr(first), endDate: localDateStr(last), label: `Năm ${now.getFullYear()}` };
    }

    case "custom":
      if (!custom) return getDateRange("today");
      return { startDate: custom.start, endDate: custom.end, label: `${custom.start} đến ${custom.end}` };

    default:
      return getDateRange("today");
  }
}

// ─── Revenue calculation ───────────────────────────────────────────────────────

export interface RevenueSummary {
  totalRevenue: number;
  confirmedRevenue: number;
  pendingRevenue: number;
  refundedRevenue: number;
  netRevenue: number;
  totalBookings: number;
  confirmedBookings: number;
  pendingBookings: number;
  cancelledBookings: number;
  avgBookingValue: number;
}

export function calculateRevenue(bookings: BookingRecord[]): RevenueSummary {
  const confirmed  = bookings.filter((b) => b.status === "confirmed");
  const pending    = bookings.filter((b) => b.status === "pending_verification");
  const cancelled  = bookings.filter((b) => b.status === "cancelled" || b.status === "rejected");

  const confirmedRevenue = confirmed.reduce((s, b) => s + (b.totalPrice ?? 0), 0);
  const pendingRevenue   = pending.reduce((s, b)   => s + (b.totalPrice ?? 0), 0);
  const refundedRevenue  = 0;

  return {
    totalRevenue:      confirmedRevenue + pendingRevenue,
    confirmedRevenue,
    pendingRevenue,
    refundedRevenue,
    netRevenue:        confirmedRevenue - refundedRevenue,
    totalBookings:     bookings.length,
    confirmedBookings: confirmed.length,
    pendingBookings:   pending.length,
    cancelledBookings: cancelled.length,
    avgBookingValue:   confirmed.length > 0 ? Math.round(confirmedRevenue / confirmed.length) : 0,
  };
}

// ─── Duration helpers ──────────────────────────────────────────────────────────

function calcDurationMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

function formatDurationHuman(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} phút`;
  if (m === 0) return `${h} giờ`;
  return `${h} giờ ${m} phút`;
}

// ─── Vietnamese filename ────────────────────────────────────────────────────────
// Filename is pure ASCII (safe for all OS/browser downloads) but the sheet
// content is fully in Vietnamese.

export function generateFilename(range: DateRange): string {
  if (range.startDate === range.endDate) {
    return `bao-cao-doanh-thu-${range.startDate}.xlsx`;
  }
  const start = new Date(range.startDate + "T00:00:00");
  const end   = new Date(range.endDate   + "T00:00:00");
  const isFullMonth =
    start.getDate() === 1 &&
    end.getDate() === new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate() &&
    start.getMonth() === end.getMonth() &&
    start.getFullYear() === end.getFullYear();

  if (isFullMonth) {
    const m = String(start.getMonth() + 1).padStart(2, "0");
    return `bao-cao-doanh-thu-thang-${m}-${start.getFullYear()}.xlsx`;
  }
  return `bao-cao-doanh-thu-${range.startDate}-den-${range.endDate}.xlsx`;
}

// ─── Status translation ────────────────────────────────────────────────────────

const STATUS_VN: Record<string, string> = {
  pending_verification: "Chờ xác nhận",
  confirmed:            "Đã xác nhận",
  rejected:             "Từ chối",
  cancelled:            "Đã hủy",
};

// ─── Court utilisation ─────────────────────────────────────────────────────────

export interface CourtUtilisation {
  court: string;
  totalBookings: number;
  totalMinutes: number;
  utilizationPct: number;
}

export function calcCourtUtilisation(bookings: BookingRecord[], range: DateRange): CourtUtilisation[] {
  const days = Math.max(
    1,
    Math.round((new Date(range.endDate).getTime() - new Date(range.startDate).getTime()) / 86_400_000) + 1
  );
  const availMinutesPerCourt = days * (21 * 60 - 5 * 60 - 30); // 05:30→21:00

  const byCourt: Record<string, BookingRecord[]> = {};
  for (const b of bookings.filter((x) => x.status === "confirmed")) {
    if (!byCourt[b.court]) byCourt[b.court] = [];
    byCourt[b.court].push(b);
  }

  return Object.entries(byCourt).map(([court, recs]) => {
    const totalMinutes = recs.reduce((s, b) => s + calcDurationMinutes(b.start, b.end), 0);
    return {
      court: `Sân ${court}`,
      totalBookings: recs.length,
      totalMinutes,
      utilizationPct: Math.min(100, Math.round((totalMinutes / availMinutesPerCourt) * 100)),
    };
  });
}

// ─── Excel workbook builder ────────────────────────────────────────────────────
//
// WHY VALUES-ONLY (no formulas):
//   SheetJS's XLSX writer does not execute formulas — it writes formula strings
//   like =SUM(...) as text. Excel normally re-evaluates on open, but this is
//   unreliable across versions, platforms (LibreOffice, Google Sheets, mobile),
//   and when "Automatic Calculation" is disabled. Pre-computing all values in
//   JavaScript guarantees the file shows correct numbers immediately on every
//   platform and viewer, with no F9 or manual recalculation needed.

export interface ExportOptions {
  bookings: BookingRecord[];
  range: DateRange;
  summary: RevenueSummary;
  reportTitle?: string;
}

export function buildExcelReport(opts: ExportOptions): Buffer {
  const { bookings, range, summary, reportTitle = "Báo cáo doanh thu E83 Pickleball" } = opts;
  const wb = XLSX.utils.book_new();

  // ════════════════════════════════════════════════════════════════════════════
  // SHEET 1 — Tổng quan (Summary first — users see this immediately on open)
  // ════════════════════════════════════════════════════════════════════════════

  const vnd = (n: number) => n.toLocaleString("vi-VN") + " đ";

  // Pre-compute all values — no formulas, no text-prefixed cells
  const confirmedRevenue = summary.confirmedRevenue;
  const pendingRevenue   = summary.pendingRevenue;
  const netRevenue       = summary.netRevenue;
  const grossRevenue     = confirmedRevenue + pendingRevenue;
  const avgValue         = summary.avgBookingValue;

  const summaryRows: (string | number)[][] = [
    [reportTitle],
    [`Kỳ báo cáo: ${range.label}`],
    [`Ngày xuất: ${new Date().toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })}`],
    [],
    ["CHỈ SỐ", "SỐ LƯỢNG / GIÁ TRỊ", "ĐƠN VỊ", "GHI CHÚ"],
    [],
    // ── Booking counts (pre-computed numbers, not formulas)
    ["SỐ LƯỢNG ĐẶT SÂN", "", "", ""],
    ["Tổng đặt sân",          summary.totalBookings,     "lịch",   ""],
    ["Đã xác nhận",           summary.confirmedBookings, "lịch",   ""],
    ["Chờ xác nhận",          summary.pendingBookings,   "lịch",   ""],
    ["Đã hủy / Từ chối",      summary.cancelledBookings, "lịch",   ""],
    [],
    // ── Revenue (pre-computed numbers)
    ["DOANH THU", "", "", ""],
    ["Doanh thu đã xác nhận", confirmedRevenue, "VND", "Các lịch status = Đã xác nhận"],
    ["Doanh thu chờ xác nhận",pendingRevenue,   "VND", "Các lịch status = Chờ xác nhận"],
    ["Tổng doanh thu (gross)", grossRevenue,    "VND", "Xác nhận + Chờ xác nhận"],
    ["Doanh thu ròng",         netRevenue,      "VND", "Đã xác nhận (không tính hoàn tiền)"],
    [],
    // ── Efficiency
    ["HIỆU QUẢ", "", "", ""],
    ["Giá trị TB / lịch",     avgValue,        "VND", "Dựa trên lịch đã xác nhận"],
    [],
    // ── Formatted for readability
    ["", "", "", ""],
    ["Doanh thu ròng (định dạng VN)", vnd(netRevenue), "", ""],
    ["Tổng doanh thu (định dạng VN)", vnd(grossRevenue), "", ""],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary["!cols"] = [{ wch: 36 }, { wch: 22 }, { wch: 8 }, { wch: 40 }];
  if (!wsSummary["!rows"]) wsSummary["!rows"] = [];
  wsSummary["!rows"][0] = { hpt: 22 };
  XLSX.utils.book_append_sheet(wb, wsSummary, "Tổng quan");

  // ════════════════════════════════════════════════════════════════════════════
  // SHEET 2 — Chi tiết đặt sân
  // ════════════════════════════════════════════════════════════════════════════

  const DETAIL_HEADERS = [
    "STT",
    "Mã đặt sân",
    "Họ tên",
    "Số điện thoại",
    "Email",
    "Ngày",
    "Sân",
    "Loại vé",
    "Giờ bắt đầu",
    "Giờ kết thúc",
    "Thời lượng (phút)",
    "Thời lượng",
    "Giá (VND)",
    "Giá (định dạng)",
    "Phương thức TT",
    "Trạng thái TT",
    "Trạng thái đặt sân",
    "Ngày tạo",
  ];

  const detailRows: (string | number)[][] = bookings.map((b, i) => {
    const dMin = calcDurationMinutes(b.start, b.end);
    const price = b.totalPrice ?? 0;
    const payStatus =
      b.status === "confirmed"            ? "Đã thanh toán"   :
      b.status === "pending_verification" ? "Chờ xác nhận"    :
      b.status === "rejected"             ? "Không thanh toán" : "Đã hủy";
    return [
      i + 1,                                           // STT (number)
      b.id,                                            // Mã đặt sân
      b.name,                                          // Họ tên
      b.phone,                                         // SĐT
      b.email ?? "",                                   // Email
      b.date,                                          // Ngày
      `Sân ${b.court}`,                               // Sân
      b.bookingType === "monthly" ? "Vé tháng" : "Lẻ", // Loại vé
      b.start,                                         // Giờ bắt đầu
      b.end,                                           // Giờ kết thúc
      dMin,                                            // Thời lượng (số)
      formatDurationHuman(dMin),                       // Thời lượng (text)
      price,                                           // Giá (số — for SUM)
      vnd(price),                                      // Giá (định dạng VN)
      "Chuyển khoản",                                  // Phương thức TT
      payStatus,                                       // Trạng thái TT
      STATUS_VN[b.status] ?? b.status,                 // Trạng thái đặt sân
      new Date(b.createdAt).toLocaleString("vi-VN"),  // Ngày tạo
    ];
  });

  // Sub-totals per status — pre-computed, not formulas
  const confirmedRows = bookings.filter((b) => b.status === "confirmed");
  const pendingRows   = bookings.filter((b) => b.status === "pending_verification");
  const cancelledRows = bookings.filter((b) => b.status === "rejected" || b.status === "cancelled");

  const sumConfirmed = confirmedRows.reduce((s, b) => s + (b.totalPrice ?? 0), 0);
  const sumPending   = pendingRows.reduce((s, b)   => s + (b.totalPrice ?? 0), 0);
  const sumCancelled = cancelledRows.reduce((s, b) => s + (b.totalPrice ?? 0), 0);
  const sumAll       = bookings.reduce((s, b)       => s + (b.totalPrice ?? 0), 0);

  const detailData: (string | number)[][] = [
    DETAIL_HEADERS,
    ...detailRows,
    [],
    ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "TỔNG KẾT", ""],
    ["", "", "", "", "", "", "", "", "", "", "Tổng đặt sân",  "",    bookings.length,       vnd(sumAll),       "", "", "", ""],
    ["", "", "", "", "", "", "", "", "", "", "Đã xác nhận",   "",    confirmedRows.length,  vnd(sumConfirmed), "", "", "", ""],
    ["", "", "", "", "", "", "", "", "", "", "Chờ xác nhận",  "",    pendingRows.length,    vnd(sumPending),   "", "", "", ""],
    ["", "", "", "", "", "", "", "", "", "", "Đã hủy/Từ chối","",    cancelledRows.length,  vnd(sumCancelled), "", "", "", ""],
  ];

  const wsDetail = XLSX.utils.aoa_to_sheet(detailData);
  wsDetail["!cols"] = [
    { wch: 5  }, // STT
    { wch: 28 }, // Mã đặt sân
    { wch: 22 }, // Họ tên
    { wch: 15 }, // SĐT
    { wch: 26 }, // Email
    { wch: 12 }, // Ngày
    { wch: 8  }, // Sân
    { wch: 10 }, // Loại vé
    { wch: 12 }, // Giờ bắt đầu
    { wch: 12 }, // Giờ kết thúc
    { wch: 18 }, // Thời lượng (phút)
    { wch: 14 }, // Thời lượng (text)
    { wch: 16 }, // Giá (số)
    { wch: 20 }, // Giá (định dạng)
    { wch: 16 }, // Phương thức TT
    { wch: 18 }, // Trạng thái TT
    { wch: 18 }, // Trạng thái đặt sân
    { wch: 22 }, // Ngày tạo
  ];
  if (!wsDetail["!rows"]) wsDetail["!rows"] = [];
  wsDetail["!rows"][0] = { hpt: 18 };
  XLSX.utils.book_append_sheet(wb, wsDetail, "Chi tiết đặt sân");

  // ════════════════════════════════════════════════════════════════════════════
  // SHEET 3 — Sử dụng sân
  // ════════════════════════════════════════════════════════════════════════════

  const util = calcCourtUtilisation(bookings, range);
  if (util.length > 0) {
    const courtData: (string | number)[][] = [
      ["Sân", "Số lịch đã xác nhận", "Tổng giờ sử dụng (phút)", "Tổng giờ sử dụng (giờ)", "Tỷ lệ sử dụng (%)"],
      ...util.map((u) => [
        u.court,
        u.totalBookings,
        u.totalMinutes,
        +(u.totalMinutes / 60).toFixed(1),
        u.utilizationPct,
      ]),
    ];
    const wsUtil = XLSX.utils.aoa_to_sheet(courtData);
    wsUtil["!cols"] = [{ wch: 12 }, { wch: 24 }, { wch: 26 }, { wch: 24 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsUtil, "Sử dụng sân");
  }

  // Write with cellDates:true and bookSST:false for maximum compatibility
  // type:"buffer" returns a Uint8Array-compatible buffer SheetJS can stream
  const buf = XLSX.write(wb, {
    type: "buffer",
    bookType: "xlsx",
    bookSST: false,     // don't use shared string table — avoids encoding issues
    compression: true,  // smaller file
  });
  return Buffer.from(buf);
}
