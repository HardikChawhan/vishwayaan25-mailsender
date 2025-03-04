const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
require('dotenv').config();

const AES_KEY = process.env.AES_KEY;
const AES_IV = process.env.AES_IV;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

function encryptData(data) {
  const cipher = crypto.createCipheriv('aes-128-cbc', AES_KEY, AES_IV);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

async function sendEmail(to, subject, text, attachmentPath) {
  let transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
  });

  // Verify connection configuration
  try {
    await transporter.verify();
    console.log('SMTP connection is ready');
  } catch (err) {
    console.error('SMTP connection error:', err);
    return;
  }

  let mailOptions = {
    from: EMAIL_USER,
    to: to,
    subject: subject,
    text: text,
    attachments: [
      {
        path: attachmentPath,
      },
    ],
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Email sent successfully to:', to);
  } catch (err) {
    console.error('Error sending email:', err);
  }
}

async function generateUniqueQRCode(data, prn, email) {
  const encryptedData = encryptData(data);
  const filePath = path.join(__dirname, 'images', `${prn}.png`);
  
  try {
    await QRCode.toFile(filePath, encryptedData);
    console.log('QR Code generated successfully:', filePath);
    await sendEmail(email, 'Your QR Code', 'Please find your QR code attached.', filePath);
  } catch (err) {
    console.error('Error generating QR Code:', err);
  }
}

// Ensure the images directory exists
if (!fs.existsSync(path.join(__dirname, 'images'))) {
  fs.mkdirSync(path.join(__dirname, 'images'));
}

function generateQRCodesFromCSV() {
  const results = [];
  fs.createReadStream('data.csv')
    .pipe(csv()) // Handle comma-separated values
    .on('data', (data) => {
      results.push(data);
    })
    .on('end', () => {
      results.forEach((row) => {
        const prn = row['prn']; // Changed from 'SRN' to 'prn'
        const email = row['email']; // Changed from 'Email' to 'email'
        if (prn && email) {
          generateUniqueQRCode(JSON.stringify(row), prn, email);
        } else {
          console.error('PRN or Email is undefined for row:', row);
        }
      });
    });
}

generateQRCodesFromCSV();