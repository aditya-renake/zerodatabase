/**
 * ════════════════════════════════════════════════════════════════════════════
 * HACKSERIES 2026 — ZERO-DATABASE APPS SCRIPT ENGINE (SHEET-NATIVE ARCHITECTURE)
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * This script turns your Google Sheet into the complete Database & Mailer!
 * 
 * HOW TO INSTALL IN 60 SECONDS:
 * 1. Open your Google Sheet (where Google Form responses arrive).
 * 2. Click Extensions ➔ Apps Script.
 * 3. Delete everything and paste this entire code.
 * 4. Set SECRET_EVENT_KEY below (or keep default).
 * 5. Click Triggers (⏰ Alarm clock icon on left) ➔ Add 2 Triggers:
 *    - onFormSubmit (Event Source: From spreadsheet ➔ On form submit)
 *    - onEdit (Event Source: From spreadsheet ➔ On edit)
 * 6. (Optional) Click Deploy ➔ New deployment ➔ Web app ➔ Who has access: Anyone.
 * ════════════════════════════════════════════════════════════════════════════
 */

const SECRET_EVENT_KEY = "hackseries_2026_dyp_aces_secret_hmac_key_9988";
const EVENT_NAME = "HackSeries 2026";
const EVENT_VENUE = "Dr. D. Y. Patil Institute of Technology (DYPDPU), Pimpri, Pune";
const EVENT_DATE = "September 2026";
const SENDER_NAME = "HackSeries 2026 Organizing Committee";

/**
 * 1. TRIGGER: Runs automatically when a hacker submits Google Form
 */
function onFormSubmit(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const row = sheet.getLastRow();
    
    // Ensure all required management columns exist in Header Row
    ensureManagementHeaders(sheet);

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const emailCol = findColumnIndex(headers, ["email"]);
    const nameCol = findColumnIndex(headers, ["name", "full name"]);
    const idCol = findColumnIndex(headers, ["unique id", "pass id", "ticket id"]);
    const statusCol = findColumnIndex(headers, ["verification", "status", "verify"]);
    const emailSentCol = findColumnIndex(headers, ["pass emailed", "email sent"]);

    if (emailCol < 0) return;

    const email = sheet.getRange(row, emailCol).getValue().toString().trim();
    const name = nameCol > 0 ? sheet.getRange(row, nameCol).getValue().toString().trim() : "Hacker";

    // Generate Unique Pass ID: HS26-XXXXXX
    let uniqueId = idCol > 0 ? sheet.getRange(row, idCol).getValue().toString().trim() : "";
    if (!uniqueId || !uniqueId.startsWith("HS26-")) {
      uniqueId = "HS26-" + Utilities.getUuid().substring(0, 8).toUpperCase();
      if (idCol > 0) sheet.getRange(row, idCol).setValue(uniqueId);
    }

    // Default Status to 'Pending' if not set
    if (statusCol > 0) {
      const currentStatus = sheet.getRange(row, statusCol).getValue().toString().trim();
      if (!currentStatus) sheet.getRange(row, statusCol).setValue("Pending");
    }

    // Default Pass Emailed to 'NO'
    if (emailSentCol > 0) {
      const currentEmailed = sheet.getRange(row, emailSentCol).getValue().toString().trim();
      if (!currentEmailed) sheet.getRange(row, emailSentCol).setValue("NO");
    }

    // Send instant "Registration Received • Details Under Verification" email
    if (email) {
      sendAckEmail(email, name, uniqueId);
    }
  } catch (err) {
    Logger.log("Error in onFormSubmit: " + err.toString());
  }
}

/**
 * 2. TRIGGER: Runs automatically when you change 'Verified' in Google Sheet
 */
function onEdit(e) {
  try {
    if (!e || !e.range) return;
    const range = e.range;
    const sheet = range.getSheet();
    const row = range.getRow();
    const col = range.getColumn();

    if (row <= 1) return; // Skip header row

    const headerName = sheet.getRange(1, col).getValue().toString().toLowerCase().trim();

    // Check if edited column is Verification Status
    if (headerName.includes("verif") || headerName.includes("status")) {
      const cellValue = range.getValue().toString().trim();
      
      if (cellValue.toLowerCase() === "verified") {
        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const emailCol = findColumnIndex(headers, ["email"]);
        const nameCol = findColumnIndex(headers, ["name", "full name"]);
        const idCol = findColumnIndex(headers, ["unique id", "pass id", "ticket id"]);
        const emailSentCol = findColumnIndex(headers, ["pass emailed", "email sent"]);
        const trackCol = findColumnIndex(headers, ["track", "category", "domain"]);
        const teamCol = findColumnIndex(headers, ["team", "team name"]);

        if (emailCol < 0) return;

        const email = sheet.getRange(row, emailCol).getValue().toString().trim();
        const name = nameCol > 0 ? sheet.getRange(row, nameCol).getValue().toString().trim() : "Hacker";
        const track = trackCol > 0 ? sheet.getRange(row, trackCol).getValue().toString().trim() : "AI & Web3 Innovation";
        const teamName = teamCol > 0 ? sheet.getRange(row, teamCol).getValue().toString().trim() : "";
        
        let uniqueId = idCol > 0 ? sheet.getRange(row, idCol).getValue().toString().trim() : "";
        if (!uniqueId || !uniqueId.startsWith("HS26-")) {
          uniqueId = "HS26-" + Utilities.getUuid().substring(0, 8).toUpperCase();
          if (idCol > 0) sheet.getRange(row, idCol).setValue(uniqueId);
        }

        // Generate HMAC signature
        const signature = generateHmacSignature(uniqueId, email);

        // Send Official Pass Email with QR Code
        sendOfficialPassEmail({
          email: email,
          name: name,
          uniqueId: uniqueId,
          track: track,
          teamName: teamName,
          signature: signature
        });

        // Mark as Pass Emailed: YES
        if (emailSentCol > 0) {
          sheet.getRange(row, emailSentCol).setValue("YES (" + Utilities.formatDate(new Date(), "GMT+5:30", "dd/MM/yyyy HH:mm") + ")");
        }
      }
    }
  } catch (err) {
    Logger.log("Error in onEdit: " + err.toString());
  }
}

/**
 * 3. Generate Cryptographic HMAC-SHA256 Signature
 */
function generateHmacSignature(uniqueId, email) {
  const message = (uniqueId + ":" + email.toLowerCase().trim() + ":Hacker Pass").toUpperCase();
  const rawBytes = Utilities.computeHmacSha256Signature(message, SECRET_EVENT_KEY);
  return rawBytes.map(function(b) {
    return ("0" + (b & 0xFF).toString(16)).slice(-2);
  }).join("");
}

/**
 * 4. Send "Registration Received • Under Verification" acknowledgement email
 */
function sendAckEmail(recipientEmail, attendeeName, uniqueId) {
  const subject = "⏳ We've Received Your Registration — " + EVENT_NAME + " (Ref: " + uniqueId + ")";
  const htmlBody = `
  <div style="background-color: #030712; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #f3f4f6; max-width: 600px; margin: 0 auto; border-radius: 16px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.1);">
    <div style="background: linear-gradient(135deg, #1e1b4b 0%, #030712 100%); padding: 32px 24px; text-align: center; border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 900; letter-spacing: -0.5px;">${EVENT_NAME}</h1>
      <div style="font-size: 11px; color: #d1a550; font-weight: 800; text-transform: uppercase; margin-top: 6px; letter-spacing: 0.1em;">
        ⚡ REGISTRATION APPLICATION RECEIVED
      </div>
    </div>
    <div style="padding: 28px 24px;">
      <p style="font-size: 16px; color: #ffffff; margin-top: 0;">Hello <strong>${attendeeName}</strong>,</p>
      <p style="font-size: 14px; color: #9ca3af; line-height: 1.6;">
        We have received your registration details for <strong>${EVENT_NAME}</strong> at <strong>${EVENT_VENUE}</strong>.
      </p>
      <div style="background: rgba(209, 165, 80, 0.1); border: 1px solid rgba(209, 165, 80, 0.35); border-radius: 12px; padding: 16px; margin: 20px 0;">
        <div style="color: #f7d070; font-weight: 800; font-size: 13px;">⏳ STATUS: DETAILS UNDER VERIFICATION</div>
        <p style="font-size: 12px; color: #e5e7eb; margin: 6px 0 0 0; line-height: 1.5;">
          Our Operations Team is reviewing your submission. Once marked as <strong>Verified</strong>, your official Cryptographic Digital Entry Pass with Gate QR Code will be dispatched to this email address.
        </p>
      </div>
      <div style="font-size: 12px; color: #6b7280;">Application Ref: <strong style="color: #f7d070; font-family: monospace;">${uniqueId}</strong></div>
    </div>
    <div style="background-color: #020408; padding: 18px 24px; text-align: center; font-size: 11px; color: #6b7280; border-top: 1px solid rgba(255, 255, 255, 0.06);">
      Lead Operations: Soham Chitnis, Aditya Renake, Hariti Rawal • ${EVENT_NAME}
    </div>
  </div>`;

  GmailApp.sendEmail(recipientEmail, subject, "", {
    name: SENDER_NAME,
    htmlBody: htmlBody
  });
}

/**
 * 5. Send Official Cryptographic Pass Email with QR Code
 */
function sendOfficialPassEmail(data) {
  const qrPayload = JSON.stringify({
    id: data.uniqueId,
    email: data.email,
    name: data.name,
    ticketType: "Hacker Pass",
    track: data.track,
    team: data.teamName,
    sig: data.signature,
    verified: true,
    issuedAt: new Date().toISOString()
  });

  const qrImageUrl = "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=" + encodeURIComponent(qrPayload);
  const qrBlob = UrlFetchApp.fetch(qrImageUrl).getBlob().setName("HackSeries_Pass_QR.png");

  const subject = "🎟️ YOUR OFFICIAL ENTRY PASS — " + EVENT_NAME + " (" + data.uniqueId + ")";
  const htmlBody = `
  <div style="background-color: #030712; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #f3f4f6; max-width: 600px; margin: 0 auto; border-radius: 16px; overflow: hidden; border: 1px solid rgba(34, 197, 94, 0.3);">
    <div style="background: linear-gradient(135deg, #064e3b 0%, #030712 100%); padding: 32px 24px; text-align: center; border-bottom: 1px solid rgba(34, 197, 94, 0.2);">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 900;">${EVENT_NAME}</h1>
      <div style="font-size: 12px; color: #4ade80; font-weight: 800; text-transform: uppercase; margin-top: 6px;">
        ✅ VERIFIED ENTRY PASS & GATE QR
      </div>
    </div>
    <div style="padding: 28px 24px; text-align: center;">
      <p style="font-size: 18px; color: #ffffff; font-weight: 800; margin: 0 0 6px 0;">Welcome, ${data.name}!</p>
      <p style="font-size: 13px; color: #9ca3af; margin: 0 0 20px 0;">Your registration has been verified. Present this QR code at the campus entry gate.</p>

      <div style="background: #ffffff; display: inline-block; padding: 16px; border-radius: 16px; box-shadow: 0 0 30px rgba(34, 197, 94, 0.35); margin-bottom: 20px;">
        <img src="cid:qrImageInline" alt="Gate QR Pass" style="width: 220px; height: 220px; display: block;" />
        <div style="color: #000; font-family: monospace; font-size: 14px; font-weight: 900; margin-top: 8px;">${data.uniqueId}</div>
      </div>

      <div style="background: #090d18; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 16px; text-align: left; font-size: 13px; margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
          <span style="color: #9ca3af;">Pass Holder:</span>
          <strong style="color: #ffffff;">${data.name}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
          <span style="color: #9ca3af;">Pass ID:</span>
          <strong style="color: #4ade80; font-family: monospace;">${data.uniqueId}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
          <span style="color: #9ca3af;">Track:</span>
          <strong style="color: #22d3ee;">${data.track}</strong>
        </div>
        ${data.teamName ? `<div style="display: flex; justify-content: space-between; margin-bottom: 6px;"><span style="color: #9ca3af;">Team:</span><strong style="color: #ffffff;">${data.teamName}</strong></div>` : ''}
        <div style="display: flex; justify-content: space-between;">
          <span style="color: #9ca3af;">Venue:</span>
          <strong style="color: #ffffff;">${EVENT_VENUE}</strong>
        </div>
      </div>

      <div style="background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 10px; padding: 12px; font-size: 11px; color: #4ade80;">
        🔒 Cryptographically signed with HMAC-SHA256 anti-forgery seal. Zero manual tampering permitted.
      </div>
    </div>
    <div style="background-color: #020408; padding: 18px 24px; text-align: center; font-size: 11px; color: #6b7280; border-top: 1px solid rgba(255, 255, 255, 0.06);">
      Lead Operations: Soham Chitnis, Aditya Renake, Hariti Rawal • ${EVENT_NAME}
    </div>
  </div>`;

  GmailApp.sendEmail(data.email, subject, "", {
    name: SENDER_NAME,
    htmlBody: htmlBody,
    inlineImages: {
      qrImageInline: qrBlob
    },
    attachments: [qrBlob]
  });
}

/**
 * Helper: Find Column Index by keyword matches
 */
function findColumnIndex(headers, keywords) {
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].toString().toLowerCase().trim();
    for (let k = 0; k < keywords.length; k++) {
      if (h.includes(keywords[k])) {
        return i + 1;
      }
    }
  }
  return -1;
}

/**
 * Helper: Automatically append management columns in Row 1 if missing
 */
function ensureManagementHeaders(sheet) {
  const lastCol = Math.max(1, sheet.getLastColumn());
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) { return h.toString().toLowerCase().trim(); });

  const required = [
    { name: "Unique ID", keyword: "unique id" },
    { name: "Verification Status", keyword: "verification" },
    { name: "Pass Emailed", keyword: "pass emailed" },
    { name: "Gate Check-In", keyword: "gate check-in" },
    { name: "Check-In Timestamp", keyword: "check-in timestamp" }
  ];

  let nextCol = lastCol + 1;
  for (let i = 0; i < required.length; i++) {
    let exists = false;
    for (let j = 0; j < headers.length; j++) {
      if (headers[j].includes(required[i].keyword)) {
        exists = true;
        break;
      }
    }
    if (!exists) {
      sheet.getRange(1, nextCol).setValue(required[i].name);
      sheet.getRange(1, nextCol).setFontWeight("bold").setBackground("#1e293b").setFontColor("#f8fafc");
      nextCol++;
    }
  }
}
