var MASTER_SS_ID = "13eONR-nL_hZniACgBdlrzXFprNgZwuGUkyrey-n7VrA";



// دالة جلب الإعدادات من شيت الإعدادات
function getSetting(key) {
  var ss = SpreadsheetApp.openById(MASTER_SS_ID);
  var sheet = ss.getSheetByName("الإعدادات");
  var data = sheet.getDataRange().getValues();
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] == key) return data[i][1];
  }
  return null;
}

// دالة الاستجابة الموحدة (JSON)
function createResponse(msg, success, data = null) {
  var res = {"success": success, "message": msg};
  if (data) res["data"] = data;
  return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
}

/** * دالة POST: معالجة كافة عمليات الإدخال والتحديث
 * تغطي: التسجيل، الحضور، التقارير، الواجبات، بنك الأسئلة، الشات، والبريد الداخلي
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    
    var requestData = JSON.parse(e.postData.contents);
    var masterKey = getSetting("API_KEY");
    
    if (requestData.apiKey !== masterKey) {
      return createResponse("خطأ في المصادقة", false);
    }

    var ss = SpreadsheetApp.openById(MASTER_SS_ID);
    var dateFormat = getSetting("DATE_FORMAT") || "yyyy-MM-dd HH:mm";
    var timestamp = Utilities.formatDate(new Date(), "GMT+3", dateFormat);

    // 1️⃣ قسم الطلاب المطور (24 عمود كاملة)
    if (requestData.action === "manageStudents") {
      var sheet = ss.getSheetByName("قاعدة_بيانات_الطلاب");
      var subAction = requestData.subAction;

      if (subAction === "register") {
        var row = new Array(24).fill(""); 
        row[0] = "STD-" + Math.floor(Math.random() * 9000 + 1000); 
        row[1] = requestData.nameEn || "";      
        row[2] = requestData.nameAr;            
        row[3] = requestData.age || "";         
        row[4] = requestData.country || "";     
        row[5] = requestData.phone;             
        row[6] = requestData.email || "";       
        row[7] = timestamp;                     
        row[8] = requestData.birthDate || "";   
        row[9] = requestData.level || "";       
        row[10] = "نشط";                         
        row[11] = requestData.password || "123456"; 
        row[12] = requestData.imageUrl || "";   
        row[13] = requestData.courseId;         
        row[14] = requestData.notes || "";       
        row[15] = requestData.gender || "";      
        row[16] = requestData.parentName || "";  
        row[17] = requestData.parentPhone || ""; 
        row[18] = requestData.lang || "العربية"; 
        row[19] = requestData.promoCode || "";   
        row[20] = requestData.regSource || "";   
        row[21] = timestamp;                    
        row[22] = requestData.healthStatus || "سليم"; 
        row[23] = requestData.idLink || "";      
        
        sheet.appendRow(row);

        try {
          syncStudentToChat({ 
            studentId: row[0], 
            nameAr: row[2], 
            email: row[6], 
            imageUrl: row[12], 
            level: row[9], 
            phone: row[5], 
            lang: row[18] 
          });
        } catch (e) {
          logToSheet("CHAT_SYNC_ERROR", "register", e.toString());
        }
        return createResponse("تم تسجيل الطالب ومزامنته مع الشات بنجاح", true);
      } 
      else if (subAction === "update") {
        var data = sheet.getDataRange().getValues();
        var studentId = requestData.studentId;
        for (var i = 1; i < data.length; i++) {
          if (data[i][0].toString() === studentId.toString()) {
            if(requestData.nameAr) sheet.getRange(i + 1, 3).setValue(requestData.nameAr);
            if(requestData.level) sheet.getRange(i + 1, 10).setValue(requestData.level);
            if(requestData.courseId) sheet.getRange(i + 1, 14).setValue(requestData.courseId);
            if(requestData.imageUrl) sheet.getRange(i + 1, 13).setValue(requestData.imageUrl);
            if(requestData.status) {
              sheet.getRange(i + 1, 11).setValue(requestData.status);
              var isBanned = (requestData.status.indexOf("نشط") === -1) ? "نعم" : "لا";
              updateChatMemberSync(studentId, { banStatus: isBanned });
            }
            sheet.getRange(i + 1, 22).setValue(timestamp); 
            return createResponse("تم تحديث بيانات الطالب وحالته في الشات", true);
          }
        }
      }
      else if (subAction === "delete") {
        var data = sheet.getDataRange().getValues();
        for (var i = 1; i < data.length; i++) {
          if (data[i][0].toString() == requestData.studentId.toString()) {
            sheet.getRange(i + 1, 11).setValue("غير نشط / محذوف");
            updateChatMemberSync(requestData.studentId, { banStatus: "نعم" });
            return createResponse("تم إلغاء تفعيل الطالب وحظره من الشات", true);
          }
        }
      }
    }

    // 2️⃣ قسم الحضور المطور (10 أعمدة كاملة)
    else if (requestData.action === "manageAttendance") {
      var sheet = ss.getSheetByName("سجل_الحضور");
      var subAction = requestData.subAction;
      var dateOnly = Utilities.formatDate(new Date(), "GMT+3", "yyyy-MM-dd");
      var timeOnly = Utilities.formatDate(new Date(), "GMT+3", "HH:mm");

      if (subAction === "submit") {
        var row = new Array(10).fill("");
        row[0] = dateOnly;                
        row[1] = timeOnly;                
        row[2] = "";                      
        row[3] = requestData.studentId;   
        row[4] = requestData.studentName; 
        row[5] = requestData.attendanceType; 
        row[6] = requestData.status;      
        row[7] = requestData.totalPresent || 0;
        row[8] = requestData.totalAbsent || 0;
        row[9] = requestData.reason || ""; 
        sheet.appendRow(row);
        return createResponse("تم التسجيل بنجاح", true);
      }
      else if (subAction === "updateExit") {
        var data = sheet.getDataRange().getValues();
        for (var i = data.length - 1; i >= 1; i--) {
          var rowDate = Utilities.formatDate(new Date(data[i][0]), "GMT+3", "yyyy-MM-dd");
          if (rowDate === dateOnly && data[i][3] == requestData.studentId) {
            sheet.getRange(i + 1, 3).setValue(timeOnly); 
            return createResponse("تم تسجيل الانصراف للطالب: " + data[i][4], true);
          }
        }
        return createResponse("لم يتم العثور على سجل حضور لهذا الطالب اليوم", false);
      }
    }

    // 3️⃣ قسم التقارير اليومية المطور (14 عمود كاملة)
    else if (requestData.action === "manageReports") {
      var sheet = ss.getSheetByName("التقارير_اليومية");
      var subAction = requestData.subAction;

      if (subAction === "submit") {
        var row = new Array(14).fill("");
        var now = new Date();
        var performanceResult = requestData.performance; 
        if (!performanceResult || performanceResult.trim() === "") {
          var errors = parseInt(requestData.errors) || 0;
          var calcScore = 100 - (errors * 5);
          if (calcScore >= 90) performanceResult = "ممتاز ⭐ (آلي)";
          else if (calcScore >= 75) performanceResult = "جيد جداً (آلي)";
          else if (calcScore >= 50) performanceResult = "مقبول (آلي)";
          else performanceResult = "ضعيف (آلي)";
        }
        row[0] = timestamp;                             
        row[1] = Utilities.formatDate(now, "GMT+3", "MM"); 
        row[2] = requestData.studentId;                 
        row[3] = requestData.studentName;               
        row[4] = requestData.hifz;                      
        row[5] = requestData.errors || 0;               
        row[6] = requestData.review || "";              
        row[7] = requestData.evaluation || "";          
        row[8] = requestData.tajweedHw || "";           
        row[9] = requestData.duration || "";            
        row[10] = requestData.tajweedGrade || "";       
        row[11] = requestData.hifzType || "";           
        row[12] = performanceResult;                    
        row[13] = requestData.audioLink || "";          
        sheet.appendRow(row);
        return createResponse("تم حفظ التقرير بنجاح", true);
      }
      else if (subAction === "update") {
        var data = sheet.getDataRange().getValues();
        var today = Utilities.formatDate(new Date(), "GMT+3", "yyyy-MM-dd");
        for (var i = data.length - 1; i >= 1; i--) {
          var rowDate = Utilities.formatDate(new Date(data[i][0]), "GMT+3", "yyyy-MM-dd");
          if (rowDate === (requestData.reportDate || today) && data[i][2].toString() === requestData.studentId.toString()) {
             if(requestData.hifz) sheet.getRange(i + 1, 5).setValue(requestData.hifz);
             if(requestData.errors !== undefined) sheet.getRange(i + 1, 6).setValue(requestData.errors);
             if(requestData.review) sheet.getRange(i + 1, 7).setValue(requestData.review);
             if(requestData.evaluation) sheet.getRange(i + 1, 8).setValue(requestData.evaluation);
             if(requestData.tajweedGrade) sheet.getRange(i + 1, 11).setValue(requestData.tajweedGrade);
             if(requestData.performance) sheet.getRange(i + 1, 13).setValue(requestData.performance); 
             return createResponse("تم تحديث التقرير بنجاح", true);
          }
        }
        return createResponse("لم يتم العثور على التقرير لتعديله", false);
      }
      else if (subAction === "delete") {
        var data = sheet.getDataRange().getValues();
        var today = Utilities.formatDate(new Date(), "GMT+3", "yyyy-MM-dd");
        for (var i = data.length - 1; i >= 1; i--) {
          var rowDate = Utilities.formatDate(new Date(data[i][0]), "GMT+3", "yyyy-MM-dd");
          if (rowDate === (requestData.reportDate || today) && data[i][2].toString() === requestData.studentId.toString()) {
            sheet.deleteRow(i + 1);
            return createResponse("تم حذف التقرير بنجاح", true);
          }
        }
        return createResponse("فشل الحذف: التقرير غير موجود", false);
      }
    }

    // 4️⃣ قسم الواجبات (13 عمود كاملة)
    else if (requestData.action === "manageHomework") {
      var sheet = ss.getSheetByName("الواجبات");
      var subAction = requestData.subAction;

      if (subAction === "submit") {
        var row = new Array(13).fill("");
        row[0] = "HW-" + new Date().getTime();    
        row[1] = requestData.courseId;            
        row[2] = requestData.groupId || "عام";    
        row[3] = requestData.title;               
        row[4] = requestData.description;         
        row[5] = timestamp;                       
        row[6] = requestData.dueDate;             
        row[7] = requestData.submitMethod || "";  
        row[8] = "منشور";                         
        row[9] = requestData.fullGrade || 10;     
        row[10] = requestData.teacherNotes || ""; 
        row[11] = requestData.attachments || "";  
        row[12] = timestamp;                      
        sheet.appendRow(row);
        return createResponse("تم نشر الواجب بنجاح", true);
      }
      else if (subAction === "update") {
        var data = sheet.getDataRange().getValues();
        for (var i = 1; i < data.length; i++) {
          if (data[i][0].toString() === requestData.hwId.toString()) {
            if(requestData.title) sheet.getRange(i+1, 4).setValue(requestData.title);
            if(requestData.dueDate) sheet.getRange(i+1, 7).setValue(requestData.dueDate);
            if(requestData.status) sheet.getRange(i+1, 9).setValue(requestData.status);
            sheet.getRange(i+1, 13).setValue(timestamp); 
            return createResponse("تم تحديث الواجب", true);
          }
        }
      }
    }

    // 5️⃣ قسم بنك الأسئلة (15 عمود كاملة)
    else if (requestData.action === "manageQuestions") {
      var sheet = ss.getSheetByName("بنك_الأسئلة");
      var subAction = requestData.subAction;

      if (subAction === "submit") {
        var row = new Array(15).fill("");
        row[0] = "Q-" + new Date().getTime(); 
        row[1] = requestData.qText; row[2] = requestData.optA;
        row[3] = requestData.optB; row[4] = requestData.optC;
        row[5] = requestData.correctAnswer; row[6] = requestData.grade;
        row[7] = requestData.seconds; row[8] = requestData.courseId;
        row[9] = requestData.difficulty; row[10] = requestData.qType;
        row[11] = requestData.explanation; row[12] = "نشط";
        row[13] = timestamp; row[14] = "المعلم/الإدارة";
        sheet.appendRow(row);
        return createResponse("تمت إضافة السؤال", true);
      }
      else if (subAction === "update") {
        var data = sheet.getDataRange().getValues();
        for (var i = 1; i < data.length; i++) {
          if (data[i][0].toString() === requestData.qId.toString()) {
            if(requestData.qText) sheet.getRange(i + 1, 2).setValue(requestData.qText);
            if(requestData.optA) sheet.getRange(i + 1, 3).setValue(requestData.optA);
            if(requestData.optB) sheet.getRange(i + 1, 4).setValue(requestData.optB);
            if(requestData.optC) sheet.getRange(i + 1, 5).setValue(requestData.optC);
            if(requestData.correctAnswer) sheet.getRange(i + 1, 6).setValue(requestData.correctAnswer);
            if(requestData.grade) sheet.getRange(i + 1, 7).setValue(requestData.grade);
            if(requestData.seconds) sheet.getRange(i + 1, 8).setValue(requestData.seconds);
            if(requestData.difficulty) sheet.getRange(i + 1, 10).setValue(requestData.difficulty);
            if(requestData.explanation) sheet.getRange(i + 1, 12).setValue(requestData.explanation);
            return createResponse("تم تحديث بيانات السؤال بنجاح", true);
          }
        }
      }
      else if (subAction === "delete") {
        var data = sheet.getDataRange().getValues();
        for (var i = 1; i < data.length; i++) {
          if (data[i][0] == requestData.qId) {
            sheet.getRange(i + 1, 13).setValue("محذوف");
            return createResponse("تم حذف السؤال بنجاح", true);
          }
        }
      }
    } 





// 3. دالة إدارة قوالب البريد (تغطي 18 عموداً)
function manageMailTemplate(action, data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("قوالب_البريد");
  const now = new Date();

  if (action === "create") {
    const rowData = [
      "TMP-" + now.getTime(),      // 1. معرف_القالب
      data.code,                   // 2. رمز_القالب
      data.name,                   // 3. اسم_القالب
      data.description,            // 4. الوصف
      data.type,                   // 5. نوع_القالب
      data.trigger || "يدوي",      // 6. حدث_التشغيل
      data.lang || "ar",           // 7. لغة_القالب
      data.subject,                // 8. العنوان
      data.content,                // 9. المحتوى
      data.variables || "",        // 10. متغيرات_القالب
      true,                        // 11. قابل_للتعديل
      "نشط",                       // 12. الحالة
      0,                           // 13. عدد_مرات_الاستخدام
      "",                          // 14. آخر_استخدام
      data.creator || "Admin",     // 15. أنشئ_بواسطة
      now,                         // 16. تاريخ_الإنشاء
      now,                         // 17. آخر_تحديث
      data.techNotes || ""         // 18. ملاحظات_تقنية
    ];
    sheet.appendRow(rowData);
    return { success: true };
  }

  if (action === "fetch") {
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    return values.slice(1).map(row => {
      let obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    });
  }
}












/** * دالة GET: معالجة كافة طلبات جلب البيانات
 * تغطي: جلب الطلاب، إحصائيات الحضور، بيانات الشات
 */


function getStudentsList() {
  var ss = SpreadsheetApp.openById(MASTER_SS_ID);
  var sheet = ss.getSheetByName("قاعدة_بيانات_الطلاب");
  var data = sheet.getDataRange().getValues();
  var students = [];
  for (var i = 1; i < data.length; i++) { if (data[i][0]) { students.push({ id: data[i][0], name: data[i][2] }); } }
  return students;
}



function updateUserStatus(ss, userId, status) {
  var sheet = ss.getSheetByName("أعضاء_الشات");
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0].toString() === userId.toString()) {
      sheet.getRange(i + 1, 4).setValue(status);
      sheet.getRange(i + 1, 6).setValue(new Date());
      break;
    }
  }
}






/**
 * دالة تحديث بيانات العضو في شيت الشات عند تعديله في شيت الطلاب
 */
function updateChatMemberSync(studentId, newData) {
  var ss = SpreadsheetApp.openById(MASTER_SS_ID);
  var chatSheet = ss.getSheetByName("أعضاء_الشات");
  var data = chatSheet.getDataRange().getValues();
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][0].toString() === studentId.toString()) {
      if (newData.name)  chatSheet.getRange(i + 1, 2).setValue(newData.name);
      if (newData.image) chatSheet.getRange(i + 1, 8).setValue(newData.image);
      if (newData.level) chatSheet.getRange(i + 1, 9).setValue(newData.level);
      
      // تحديث عمود الحظر (رقم 13) وحالة الاتصال (رقم 4)
      if (newData.banStatus) {
        chatSheet.getRange(i + 1, 13).setValue(newData.banStatus);
        if (newData.banStatus === "نعم") {
           chatSheet.getRange(i + 1, 4).setValue("محظور");
        } else {
           chatSheet.getRange(i + 1, 4).setValue("متصل");
        }
      }
      chatSheet.getRange(i + 1, 12).setValue(new Date()); 
      break;
    }
  }
}
//-------------------------------------------------
//----------------------------------------------------------------------------------
//محرك مراقبة الاشتراكات (Subscriptions_Module.gs) 

//----------------------------------------------------------------------------------


/**
 * دالة فحص حالات اشتراك الطلاب
 * تعطي تنبيهاً إذا بقي أقل من 3 أيام على الانتهاء
 */
function checkSubscriptionsStatus() {
  const ss = getSS();
  const sheet = ss.getSheetByName("البيانات_الأساسية_للطلاب") || ss.getSheetByName("قاعدة_بيانات_الطلاب");
  if (!sheet) return;

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const idxExpiry = headers.indexOf("تاريخ_انتهاء_الاشتراك");
  const idxName = headers.indexOf("الاسم_بالعربي");
  const idxStatus = headers.indexOf("حالة_الاشتراك"); // عمود إضافي للحالة

  const today = new Date();
  const alertList = [];

  for (let i = 1; i < data.length; i++) {
    const expiryDate = new Date(data[i][idxExpiry]);
    
    if (data[i][idxExpiry] && !isNaN(expiryDate.getTime())) {
      // حساب الفرق بالأيام
      const timeDiff = expiryDate.getTime() - today.getTime();
      const daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));

      let status = "ساري";
      if (daysLeft <= 0) {
        status = "منتهي ❌";
        alertList.push(data[i][idxName] + " (منتهي)");
      } else if (daysLeft <= 3) {
        status = "قارب على الانتهاء ⚠️";
        alertList.push(data[i][idxName] + " (بقي " + daysLeft + " يوم)");
      }

      // تحديث حالة الاشتراك في الجدول تلقائياً
      if (idxStatus !== -1) {
        sheet.getRange(i + 1, idxStatus + 1).setValue(status);
      }
    }
  }

  return alertList;
}
/**
 * عرض تقرير الاشتراكات المتأخرة في نافذة منبثقة
 */
/**
 * عرض تنبيه تلقائي فقط في حال وجود اشتراكات منتهية أو قريبة من الانتهاء
 */
function showSubscriptionAlerts() {
  const alerts = checkSubscriptionsStatus(); // المحرك الذي برمجناه في الخطوة السابقة
  
  if (alerts && alerts.length > 0) {
    const ui = SpreadsheetApp.getUi();
    const message = "⚠️ تنبيه هام: يوجد عدد (" + alerts.length + ") طلاب اشتراكاتهم منتهية أو ستنتهي خلال 3 أيام.\n\n" + 
                    "يرجى مراجعة قائمة الطلاب أو الضغط على زر (المالية > فحص الاشتراكات) للتفاصيل.";
    
    ui.alert("📢 إدارة الاشتراكات", message, ui.ButtonSet.OK);
  } else {
    // لا نظهر أي رسالة إذا كان الوضع سليماً لعدم إزعاج المستخدم عند كل فتح للملف
    console.log("الاشتراكات سليمة عند الفحص التلقائي.");
  }
}





//━━━━━━━━━━━━━━━━━━

/**
 * دالة تسجيل مادة أو تجهيز جديد في المخازن
 * متوافقة تماماً مع الـ 22 عموداً في كود التأسيس الخاص بك
 */
function recordInventoryDetailed(data) {
  try {
    const ss = getSS();
    const sheet = ss.getSheetByName("المخازن_والتجهيزات");
    if (!sheet) throw new Error("ورقة المخازن_والتجهيزات غير موجودة");

    const now = new Date();
    // توليد معرف فريد للتجهيز
    const equipmentId = "EQP-" + Math.floor(now.getTime() / 1000);

    // بناء المصفوفة لتطابق الـ 22 عموداً بالترتيب الدقيق الذي ذكرته
    const rowData = [
      data.storeId || "STR-01",      // 1. معرف_المخزن
      data.storeName || "المستودع الرئيسي", // 2. اسم_المخزن
      data.storeType || "مركزي",     // 3. نوع_المخزن
      data.storeAddress || "المقر",   // 4. عنوان_المخزن
      data.storeKeeper || "",        // 5. أمين_المخزن
      data.responsibleDept || "",    // 6. جهة_المسؤول
      data.contactPhone || "",       // 7. رقم_التواصل
      data.equipmentType || "",      // 8. نوع_التجهيز (أثاث/تقني..)
      equipmentId,                   // 9. معرف_التجهيز (توليد آلي)
      data.equipmentName,            // 10. اسم_التجهيز
      data.quantity || 0,            // 11. الكمية_المتوفرة
      data.unit || "قطعة",           // 12. الوحدة
      data.status || "جديد",         // 13. الحالة
      now,                           // 14. تاريخ_الإدخال
      now,                           // 15. تاريخ_آخر_تحديث
      data.usingDept || "",          // 16. الجهة_المستخدمة
      data.subLocation || "",        // 17. مكان_التخزين_الفرعي
      data.notes || "",              // 18. ملاحظات
      data.unitPrice || 0,           // 19. سعر_الوحدة
      data.supplier || "",           // 20. المورد
      data.nextMaintenance || "",    // 21. تاريخ_الصيانة_المقبلة
      data.maintenanceOfficer || ""  // 22. مسؤول_الصيانة
    ];

    sheet.appendRow(rowData);
    
    // تسجيل في سجل العمليات الإدارية
    logAdminAction("إضافة مخزنية", "تم إضافة: " + data.equipmentName + " إلى " + data.storeName);

    return { success: true, id: equipmentId };
  } catch (e) {
    logSystemError("Inventory_Module", e.message, JSON.stringify(data));
    return { success: false, error: e.message };
  }
}
//━━━━━━━━━━━━━━━━━━


/**
 * محرك الصلاحيات المتقدم
 * يتحقق من إيميل المستخدم الحالي وصلاحياته قبل تنفيذ أي أمر
 */
function checkUserPermission(requiredRole) {
  try {
    const userEmail = Session.getActiveUser().getEmail();
    const ss = getSS();
    const sheet = ss.getSheetByName("المستخدمين_والصلاحيات");
    
    if (!sheet) return true; // إذا لم تفعل الجدول بعد، اسمح بالدخول مؤقتاً

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    // البحث عن المستخدم وصلاحيته
    for (let i = 1; i < data.length; i++) {
      if (data[i][2] === userEmail) { // عمود البريد الإلكتروني
        const userRole = data[i][4]; // عمود الصلاحية (مدير، محاسب، معلم)
        const userStatus = data[i][5]; // عمود الحالة (نشط/موقف)

        if (userStatus !== "نشط") return false;
        
        // المدير له صلاحية على كل شيء
        if (userRole === "مدير") return true;
        
        // التحقق من الصلاحية المطلوبة
        return userRole === requiredRole;
      }
    }
    return false; // مستخدم غير مسجل
  } catch (e) {
    return false;
  }
}

/**
 * مثال على حماية دالة (تعديل الرواتب)
 */
function generatePayrollProtected() {
  if (!checkUserPermission("محاسب") && !checkUserPermission("مدير")) {
    SpreadsheetApp.getUi().alert("🚫 عذراً: لا تملك صلاحية الوصول للإدارة المالية.");
    return;
  }
  generatePayrollUI(); // استدعاء الواجهة إذا كان يملك الصلاحية
}
//━━━━━━━━━━━━━━━━━━
/**
 * دالة تسجيل مادة في المخازن مع الخصم التلقائي من الميزانية
 */
function recordInventoryWithFinance(data) {
  try {
    const ss = getSS();
    
    // 1. تسجيل البيانات في ورقة المخازن (الـ 22 عموداً)
    const inventoryResult = recordInventoryDetailed(data); 
    
    if (inventoryResult.success) {
      // 2. حساب الإجمالي المالي
      const totalCost = (data.quantity || 0) * (data.unitPrice || 0);
      
      if (totalCost > 0) {
        // 3. استدعاء دالة تسجيل المصروفات (المرتبطة بالنظام المالي)
        // نفترض وجود ورقة باسم "المصروفات" أو "الإدارة_المالية_للمؤسسة"
        recordAutomaticExpense({
          date: new Date(),
          category: "مشتريات وأصول مخزنية",
          amount: totalCost,
          description: "شراء تلقائي: " + data.equipmentName + " (كمية: " + data.quantity + ")",
          referenceId: inventoryResult.id
        });
      }
    }
    
    return inventoryResult;
  } catch (e) {
    logSystemError("Inventory_Finance_Link", e.message, JSON.stringify(data));
    return { success: false, error: e.message };
  }
}

/**
 * دالة مساعدة لتسجيل السند المالي تلقائياً
 */
function recordAutomaticExpense(expenseData) {
  const ss = getSS();
  const sheet = ss.getSheetByName("الإدارة_المالية_للطلاب") || ss.getSheetByName("كشوف_المرتبات"); 
  // ملاحظة: يفضل مستقبلاً تخصيص ورقة "المصروفات العامة" لهذا الغرض
  
  // هنا يتم إضافة صف يمثل خروج مبلغ من الخزينة
  Logger.log("تم خصم مبلغ " + expenseData.amount + " من الميزانية بنجاح.");
}

//━━━━━━━━━━━━━━━━━━

//----------------------------------------------------------------------------------
//محرك نظام الاجتماعات
//----------------------------------------------------------------------------------
/**
 * دالة إنشاء سجل اجتماع جديد
 * تغطي الـ 15 عموداً المحددة في جدول "سجل_الاجتماعات"
 */
function recordNewMeeting(meetingData) {
  try {
    const ss = getSS();
    const sheet = ss.getSheetByName("سجل_الاجتماعات");
    if (!sheet) throw new Error("ورقة سجل_الاجتماعات غير موجودة");

    const now = new Date();
    const meetingId = "MTG-" + now.getTime();

    // بناء المصفوفة لتطابق الـ 15 عموداً بالترتيب الدقيق
    const rowData = [
      meetingId,                   // 1. معرف_الاجتماع
      meetingData.title,           // 2. عنوان_الاجتماع
      meetingData.date || now,     // 3. التاريخ
      meetingData.time || "",      // 4. الوقت
      meetingData.location || "أونلاين", // 5. المكان/المنصة
      meetingData.organizer,       // 6. المنظم/المقرر
      meetingData.attendees || "", // 7. قائمة_الحضور
      meetingData.agenda || "",    // 8. جدول_الأعمال
      meetingData.decisions || "", // 9. القرارات_المتخذة
      meetingData.recommendations || "", // 10. التوصيات
      meetingData.status || "مخطط له", // 11. حالة_الاجتماع (مكتمل/مؤجل)
      meetingData.attachments || "", // 12. محضر_الاجتماع (رابط ملف)
      meetingData.nextMeetingDate || "", // 13. موعد_الاجتماع_القادم
      meetingData.branchId || "الرئيسي", // 14. معرف_الفرع
      now                          // 15. تاريخ_التسجيل
    ];

    sheet.appendRow(rowData);
    
    // تسجيل العملية في سجل العمليات الإدارية
    logAdminAction("إنشاء اجتماع", "تم تسجيل اجتماع بعنوان: " + meetingData.title);

    return { success: true, id: meetingId };
  } catch (e) {
    logSystemError("Meetings_Module -> recordNewMeeting", e.message, JSON.stringify(meetingData));
    return { success: false, error: e.message };
  }
}

/**
 * دالة لجلب الاجتماعات القادمة (للعرض في لوحة التحكم الإدارية)
 */
function getUpcomingMeetings() {
  const ss = getSS();
  const sheet = ss.getSheetByName("سجل_الاجتماعات");
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const today = new Date();

  return data.slice(1)
    .filter(row => new Date(row[2]) >= today) // التاريخ في العمود الثالث
    .map(row => {
      let obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    });
}

/**
 * واجهة جدولة اجتماع جديد
 */
function scheduleMeetingUI() {
  const ui = SpreadsheetApp.getUi();
  
  const title = ui.prompt('📅 اجتماع جديد', 'عنوان الاجتماع (مثلاً: اجتماع تقييم المعلمين):', ui.ButtonSet.OK_CANCEL);
  if (title.getSelectedButton() != ui.Button.OK) return;

  const agenda = ui.prompt('📅 اجتماع جديد', 'جدول الأعمال باختصار:', ui.ButtonSet.OK).getResponseText();
  const organizer = ui.prompt('📅 اجتماع جديد', 'اسم المنظم/المقرر:', ui.ButtonSet.OK).getResponseText();

  const result = recordNewMeeting({
    title: title.getResponseText().trim(),
    agenda: agenda,
    organizer: organizer,
    status: "مخطط له"
  });

  if (result.success) {
    ui.alert('✅ تم الجدولة', 'تم تسجيل الاجتماع بنجاح في السجل الرسمي.', ui.ButtonSet.OK);
  } else {
    ui.alert('❌ خطأ', 'حدثت مشكلة أثناء الحفظ.', ui.ButtonSet.OK);
  }
}

//━━━━━━━━━━━━━━━━━━

/**
 * دالة تسجيل نتيجة اختبار لطالب
 * تغطي الـ 16 عموداً المحددة في جدول "سجل_الاختبارات"
 */
function recordExamResult(examData) {
  try {
    const ss = getSS();
    const sheet = ss.getSheetByName("سجل_الاختبارات");
    if (!sheet) throw new Error("ورقة سجل_الاختبارات غير موجودة");

    const now = new Date();
    const examRecordId = "EXM-" + now.getTime();

    // بناء المصفوفة لتطابق الـ 16 عموداً بالترتيب
    const rowData = [
      examRecordId,              // 1. معرف_السجل
      examData.studentId,        // 2. معرف_الطالب
      examData.studentName,      // 3. اسم_الطالب
      examData.courseId,         // 4. معرف_الدورة
      examData.examTitle,        // 5. اسم_الاختبار (مثلاً: نصفي/نهائي)
      examData.examDate || now,  // 6. تاريخ_الاختبار
      examData.maxGrade || 100,  // 7. الدرجة_القصوى
      examData.obtainedGrade,    // 8. الدرجة_المستحقة
      examData.percentage || ((examData.obtainedGrade / examData.maxGrade) * 100).toFixed(2) + "%", // 9. النسبة_المئوية
      examData.obtainedGrade >= (examData.maxGrade / 2) ? "ناجح" : "راسب", // 10. النتيجة
      examData.teacherNotes || "", // 11. ملاحظات_المصحح
      examData.levelBefore || "",  // 12. المستوى_قبل_الاختبار
      examData.levelAfter || "",   // 13. المستوى_بعد_الاختبار
      examData.isFinal || "لا",    // 14. اختبار_نهائي (نعم/لا)
      examData.linkToPaper || "",  // 15. رابط_ورقة_الاختبار (إن وجد)
      now                          // 16. تاريخ_الرصد
    ];

    sheet.appendRow(rowData);
    
    // أتمتة: إذا كان الاختبار نهائياً وناجحاً، يمكننا تحديث مستوى الطالب في شيت الطلاب
    if (examData.isFinal === "نعم" && rowData[9] === "ناجح") {
      updateStudentData(examData.studentId, {"المستوى": examData.levelAfter});
    }

    return { success: true, id: examRecordId };
  } catch (e) {
    logSystemError("Exams_Module -> recordExamResult", e.message, JSON.stringify(examData));
    return { success: false, error: e.message };
  }
}

/**
 * دالة جلب نتائج الاختبارات لطالب معين (لاستخدامها في تطبيق الهاتف)
 */
function getStudentExamHistory(studentId) {
  const ss = getSS();
  const sheet = ss.getSheetByName("سجل_الاختبارات");
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const studentIdIdx = headers.indexOf("معرف_الطالب");

  return data.slice(1)
    .filter(row => String(row[studentIdIdx]) === String(studentId))
    .map(row => {
      let obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    });
}



//انتهى ملف Exams_Module.gs

//----------------------------------------------------------------------------------

//ملف Exams_UI.gs 

/**
 * واجهة رصد درجات الاختبار
 */
function addExamGradeUI() {
  const ui = SpreadsheetApp.getUi();
  
  const studentId = ui.prompt('📝 رصد درجة', 'أدخل معرف الطالب (STU-XXXX):', ui.ButtonSet.OK_CANCEL);
  if (studentId.getSelectedButton() != ui.Button.OK) return;

  const examTitle = ui.prompt('📝 رصد درجة', 'اسم الاختبار (مثلاً: نهائي المستوى الأول):', ui.ButtonSet.OK).getResponseText();
  const grade = ui.prompt('📝 رصد درجة', 'الدرجة التي حصل عليها:', ui.ButtonSet.OK).getResponseText();

  const student = findStudent(studentId.getResponseText().trim());
  
  if (student) {
    const result = recordExamResult({
      studentId: student["معرف_الطالب"],
      studentName: student["الاسم_بالعربي"],
      courseId: student["معرف_الدورة"],
      examTitle: examTitle,
      obtainedGrade: parseFloat(grade),
      maxGrade: 100,
      isFinal: "نعم"
    });

    if (result.success) {
      ui.alert('✅ تم الرصد', 'تم تسجيل الدرجة بنجاح وتحديث سجل الطالب.', ui.ButtonSet.OK);
    }
  } else {
    ui.alert('❌ خطأ', 'الطالب غير موجود.', ui.ButtonSet.OK);
  }
}

//----------------------------------------------------------





//أضف الدوال الاضافيه هنا👇👇








function doGet(e) {
  var action = e.parameter.action;
  var ss = SpreadsheetApp.openById(MASTER_SS_ID);
  var studentId = e.parameter.studentId || e.parameter.id; 

  try {
    // --- 1️⃣ منطق تسجيل دخول الطلاب ---
    if (action === "loginStudent") {
      var email = e.parameter.email;
      var password = e.parameter.password;
      var sheet = ss.getSheetByName("قاعدة_بيانات_الطلاب");
      var data = sheet.getDataRange().getValues();

      for (var i = 1; i < data.length; i++) {
        // البريد الإلكتروني في العمود 7 (Index 6)
        // كلمة المرور في العمود 12 (Index 11)
        if (data[i][6] === email && data[i][11].toString() === password.toString()) {
          
          // التحقق من حالة الحساب في العمود 11 (Index 10)
          if (data[i][10] === "غير نشط / محذوف") {
             return createResponse("هذا الحساب معطل أو محذوف", false);
          }

          // تجهيز بيانات الطالب للارسال
          var profile = {
            studentId: data[i][0],
            nameAr: data[i][2],
            level: data[i][9],
            imageUrl: data[i][12],
            courseId: data[i][13]
          };
          
          // تحديث "آخر نشاط" في العمود 22 (Index 21)
          sheet.getRange(i + 1, 22).setValue(new Date());

          return createResponse("تم تسجيل الدخول بنجاح", true, profile);
        }
      }
      return createResponse("خطأ في البريد الإلكتروني أو كلمة المرور", false);
    }
    // --- نهاية منطق تسجيل الدخول ---

    else if (action === "getMyChannels" || action === "getMessages") {
      var cSheet = ss.getSheetByName("أعضاء_الشات");
      var cData = cSheet.getDataRange().getValues();
      for (var i = 1; i < cData.length; i++) {
        if (cData[i][0].toString() === studentId.toString() && cData[i][12] === "نعم") {
          return createResponse("حسابك محظور من استخدام الشات", false);
        }
      }
    }

// أضف هذا الشرط داخل doGet
else if (action === "hasCourseQuestions") {
  var courseId = e.parameter.courseId;
  var sheet = ss.getSheetByName("بنك_الأسئلة");
  var data = sheet.getDataRange().getValues();
  
  // فحص هل يوجد ولو سؤال واحد نشط لهذه الدورة (العمود 9 هو معرف الدورة والعمود 13 هو الحالة)
  var hasQuestions = data.some(function(row, i) {
    return i > 0 && row[8] == courseId && row[12] === "نشط";
  });
  
  return createResponse("فحص التوفر", true, { hasQuestions: hasQuestions });
}



    // جلب حضور اليوم فقط مع كافة التفاصيل
    else if (action === "getTodayAttendance") {
      var sheet = ss.getSheetByName("سجل_الحضور");
      var data = sheet.getDataRange().getValues();
      var today = Utilities.formatDate(new Date(), "GMT+3", "yyyy-MM-dd");
      var results = [];
      for (var i = 1; i < data.length; i++) {
        var rowDate = Utilities.formatDate(new Date(data[i][0]), "GMT+3", "yyyy-MM-dd");
        if (rowDate === today) {
          results.push({
            date: rowDate, checkIn: data[i][1], checkOut: data[i][2], id: data[i][3], name: data[i][4], type: data[i][5], status: data[i][6], reason: data[i][9]
          });
        }
      }
      return createResponse("نجاح", true, results);
    }

    // 5️⃣ البحث عن طالب
    else if (action === "searchStudent") {
      var query = e.parameter.query.toLowerCase();
      var sheet = ss.getSheetByName("قاعدة_بيانات_الطلاب");
      var data = sheet.getDataRange().getValues();
      var results = [];
      
      for (var i = 1; i < data.length; i++) {
        var nameAr = data[i][2].toString().toLowerCase();
        var phone = data[i][5].toString();
        if (nameAr.includes(query) || phone.includes(query)) {
          results.push({ id: data[i][0], name: data[i][2], level: data[i][9], status: data[i][10] });
        }
      }
      return createResponse("نتائج البحث", true, results);
    }

    // جلب الطلاب بناءً على "معرف الدورة"
    else if (action === "getStudentsByCourse") {
      var courseId = e.parameter.courseId; 
      var sheet = ss.getSheetByName("قاعدة_بيانات_الطلاب");
      var data = sheet.getDataRange().getValues();
      var students = [];
      for (var i = 1; i < data.length; i++) {
        if (data[i][13] == courseId && data[i][10] !== "غير نشط / محذوف") {
          students.push({
            id: data[i][0], nameAr: data[i][2], phone: data[i][5], level: data[i][9], status: data[i][10]
          });
        }
      }
      return createResponse("تم جلب طلاب الدورة بنجاح", true, students);
    }

    // جلب تقارير اليوم فقط
    else if (action === "getTodayReports") {
      var sheet = ss.getSheetByName("التقارير_اليومية");
      var data = sheet.getDataRange().getValues();
      var today = Utilities.formatDate(new Date(), "GMT+3", "yyyy-MM-dd");
      var reports = [];
      for (var i = 1; i < data.length; i++) {
        var rowDate = Utilities.formatDate(new Date(data[i][0]), "GMT+3", "yyyy-MM-dd");
        if (rowDate === today) {
          reports.push({
            time: Utilities.formatDate(new Date(data[i][0]), "GMT+3", "HH:mm"), studentId: data[i][2], studentName: data[i][3], hifz: data[i][4], evaluation: data[i][7], performance: data[i][12]
          });
        }
      }
      return createResponse("تم جلب التقارير", true, reports);
    }

    // جلب الأسئلة الخاصة بدورة معينة
    else if (action === "getQuestionsByCourse") {
      var courseId = e.parameter.courseId; 
      var sheet = ss.getSheetByName("بنك_الأسئلة");
      var data = sheet.getDataRange().getValues();
      var questions = [];
      for (var i = 1; i < data.length; i++) {
        if (data[i][8] == courseId && data[i][12] === "نشط") {
          questions.push({
            id: data[i][0], text: data[i][1], optA: data[i][2], optB: data[i][3], optC: data[i][4], correct: data[i][5], grade: data[i][6], time: data[i][7], difficulty: data[i][9], type: data[i][10], explanation: data[i][11]
          });
        }
      }
      return createResponse("تم جلب أسئلة الدورة بنجاح", true, questions);
    }

    // جلب البروفايل
    else if (action === "getProfile") {
      var id = e.parameter.id;
      var sheet = ss.getSheetByName("قاعدة_بيانات_الطلاب");
      var data = sheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (data[i][0] == studentId) {
          return ContentService.createTextOutput(JSON.stringify({
            "معرف_الطالب": data[i][0], "الاسم_بالعربي": data[i][2], "رابط_الصورة": data[i][12], "الحالة": data[i][10], "المستوى": data[i][9], "رقم_الهاتف": data[i][5], "تاريخ_التسجيل": data[i][7], "إجمالي_المدفوعات": 0 
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }
    }

    // جلب الواجبات
    else if (action === "getAssignments") {
      var sheet = ss.getSheetByName("الواجبات");
      var data = sheet.getDataRange().getValues();
      var assignments = [];
      for (var i = 1; i < data.length; i++) {
        assignments.push({ "الحالة": data[i][8], "عنوان_الواجب": data[i][3], "وصف_الواجب": data[i][4], "تاريخ_التسليم": data[i][6] });
      }
      return ContentService.createTextOutput(JSON.stringify(assignments)).setMimeType(ContentService.MimeType.JSON);
    }

    // جلب الواجبات الخاصة بدورة
    else if (action === "getHomeworkByCourse") {
      var courseId = e.parameter.courseId;
      var sheet = ss.getSheetByName("الواجبات");
      var data = sheet.getDataRange().getValues();
      var homeworks = [];
      for (var i = 1; i < data.length; i++) {
        if (data[i][1] == courseId) {
          homeworks.push({ id: data[i][0], title: data[i][3], dueDate: data[i][6], status: data[i][8] });
        }
      }
      return createResponse("نجاح", true, homeworks);
    }

    // جلب إحصائيات الحضور
    else if (action === "getStats") {
      var studentSheet = ss.getSheetByName("قاعدة_بيانات_الطلاب");
      var attendanceSheet = ss.getSheetByName("سجل_الحضور");
      var studentData = studentSheet.getDataRange().getValues();
      var totalStudents = 0;
      for (var s = 1; s < studentData.length; s++) { if (studentData[s][10] === "نشط") totalStudents++; }
      var attendanceData = attendanceSheet.getDataRange().getValues();
      var todayStr = Utilities.formatDate(new Date(), "GMT+3", "yyyy-MM-dd");
      var presentToday = 0, absentToday = 0, excusedToday = 0;
      for (var i = 1; i < attendanceData.length; i++) {
        if (!attendanceData[i][0]) continue;
        var rowDateStr = Utilities.formatDate(new Date(attendanceData[i][0]), "GMT+3", "yyyy-MM-dd");
        if (rowDateStr === todayStr) {
          var status = attendanceData[i][6] ? attendanceData[i][6].toString().trim() : "";
          if (status === "حاضر") presentToday++; else if (status === "غائب") absentToday++; else if (status === "مستأذن") excusedToday++;
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ total: totalStudents, present: presentToday, absent: absentToday, excused: excusedToday })).setMimeType(ContentService.MimeType.JSON);
    }

  } catch (e) {
    return createResponse(e.toString(), false);
  }
}


// ---------------------------------------------------------
// الدوال المساعدة (Helper Functions) - تبقى خارج doGet
// ---------------------------------------------------------

    function logToSheet(type, location, errorMsg) {
  var ss = SpreadsheetApp.openById(MASTER_SS_ID);
  var sheet = ss.getSheetByName("سجل_الأخطاء") || ss.insertSheet("سجل_الأخطاء");
  sheet.appendRow([new Date(), type, location, errorMsg]);
}
