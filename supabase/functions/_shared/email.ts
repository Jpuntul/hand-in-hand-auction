// deno-lint-ignore-file no-explicit-any
import { Resend } from "npm:resend@4.0.0";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL =
  Deno.env.get("EMAIL_FROM") ?? "Hand in Hand <onboarding@resend.dev>";
const APP_URL = Deno.env.get("APP_URL") ?? "http://localhost:3000";

if (!RESEND_API_KEY) {
  console.warn("RESEND_API_KEY is not set — outgoing emails will fail.");
}

const resend = new Resend(RESEND_API_KEY ?? "");

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function shell(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f6f6f6; margin: 0; padding: 24px;">
  <div style="max-width: 560px; margin: 0 auto; background: white; padding: 32px; border-radius: 8px;">
    ${body}
    <p style="font-size: 12px; color: #888; margin-top: 32px; border-top: 1px solid #eee; padding-top: 16px;">
      You're receiving this because you have an account at Hand in Hand for Myanmar.
      <a href="${APP_URL}/account/notifications" style="color: #666;">Manage email preferences</a>.
    </p>
  </div>
</body>
</html>`;
}

export function outbidEmail(params: {
  itemName: string;
  itemNo: number | null;
  newBid: number;
  previousBid: number;
}) {
  const subject = `Outbid on ${params.itemName}`;
  const body = `
    <h2 style="margin-top: 0; color: #1a1a1a;">You've been outbid</h2>
    <p>Someone just placed a higher bid on <strong>${escapeHtml(params.itemName)}</strong>${params.itemNo != null ? ` (#${params.itemNo})` : ""}.</p>
    <table cellpadding="8" style="border-collapse: collapse; margin: 16px 0; width: 100%;">
      <tr><td style="color: #666;">Your previous bid:</td><td style="text-align: right;">${usd.format(params.previousBid)}</td></tr>
      <tr><td style="color: #666;">New highest bid:</td><td style="text-align: right; font-weight: 600;">${usd.format(params.newBid)}</td></tr>
    </table>
    <p style="margin-top: 24px;">
      <a href="${APP_URL}/bidding" style="background: #1a1a1a; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block;">Place a higher bid</a>
    </p>
  `;
  return { subject, html: shell(subject, body) };
}

export function wonEmail(params: {
  itemName: string;
  itemNo: number | null;
  winningBid: number;
}) {
  const subject = `🎉 You won ${params.itemName}!`;
  const body = `
    <h2 style="margin-top: 0; color: #1a1a1a;">Congratulations — you won!</h2>
    <p>You won <strong>${escapeHtml(params.itemName)}</strong>${params.itemNo != null ? ` (#${params.itemNo})` : ""} with a winning bid of <strong>${usd.format(params.winningBid)}</strong>.</p>
    <p>The auction organizers will reach out shortly with pickup and payment instructions.</p>
    <p>Thank you for supporting Hand in Hand for Myanmar.</p>
  `;
  return { subject, html: shell(subject, body) };
}

export function lostEmail(params: {
  itemName: string;
  itemNo: number | null;
  winningBid: number;
  yourBid: number;
}) {
  const subject = `Auction closed: ${params.itemName}`;
  const body = `
    <h2 style="margin-top: 0; color: #1a1a1a;">Auction closed</h2>
    <p><strong>${escapeHtml(params.itemName)}</strong>${params.itemNo != null ? ` (#${params.itemNo})` : ""} closed at <strong>${usd.format(params.winningBid)}</strong>. Your highest bid was ${usd.format(params.yourBid)}.</p>
    <p>There are still active items — <a href="${APP_URL}/bidding">browse the auction</a>.</p>
    <p>Thank you for supporting Hand in Hand for Myanmar.</p>
  `;
  return { subject, html: shell(subject, body) };
}

export function cancelledEmail(params: {
  itemName: string;
  itemNo: number | null;
}) {
  const subject = `Auction cancelled: ${params.itemName}`;
  const body = `
    <h2 style="margin-top: 0; color: #1a1a1a;">Auction cancelled</h2>
    <p>The auction for <strong>${escapeHtml(params.itemName)}</strong>${params.itemNo != null ? ` (#${params.itemNo})` : ""} was cancelled by the organisers.</p>
    <p>There are still active items — <a href="${APP_URL}/bidding">browse the auction</a>.</p>
    <p>Thank you for supporting Hand in Hand for Myanmar.</p>
  `;
  return { subject, html: shell(subject, body) };
}


export async function sendEmail(
  to: string,
  payload: { subject: string; html: string },
): Promise<{ id?: string; error?: any }> {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: payload.subject,
      html: payload.html,
    });
    if (error) return { error };
    return { id: data?.id };
  } catch (err) {
    return { error: err };
  }
}
