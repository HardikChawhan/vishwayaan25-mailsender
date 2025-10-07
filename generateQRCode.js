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

// Configuration
const BATCH_SIZE = 10; // Send 10 emails simultaneously
const RETRY_ATTEMPTS = 3; // Retry failed emails 3 times
const RETRY_DELAY = 5000; // 5 seconds between retries
const BATCH_DELAY = 3000; // 3 seconds between batches

// Create a reusable transporter
let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
      },
      pool: true, // Use pooled connections
      maxConnections: 5, // Max simultaneous connections
      maxMessages: 100, // Max messages per connection
    });
  }
  return transporter;
}

function encryptData(data) {
  const cipher = crypto.createCipheriv('aes-128-cbc', AES_KEY, AES_IV);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

async function sendEmail(to, subject, text, attachmentPath, retryCount = 0) {
  const transport = getTransporter();

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
    await transport.sendMail(mailOptions);
    return { success: true, email: to };
  } catch (err) {
    console.error(`Error sending email to ${to} (attempt ${retryCount + 1}):`, err.message);
    
    // Retry logic
    if (retryCount < RETRY_ATTEMPTS) {
      console.log(`Retrying email to ${to} in ${RETRY_DELAY / 1000} seconds...`);
      await sleep(RETRY_DELAY);
      return sendEmail(to, subject, text, attachmentPath, retryCount + 1);
    }
    
    return { success: false, email: to, error: err.message };
  }
}

async function generateUniqueQRCode(data, phoneNo, email) {
  const encryptedData = encryptData(data);
  const filePath = path.join(__dirname, 'images', `${phoneNo}.png`);
  
  try {
    await QRCode.toFile(filePath, encryptedData);
    console.log(`QR Code generated: ${phoneNo}.png`);
    
    const result = await sendEmail(
      email, 
      'Your QR Code for Vishwaayan 2025', 
      'Dear Participant,\n\nPlease find your QR code attached. Keep this safe for event check-in.\n\nBest regards,\nVishwaayan Team', 
      filePath
    );
    
    return result;
  } catch (err) {
    console.error(`Error generating QR Code for ${phoneNo}:`, err.message);
    return { success: false, email: email, error: err.message };
  }
}

// Helper function for delays
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Process emails in batches
async function processBatch(batch, batchNumber, totalBatches) {
  console.log(`\n=== Processing Batch ${batchNumber}/${totalBatches} (${batch.length} emails) ===`);
  
  const promises = batch.map(row => {
    const phoneNo = row['phone_no'];
    const email = row['email'];
    
    if (phoneNo && email) {
      return generateUniqueQRCode(JSON.stringify(row), phoneNo, email);
    } else {
      console.error('Phone number or Email is undefined for row:', row);
      return Promise.resolve({ success: false, email: row['email'] || 'unknown', error: 'Missing phone_no or email' });
    }
  });
  
  const results = await Promise.all(promises);
  return results;
}

// Ensure the images directory exists
if (!fs.existsSync(path.join(__dirname, 'images'))) {
  fs.mkdirSync(path.join(__dirname, 'images'));
}

// Ensure the logs directory exists
if (!fs.existsSync(path.join(__dirname, 'logs'))) {
  fs.mkdirSync(path.join(__dirname, 'logs'));
}

async function generateQRCodesFromCSV() {
  console.log('🚀 Starting QR Code generation and email sending process...\n');
  const startTime = Date.now();
  
  const results = [];
  
  // Read CSV file
  await new Promise((resolve, reject) => {
    fs.createReadStream('data.csv')
      .pipe(csv())
      .on('data', (data) => {
        results.push(data);
      })
      .on('end', resolve)
      .on('error', reject);
  });
  
  console.log(`📊 Total records found: ${results.length}\n`);
  
  // Split into batches
  const batches = [];
  for (let i = 0; i < results.length; i += BATCH_SIZE) {
    batches.push(results.slice(i, i + BATCH_SIZE));
  }
  
  const totalBatches = batches.length;
  console.log(`📦 Split into ${totalBatches} batches of ${BATCH_SIZE} emails each\n`);
  
  // Process batches
  const allResults = [];
  let successCount = 0;
  let failureCount = 0;
  
  for (let i = 0; i < batches.length; i++) {
    const batchResults = await processBatch(batches[i], i + 1, totalBatches);
    allResults.push(...batchResults);
    
    // Count successes and failures
    batchResults.forEach(result => {
      if (result.success) {
        successCount++;
        console.log(`✅ Success: ${result.email}`);
      } else {
        failureCount++;
        console.log(`❌ Failed: ${result.email}`);
      }
    });
    
    // Progress update
    const processed = (i + 1) * BATCH_SIZE;
    const percentage = ((processed / results.length) * 100).toFixed(1);
    console.log(`\n📈 Progress: ${Math.min(processed, results.length)}/${results.length} (${percentage}%)`);
    
    // Delay between batches (except for the last batch)
    if (i < batches.length - 1) {
      console.log(`⏳ Waiting ${BATCH_DELAY / 1000} seconds before next batch...\n`);
      await sleep(BATCH_DELAY);
    }
  }
  
  // Close transporter
  if (transporter) {
    transporter.close();
  }
  
  // Final summary
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000 / 60).toFixed(2);
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 FINAL REPORT');
  console.log('='.repeat(60));
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failureCount}`);
  console.log(`⏱️  Total time: ${duration} minutes`);
  console.log(`📧 Average: ${(results.length / (duration || 1)).toFixed(1)} emails/minute`);
  console.log('='.repeat(60));
  
  // Log failed emails to file
  const failedEmails = allResults.filter(r => !r.success);
  if (failedEmails.length > 0) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logFile = path.join(__dirname, 'logs', `failed_emails_${timestamp}.json`);
    fs.writeFileSync(logFile, JSON.stringify(failedEmails, null, 2));
    console.log(`\n📝 Failed emails logged to: ${logFile}`);
  }
  
  console.log('\n✨ Process completed!\n');
}

// Verify SMTP connection before starting
async function verifyConnection() {
  try {
    const transport = getTransporter();
    await transport.verify();
    console.log('✅ SMTP connection verified successfully\n');
    return true;
  } catch (err) {
    console.error('❌ SMTP connection error:', err.message);
    console.error('\nPlease check your .env file and ensure:');
    console.error('- EMAIL_USER is set correctly');
    console.error('- EMAIL_PASS is a valid Gmail App Password');
    console.error('- Your Gmail account has 2FA enabled and App Passwords configured\n');
    return false;
  }
}

// Main execution
(async () => {
  const isConnected = await verifyConnection();
  if (isConnected) {
    await generateQRCodesFromCSV();
  } else {
    process.exit(1);
  }
})();