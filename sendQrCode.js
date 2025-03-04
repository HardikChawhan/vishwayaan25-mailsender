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
    <title>Your E-Ticket for Vishwaayan, 2025</title>
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
        .event-image {
            text-align: center;
            margin: 20px 0;
        }
        .event-image img {
            max-width: 100%;
            height: auto;
        }
        .day-highlight {
            font-weight: bold;
            color: #005f9e;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Vishwaayan, 2025</h1>
            <p>Your Official E-Ticket</p>
        </div>

        <p>Dear <strong>${username}</strong>,</p>

        <p>Thank you for registering for Vishwaayan 2025! We are thrilled to have you join us for this special celebration. Please find your e-ticket attached, including QR codes required for entry. Kindly note that the QR code is valid for a single scan only, meaning re-entry will not be permitted once you exit the premises.</p>

        <p>The detailed programme schedule is also attached for your reference.</p>

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
            
            <p class="day-highlight">For Day 3 - "Tapestry of India"</p>
            <p>Participants are expected to wear Sarees & Kurtas, celebrating the culture of India.</p>
            
            <p class="day-highlight">For Day 4 - "The Grand Gala"</p>
            <p>The dress code is Suits & Gowns, embracing elegance and sophistication.</p>
            
            <p><strong>If, for any reason, you are unable to follow the dress code, decent wear is required. Entry will be denied to those who do not comply.</strong></p>
        </div>

        <p>We can't wait to celebrate with you at Vishwaayan 2025! Get ready for an unforgettable experience filled with creativity, talent, and excitement.</p>

        <p><strong>See you there!</strong></p>

        <div class="contact">
            <h3>📞 Contact Information:</h3>
            <p>If you have any questions, please contact us at:</p>
            <p><strong>Pratik Pawar:</strong> 9552524565</p>
            <p><strong>Vidhi Bafna:</strong> 9172463623</p>
            <p><strong>Dhruv Nahar:</strong> 9112424754</p>
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

Thank you for registering for Vishwaayan 2025! We are thrilled to have you join us for this special celebration.
Please find your e-ticket attached, including QR codes required for entry. Kindly note that the QR code is valid for a single scan only, meaning re-entry will not be permitted once you exit the premises.

The detailed programme schedule is also attached for your reference.

Important Information: 

QR Code Validity: Your QR code is valid for a single scan only. If you exit the premises, you will not be allowed to re-enter.
Entry Guidelines: Please ensure you arrive on time.
Mandatory Documents: You must present both your ID card and QR code at the entrance for a smooth check-in process.
Self-Declaration Form: It is compulsory to carry a printed self-declaration form for entry. Without it, entry will not be permitted.

Dress Code for Vishwaayan:

For Day 3 - "Tapestry of India", participants are expected to wear Sarees & Kurtas, celebrating the culture of India.

For Day 4 - "The Grand Gala", the dress code is Suits & Gowns, embracing elegance and sophistication.

If, for any reason, you are unable to follow the dress code, decent wear is required. Entry will be denied to those who do not comply.

We can't wait to celebrate with you at Vishwaayan 2025! Get ready for an unforgettable experience filled with creativity, talent, and excitement.

See you there!

If you have any questions, please contact us at:
Pratik Pawar : 9552524565
Vidhi Bafna : 9172463623
Dhruv Nahar : 9112424754

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
        subject: 'Your E-Ticket for Vishwaayan, 2025',
        text: emailContentText,
        html: emailContentHtml, // Add the HTML version
        attachments: [
            {
                filename: 'vishwaayan_ticket.png',
                path: qrCodePath
            },
            {
                filename: 'Day_3_&_4.jpeg', // Event banner image
                path: './Day_3_&_4.jpeg',
                cid: 'Day_3_&_4'
            },
            {
                filename: 'self_declaration.pdf', // Program schedule PDF
                path: './self_declaration.pdf'
            },
            {
                filename: 'theme_wise_outfits.docx', // Self-declaration form
                path: './theme_wise_outfits.docx'
            },
            {
                filename: 'Vishwayan Terms_and_Conditions.docx', // Additional information document
                path: './Vishwayan Terms_and_Conditions.docx'
            },
            {
                filename: 'signature1.jpg', // Path to your first signature image
                path: './signature1.jpg',
                cid: 'signature1' // Content ID for referencing in the HTML
            },
            {
                filename: 'signature2.jpg', // Path to your second signature image
                path: './signature2.jpg', 
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