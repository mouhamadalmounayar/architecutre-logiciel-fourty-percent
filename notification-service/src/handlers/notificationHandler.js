import EmailService from '../email/emailService.js';

class NotificationHandler {
  constructor(emailConfig) {
    this.emailService = new EmailService(emailConfig);
  }

  async handleAlert(topic, alertData) {
    try {
      console.log(`🔔 Processing alert from topic: ${topic}`);
      console.log('Alert data:', alertData);

      const {
        title,
        message,
        recipients = [],
      } = alertData || {};

      if (!title || !message) {
        console.warn('⚠️ Missing title or message in alert payload; ignoring.');
        return { success: false, error: 'Invalid alert payload' };
      }

      const emails = recipients
        .map(r => (typeof r === 'string' ? r : r?.email))
        .filter(Boolean);

      if (emails.length === 0) {
        console.warn('⚠️ No recipients in alert; nothing to send.');
        return { success: false, error: 'No recipients provided' };
      }

      console.log(`📧 Will notify: ${emails.join(', ')}`);
      console.log(`📨 Sending ${emails.length} email(s)...`);

      const results = await this.emailService.sendBatchAlerts(emails, title, message);

      const successCount = results.filter(r => r.status === 'fulfilled' && r.data?.success).length;
      const failureCount = results.length - successCount;

      if (failureCount > 0) {
        results
          .filter(r => !(r.status === 'fulfilled' && r.data?.success))
          .forEach(r => console.error('❌ Email send failure:', r));
      }

      console.log(`✅ Emails sent: ${successCount} succeeded, ${failureCount} failed`);

      return {
        success: true,
        summary: {
          total: results.length,
          succeeded: successCount,
          failed: failureCount,
        },
      };
    } catch (error) {
      console.error('❌ Error handling alert:', error);
      return { success: false, error: error.message };
    }
  }
}

export default NotificationHandler;
