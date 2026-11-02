import { Resend } from "resend";
import { ERROR_MAIL_TO } from "@/lib/mail-recipients";

// Sent when closing a store did not reach Printavo. The store stays open so setting the
// status to "closed" again retries it; nothing is lost.
export async function sendStoreCloseFailure(storeName: string, error: unknown) {
    try {
        const resend = new Resend(process.env.RESEND_API_KEY!);
        const text = typeof error === "string" ? error : (error as any)?.message || JSON.stringify(error);
        await resend.emails.send({
            from: "AurixLab Webstore Automation <webstores@aurixlab.com>",
            to: ERROR_MAIL_TO,   // errors go to AurixLab only
            subject: `Store NOT closed: ${storeName} (Printavo did not accept the order)`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 640px;">
                <h2 style="color: #b91c1c;">${escapeHtml(storeName)} was not closed</h2>
                <p>The batch order could not be sent to Printavo, so the store was kept <strong>open</strong> and no orders were lost.</p>
                <p><strong>Printavo said:</strong></p>
                <pre style="background:#f3f4f6;padding:12px;border-radius:8px;white-space:pre-wrap;">${escapeHtml(String(text).slice(0, 1500))}</pre>
                <p>Fix the cause (or wait a few minutes), then set the collection's <strong>store_status</strong> to something else and back to <strong>closed</strong> to retry.</p>
              </div>`
        });
    } catch (err) {
        console.error("Could not send the store-close failure email:", err);
    }
}

function escapeHtml(value: unknown) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));
}
