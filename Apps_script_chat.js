/**
 * نظام الشات والبريد المتكامل - النسخة الاحترافية الشاملة
 * تم دمج كافة الدوال مع إضافة doPost دون أي تعديل في المنطق أو الحقول
 */
var MASTER_SS_ID = "13eONR-nL_hZniACgBdlrzXFprNgZwuGUkyrey-n7VrA";

// SCHEMA الشامل لضمان توافق الأعمدة في النسختين
const SCHEMA = {
  MEMBERS: { name: "أعضاء_الشات", id: 0, fullName: 1, type: 2, status: 3, lastSeen: 5, img: 7, isBlocked: 12 },
  CHANNELS: { name: "قنوات_الشات", id: 0, nameCol: 1, type: 2, owner: 3, createdAt: 5, lastUpdate: 6, status: 7, memberCount: 9, lastActivity: 12, courseCode: 14, unreadTotal: 15 },
  CHANNEL_MEMBERS: { name: "أعضاء_القنوات", channelId: 0, memberId: 1, type: 2, role: 3, status: 6, unreadCount: 9 },
  MESSAGES: { name: "رسائل_الشات", id: 0, channelId: 1, replyTo: 2, sender: 3, typeSender: 4, content: 5, attachmentsCount: 6, timestamp: 12, isRead: 13 },
  ATTACHMENTS: { name: "مرفقات_الشات", id: 0, msgId: 1, name: 2, type: 3, size: 4, url: 6, uploader: 8, date: 7 },
  LOGS: { name: "سجل_نشاطات_شات", time: 0, type: 1, user: 2, content: 3 },
  ERRORS: { name: "سجل_أخطاء_شات", time: 0, type: 1, source: 2, details: 3 }
};

/**
 * دالة doPost لمعالجة طلبات الإرسال (POST)
 */
function doPost(e) {
  var ss = SpreadsheetApp.openById(MASTER_SS_ID);
  var action = e.parameter.action;
  var data;
  
  try {
    data = JSON.parse(e.postData.contents);
    
    switch (action) {
      case 'sendInternalMail':
        return jsonResponse(sendInternalMail(data));
      case 'replyToMail':
        return jsonResponse(replyToMail(data.originalMsgId, data.replyData));
      case 'sendMessage':
        // تمرير البيانات لدالة sendMessageEnhanced الأصلية
        return jsonResponse(sendMessageEnhanced(ss, data.senderId, data.channelId, data.content, data.replyTo, JSON.stringify(data.attachments)));
      case 'syncStudent':
        syncStudentToChat(data);
        return jsonResponse({ success: true });
      default:
        return jsonResponse({ error: true, message: "Action not recognized in doPost" });
    }
  } catch (err) {
    return jsonResponse({ error: true, message: err.toString() });
  }
}

function doGet(e) {
  var action = e.parameter.action;
  var studentId = e.parameter.studentId;
  var ss = SpreadsheetApp.openById(MASTER_SS_ID);

  try {
    if (!studentId) throw new Error("studentId is required");

    // فحص الحظر الشامل قبل أي إجراء
    if (isGlobalBlocked(ss, studentId)) throw new Error("Access Denied: User is globally blocked.");

    switch (action) {
      // --- دوال الأعضاء والمزامنة ---
      case 'getAllChatMembers': return jsonResponse(getAllMembers(ss, studentId)); 
      case 'getAllMembersWithDetails': return jsonResponse(getAllMembersWithDetails(ss, studentId)); 
      case 'updateStatus': updateUserStatus(ss, studentId, e.parameter.status); return textResponse("Status Updated");
      
      // --- دوال القنوات والمحادثات ---
      case 'getOrCreatePrivateChat': return jsonResponse(getOrCreatePrivate(ss, studentId, e.parameter.targetId)); 
      case 'getMyChannels': 
        return jsonResponse(getMyChannelsAction(ss, studentId));
      case 'getUserChannels': 
        return jsonResponse(getUserChannels(ss, studentId));
      case 'createGroupChannel': return jsonResponse(createGroupChannel(ss, studentId, e.parameter.channelName, e.parameter.type, e.parameter.courseCode));
      case 'manageMember': return jsonResponse(manageChannelMember(ss, e.parameter.channelId, e.parameter.targetId, e.parameter.mode));

      // --- دوال الرسائل والمرفقات (المتقدمة) ---
      case 'sendMessage': 
        return jsonResponse(sendMessageEnhanced(ss, studentId, e.parameter.channelId, e.parameter.content, e.parameter.replyTo, e.parameter.attachments));
      case 'getMessages': 
        return jsonResponse(getMessagesPaginated(ss, e.parameter.channelId, e.parameter.limit, e.parameter.offset));
      case 'markAsRead': 
        return jsonResponse(clearUnreadCount(ss, e.parameter.channelId, studentId));

      // --- دوال البريد الداخلي ---
      case 'fetchMailbox':
        return jsonResponse(fetchMailbox(studentId, e.parameter.isAdmin === "true"));
      case 'fetchConversationThread':
        return jsonResponse(fetchConversationThread(e.parameter.conversationId));

      // --- دوال الحظر ---
      case 'blockUser': return jsonResponse(manageBlock(ss, studentId, e.parameter.targetId, e.parameter.channelId, "block"));
      case 'unblockUser': return jsonResponse(manageBlock(ss, studentId, e.parameter.targetId, e.parameter.channelId, "unblock"));
      case 'globalBlock': return jsonResponse(manageGlobalBlock(ss, studentId, e.parameter.targetId, "block"));

      default: return textResponse("Invalid Action");
    }
  } catch (err) {
    logError(ss, "doGet: " + action, err.toString());
    return jsonResponse({ error: true, message: err.toString() });
  }
}

// ============================================================
// الجزء 1: دوال المزامنة وتفاصيل الأعضاء
// ============================================================

function getAllMembersWithDetails(ss, studentId) {
  var sheet = ss.getSheetByName(SCHEMA.MEMBERS.name);
  var data = sheet.getDataRange().getValues();
  var members = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][0].toString() === studentId.toString()) continue;
    members.push({
      id: data[i][0], name: data[i][1], type: data[i][2], status: data[i][3],
      lastSeen: formatDateTime(data[i][5]), image: data[i][7] || "", rank: data[i][8]
    });
  }
  return members;
}

function syncStudentToChat(studentData) {
  var ss = SpreadsheetApp.openById(MASTER_SS_ID);
  var chatSheet = ss.getSheetByName(SCHEMA.MEMBERS.name);
  var now = new Date();
  var chatRow = new Array(17).fill("");
  chatRow[0] = studentData.studentId; chatRow[1] = studentData.nameAr; chatRow[2] = "طالب";
  chatRow[3] = "متصل"; chatRow[4] = now; chatRow[5] = now; chatRow[6] = studentData.email || "";
  chatRow[7] = studentData.imageUrl || ""; chatRow[8] = studentData.level || "مبتدئ";
  chatRow[9] = "تمت المزامنة تلقائياً"; chatRow[10] = now; chatRow[11] = now;
  chatRow[12] = "لا"; chatRow[13] = "مستخدم"; chatRow[14] = studentData.phone || "";
  chatRow[15] = studentData.lang || "العربية"; chatRow[16] = "All";
  chatSheet.appendRow(chatRow);
}

// ============================================================
// الجزء 2: إدارة القنوات والمحادثات
// ============================================================

function getOrCreatePrivate(ss, user1, user2) {
  var membersSheet = ss.getSheetByName(SCHEMA.CHANNEL_MEMBERS.name);
  var channelsSheet = ss.getSheetByName(SCHEMA.CHANNELS.name);
  var channelId = "PRIV-" + [user1, user2].sort().join("-");
  
  var channelData = channelsSheet.getDataRange().getValues();
  var exists = channelData.some(row => row[0] === channelId);

  if (!exists) {
    var now = new Date();
    var newChannelRow = new Array(16).fill("");
    newChannelRow[0] = channelId; newChannelRow[1] = "محادثة خاصة"; newChannelRow[2] = "خاصة";
    newChannelRow[3] = user1; newChannelRow[5] = now; newChannelRow[6] = now;
    newChannelRow[7] = "نشط"; newChannelRow[9] = 2; newChannelRow[12] = now;
    channelsSheet.appendRow(newChannelRow);
    createPrivateChannelWithCols(ss, user1, user2, channelId);
  }
  return { channelId: channelId };
}

function createPrivateChannelWithCols(ss, user1, user2, channelId) {
  var mSheet = ss.getSheetByName(SCHEMA.CHANNEL_MEMBERS.name);
  var now = new Date();
  var memberRow1 = [channelId, user1, "طالب", "عضو", now, "", "نشط", "", "", 0, now, ""];
  var memberRow2 = [channelId, user2, "طرف_آخر", "عضو", now, "", "نشط", "", "", 0, now, ""];
  mSheet.appendRow(memberRow1);
  mSheet.appendRow(memberRow2);
}

function getMyChannelsAction(ss, studentId) {
  var memberSheet = ss.getSheetByName(SCHEMA.CHANNEL_MEMBERS.name);
  var mData = memberSheet.getDataRange().getValues();
  var myChannels = [];
  for (var i = 1; i < mData.length; i++) {
    if (mData[i][1].toString() === studentId.toString() && mData[i][6] === "نشط") {
      myChannels.push({ channelId: mData[i][0], role: mData[i][3], unread: mData[i][9] });
    }
  }
  return myChannels;
}

// ============================================================
// الجزء 3: إرسال وجلب الرسائل
// ============================================================

function sendMessageEnhanced(ss, senderId, channelId, content, replyTo, attachmentsJSON) {
  try {
    if (!content && !attachmentsJSON) throw new Error("المحتوى فارغ");
    var cleanContent = content ? content.toString().replace(/<script/gi, "[blocked]") : "";
    var msgSheet = ss.getSheetByName(SCHEMA.MESSAGES.name);
    var msgId = "MSG-" + Utilities.getUuid().substring(0, 8);
    
    var attachments = [];
    if (attachmentsJSON && attachmentsJSON !== "undefined" && attachmentsJSON !== "") {
      try { attachments = JSON.parse(attachmentsJSON); } catch(e) { attachments = []; }
    }

    msgSheet.appendRow([msgId, channelId, replyTo || "", senderId, "طالب", cleanContent, attachments.length, "", "", "", "", "", new Date(), "غير مقروء"]);

    if (attachments.length > 0) {
      attachments.forEach(att => uploadAttachment(ss, msgId, att.type, att.url, att.name, att.size || 0, senderId));
    }

    incrementUnreadForOthers(ss, channelId, senderId);
    updateChannelActivityEnhanced(ss, channelId);
    return { success: true, messageId: msgId };
  } catch (err) { return { success: false, error: err.toString() }; }
}

function getMessagesPaginated(ss, channelId, limit, offset) {
  var lim = parseInt(limit) || 50;
  var off = parseInt(offset) || 0;
  var sheet = ss.getSheetByName(SCHEMA.MESSAGES.name);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var data = sheet.getRange(2, 1, lastRow - 1, 14).getValues();
  var filtered = data.filter(row => row[SCHEMA.MESSAGES.channelId] === channelId);
  
  return filtered.reverse().slice(off, off + lim).map(row => ({
    id: row[SCHEMA.MESSAGES.id],
    sender: row[SCHEMA.MESSAGES.sender],
    content: row[SCHEMA.MESSAGES.content],
    time: formatDateTime(row[SCHEMA.MESSAGES.timestamp]),
    replyTo: row[SCHEMA.MESSAGES.replyTo],
    attachments: getAttachments(ss, row[SCHEMA.MESSAGES.id])
  }));
}

// ============================================================
// الجزء 4: الدوال المساعدة وإدارة الحظر
// ============================================================

function manageBlock(ss, adminId, targetId, channelId, mode) {
  var memSheet = ss.getSheetByName(SCHEMA.CHANNEL_MEMBERS.name);
  var data = memSheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][SCHEMA.CHANNEL_MEMBERS.channelId] === channelId && data[i][SCHEMA.CHANNEL_MEMBERS.memberId].toString() === targetId.toString()) {
      var status = (mode === "block") ? "محظور" : "نشط";
      memSheet.getRange(i + 1, SCHEMA.CHANNEL_MEMBERS.status + 1).setValue(status);
      return { success: true, status: status };
    }
  }
  return { success: false };
}

function manageGlobalBlock(ss, adminId, targetId, mode) {
  var sheet = ss.getSheetByName(SCHEMA.MEMBERS.name);
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][SCHEMA.MEMBERS.id].toString() === targetId.toString()) {
      var val = (mode === "block") ? "نعم" : "لا";
      sheet.getRange(i + 1, SCHEMA.MEMBERS.isBlocked + 1).setValue(val);
      return { success: true };
    }
  }
}

function uploadAttachment(ss, msgId, type, url, name, size, uploader) {
  var sheet = ss.getSheetByName(SCHEMA.ATTACHMENTS.name);
  sheet.appendRow(["ATT-" + Utilities.getUuid().substring(0, 5), msgId, name, type, size, "", url, new Date(), uploader, new Date(), "نشط"]);
}

function getAttachments(ss, msgId) {
  var sheet = ss.getSheetByName(SCHEMA.ATTACHMENTS.name);
  if (sheet.getLastRow() < 2) return [];
  var data = sheet.getDataRange().getValues();
  return data.filter(r => r[1] === msgId).map(r => ({ name: r[2], type: r[3], url: r[6] }));
}

function clearUnreadCount(ss, channelId, userId) {
  var sheet = ss.getSheetByName(SCHEMA.CHANNEL_MEMBERS.name);
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === channelId && data[i][1].toString() === userId.toString()) {
      sheet.getRange(i + 1, 10).setValue(0);
      break;
    }
  }
  return { success: true };
}

function isGlobalBlocked(ss, userId) {
  var sheet = ss.getSheetByName(SCHEMA.MEMBERS.name);
  var data = sheet.getDataRange().getValues();
  var user = data.find(r => r[0].toString() === userId.toString());
  return user ? user[12] === "نعم" : false;
}

function formatDateTime(date) {
  if (!date || isNaN(new Date(date).getTime())) return "غير معروف";
  return Utilities.formatDate(new Date(date), "GMT+3", "yyyy-MM-dd HH:mm");
}

function logError(ss, source, details) {
  ss.getSheetByName(SCHEMA.ERRORS.name).appendRow([new Date(), "خطأ", source, details, "نشط"]);
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function textResponse(text) {
  return ContentService.createTextOutput(text);
}

function getUserChannels(ss, userId) {
  var memSheet = ss.getSheetByName(SCHEMA.CHANNEL_MEMBERS.name);
  var chanSheet = ss.getSheetByName(SCHEMA.CHANNELS.name);
  var memberships = memSheet.getDataRange().getValues();
  var userChannelIds = memberships.filter(row => row[1].toString() === userId.toString()).map(row => row[0]);
  var allChannels = chanSheet.getDataRange().getValues().slice(1);
  return allChannels.filter(row => userChannelIds.includes(row[0])).map(row => ({
      id: row[0], name: row[1], type: row[2], memberCount: row[9], courseCode: row[14]
  }));
}

function createGroupChannel(ss, ownerId, name, type, courseCode) {
  var sheet = ss.getSheetByName(SCHEMA.CHANNELS.name);
  var channelId = (type === "دورة" ? "CRSE-" : "GRP-") + Utilities.getUuid().substring(0, 8);
  var row = new Array(16).fill("");
  row[0] = channelId; row[1] = name; row[2] = type || "جماعية"; row[3] = ownerId;
  row[5] = new Date(); row[6] = new Date(); row[7] = "نشط"; row[9] = 1; row[14] = courseCode || "";
  sheet.appendRow(row);
  
  var memSheet = ss.getSheetByName(SCHEMA.CHANNEL_MEMBERS.name);
  memSheet.appendRow([channelId, ownerId, "مدرب", "مشرف", new Date(), "", "نشط", "", "", 0, new Date(), ""]);
  return { success: true, channelId: channelId };
}

function updateUserStatus(ss, userId, status) {
  var sheet = ss.getSheetByName(SCHEMA.MEMBERS.name);
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0].toString() === userId.toString()) {
      sheet.getRange(i + 1, 4).setValue(status);
      sheet.getRange(i + 1, 6).setValue(new Date());
      break;
    }
  }
}

function getAllMembers(ss, currentUserId) {
  var sheet = ss.getSheetByName(SCHEMA.MEMBERS.name);
  var data = sheet.getDataRange().getValues().slice(1);
  return data.filter(row => row[0].toString() !== currentUserId.toString()).map(row => ({
      id: row[0], name: row[1], image: row[7] || "", 
      status: row[3] === "متصل" ? "متصل الآن" : "آخر ظهور: " + formatDateTime(row[5]),
      isOnline: row[3] === "متصل"
  }));
}

function incrementUnreadForOthers(ss, channelId, senderId) {
  var sheet = ss.getSheetByName(SCHEMA.CHANNEL_MEMBERS.name);
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === channelId && data[i][1].toString() !== senderId.toString()) {
      var current = parseInt(data[i][9] || 0);
      sheet.getRange(i + 1, 10).setValue(current + 1);
    }
  }
}

function updateChannelActivityEnhanced(ss, channelId) {
  var sheet = ss.getSheetByName(SCHEMA.CHANNELS.name);
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === channelId) {
      sheet.getRange(i + 1, 13).setValue(new Date());
      sheet.getRange(i + 1, 7).setValue(new Date());
      break;
    }
  }
}

function manageChannelMember(ss, channelId, targetId, mode) {
  var memSheet = ss.getSheetByName(SCHEMA.CHANNEL_MEMBERS.name);
  var data = memSheet.getDataRange().getValues();
  var rowIndex = -1;
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === channelId && data[i][1].toString() === targetId.toString()) {
      rowIndex = i + 1; break;
    }
  }
  if (mode === "add" && rowIndex === -1) {
    memSheet.appendRow([channelId, targetId, "طالب", "عضو", new Date(), "", "نشط", "", "", 0, new Date(), ""]);
  } else if (mode === "remove" && rowIndex !== -1) {
    memSheet.deleteRow(rowIndex);
  }
  return { success: true };
}

// ============================================================
// الجزء 5: نظام البريد الداخلي والإشعارات (الإصدار النهائي)
// ============================================================

function sendInternalMail(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("البريد_الداخلي");
  if (!sheet) throw new Error("ورقة البريد الداخلي غير موجودة");

  const now = new Date();
  const msgId = "MSG-" + now.getTime();
  
  const rowData = [
    msgId, data.conversationId || msgId, data.replyTo || "", data.type || "نص",
    data.senderName, data.senderType, data.studentId, data.receiverName, data.receiverType,
    data.subject, data.content, "مرسلة", data.priority || "عادية", "البوابة",
    data.attachmentCount || 0, data.attachments || "", data.receiverId || "",
    data.isImportant || false, "", false, 0, true, data.category || "عام",
    now, "", "", "", now
  ];

  sheet.appendRow(rowData);
  return { success: true, messageId: msgId };
}

function fetchMailbox(userId, isAdmin) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("البريد_الداخلي");
  if (!sheet) return [];

  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const senderIdIdx = 6;
  const receiverIdIdx = 16;

  const filteredData = values.slice(1).filter(row => {
    if (isAdmin) return true;
    return String(row[senderIdIdx]) === String(userId) || String(row[receiverIdIdx]) === String(userId);
  });

  return filteredData.map(row => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function processInternalNotifications() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const mailSheet = ss.getSheetByName("البريد_الداخلي");
  const data = mailSheet.getDataRange().getValues();
  
  const idxReceiverId = 16, idxReceiverType = 8, idxIsNotified = 19;
  const idxSubject = 9, idxReceiverName = 7, idxContent = 10;

  for (let i = 1; i < data.length; i++) {
    if (data[i][idxIsNotified] === false || data[i][idxIsNotified] === "") {
      const receiverEmail = getEmailForUser(data[i][idxReceiverId], data[i][idxReceiverType]);
      if (receiverEmail) {
        try {
          MailApp.sendEmail({
            to: receiverEmail,
            subject: "إشعار بريد داخلي جديد: " + data[i][idxSubject],
            body: `مرحباً ${data[i][idxReceiverName]},\n\nلديك رسالة جديدة في النظام.\nالمحتوى: ${data[i][idxContent]}\n\nيرجى الدخول للبوابة للمتابعة.`
          });
          mailSheet.getRange(i + 1, idxIsNotified + 1).setValue(true);
        } catch (e) {
          console.error("فشل إرسال الإيميل للمعرف: " + data[i][idxReceiverId]);
        }
      }
    }
  }
}

function getEmailForUser(userId, userType) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet, emailCol;
  
  if (userType === "طالب") {
    sheet = ss.getSheetByName("قاعدة_بيانات_الطلاب");
    emailCol = 6;
  } else {
    sheet = ss.getSheetByName("إدارة_المعلمين_والموظفين");
    emailCol = 4;
  }

  if (!sheet) return null;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(userId)) return data[i][emailCol];
  }
  return null;
}

// ============================================================
// الجزء 6: دوال الرد والمسارات (Thread)
// ============================================================

function replyToMail(originalMsgId, replyData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("البريد_الداخلي");
  const data = sheet.getDataRange().getValues();
  
  let originalRowIndex = -1, conversationId = "";
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === originalMsgId) {
      originalRowIndex = i + 1;
      conversationId = data[i][1];
      break;
    }
  }

  if (originalRowIndex === -1) throw new Error("الرسالة الأصلية غير موجودة");

  const fullReplyData = { ...replyData, conversationId: conversationId, replyTo: originalMsgId, type: "رد" };
  const result = sendInternalMail(fullReplyData);

  const currentReplies = parseInt(data[originalRowIndex - 1][20] || 0);
  sheet.getRange(originalRowIndex, 21).setValue(currentReplies + 1);
  sheet.getRange(originalRowIndex, 28).setValue(new Date());

  return { success: true, replyId: result.messageId, conversationId: conversationId };
}

function fetchConversationThread(conversationId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("البريد_الداخلي");
  const values = sheet.getDataRange().getValues();
  const headers = values[0];

  return values.slice(1)
    .filter(row => row[1] === conversationId)
    .sort((a, b) => new Date(a[23]) - new Date(b[23]))
    .map(row => {
      let obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    });
}

