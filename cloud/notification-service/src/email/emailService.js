import nodemailer from "nodemailer";

class EmailService {
  constructor(config) {
    this.transporter = nodemailer.createTransport({
      host: config.host || "smtp.gmail.com",
      port: Number(config.port) || 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: config.user,
        pass: config.pass,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
      tls: {
        minVersion: "TLSv1.2",
        servername: config.host || "smtp.gmail.com",
      },
      logger: String(process.env.SMTP_DEBUG || "").toLowerCase() === "true",
      debug: String(process.env.SMTP_DEBUG || "").toLowerCase() === "true",
    });

    this.transporter
      .verify()
      .then(() => console.log("SMTP connection verified."))
      .catch((err) =>
        console.error("❌ SMTP verify failed:", err?.message || err),
      );
  }

  async sendEmail({ to, subject, text, html }) {
    try {
      const info = await this.transporter.sendMail({
        from: `"Healthcare Alert System" <${process.env.SMTP_USER}>`,
        to,
        subject,
        text,
        html: html || text,
      });

      console.log(`Email sent to ${to}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error(`❌ Failed to send email to ${to}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  async sendAlertNotification(recipient, title, message, meta) {
    const text = `
${title}

${message}

---
Healthcare Monitoring System
    `.trim();
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 20px auto; background: #fff; }
    .header { background: #007bff; color: white; padding: 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 20px; }
    .content { padding: 24px; background: #f8f9fa; }
    .message-box { background: white; padding: 16px; margin: 16px 0; border-left: 5px solid #007bff; box-shadow: 0 2px 4px rgba(0,0,0,0.06); }
    .footer { text-align: center; padding: 16px; color: #6c757d; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>${title}</h1></div>
    <div class="content">
    Our system has detected an alert condition in your patient's health data.
      <div class="message-box"><p>${message} \n ${String(meta.alert_message || "").replace(/\n/g, "<br>")}</p></div>
    </div>
    <div class="footer">Healthcare Monitoring System - Automated Alert</div>
  </div>
</body>
</html>
    `.trim();
    return this.sendEmail({ to: recipient, subject: title, text, html });
  }

  async sendBatchAlerts(recipients, title, message, meta) {
    const results = await Promise.allSettled(
      recipients.map((r) =>
        this.sendAlertNotification(r, title, message, meta),
      ),
    );
    return results.map((res, i) => ({
      recipient: recipients[i],
      status: res.status,
      data: res.status === "fulfilled" ? res.value : res.reason,
    }));
  }
}

export default EmailService;
