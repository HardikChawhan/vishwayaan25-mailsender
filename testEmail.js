const nodemailer = require('nodemailer');
require('dotenv').config();

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

async function sendTestEmail() {
  let transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
  });

  // Add this before sending the email
  try {
    await transporter.verify();
    console.log('SMTP connection is ready');
  } catch (err) {
    console.error('SMTP connection error:', err);
    return;
  }

  let mailOptions = {
    from: EMAIL_USER,
    to: 'rohaniyengar56@gmail.com', // Replace with a valid recipient email
    subject: 'Test Email',
    text: 'This is a test email.',
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Test email sent successfully');
  } catch (err) {
    console.error('Error sending test email:', err);
  }
}

sendTestEmail();