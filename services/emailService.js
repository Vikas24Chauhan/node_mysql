import nodemailer from "nodemailer";

const smtpPort = Number(process.env.SMTP_PORT || 587);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: smtpPort,
  secure: smtpPort === 465,
  requireTLS: smtpPort === 587,
  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 15000,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendWithResend = async (to, subject, html) => {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: [to],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Resend API failed (${response.status}): ${details}`);
  }

  return response.json();
};

export const sendEmail = async (to, subject, html) => {
  try {
    const info = process.env.RESEND_API_KEY
      ? await sendWithResend(to, subject, html)
      : await transporter.sendMail({
          from: `"Believers Consultancy" <${process.env.EMAIL_USER}>`,
          to,
          subject,
          html,
        });

    console.log("Email sent:", info.id || info.messageId);

    return info;
  } catch (error) {
    console.error("Email sending failed:", error);
    throw error;
  }
};
