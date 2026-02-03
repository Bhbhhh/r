//ملف questions.js 
import { WEB_APP_URL, currentUser } from './main.js';

export async function loadQuestions(container) {
    try {
        const res = await axios.get(WEB_APP_URL, { 
            params: { action: "getQuestionsByCourse", courseId: currentUser.courseId } 
        });
        
        container.innerHTML = `
            <div class="questions-grid animate-fade-in">
                ${res.data.data.map((q, index) => `
                    <div class="question-card">
                        <span class="q-num">سؤال ${index + 1}</span>
                        <p class="q-text">${q.text}</p>
                        <div class="options">
                            <div class="opt"><span>أ</span> ${q.optA}</div>
                            <div class="opt"><span>ب</span> ${q.optB}</div>
                        </div>
                        <button class="btn-reveal" onclick="this.nextElementSibling.style.display='block'; this.style.display='none'">كشف الإجابة</button>
                        <div class="correct-ans" style="display:none">✨ الإجابة الصحيحة: ${q.correct}</div>
                    </div>
                `).join('')}
            </div>`;
    } catch (e) {
        container.innerHTML = `<p class="error">بنك الأسئلة غير متاح حالياً</p>`;
    }
}
