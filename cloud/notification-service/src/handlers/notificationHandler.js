import EmailService from "../email/emailService.js";

// ============================================================================
// COLORIZED LOGGING FOR DEMO
// ============================================================================
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgMagenta: '\x1b[45m',
};

function logEmailSent(recipient, title) {
  const banner = '━'.repeat(80);
  console.log(`\n${colors.bright}${colors.bgMagenta}${banner}${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}*** EMAIL NOTIFICATION SENT ***${colors.reset}`);
  console.log(`${colors.bright}${colors.bgMagenta}${banner}${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}To: ${recipient}${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}Subject: ${title}${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}Sent at: ${new Date().toISOString()}${colors.reset}`);
  console.log(`${colors.bright}${colors.bgMagenta}${banner}${colors.reset}\n`);
}

class NotificationHandler {
  constructor(emailConfig) {
    this.emailService = new EmailService(emailConfig);
  }

  async handleAlert(topic, alertData) {
    try {
      console.log(`Processing alert from topic: ${topic}`);
      console.log("Alert data:", alertData);

      const { title, message, recipients = [], meta } = alertData || {};

      if (!title || !message || !meta) {
        console.warn(" Missing title or message in alert payload; ignoring.");
        return { success: false, error: "Invalid alert payload" };
      }

      const emails = recipients
        .map((r) => (typeof r === "string" ? r : r?.email))
        .filter(Boolean);

      if (emails.length === 0) {
        console.warn("No recipients in alert; nothing to send.");
        return { success: false, error: "No recipients provided" };
      }

      console.log(`Will notify: ${emails.join(", ")}`);
      console.log(`Sending ${emails.length} email(s)...`);

      const results = await this.emailService.sendBatchAlerts(
        emails,
        title,
        message,
        meta,
      );

      const successCount = results.filter(
        (r) => r.status === "fulfilled" && r.data?.success,
      ).length;
      const failureCount = results.length - successCount;

      if (failureCount > 0) {
        results
          .filter((r) => !(r.status === "fulfilled" && r.data?.success))
          .forEach((r) => console.error("[ERROR] Email send failure:", r));
      }

      // LOG EACH SUCCESSFUL EMAIL WITH SPECTACULAR BANNER
      results
        .filter((r) => r.status === "fulfilled" && r.data?.success)
        .forEach((r, index) => {
          if (emails[index]) {
            logEmailSent(emails[index], title);
          }
        });

      console.log(
        `${colors.green}[SUCCESS] Email Summary: ${successCount} succeeded, ${failureCount} failed${colors.reset}`,
      );

      return {
        success: true,
        summary: {
          total: results.length,
          succeeded: successCount,
          failed: failureCount,
        },
      };
    } catch (error) {
      console.error("[ERROR] Error handling alert:", error);
      return { success: false, error: error.message };
    }
  }
}

export default NotificationHandler;
