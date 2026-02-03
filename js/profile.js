
//ملف profile.js

import { WEB_APP_URL, currentUser } from './main.js';

export async function loadProfile(container) {
    try {
        const res = await axios.get(WEB_APP_URL, { params: { action: "getProfile", id: currentUser.studentId } });
        const p = res.data;

        container.innerHTML = `
            <div class="info-card-styled animate-fade-in" style="margin-bottom: 30px; width: 100%;">
                <div class="card-icon-circle" style="width: 100px; height: 100px; font-size: 40px; margin: 0 auto 15px;">🎓</div>
                <h2 style="color: var(--primary); margin-bottom: 5px;">${currentUser.nameAr}</h2>
                <span class="status-badge bg-success">طالب نشط</span>
            </div>

            <div class="grid-container">
                <div class="info-card-styled">
                    <div class="card-icon-circle"><i class="fas fa-id-card-alt"></i></div>
                    <div class="card-label">رقم الطالب الأكاديمي</div>
                    <div class="card-value">${p.معرف_الطالب || '---'}</div>
                </div>

                <div class="info-card-styled pulse-border">
                    <div class="card-icon-circle"><i class="fas fa-layer-group"></i></div>
                    <div class="card-label">المستوى الدراسي</div>
                    <div class="card-value">${p.المستوى || '---'}</div>
                </div>

                <div class="info-card-styled">
                    <div class="card-icon-circle"><i class="fas fa-phone-alt"></i></div>
                    <div class="card-label">رقم التواصل المسجل</div>
                    <div class="card-value" style="direction: ltr;">${p.رقم_الهاتف || '---'}</div>
                </div>
            </div>

            <div class="section-title" style="margin: 40px 20px 20px; font-weight: 800; color: var(--primary);">
                <i class="fas fa-calendar-check" style="color: var(--brand-green);"></i> سجل الحضور الأخير
            </div>
            
            <div id="attendance-sub-list" class="grid-container" style="grid-template-columns: 1fr;">
                <div class="skeleton" style="height: 60px; width: 100%;"></div>
            </div>
        `;
        
        loadSubAttendance();
    } catch (e) {
        container.innerHTML = `
            <div class="info-card-styled" style="border-color: var(--danger);">
                <i class="fas fa-exclamation-circle" style="font-size: 40px; color: var(--danger);"></i>
                <p>تعذر تحميل بيانات البروفايل، يرجى التأكد من الاتصال.</p>
            </div>`;
    }
}

async function loadSubAttendance() {
    try {
        const res = await axios.get(WEB_APP_URL, { params: { action: "getTodayAttendance" } });
        const list = document.getElementById('attendance-sub-list');
        let html = '';
        
        // تصفية البيانات وعرضها بشكل بطاقة واحدة أنيقة
        res.data.data.forEach(row => {
            if(row.id == currentUser.studentId) {
                html += `
                    <div class="info-card-styled" style="flex-direction: row; justify-content: space-between; padding: 15px 30px; text-align: right;">
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <i class="far fa-clock" style="color: var(--secondary-blue);"></i>
                            <span style="font-weight: 700;">${row.date}</span>
                        </div>
                        <span class="status-badge ${row.status === 'حاضر' ? 'bg-success' : 'bg-warning'}">
                            ${row.status}
                        </span>
                    </div>`;
            }
        });
        list.innerHTML = html || '<p class="text-center" style="grid-column: 1/-1;">لا توجد سجلات حضور مؤخراً</p>';
    } catch (error) {
        document.getElementById('attendance-sub-list').innerHTML = '<p class="text-center">فشل تحميل السجل</p>';
    }
}
