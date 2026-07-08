# E83 - Câu lạc bộ Pickleball — Booking System

A mobile-first Next.js 14 court rental app with a jade green theme (`#6BD5AC`), 30-minute slot booking, monthly tickets, and MoMo payment integration.

**Address:** 01 Nguyễn Phan Vinh, Sơn Trà, Đà Nẵng

---

## Quick Start

```bash
npm install
cp .env.local.example .env.local   # fill in your MoMo + email credentials
npm run dev
```

Open http://localhost:3000

---

## Admin Panel Access

URL: `/admin`
**Password: `E83admin@2026`**

Change this before deploying — edit the `ADMIN_PASSWORD` constant near the top of `src/app/admin/page.tsx`. The session persists in `sessionStorage` until the browser tab closes (no need to log in again on every page refresh during testing).

The admin can view the full booking timetable for **past dates** too (read-only) via the "Xem bảng giờ đầy đủ" link on the dashboard, which opens `/booking?admin=1`.

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Homepage — "Đặt sân ngay" + "Mua vé tháng" CTAs
│   ├── intro/page.tsx               # Introduction page
│   ├── booking/page.tsx             # Single booking — 30-min slots, start+duration picker
│   ├── monthly/page.tsx             # Monthly ticket — 30-day pass, conflict checker
│   ├── checkout/
│   │   ├── info/page.tsx            # Renter info form (name, phone, optional email)
│   │   ├── payment/page.tsx         # MoMo payment — QR + deep link, polls for confirmation
│   │   └── success/page.tsx         # Confirmation screen
│   ├── admin/page.tsx               # Admin panel (password-protected)
│   └── api/
│       ├── bookings/route.ts        # Bookings CRUD (mock data — swap for real DB)
│       ├── momo-create/route.ts     # Creates a MoMo payment request
│       ├── momo-ipn/route.ts        # MoMo's webhook — confirms payment, saves booking, emails
│       ├── monthly-check/route.ts   # Checks 30 days for time-slot conflicts
│       └── payment-status/route.ts  # Frontend polls this while waiting for MoMo IPN
├── components/
│   ├── Calendar.tsx                 # Date picker — past dates greyed out unless admin
│   └── SlotRow.tsx                  # Single 30-min slot row in the timetable
└── lib/
    ├── bookingLogic.ts              # All business rules: slots, pricing, durations
    ├── adminLogic.ts                # Admin settings (lock, announcement) via localStorage
    ├── momo.ts                      # MoMo signature generation + create-payment call
    ├── paymentStore.ts              # In-memory pending-payment tracker (replace with DB)
    └── email.ts                     # HTML email templates + nodemailer sender
```

---

## How Booking Works Now

**Slot model:** the timetable shows **30-minute start marks** (05:30, 06:00, 06:30 …). Tapping an available mark sets it as the start time. A separate "Thời lượng" (duration) dropdown — default `01:00` — controls how long the booking runs, capped so it can never extend past closing time (21:00). E.g. starting at 20:00 only allows up to a 1-hour duration.

**Pricing:**
| Time | Rate |
|---|---|
| 05:30 – 16:30 | 70,000 VND/hour |
| 16:30 – 21:00 | 120,000 VND/hour |

A booking that straddles the 16:30 boundary is priced correctly per half-hour segment.

**Past dates:** normal users cannot select a date before today — those calendar cells are greyed out and disabled. Admins can view (not book) any past date via `/booking?admin=1`.

**Taken slots:** show the customer's name and a masked phone number (`*******123`) instead of a price.

---

## Monthly Tickets (`/monthly`)

1. User picks a **start date** — the pass runs for the following 30 days.
2. User picks a **court** (1, 2, or both) and a **daily time slot** (start + duration), same logic as single booking.
3. User taps **"Kiểm tra lịch trống 30 ngày"** — this calls `/api/monthly-check`, which walks all 30 dates and checks for overlapping bookings on the chosen court(s).
4. If conflicts are found, each conflicting date is listed so the user knows exactly which day(s) need a separate, manual booking.
5. If no conflicts, the user proceeds to checkout. On payment confirmation (MoMo IPN), the system creates 30 individual booking records — one per day.

**Pricing — 10% monthly discount:** the monthly ticket price is `(daily rate × 30 days) × 90%`.

Example: booking 17:00–18:00 daily (falls in the 120,000 VND/h tier):
```
120,000 × 30 days = 3,600,000 VND   (before discount)
3,600,000 × 90%   = 3,240,000 VND   (monthly ticket price)
```

The discount rate lives in `MONTHLY_DISCOUNT_RATE` (`src/lib/bookingLogic.ts`) — currently `0.10`. The monthly page shows the full breakdown: daily rate, 30-day subtotal (struck through), discount amount, and final total.

---

## MoMo Payment Integration

This app uses **MoMo's IPN (Instant Payment Notification)** flow:

1. `/api/momo-create` calls MoMo's `create` API and gets back a `payUrl` / `qrCodeUrl`.
2. The customer pays via the MoMo app (QR scan or deep link).
3. **MoMo calls your server directly** (not through the customer's browser) at `/api/momo-ipn` the moment payment succeeds or fails. This is the IPN.
4. The IPN handler verifies MoMo's signature, marks the payment as paid, creates the booking(s) in the database, and sends confirmation emails.
5. Meanwhile, the customer's browser is polling `/api/payment-status?orderId=...` every 2.5s — once it sees `status: "paid"`, it redirects to the success page.

### Setting up MoMo

1. Register at https://business.momo.vn (or use the public **test** credentials already in `.env.local.example` to try it immediately — no approval needed for sandbox testing).
2. Set `MOMO_PARTNER_CODE`, `MOMO_ACCESS_KEY`, `MOMO_SECRET_KEY` in `.env.local`.
3. **Important:** MoMo's IPN needs a publicly reachable URL. For local development, use a tunnel:
   ```bash
   ngrok http 3000
   ```
   Then set `NEXT_PUBLIC_APP_URL` to the ngrok URL (e.g. `https://abcd1234.ngrok.io`) so MoMo can actually reach `/api/momo-ipn`.
4. Once approved for production, set `MOMO_ENV=production` and replace the test credentials with your real merchant keys.

### Replacing the in-memory payment store

`src/lib/paymentStore.ts` currently uses an in-memory `Map` — fine for local testing, but it resets on server restart and won't work across multiple server instances. Before going live, replace it with a real database table (e.g. a `payments` table keyed by `orderId` in Postgres/Supabase).

---

## Email Confirmations

Sent automatically from inside the MoMo IPN handler once a payment is confirmed:

- **Customer email** — only sent if the customer filled in the optional email field at checkout.
- **Owner email** — sent to `OWNER_EMAIL`, includes the customer's full (unmasked) phone number for follow-up.

Configure SMTP credentials in `.env.local` — see the comments in `.env.local.example` for Gmail App Password setup or other providers.

---

## Database Integration

Both `/api/bookings` and `/api/monthly-check` currently use in-memory mock data. Before production:

1. Replace `MOCK_BOOKINGS` in `src/app/api/bookings/route.ts` with real DB queries.
2. Replace the duplicate mock lookup in `src/app/api/monthly-check/route.ts`'s `getBookingsForDate()` with the same DB query (it should hit the same table).
3. Replace `src/lib/paymentStore.ts`'s in-memory `Map` with a `payments` table.

---

## Theme — Jade Green (`#6BD5AC` base)

Every shade in `tailwind.config.ts` is derived directly from the base color:

| Token | Value | Use |
|---|---|---|
| `jade` | `#6BD5AC` | Standard base — primary CTA, selections, accents |
| `jade-light` | `#8FE2C2` | Hover states |
| `jade-dark` | `#4FB890` | Active/pressed |
| `jade-900` | `#0E2A21` | Page background (darkened base) |
| `jade-800` | `#15392C` | Surface / card background |
| `jade-700` | `#1C4938` | Borders, dividers |

---

## Deployment

### Vercel (recommended)
```bash
npm install -g vercel
vercel
```
Add all `.env.local` variables in the Vercel dashboard under Project Settings → Environment Variables. Make sure `NEXT_PUBLIC_APP_URL` matches your real production domain so MoMo's IPN can reach it.

### Self-hosted (VPS)
```bash
npm run build
npm start
```
