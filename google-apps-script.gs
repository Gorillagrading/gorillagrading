function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents || "{}");
    var properties = PropertiesService.getScriptProperties();
    var expectedSecret = properties.getProperty("SHARED_SECRET");

    if (!expectedSecret || payload.secret !== expectedSecret) {
      return jsonResponse({ ok: false, error: "Unauthorized" });
    }

    var email = String(payload.email || "").trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return jsonResponse({ ok: false, error: "Invalid email" });
    }

    var spreadsheetId = properties.getProperty("SPREADSHEET_ID");
    var notificationEmail = properties.getProperty("NOTIFICATION_EMAIL") || "gorillagradingint@gmail.com";
    if (!spreadsheetId) {
      return jsonResponse({ ok: false, error: "Missing script configuration" });
    }

    var spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    var sheet = spreadsheet.getSheets()[0];
    var lock = LockService.getScriptLock();
    lock.waitLock(10000);

    var isNew = false;
    try {
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(["Fecha", "Correo", "Origen"]);
      }

      var lastRow = sheet.getLastRow();
      var existingEmails = lastRow > 1
        ? sheet.getRange(2, 2, lastRow - 1, 1).getValues().flat()
        : [];
      isNew = !existingEmails.some(function (value) {
        return String(value).trim().toLowerCase() === email;
      });

      if (isNew) {
        sheet.appendRow([new Date(), email, String(payload.source || "coming-soon")]);
      }
    } finally {
      lock.releaseLock();
    }

    if (isNew) {
      MailApp.sendEmail({
        to: notificationEmail,
        subject: "Nuevo registro | Gorilla Grading",
        body: "Nuevo correo registrado para recibir novedades de Gorilla Grading:\n\n" + email,
        name: "Gorilla Grading",
        replyTo: notificationEmail
      });

      var logoUrl = properties.getProperty("LOGO_URL") || "https://www.gorillagrading.com/gorilla-logo.png";
      var logo = logoUrl
        ? '<img src="' + escapeHtml(logoUrl) + '" width="88" alt="Gorilla Grading" style="display:block;width:88px;height:auto;margin:0 auto;">'
        : '<div style="font-size:22px;font-weight:800;letter-spacing:2px;color:#ffffff;">GORILLA <span style="color:#61B663;">GRADING</span></div>';
      var confirmationText = "Thanks for your interest in Gorilla Grading. We've received your email and will let you know as soon as the website is live.";
      MailApp.sendEmail({
        to: email,
        subject: "Gorilla Grading | You're on the list",
        body: confirmationText,
        htmlBody: '<div style="margin:0;padding:32px 12px;background:#f0f1f2;font-family:Arial,Helvetica,sans-serif;color:#292d2e;">' +
          '<div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #dfe3e3;">' +
          '<div style="height:6px;background:#61B663;"></div>' +
          '<div style="padding:36px 32px 32px;text-align:center;">' +
          logo +
          '<p style="margin:30px 0 8px;color:#3B803C;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Thanks for signing up</p>' +
          '<h1 style="margin:0 0 18px;color:#252929;font-size:26px;line-height:1.25;">You are on the list.</h1>' +
          '<p style="margin:0 auto 24px;max-width:420px;color:#555d5e;font-size:16px;line-height:1.65;">We will let you know as soon as the Gorilla Grading website is live.</p>' +
          '<div style="width:44px;height:2px;margin:0 auto 24px;background:#61B663;"></div>' +
          '<p style="margin:0;color:#7b8283;font-size:13px;line-height:1.6;">Grading and encapsulation for collectible cards.<br>Madrid</p>' +
          '</div>' +
          '<div style="padding:16px 24px;background:#454545;text-align:center;color:#c5c9c9;font-size:12px;">Gorilla Grading</div>' +
          '</div></div>',
        name: "Gorilla Grading",
        replyTo: notificationEmail
      });
    }

    return jsonResponse({ ok: true, duplicate: !isNew });
  } catch (error) {
    console.error(error);
    return jsonResponse({ ok: false, error: "Signup processing failed" });
  }
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}