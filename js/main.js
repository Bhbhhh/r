//ملف main.js
// 1. استيراد الدوال من الملفات الأخرى
import { handleLogin, logout, checkAuth } from './auth.js';
import { loadProfile } from './profile.js';
import { loadAssignments } from './assignments.js';
import { loadChat } from './chat.js';
import { loadQuestions } from './questions.js';

// 2. المتغيرات العالمية (نستخدم export لتتمكن الملفات الأخرى من الوصول إليها)
export const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzQsqGwBT-QB9WrJBdjWrWtpis91hsqLRH6dP4UDxBFnD2RqPDzM4g0BtqY77nFIbtrMg/exec";
export const WEB_APP_URL_Chat = "https://script.google.com/macros/s/AKfycbxzvqKPrtIHrnTW6RKKgeBnvYNPHqLGZcvlpa2rOfM3FK055lW177aVEM62mo3y75y1/exec";
export let currentUser = null;

// 3. مستمع الأحداث الرئيسي عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    checkAuth(); // التأكد من حالة تسجيل الدخول عند فتح الموقع

    // ربط الأزرار بالدوال الخاصة بها
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) loginBtn.addEventListener('click', handleLogin);
    
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);

    // برمجة أزرار التنقل (Tabs)
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tabName = e.currentTarget.getAttribute('data-tab');
            switchTab(tabName);
        });
    });
});


// في أعلى ملف chat.js أو main.js


/**
 * دالة تبديل الأقسام (Tabs)
 * تتضمن إظهار وإخفاء الدائرة المتحركة الجذابة
 */
export async function switchTab(tabId) {
    const loader = document.getElementById('loader-global');
    const contentArea = document.getElementById('content-area');

    // أ. تحديث شكل الأزرار (إزالة active من الجميع وإضافتها للضغط عليه)
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    const activeBtn = document.querySelector(`[data-tab="${tabId}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    // ب. إظهار الدائرة المتحركة فوراً
    loader.style.display = 'flex';

    // ج. تنظيف منطقة المحتوى استعداداً للبيانات الجديدة
    contentArea.innerHTML = ''; 

    try {
        // د. تحميل القسم المطلوب برمجياً
        if(tabId === 'profile') await loadProfile(contentArea);
        else if(tabId === 'assignments') await loadAssignments(contentArea);
        else if(tabId === 'chat') await loadChat(contentArea);
        else if(tabId === 'questions') await loadQuestions(contentArea);
        
        // يمكنك إضافة أي قسم جديد هنا مستقبلاً (مثل الجدول)
        
    } catch (error) {
        console.error("خطأ أثناء تحميل القسم:", error);
        contentArea.innerHTML = '<p class="error">حدث خطأ أثناء تحميل البيانات، يرجى المحاولة لاحقاً.</p>';
    } finally {
        /**
         * هـ. إخفاء الدائرة بعد انتهاء التحميل
         * أضفنا تأخير بسيط (600ms) لضمان انسيابية الحركة البصرية (UX)
         */
        setTimeout(() => {
            loader.style.display = 'none';
        }, 600);
    }
}

// دالة مساعدة لتخزين بيانات المستخدم في المتغير العالمي
export function setCurrentUser(user) {
    currentUser = user;
}

/** * 💡 ملاحظة للمبرمج:
 * لإضافة أي قسم جديد، فقط قم بإنشاء ملف JS له، 
 * واستورده في الأعلى، ثم أضف شرطاً (if) جديداً داخل دالة switchTab.
 */


// داخل document.addEventListener('DOMContentLoaded', () => { ... })

document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const loginScreen = document.getElementById('login-screen');
        // إذا كانت شاشة تسجيل الدخول هي الظاهرة حالياً، نفذ الدالة
        if (loginScreen && loginScreen.style.display !== 'none') {
            handleLogin();
        }
    }
});
