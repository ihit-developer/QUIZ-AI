const nodemailer = require('nodemailer');

const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));

const sendOtpEmail = async ({ email, code, purpose, name = 'there' }) => {
  const subject = purpose === 'reset' ? 'Reset your Quizese password' : 'Verify your Quizese account';
  const text = `Your Quizese ${purpose === 'reset' ? 'password reset' : 'verification'} code is ${code}. It expires in 10 minutes.`;
  const action = purpose === 'reset' ? 'reset your password' : 'verify your account';
  const html = `<!doctype html><html><body style="margin:0;background:#f7f7f8;font-family:Arial,sans-serif;color:#202124"><div style="max-width:560px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #eee"><div style="background:#9f1239;padding:28px 32px;color:#fff"><div style="font-size:24px;font-weight:800">Quizese</div><div style="margin-top:6px;opacity:.9">Secure account verification</div></div><div style="padding:32px"><h1 style="font-size:22px;margin:0 0 16px">Hello, ${escapeHtml(name)}</h1><p style="line-height:1.6">Use this one-time code to ${action}.</p><div style="margin:24px 0;padding:18px;text-align:center;background:#fff1f2;border:1px solid #fda4af;border-radius:12px;font-size:30px;letter-spacing:8px;font-weight:800;color:#9f1239">${code}</div><p style="line-height:1.6;color:#5f6368">This code expires in 10 minutes. Do not share it with anyone.</p><p style="font-size:12px;color:#888;margin-top:28px">If you did not request this, you can safely ignore this email.</p></div></div></body></html>`;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Email service is not configured. Contact the site administrator.');
    }
    console.log(`[Email development fallback] ${email}: ${text}`);
    return;
  }
  try {
    const isGmail = (process.env.SMTP_HOST || '').includes('gmail');
    const transportConfig = isGmail
      ? {
          service: 'gmail',
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
          connectionTimeout: 10000,
        }
      : {
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 587),
          secure: process.env.SMTP_SECURE === 'true',
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
          connectionTimeout: 10000,
        };

    const transport = nodemailer.createTransport(transportConfig);
    const info = await transport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject,
      text,
      html,
    });
    console.log(`[Email Service] OTP successfully delivered to ${email}. MessageId: ${info.messageId}`);
  } catch (err) {
    console.error(`[Email Service Error] Failed to send email to ${email}:`, err.message || err);
    throw new Error('We could not send the verification email. Please try again later.');
  }
};

const sendLoginAlert = async ({ email, name = 'there' }) => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return;
  const transport = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === 'true', auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
  const time = new Date().toLocaleString();
  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: 'New sign-in to your Quizese account',
    text: `Hello ${name}, your Quizese account was signed in at ${time}. If this was not you, change your password immediately.`,
    html: `<!doctype html><html><body style="margin:0;background:#f7f7f8;font-family:Arial,sans-serif;color:#202124"><div style="max-width:560px;margin:32px auto;background:#fff;border:1px solid #eee;border-radius:16px;overflow:hidden"><div style="padding:24px 32px;background:#9f1239;color:#fff;font-size:24px;font-weight:800">Quizese</div><div style="padding:32px"><h1 style="font-size:22px">Hello, ${escapeHtml(name)}</h1><p style="line-height:1.6">Your account was successfully signed in on <strong>${escapeHtml(time)}</strong>.</p><p style="line-height:1.6;color:#5f6368">If this was not you, change your password immediately from your profile.</p></div></div></body></html>`,
  });
};

module.exports = { sendOtpEmail, sendLoginAlert };
