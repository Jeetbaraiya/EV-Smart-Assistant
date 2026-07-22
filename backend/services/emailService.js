const nodemailer = require('nodemailer');

const { Resend } = require('resend');

// ── Email sender setup ───────────────────────────────────────────────────────
// Railway blocks ALL outbound SMTP ports (25, 465, 587). Vercel is also strict.
// Using HTTP-based providers (Brevo, Resend) as primary.

let resend = null;
let smtpTransporter = null;

if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
}

if (process.env.MAIL_USER && process.env.MAIL_PASS) {
  smtpTransporter = nodemailer.createTransport({
    host: 'smtp.gmail.com', port: 465, secure: true,
    auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 10000, socketTimeout: 10000, greetingTimeout: 10000,
  });
}

const sendViaBrevo = async ({ to, subject, html }) => {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      sender: {
        name: 'EV Assistant',
        email: process.env.BREVO_SENDER || process.env.MAIL_USER || 'noreply@evassistant.com',
      },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `Brevo HTTP ${res.status}`);
  }
};

const sendMail = async ({ to, subject, html }) => {
  if (process.env.BREVO_API_KEY) {
    await sendViaBrevo({ to, subject, html });
    return;
  }
  if (resend) {
    const sendTo = process.env.RESEND_OVERRIDE_TO || to;
    const result = await resend.emails.send({
      from: 'EV Assistant <onboarding@resend.dev>',
      to: sendTo, subject, html,
    });
    if (result.error) throw new Error(result.error.message);
    return;
  }
  if (smtpTransporter) {
    await new Promise((resolve, reject) => {
      smtpTransporter.sendMail(
        { from: `EV Assistant <${process.env.MAIL_USER}>`, to, subject, html },
        (err) => err ? reject(err) : resolve()
      );
    });
    return;
  }
  throw new Error('No email provider configured.');
};

// ── HTML Template Helper ─────────────────────────────────────────────────────
const wrapInTemplate = (title, body) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f0f9ff; color: #1e293b; }
    .wrapper { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%); padding: 36px 40px; text-align: center; }
    .header h1 { color: #fff; font-size: 26px; font-weight: 800; letter-spacing: -0.5px; }
    .header p { color: rgba(255,255,255,0.85); font-size: 13px; margin-top: 6px; }
    .logo-badge { display: inline-block; background: rgba(255,255,255,0.2); border-radius: 50px; padding: 6px 18px; color: #fff; font-size: 12px; font-weight: 700; letter-spacing: 1px; margin-bottom: 12px; }
    .body { padding: 36px 40px; }
    .body h2 { font-size: 20px; font-weight: 700; color: #1e293b; margin-bottom: 8px; }
    .body p { color: #475569; font-size: 14px; line-height: 1.7; margin-bottom: 16px; }
    .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px 24px; margin: 20px 0; }
    .info-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
    .info-row:last-child { border-bottom: none; padding-bottom: 0; }
    .info-label { color: #64748b; font-weight: 600; }
    .info-value { color: #1e293b; font-weight: 700; text-align: right; max-width: 60%; }
    .status-confirmed { display: inline-block; background: #dcfce7; color: #16a34a; padding: 4px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; }
    .cta-btn { display: block; width: fit-content; margin: 24px auto; background: linear-gradient(135deg, #0ea5e9, #6366f1); color: #fff; text-decoration: none; padding: 14px 36px; border-radius: 50px; font-weight: 700; font-size: 15px; text-align: center; }
    .footer { background: #f8fafc; padding: 24px 40px; text-align: center; border-top: 1px solid #e2e8f0; }
    .footer p { color: #94a3b8; font-size: 12px; line-height: 1.8; }
    .highlight { color: #6366f1; font-weight: 700; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="logo-badge">⚡ EV SMART ASSISTANT</div>
      <h1>${title}</h1>
      <p>Your intelligent EV charging companion</p>
    </div>
    <div class="body">
      ${body}
    </div>
    <div class="footer">
      <p>You received this email because you have an account on <span class="highlight">EV Smart Assistant</span>.<br/>
      This is an automated notification — please do not reply to this email.</p>
      <p style="margin-top:8px;">© ${new Date().getFullYear()} EV Smart Route & Charging Assistant</p>
    </div>
  </div>
</body>
</html>
`;

// ── Format date helper ───────────────────────────────────────────────────────
const fmtDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  try {
    const isoString = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T');
    const d = new Date(isoString.endsWith('Z') ? isoString : isoString + 'Z');
    return new Intl.DateTimeFormat('en-IN', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata'
    }).format(d);
  } catch {
    return dateStr;
  }
};

// ── Email Senders ────────────────────────────────────────────────────────────

/**
 * Send booking confirmation email to the EV driver (user).
 */
const sendBookingConfirmationToUser = async ({ userEmail, userName, stationName, stationAddress, stationCity, connectorType, startTime, endTime, durationMinutes, totalPrice }) => {

  const body = `
    <h2>Hey ${userName || 'there'} 👋, your slot is confirmed!</h2>
    <p>Your EV charging session has been successfully booked. Here's a summary of your reservation:</p>
    <div class="info-card">
      <div class="info-row">
        <span class="info-label">📍 Station</span>
        <span class="info-value">${stationName}</span>
      </div>
      ${stationAddress ? `<div class="info-row"><span class="info-label">🏙️ Location</span><span class="info-value">${stationAddress}${stationCity ? ', ' + stationCity : ''}</span></div>` : ''}
      ${connectorType ? `<div class="info-row"><span class="info-label">🔌 Connector</span><span class="info-value">${connectorType}</span></div>` : ''}
      <div class="info-row">
        <span class="info-label">🕐 Check-In</span>
        <span class="info-value">${fmtDate(startTime)}</span>
      </div>
      <div class="info-row">
        <span class="info-label">🕐 Check-Out</span>
        <span class="info-value">${fmtDate(endTime)}</span>
      </div>
      <div class="info-row">
        <span class="info-label">⏱️ Duration</span>
        <span class="info-value">${durationMinutes} minutes</span>
      </div>
      <div class="info-row">
        <span class="info-label">💰 Est. Cost</span>
        <span class="info-value">₹${Number(totalPrice || 0).toFixed(2)}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Status</span>
        <span class="info-value"><span class="status-confirmed">✅ CONFIRMED</span></span>
      </div>
    </div>
    <p>⚡ <strong>Arrive on time!</strong> Your slot is reserved for the exact time window above. You can manage your bookings from "My Bookings" in the app.</p>
  `;

  try {
    await sendMail({
      to: userEmail,
      subject: `✅ Booking Confirmed — ${stationName}`,
      html: wrapInTemplate('Booking Confirmed!', body)
    });
    console.log(`[Email] Booking confirmation sent to ${userEmail}`);
    return { sent: true };
  } catch (err) {
    console.error('[Email] Failed to send booking confirmation to user:', err.message);
    return { sent: false, reason: err.message };
  }
};

/**
 * Send new booking alert email to the station owner.
 */
const sendNewBookingAlertToOwner = async ({ ownerEmail, ownerName, stationName, userName, userEmail, connectorType, startTime, endTime, totalPrice }) => {

  const body = `
    <h2>New Booking at Your Station! 🎉</h2>
    <p>Great news, <strong>${ownerName || 'Owner'}</strong>! A new charging session has been booked at your station.</p>
    <div class="info-card">
      <div class="info-row">
        <span class="info-label">⚡ Station</span>
        <span class="info-value">${stationName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">👤 Customer</span>
        <span class="info-value">${userName || 'EV Driver'}${userEmail ? ' (' + userEmail + ')' : ''}</span>
      </div>
      ${connectorType ? `<div class="info-row"><span class="info-label">🔌 Connector</span><span class="info-value">${connectorType}</span></div>` : ''}
      <div class="info-row">
        <span class="info-label">🕐 Check-In</span>
        <span class="info-value">${fmtDate(startTime)}</span>
      </div>
      <div class="info-row">
        <span class="info-label">🕐 Check-Out</span>
        <span class="info-value">${fmtDate(endTime)}</span>
      </div>
      <div class="info-row">
        <span class="info-label">💰 Est. Revenue</span>
        <span class="info-value">₹${Number(totalPrice || 0).toFixed(2)}</span>
      </div>
    </div>
    <p>View and manage all your reservations in the <strong>Owner Command Center</strong> dashboard.</p>
  `;

  try {
    await sendMail({
      to: ownerEmail,
      subject: `🔔 New Booking at ${stationName}`,
      html: wrapInTemplate('New Station Booking', body)
    });
    console.log(`[Email] Owner booking alert sent to ${ownerEmail}`);
    return { sent: true };
  } catch (err) {
    console.error('[Email] Failed to send owner alert:', err.message);
    return { sent: false, reason: err.message };
  }
};

/**
 * Send booking cancellation email to the user.
 */
const sendCancellationEmail = async ({ userEmail, userName, stationName, startTime }) => {

  const body = `
    <h2>Booking Cancelled</h2>
    <p>Hi ${userName || 'there'}, your upcoming charging session has been cancelled as requested.</p>
    <div class="info-card">
      <div class="info-row">
        <span class="info-label">📍 Station</span>
        <span class="info-value">${stationName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">🕐 Was Scheduled For</span>
        <span class="info-value">${fmtDate(startTime)}</span>
      </div>
    </div>
    <p>If you'd like to rebook, you can do so anytime in the <strong>Charging Stations</strong> section of the app.</p>
  `;

  try {
    await sendMail({
      to: userEmail,
      subject: `❌ Booking Cancelled — ${stationName}`,
      html: wrapInTemplate('Booking Cancelled', body)
    });
    return { sent: true };
  } catch (err) {
    console.error('[Email] Failed to send cancellation email:', err.message);
    return { sent: false, reason: err.message };
  }
};

module.exports = {
  sendBookingConfirmationToUser,
  sendNewBookingAlertToOwner,
  sendCancellationEmail
};
