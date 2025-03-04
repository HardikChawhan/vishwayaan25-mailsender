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
const EMAIL_CONFIG = {
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, // Get email from .env
        pass: process.env.EMAIL_PASS  // Get password from .env
    }
};

// Default encryption key and IV if not provided in .env
const ENCRYPTION_KEY = process.env.AES_KEY;// Default key if not in .env
const ENCRYPTION_IV = process.env.AES_IV;   // Default IV if not in .env

// Create images directory if it doesn't exist
if (!fs.existsSync(QR_CODE_DIR)) {
    fs.mkdirSync(QR_CODE_DIR, { recursive: true });
}

// Setup email transporter
const transporter = nodemailer.createTransport(EMAIL_CONFIG);

// Encryption function (AES-128)
function encryptData(data) {
    const cipher = crypto.createCipheriv('aes-128-cbc', 
        Buffer.from(ENCRYPTION_KEY.slice(0, 16)), 
        Buffer.from(ENCRYPTION_IV.slice(0, 16)));
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}

// Process each row in the CSV
function processCSV() {
    const results = [];
    
    fs.createReadStream(CSV_FILE_PATH)
        .pipe(csv())
        .on('data', async (row) => {
            try {
                // Store the email for file naming
                const userEmail = row.email;
                const username = row.username;
                
                // Convert row to JSON string
                const userData = JSON.stringify(row);
                
                // Encrypt the data
                const encryptedData = encryptData(userData);
                
                // Generate QR code and save to file
                const qrCodePath = path.join(QR_CODE_DIR, `${userEmail}.png`);
                await generateQRCode(encryptedData, qrCodePath);
                
                // Send email with QR code
                await sendEmail(userEmail, username, qrCodePath);
                
                console.log(`Processed ${userEmail} successfully.`);
            } catch (error) {
                console.error(`Error processing row: ${JSON.stringify(row)}`, error);
            }
        })
        .on('end', () => {
            console.log('CSV processing completed.');
        });
}

// Generate QR Code
async function generateQRCode(data, filePath) {
    try {
        await QRCode.toFile(filePath, data);
        console.log(`QR code generated: ${filePath}`);
    } catch (error) {
        console.error('QR Code generation error:', error);
        throw error;
    }
}

// Send Email with QR Code attachment
async function sendEmail(email, username, qrCodePath) {
    // HTML version of the email
    const emailContentHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your E-Ticket for Aarambh, 2024</title>
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
        .event-details {
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
            border-left: 4px solid #005f9e;
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
        .region {
            font-weight: bold;
            color: #005f9e;
        }
        .department {
            margin-left: 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Aarambh, 2024</h1>
            <p>Your Official E-Ticket</p>
        </div>

        <p>Dear <strong>${username}</strong>,</p>

        <p>Thank you for registering for Aarambh, 2024! We are excited to have you join us for this special event. Please find your e-ticket below, which includes a QR code required for entry. <strong>Please note the QR is viable for a single scan only.</strong></p>

        <p>Keeping this in mind, please note that the Student entering the premises of Building 1 will not be able to enter again if the Student has to take an exit from the Premises for any reason.</p>

        <div class="event-details">
            <h3>📅 Event Details:</h3>
            <p><strong>Event Date:</strong> 27th Sep, 2024</p>
            <p><strong>Entry Start Time:</strong> 12:30 PM</p>
            <p><strong>Final Entry Time:</strong> 04:00 PM (entries will be closed after this)</p>
            <p><strong>Venue:</strong> Behind Eco Campus, Vishwakarma University, Pune</p>
            <p><em>The detailed programme schedule has been attached to this email.</em></p>
        </div>

        <div class="important-info">
            <h3>⚠️ Important Information:</h3>
            <ul>
                <li>Your QR Code is valid for a single scan only. Once scanned, re-entry will not be permitted.</li>
                <li>Please arrive on time, as entry closes at 4:00 PM. After this time, no further entry will be allowed, and no exceptions will be made.</li>
                <li>You must present both your ID card and the attached QR code at the entrance for a smooth check-in process.</li>
                <li><strong>Note:</strong> Get your self-declaration form printed and it is compulsory for all students. Without it, entry will not be permitted.</li>
            </ul>
        </div>

        <div class="dress-code">
            <h3>👗 Dress code for Aarambh:</h3>
            <p>Please follow the following for the dress code according to your respective departments:</p>

            <p class="region">NORTH - (Jammu & Kashmir, Himachal Pradesh, Punjab, Uttarakhand, Haryana, Delhi, Uttar Pradesh and UT Chandigarh)</p>
            <p class="department">• Humanities and Social Sciences</p>
            <p class="department">• Media and Communication</p>

            <p class="region">SOUTH - (Andhra Pradesh, Karnataka, Kerala, Tamil Nadu, and Telangana)</p>
            <p class="department">• Commerce and Management</p>
            <p class="department">• Art and Design</p>

            <p class="region">EAST - (Bihar, Jharkhand, Odisha and West Bengal, Mizoram, Sikkim, Chhattisgarh, Assam, Meghalaya, Tripura)</p>
            <p class="department">• Pharmacy</p>
            <p class="department">• Science and Technology</p>

            <p class="region">WEST - (Maharashtra, Goa, Gujarat, Rajasthan, Daman & Diu)</p>
            <p class="department">• Interdisciplinary studies</p>
            <p class="department">• Architecture</p>
            <p class="department">• Law</p>

            <p><em>Examples for the above have been attached with this email.</em></p>

            <p>If, for some reason, you are unable to follow the dress code, please wear decent Ethnic Wear.</p>

            <p><strong>If anyone does not follow the above guidelines, they will not be permitted to enter the premises of the event.</strong></p>
        </div>

        <p>Aarambh promises an unforgettable day filled with creativity, talent, and fun. We look forward to celebrating with you and the entire Vishwakarma University community.</p>

        <div class="contact">
            <h3>📞 Contact Information:</h3>
            <p>If you have any questions, please contact us at:</p>
            <p><strong>Pratik Pawar:</strong> 9552524565</p>
            <p><strong>Vidhi Bafna:</strong> 9172463623</p>
            <p><strong>Dhruv Nahar:</strong> 9112424754</p>
        </div>

        <p><strong>Please note that seating for the event will be done on "First Come First Serve Basis" and priority will be given to First Year students and Direct Second Year Students.</strong></p>

        <p>Please also note that you need to carry the duly filled self-declaration form on the day of the event.</p>

        <p>Don't miss the excitement of Aarambh. We can't wait to see you there!</p>

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
                Student Welfare</strong><br>
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

Thank you for registering for Aarambh, 2024! We are excited to have you join us for this special event. Please find your e-ticket below, which includes a QR code required for entry. Please note the QR is viable for a single scan only.

Keeping this in mind, please note that the Student entering the premises of Building 1 will not be able to enter again if the Student has to take an exit from the Premises for any reason.

Event Details:
Event Date: 27th Sep, 2024
Entry Start Time: 12:30 PM
Final Entry Time: 04:00 PM (entries will be closed after this)
Venue: Behind Eco Campus, Vishwakarma University, Pune

The detailed programme schedule has been attached to this email.

Important Information:
- Your QR Code is valid for a single scan only. Once scanned, re-entry will not be permitted.
- Please arrive on time, as entry closes at 4:00 PM. After this time, no further entry will be allowed, and no exceptions will be made.
- You must present both your ID card and the attached QR code at the entrance for a smooth check-in process.
- Note: Get your self-declaration form printed and it is compulsory for all students. Without it, entry will not be permitted.

Dress code for Aarambh:
Please follow the following for the dress code according to your respective departments:

NORTH - (Jammu & Kashmir, Himachal Pradesh, Punjab, Uttarakhand, Haryana, Delhi, Uttar Pradesh and UT Chandigarh)
*Humanities and Social Sciences
*Media and Communication

SOUTH - (Andhra Pradesh, Karnataka, Kerala, Tamil Nadu, and Telangana)
*Commerce and Management
*Art and Design

EAST - (Bihar, Jharkhand, Odisha and West Bengal, Mizoram, Sikkim, Chhattisgarh, Assam, Meghalaya, Tripura)
*Pharmacy
*Science and Technology

WEST - (Maharashtra, Goa, Gujarat, Rajasthan, Daman & Diu)
*Interdisciplinary studies
*Architecture
*Law

Examples for the above have been attached with this email.

If, for some reason, you are unable to follow the dress code, please wear decent Ethnic Wear.

If anyone does not follow the above guidelines, they will not be permitted to enter the premises of the event.

Aarambh promises an unforgettable day filled with creativity, talent, and fun. We look forward to celebrating with you and the entire Vishwakarma University community.

If you have any questions, please contact us at:

Pratik Pawar : 9552524565
Vidhi Bafna : 9172463623
Dhruv Nahar : 9112424754

Please note that seating for the event will be done on "First Come First Serve Basis" and priority will be given to First Year students and Direct Second Year Students.

Please also note that you need to carry the duly filled self-declaration form on the day of the event.

Don't miss the excitement of Aarambh. We can't wait to see you there!

Important Note:
Students are reminded to refrain from engaging in Violence, Non-cooperation with authorities including organizers, use or the consumption of illicit substances, sloganeering, making sexist comments, or engaging in behaviour that may hurt religious sentiments, disrupt campus discipline, or create excessive noise with vehicles, speakers or any kind of devices in the University campus. Strict disciplinary actions thereby involving the respective department's HoDs will be taken against those found violating these guidelines.


Thanks and Regards,

Student Council &
Student Welfare

Vishwakarma University,
Survey No 2,3,4 Laxmi Nagar,
Kondhwa (Bk.) Pune 411048`;

    const mailOptions = {
        from: EMAIL_CONFIG.auth.user,
        to: email,
        subject: 'Your E-Ticket for Aarambh, 2024',
        text: emailContentText,
        html: emailContentHtml, // Add the HTML version
        attachments: [
            {
                filename: 'aarambh_ticket.png',
                path: qrCodePath
            },
            {
                filename: 'signature1.jpg',
                path: './signature1.jpg', // Path to your first signature image
                cid: 'signature1' // Content ID for referencing in the HTML
            },
            {
                filename: 'signature2.jpg',
                path: './signature2.jpg', // Path to your second signature image
                cid: 'signature2' // Content ID for referencing in the HTML
            }
        ]
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`Email sent to ${email}: ${info.messageId}`);
    } catch (error) {
        console.error(`Email sending error for ${email}:`, error);
        throw error;
    }
}

// Start processing
console.log('Starting to process CSV file...');
processCSV();