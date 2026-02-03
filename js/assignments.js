//ملف assignments.js

import { WEB_APP_URL, currentUser } from './main.js';

export async function loadAssignments(container) {
    try {
        const res = await axios.get(WEB_APP_URL, { params: { action: "getAssignments" } });
        const data = res.data;

        container.innerHTML = `
            <div class="assignments-header animate-fade-in">
                <h3><i class="fas fa-book-reader"></i> إدارة المهام والواجبات</h3>
            </div>
            
            <div class="assign-sections">
                <div class="assign-col">
                    <h4><i class="fas fa-clock color-warning"></i> قيد التنفيذ</h4>
                    <div id="pending-list"></div>
                </div>
                <div class="assign-col">
                    <h4><i class="fas fa-check-circle color-success"></i> تم الإنجاز</h4>
                    <div id="completed-list"></div>
                </div>
            </div>
        `;

        const pList = document.getElementById('pending-list');
        const cList = document.getElementById('completed-list');

        data.forEach(h => {
            const isDone = h.الحالة === 'مكتمل';
            const card = `
                <div class="hw-card ${isDone ? 'done' : ''}">
                    <div class="hw-info">
                        <strong>${h.عنوان_الواجب}</strong>
                        <small>ينتهي في: ${h.تاريخ_التسليم}</small>
                    </div>
                    ${!isDone ? `<button class="btn-upload-sm"><i class="fas fa-upload"></i></button>` : '<i class="fas fa-check-double done-icon"></i>'}
                </div>`;
            isDone ? cList.innerHTML += card : pList.innerHTML += card;
        });

    } catch (e) {
        container.innerHTML = `<p class="error">خطأ في جلب الواجبات</p>`;
    }
}
