const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const crypto = require('crypto');
const QRCode = require('qrcode');
const nodemailer = require('nodemailer');
require('dotenv').config(); // Add dotenv for environment variables

// Configuration
const CSV_FILE_PATH = './data.csv';
const QR_CODE_DIR = './images';
const LOGS_DIR = './logs';

// Optimized settings for 1200 emails in ~1 hour
const BATCH_SIZE = 10; // Send 10 emails simultaneously
const RETRY_ATTEMPTS = 3; // Retry failed emails 3 times
const RETRY_DELAY = 5000; // 5 seconds between retries
const BATCH_DELAY = 3000; // 3 seconds between batches

const EMAIL_CONFIG = {
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    pool: true, // Use pooled connections
    maxConnections: 5, // Max simultaneous connections
    maxMessages: 100 // Max messages per connection
};

// Default encryption key and IV if not provided in .env
const ENCRYPTION_KEY = process.env.AES_KEY;
const ENCRYPTION_IV = process.env.AES_IV;

// Create directories if they don't exist
if (!fs.existsSync(QR_CODE_DIR)) {
    fs.mkdirSync(QR_CODE_DIR, { recursive: true });
}

if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
}

// Setup email transporter (singleton pattern)
let transporter = null;

function getTransporter() {
    if (!transporter) {
        transporter = nodemailer.createTransport(EMAIL_CONFIG);
    }
    return transporter;
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


// Encryption function (AES-128)
function encryptData(data) {
    const cipher = crypto.createCipheriv('aes-128-cbc', 
        Buffer.from(ENCRYPTION_KEY.slice(0, 16)), 
        Buffer.from(ENCRYPTION_IV.slice(0, 16)));
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}

// Helper function for delays
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Generate QR Code
async function generateQRCode(data, filePath) {
    try {
        await QRCode.toFile(filePath, data);
        return true;
    } catch (error) {
        console.error('QR Code generation error:', error);
        throw error;
    }
}

// Modified sendEmail function with retry logic
async function sendEmailWithAttachments(email, username, qrCodePath, retryCount = 0) {
    const transport = getTransporter();
    // HTML version of the email
    const emailContentHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your E-Ticket for Vishwaayan, 2026</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 650px;
            margin: 0 auto;
        }
        .container {
            padding: 20px;
            border-radius: 8px;
            border: 1px solid #ddd;
        }
        .header {
            text-align: center;
            padding-bottom: 20px;
            border-bottom: 2px solid #005f9e;
            margin-bottom: 20px;
        }
        .header h1 {
            color: #005f9e;
            margin-bottom: 5px;
        }
        .important-info {
            background-color: #fff4e6;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
            border-left: 4px solid #ff8c00;
        }
        .dress-code {
            background-color: #f0f7ff;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
            border-left: 4px solid #0066cc;
        }
        .warning {
            background-color: #ffeeee;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
            border-left: 4px solid #cc0000;
        }
        .contact {
            background-color: #f2f2f2;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
        }
        .signature {
            text-align: left;
            font-style: italic;
            margin-top: 30px;
            border-top: 1px solid #eee;
            padding-top: 15px;
        }
        .signature-images {
            margin-top: 15px;
            display: block;
        }
        .signature-image {
            max-height: 80px;
            margin-right: 15px;
            margin-bottom: 10px;
        }
        ul {
            margin-left: 20px;
            padding-left: 0;
        }
        .highlight {
            font-weight: bold;
            color: #005f9e;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Vishwaayan, 2026</h1>
            <p>Your Official E-Ticket</p>
        </div>

        <p>Dear <strong>${username}</strong>,</p>

        <p>Thank you for registering for Vishwaayan 2026! We are thrilled to have you join us for this special celebration. Please find your e-ticket attached, including QR codes required for entry. Kindly note that the QR code is valid for a single scan only, meaning re-entry will not be permitted once you exit the premises.</p>

        <p>The detailed programme schedule is also attached for your reference. You can also access the <a href="https://drive.google.com/file/d/1HFBKjaXWXaDLCBAjvwVIrB0y8LmpIY5R/view?usp=drive_link" style="color: #005f9e; text-decoration: none; font-weight: bold;">📄 Vishwaayan 2026 Brochure</a> for more information.</p>

        <div class="important-info">
            <h3>⚠️ Important Information:</h3>
            <ul>
                <li><strong>QR Code Validity:</strong> Your QR code is valid for a single scan only. If you exit the premises, you will not be allowed to re-enter.</li>
                <li><strong>Entry Guidelines:</strong> Please ensure you arrive on time.</li>
                <li><strong>Mandatory Documents:</strong> You must present both your ID card and QR code at the entrance for a smooth check-in process.</li>
                <li><strong>Self-Declaration Form:</strong> It is compulsory to carry a printed self-declaration form for entry. Without it, entry will not be permitted.</li>
            </ul>
        </div>

        <div class="dress-code">
            <h3>👗 Dress Code for Vishwaayan:</h3>
            
            <h4>For Day 3 - "THE INDIAN HERITAGE"</h4>
            <p>Participants are expected to wear Sarees & Kurtas, celebrating the culture of India.</p>
            <p><strong>Entry time: 3:00 PM to 5:00 PM</strong></p>
            
            <h4>For Day 4 - "GLAM & GLITTERS"</h4>
            <p><strong>Entry time for lunch: 12:00 PM to 2:45 PM</strong></p>
            <p><strong>Open arena: 3:00 PM to 5:00 PM</strong></p>
            <p>The dress code is Suits & Gowns, embracing elegance and sophistication.</p>
            
            <p>If, for any reason, you are unable to follow the dress code, decent wear is required. Entry will be denied to those who do not comply.</p>
            <p><strong>Everyone to comply with the guidelines attached herewith</strong></p>
        </div>

        <p>We can't wait to celebrate with you at Vishwaayan 2026! Get ready for an unforgettable experience filled with creativity, talent, and excitement.</p>

        <p><strong>See you there!</strong></p>

        <div class="contact">
            <h3>📞 Contact Information:</h3>
            <p>If you have any questions, please contact us at:</p>
            <p><strong>Yash Jain:</strong> 8390499943</p>
            <p><strong>Harsh Parkale:</strong> 9322404441</p>
            <p><strong>Khevna Shah:</strong> 7385886378</p>
        </div>

        <div class="warning">
            <h3>⚠️ Important Note:</h3>
            <p>Students are reminded to refrain from engaging in Violence, Non-cooperation with authorities including organizers, use or the consumption of illicit substances, sloganeering, making sexist comments, or engaging in behaviour that may hurt religious sentiments, disrupt campus discipline, or create excessive noise with vehicles, speakers or any kind of devices in the University campus. Strict disciplinary actions thereby involving the respective department's HoDs will be taken against those found violating these guidelines.</p>
        </div>

        <div class="signature">
            <p>Thanks and Regards,</p>
            <div class="signature-images">
                <img src="cid:signature1" alt="Student Council Signature" class="signature-image">
                <img src="cid:signature2" alt="Student Welfare Signature" class="signature-image">
            </div>
            <p>
                <strong>Student Council &<br>
                Sports Council</strong><br>
                Vishwakarma University,<br>
                Survey No 2,3,4 Laxmi Nagar,<br>
                Kondhwa (Bk.) Pune 411048
            </p>
        </div>
    </div>
</body>
</html>
    `;

    // Keep the text version for email clients that don't support HTML
    const emailContentText = `Dear ${username},

Thank you for registering for Vishwaayan 2026! We are thrilled to have you join us for this special celebration. Please find your e-ticket attached, including QR codes required for entry. Kindly note that the QR code is valid for a single scan only, meaning re-entry will not be permitted once you exit the premises.

The detailed programme schedule is also attached for your reference. You can also access the Vishwaayan 2026 Brochure for more information:
https://drive.google.com/file/d/1HFBKjaXWXaDLCBAjvwVIrB0y8LmpIY5R/view?usp=drive_link

⚠️ Important Information:
- QR Code Validity: Your QR code is valid for a single scan only. If you exit the premises, you will not be allowed to re-enter.
- Entry Guidelines: Please ensure you arrive on time.
- Mandatory Documents: You must present both your ID card and QR code at the entrance for a smooth check-in process.
- Self-Declaration Form: It is compulsory to carry a printed self-declaration form for entry. Without it, entry will not be permitted.

👗 Dress Code for Vishwaayan:

For Day 3 - "THE INDIAN HERITAGE"
Participants are expected to wear Sarees & Kurtas, celebrating the culture of India.
Entry time: 3:00 PM to 5:00 PM

For Day 4 - "GLAM & GLITTERS"
Entry time for lunch: 12:00 PM to 2:45 PM
Open arena: 3:00 PM to 5:00 PM
The dress code is Suits & Gowns, embracing elegance and sophistication.

If, for any reason, you are unable to follow the dress code, decent wear is required. Entry will be denied to those who do not comply.

Everyone to comply with the guidelines attached herewith

We can't wait to celebrate with you at Vishwaayan 2026! Get ready for an unforgettable experience filled with creativity, talent, and excitement.

See you there!

📞 Contact Information:
If you have any questions, please contact us at:
Yash Jain: 8390499943
Harsh Parkale: 9322404441
Khevna Shah: 7385886378

⚠️ Important Note:
Students are reminded to refrain from engaging in Violence, Non-cooperation with authorities including organizers, use or the consumption of illicit substances, sloganeering, making sexist comments, or engaging in behaviour that may hurt religious sentiments, disrupt campus discipline, or create excessive noise with vehicles, speakers or any kind of devices in the University campus. Strict disciplinary actions thereby involving the respective department's HoDs will be taken against those found violating these guidelines.

Thanks and Regards,

Student Council &
Sports Council

Vishwakarma University,
Survey No 2,3,4 Laxmi Nagar,
Kondhwa (Bk.) Pune 411048`;

    const mailOptions = {
        from: EMAIL_CONFIG.auth.user,
        to: email,
        subject: 'Your E-Ticket for Vishwaayan, 2026',
        text: emailContentText,
        html: emailContentHtml,
        attachments: [
            {
                filename: 'vishwaayan_ticket.png',
                path: qrCodePath
            },
            {
                filename: 'signature1.jpg',
                path: './signature1.jpg',
                cid: 'signature1'
            },
            {
                filename: 'signature2.jpg',
                path: './signature2.jpg', 
                cid: 'signature2'
            },
            {
                filename: 'Terms and conditions.pdf',
                path: './Terms and conditions.pdf'
            },
            // {
            //     filename: 'Vishwaayan 26 - Brochure-2.pdf',
            //     path: './Vishwaayan 26 - Brochure-2.pdf'
            // }
        ]
    };

    try {
        // Check if files exist before sending
        const attachmentPaths = [
            qrCodePath,
            './signature1.jpg',
            './signature2.jpg',
            './Terms and conditions.pdf',
            // './Vishwaayan 26 - Brochure-2.pdf'
        ];
        
        for (const filePath of attachmentPaths) {
            if (!fs.existsSync(filePath)) {
                throw new Error(`Attachment file missing: ${filePath}`);
            }
        }
        
        await transport.sendMail(mailOptions);
        return { success: true, email: email };
    } catch (err) {
        // Retry logic
        if (retryCount < RETRY_ATTEMPTS) {
            console.log(`⚠️  Retry [${retryCount + 1}/${RETRY_ATTEMPTS}] for ${email} in ${RETRY_DELAY / 1000}s... (${err.message})`);
            await sleep(RETRY_DELAY);
            return sendEmailWithAttachments(email, username, qrCodePath, retryCount + 1);
        }
        
        console.error(`❌ Failed after ${RETRY_ATTEMPTS} attempts: ${email} - ${err.message}`);
        return { success: false, email: email, error: err.message };
    }
}

// Generate and send for a single user
async function processUser(row, currentIndex, totalEmails) {
    // Normalize keys by removing quotes and trimming
    const normalizedRow = {};
    for (let key in row) {
        const cleanKey = key.replace(/^['"]|['"]$/g, '').trim();
        normalizedRow[cleanKey] = row[key];
    }
    
    const phoneNo = normalizedRow['phone_no'];
    const email = normalizedRow['email'];
    const username = normalizedRow['username'];
    
    if (!phoneNo || !email) {
        console.error('Phone number or Email is undefined for row:', row);
        console.error('Available keys:', Object.keys(row));
        console.error('Normalized keys:', Object.keys(normalizedRow));
        return { success: false, email: normalizedRow['email'] || 'unknown', error: 'Missing phone_no or email' };
    }
    
    const qrCodePath = path.join(QR_CODE_DIR, `${phoneNo}.png`);
    
    try {
        // Generate QR code if it doesn't exist
        if (!fs.existsSync(qrCodePath)) {
            const userData = JSON.stringify(normalizedRow);
            const encryptedData = encryptData(userData);
            await generateQRCode(encryptedData, qrCodePath);
            console.log(`📱 QR Code generated: ${phoneNo}.png`);
        }
        
        // Send email with attachments
        const result = await sendEmailWithAttachments(email, username, qrCodePath);
        
        // Live progress update immediately after sending
        if (result.success) {
            console.log(`✅ [${currentIndex}/${totalEmails}] Email sent successfully to: ${email} (${username})`);
        } else {
            console.log(`❌ [${currentIndex}/${totalEmails}] Failed to send email to: ${email} (${username})`);
        }
        
        return result;
    } catch (err) {
        console.error(`❌ [${currentIndex}/${totalEmails}] Error processing ${phoneNo}:`, err.message);
        return { success: false, email: email, error: err.message };
    }
}

// Process emails in batches
async function processBatch(batch, batchNumber, totalBatches, startIndex, totalEmails) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📦 Processing Batch ${batchNumber}/${totalBatches} (${batch.length} emails)`);
    console.log(`${'='.repeat(60)}`);
    
    const promises = batch.map((row, index) => {
        const currentIndex = startIndex + index + 1;
        return processUser(row, currentIndex, totalEmails);
    });
    
    const results = await Promise.all(promises);
    
    return results;
}

// Main CSV processing function
async function processCSV() {
    console.log('🚀 Starting QR Code generation and email sending process...\n');
    const startTime = Date.now();
    
    const rows = [];
    
    // Read CSV file
    await new Promise((resolve, reject) => {
        fs.createReadStream(CSV_FILE_PATH)
            .pipe(csv())
            .on('data', (data) => {
                rows.push(data);
            })
            .on('end', resolve)
            .on('error', reject);
    });
    
    console.log(`📊 Total records found: ${rows.length}\n`);
    
    // Split into batches
    const batches = [];
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        batches.push(rows.slice(i, i + BATCH_SIZE));
    }
    
    const totalBatches = batches.length;
    console.log(`📦 Split into ${totalBatches} batches of ${BATCH_SIZE} emails each\n`);
    
    // Process batches
    const allResults = [];
    let successCount = 0;
    let failureCount = 0;
    
    for (let i = 0; i < batches.length; i++) {
        const startIndex = i * BATCH_SIZE;
        const batchResults = await processBatch(batches[i], i + 1, totalBatches, startIndex, rows.length);
        allResults.push(...batchResults);
        
        // Count successes and failures (without duplicate logging)
        batchResults.forEach(result => {
            if (result.success) {
                successCount++;
            } else {
                failureCount++;
            }
        });
        
        // Progress summary after batch
        const processed = Math.min((i + 1) * BATCH_SIZE, rows.length);
        const percentage = ((processed / rows.length) * 100).toFixed(1);
        const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
        
        console.log(`\n${'─'.repeat(60)}`);
        console.log(`📈 Batch ${i + 1} Complete | Overall Progress: ${processed}/${rows.length} (${percentage}%)`);
        console.log(`✅ Success: ${successCount} | ❌ Failed: ${failureCount} | ⏱️ Time: ${elapsed} min`);
        console.log(`${'─'.repeat(60)}`);
        
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
    console.log(`📧 Average: ${(rows.length / (duration || 1)).toFixed(1)} emails/minute`);
    console.log('='.repeat(60));
    
    // Log failed emails to file
    const failedEmails = allResults.filter(r => !r.success);
    if (failedEmails.length > 0) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const logFile = path.join(LOGS_DIR, `failed_emails_${timestamp}.json`);
        fs.writeFileSync(logFile, JSON.stringify(failedEmails, null, 2));
        console.log(`\n📝 Failed emails logged to: ${logFile}`);
    }
    
    console.log('\n✨ Process completed!\n');
}

// Main execution
(async () => {
    const isConnected = await verifyConnection();
    if (isConnected) {
        await processCSV();
    } else {
        process.exit(1);
    }
})();