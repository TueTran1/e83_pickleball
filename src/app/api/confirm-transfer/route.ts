import { NextRequest, NextResponse } from "next/server";
import { createPendingBooking, createPendingMonthlyBooking } from "@/lib/db";
import { sendOwnerVerificationRequest } from "@/lib/email";
import { getServerSettings, getActivePricingTiers, getNotificationEmail, getInternalSlots, ensureSettingsLoaded } from "@/lib/serverSettings";
import { isInternalSlot } from "@/lib/bookingLogic";
import { calculateRangePrice, calculateMonthlyPrice } from "@/lib/bookingLogic";

// Prevent Next.js from statically caching this route at build time.
// All these routes read live data from Turso — caching would serve stale responses.
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      bookingType, // "single" | "monthly"
      date,
      startDate,
      court, // "1" | "2" | "both"
      start,
      end,
      name,
      phone,
      email,
      totalPrice: clientTotalPrice,
    } = body;

    if (!court || !start || !end || !name || !phone || !clientTotalPrice) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const courts: ("1" | "2")[] = court === "both" ? ["1", "2"] : [court];
    const courtCount: 1 | 2 = court === "both" ? 2 : 1;

    // ── Server-side price recomputation ──────────────────────────────────────
    // Never trust the client-submitted totalPrice. Recompute using the live
    // pricing tiers from the database so the booking UI and backend always
    // agree, even if the admin changed pricing between page load and submit.
    await ensureSettingsLoaded();
    const tiers = getActivePricingTiers();

    // Backend validation: reject bookings during internal (owner-reserved) slots.
    // Checks are court + date aware — a rule for Sân 2 on weekends only blocks Sân 2 on weekends.
    const internalSlots = getInternalSlots();
    if (internalSlots.length > 0) {
      const bookingDate = bookingType === "monthly" ? new Date(startDate + "T00:00:00") : new Date(date + "T00:00:00");
      const bookedCourts: (1|2)[] = court === "both" ? [1, 2] : [Number(court) as 1|2];
      for (const c of bookedCourts) {
        if (isInternalSlot(start, end, internalSlots, c, bookingDate)) {
          return NextResponse.json(
            { error: "Khung giờ này đã được đặt cho nội bộ. Vui lòng chọn khung giờ khác." },
            { status: 409 }
          );
        }
      }
    }
    const refDate = bookingType === "monthly" ? new Date(`${startDate}T00:00:00`) : new Date(`${date}T00:00:00`);
    const expectedTotalPrice =
      bookingType === "monthly"
        ? calculateMonthlyPrice(start, end, courtCount, tiers)
        : calculateRangePrice(start, end, courtCount, tiers, refDate);

    // Allow a tiny rounding tolerance (1 VND) but otherwise reject mismatches.
    if (Math.abs(expectedTotalPrice - Number(clientTotalPrice)) > 1) {
      console.warn(
        `[confirm-transfer] Price mismatch — client sent ${clientTotalPrice}, server computed ${expectedTotalPrice}. Using server value.`,
      );
    }
    const totalPrice = expectedTotalPrice;

    let groupId: string;
    const endDate: string | undefined = undefined;

    if (bookingType === "monthly") {
      if (!startDate) {
        return NextResponse.json({ error: "Missing startDate for monthly booking" }, { status: 400 });
      }
      const result = await createPendingMonthlyBooking({
        startDate,
        days: 30,
        courts,
        start,
        end,
        name,
        phone,
        email: email ?? "",
        totalPrice,
      });
      groupId = result.groupId;

      if (result.skipped.length > 0) {
        // A conflict appeared between the user's earlier check and this submission.
        return NextResponse.json(
          {
            error: "Một số ngày trong khung giờ này đã có người đặt trước khi bạn xác nhận. Vui lòng kiểm tra lại lịch.",
            skipped: result.skipped,
          },
          { status: 409 }
        );
      }
    } else {
      if (!date) {
        return NextResponse.json({ error: "Missing date for single booking" }, { status: 400 });
      }
      try {
        const records = await createPendingBooking({
          date,
          courts,
          start,
          end,
          name,
          phone,
          email: email ?? "",
          totalPrice,
        });
        groupId = records[0].groupId;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Booking conflict";
        return NextResponse.json({ error: message }, { status: 409 });
      }
    }

    // Notify the owner so they can verify the transfer and approve
    const settings = getServerSettings();
    await sendOwnerVerificationRequest(
      {
        groupId,
        bookingType: bookingType === "monthly" ? "monthly" : "single",
        customerName: name,
        customerEmail: email ?? "",
        customerPhone: phone,
        date: bookingType === "monthly" ? startDate : date,
        endDate,
        court,
        start,
        end,
        totalPrice,
        contactPhone:    settings.contactInfo?.phone    ?? "",
        contactFacebook: settings.contactInfo?.facebook ?? "",
        contactZalo:     settings.contactInfo?.zalo     ?? "",
      },
      getNotificationEmail()
    );

    return NextResponse.json({ success: true, groupId, totalPrice });
  } catch (err) {
    console.error("[confirm-transfer] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
