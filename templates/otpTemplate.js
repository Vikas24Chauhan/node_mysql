export const otpTemplate = (otp) => {
  return `
    <div style="font-family: Arial, sans-serif; max-width:600px; margin:auto;">
      <h2>Password Reset</h2>

      <p>Your OTP for resetting your password is:</p>

      <h1 style="letter-spacing:5px; color:#2563eb;">
        ${otp}
      </h1>

      <p>This OTP will expire in <strong>10 minutes</strong>.</p>

      <p>If you didn't request this, please ignore this email.</p>

      <br>

      <p>Regards,</p>
      <p><strong>Medical Counselling Portal</strong></p>
    </div>
  `;
};
