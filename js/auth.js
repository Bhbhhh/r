//ملف auth.js

import { WEB_APP_URL, setCurrentUser, switchTab } from './main.js';

/**
 * [1] دالة تسجيل الدخول
 * تتعامل مع التحقق من البيانات وإظهار دائرة التحميل
 */
export async function handleLogin() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const msg = document.getElementById('login-msg');
    const loader = document.getElementById('loader-global'); 

    if(!email || !password) { 
        msg.innerText = "يرجى ملء البيانات"; 
        return; 
    }

    loader.style.display = 'flex';
    const btn = document.getElementById('loginBtn');
    btn.disabled = true;
    btn.innerText = "جاري التحقق...";

    try {
        const res = await axios.get(WEB_APP_URL, { 
            params: { action: "loginStudent", email, password } 
        });
        
        if(res.data.success) {
            const user = res.data.data;
            // تخزين بيانات المستخدم كاملة
            localStorage.setItem('student', JSON.stringify(user));
            // تخزين الـ ID بشكل منفصل لسهولة وصول الشات إليه
            localStorage.setItem('studentId', user.studentId);
            
            location.reload(); 
        } else {
            msg.innerText = res.data.message;
            loader.style.display = 'none';
            btn.disabled = false;
            btn.innerText = "تسجيل الدخول";
        }
    } catch (e) {
        msg.innerText = "خطأ في الاتصال بالسيرفر";
        loader.style.display = 'none';
        btn.disabled = false;
        btn.innerText = "تسجيل الدخول";
    }
}



/**
 * [2] دالة التحقق من الجلسة
 * تعمل عند فتح الموقع للتأكد إذا كان المستخدم مسجل دخوله مسبقاً
 */
export function checkAuth() {
    const saved = localStorage.getItem('student');
    if(saved) {
        const user = JSON.parse(saved);
        setCurrentUser(user);
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('main-dashboard').style.display = 'block';
        document.getElementById('user-name').innerText = user.nameAr;
        switchTab('profile'); 
    }
}

/**
 * [3] دالة تسجيل الخروج
 */
export function logout() {
    if(confirm("هل تريد تسجيل الخروج؟")) {
        localStorage.clear();
        location.reload();
    }
}




/** * 👇 [مكان إضافة الدوال الجديدة المتعلقة بالحساب] 👇
 * * مثال: لو أردت إضافة دالة "تغيير كلمة المرور" أو "تحديث الصورة الشخصية"
 * قم بكتابتها هنا بصيغة export async function 
 */

// export async function updatePassword(newPass) {
//    // الكود الخاص بك هنا
// }
