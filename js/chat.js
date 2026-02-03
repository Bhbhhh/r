import { WEB_APP_URL_Chat, currentUser } from './main.js';

let activeChannel = null;
let currentReplyTo = null;

export async function loadChat(container) {
    // تصفير الحاوية لضمان عدم تداخل أي تنسيقات قديمة
    container.style.cssText = "height: 100vh; display: flex; flex-direction: column; overflow: hidden; background: #fff;";

    container.innerHTML = `
      <div class="chat-main-wrapper">
        <div class="chat-top-tabs">
            <button class="t-tab active" id="tab-private" onclick="window.switchChatTab(event, 'private')">
                💬 المحادثات الخاصة
            </button>
            <button class="t-tab" id="tab-channels" onclick="window.switchChatTab(event, 'channels')">
                📢 القنوات الدراسية
            </button>
            <button class="t-tab" id="tab-internal-mail" onclick="window.switchChatTab(event, 'internal-mail')">
                📧 البريد الداخلي
            </button>
        </div>
      </div>

      <div id="horizontal-list-container" class="horizontal-scroll-list"></div>

      <div class="messages-viewport" id="messages-viewport">
          <div id="chat-inner-display" class="chat-inner-display">
              <div class="chat-placeholder">
                  <i class="fas fa-comments"></i>
                  <p>اختر زميلاً أو قناة من الشريط العلوي لبدء المحادثة</p>
              </div>
          </div>
      </div>

      <div class="fixed-bottom-input" id="chat-input-area">
          <div class="input-actions">
              <label for="file-upload" class="action-icon"><i class="fas fa-plus"></i></label>
              <input type="file" id="file-upload" style="display:none">
          </div>
          <input type="text" id="chat-msg-input" placeholder="اكتب رسالتك هنا..." onkeypress="if(event.key === 'Enter') window.handleSendMessage()">
          <button class="send-circle-btn" onclick="window.handleSendMessage()">
              <i class="fas fa-paper-plane"></i>
          </button>
      </div>

      <div id="image-overlay" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.9); z-index:9999; flex-direction:column; align-items:center; justify-content:center;">
          <span onclick="closeImagePreview()" style="position:absolute; top:20px; right:20px; color:#fff; font-size:30px; cursor:pointer;">&times;</span>
          <img id="full-res-image" src="" style="max-width:95%; max-height:85%; border-radius:8px; box-shadow:0 0 20px rgba(0,0,0,0.5);">
      </div>
    `;

    loadHorizontalList('private');

    const fileInput = document.getElementById('file-upload');
    if(fileInput) {
        fileInput.addEventListener('change', async function() {
            if (this.files && this.files[0]) {
                const file = this.files[0];
                if (!file.type.startsWith('image/')) {
                    alert('يرجى اختيار ملف صورة فقط');
                    return;
                }
                const inputField = document.getElementById('chat-msg-input');
                const originalPlaceholder = inputField.placeholder;
                inputField.placeholder = "جاري رفع الصورة... انتظر";
                inputField.disabled = true;
                try {
                    const imageUrl = await uploadImageToServer(file); 
                    if (imageUrl) await sendImageAsMessage(imageUrl);
                } catch (error) {
                    alert('فشل رفع الصورة');
                } finally {
                    inputField.placeholder = originalPlaceholder;
                    inputField.disabled = false;
                    this.value = '';
                }
            }
        });
    }
}

export async function loadHorizontalList(type) {
    const listContainer = document.getElementById('horizontal-list-container');
    if (!listContainer) return;

    listContainer.innerHTML = '<div class="list-loader">جاري التحميل...</div>';

    try {
        const action = type === 'private' ? "getAllChatMembers" : "getUserChannels";
        const res = await axios.get(WEB_APP_URL_Chat, { 
            params: { action, studentId: currentUser.studentId } 
        });

        if (res.data && res.data.length > 0) {
            listContainer.innerHTML = res.data.map(item => {
                const unread = item.unreadCount || 0;
                const badge = unread > 0 ? `<div class="notification-badge">${unread}</div>` : '';
                const rawImg = item.image || item.img;
                const finalImg = rawImg ? formatDriveUrl(rawImg) : null;
                const avatarContent = finalImg 
                    ? `<img src="${finalImg}" class="h-avatar-img" onerror="this.src='https://via.placeholder.com/50?text=👤'">` 
                    : `<div class="h-avatar">${type === 'private' ? '👤' : '📢'}</div>`;
                
                return `
                    <div class="h-item" id="h-item-${item.id || item.channelId}" onclick="window.activateChat('${item.id || item.channelId}', '${type}', '${item.name || item.channelId}')">
                        <div class="h-avatar-wrapper">
                            ${avatarContent}
                            ${badge}
                        </div>
                        <span class="h-name">${item.name || item.channelId}</span>
                    </div>
                `;
            }).join('');
        } else {
            listContainer.innerHTML = '<div class="list-empty">لا توجد محادثات</div>';
        }
    } catch (e) {
        console.error("خطأ في تحميل القائمة الأفقية:", e);
        listContainer.innerHTML = '<div class="list-error">خطأ في الاتصال</div>';
    }
}

window.activateChat = async (id, type, name) => {
    document.querySelectorAll('.h-item').forEach(el => el.classList.remove('selected'));
    const activeItem = document.getElementById(`h-item-${id}`);
    if (activeItem) {
        activeItem.classList.add('selected');
        const badge = activeItem.querySelector('.notification-badge');
        if(badge) badge.style.display = 'none';
    }
    activeChannel = id;
    const viewport = document.getElementById('chat-inner-display');
    viewport.innerHTML = '<div class="list-loader">جاري تحميل الرسائل...</div>';
    try {
        axios.get(WEB_APP_URL_Chat, { 
            params: { action: "markAsRead", channelId: id, studentId: currentUser.studentId } 
        });
        if(type === 'private') {
            const res = await axios.get(WEB_APP_URL_Chat, { 
                params: { action: "getOrCreatePrivateChat", studentId: currentUser.studentId, targetId: id } 
            });
            activeChannel = res.data.channelId;
        }
        refreshChatContent();
    } catch (e) { console.error("خطأ في تفعيل المحادثة", e); }
};

async function refreshChatContent() {
    if(!activeChannel) return;
    try {
        const res = await axios.get(WEB_APP_URL_Chat, { params: { action: "getMessages", channelId: activeChannel, limit: 50, offset: 0 } });
        const viewport = document.getElementById('chat-inner-display');
        viewport.innerHTML = res.data.map(m => {
            const isMe = m.sender == currentUser.studentId;
            const isImage = typeof m.content === 'string' && m.content.match(/\.(jpeg|jpg|gif|png|webp)$/i) != null;
            const displayContent = isImage 
                ? `<img src="${formatDriveUrl(m.content)}" onclick="window.openImagePreview('${formatDriveUrl(m.content)}')" class="chat-img-msg">` 
                : `<p>${m.content}</p>`;
            return `
                <div class="bubble-wrapper ${isMe ? 'msg-right' : 'msg-left'}">
                    <div class="msg-bubble">
                        ${displayContent}
                        <span class="msg-time">${m.time}</span>
                    </div>
                </div>
            `;
        }).join('');
        const container = document.getElementById('messages-viewport');
        container.scrollTop = container.scrollHeight;
    } catch (e) { console.error("Error loading messages"); }
}

async function handleSendMessage() {
    const input = document.getElementById('chat-msg-input');
    const content = input.value.trim();
    if(!content || !activeChannel) return;
    try {
        const response = await axios.get(WEB_APP_URL_Chat, { 
            params: { 
                action: "sendMessage", 
                studentId: currentUser.studentId, 
                channelId: activeChannel, 
                content: content,
                replyTo: "none",
                attachments: "[]"
            } 
        });
        if (response.data && (response.data.success || response.data.messageId)) {
            input.value = '';
            refreshChatContent();
        }
    } catch (e) { console.error("خطأ في الإرسال", e); }
}

window.switchChatTab = (e, type) => {
    document.querySelectorAll('.t-tab').forEach(t => t.classList.remove('active'));
    e.currentTarget.classList.add('active');
    const inputArea = document.getElementById('chat-input-area');

    if (type === 'internal-mail') {
        if(inputArea) inputArea.style.display = 'none'; // إخفاء شريط إرسال الشات في البريد
        loadInternalMailbox(); 
    } else {
        if(inputArea) inputArea.style.display = 'flex';
        loadHorizontalList(type);
        resetChatDisplay(type === 'private' ? 'اختر زميلاً لبدء المحادثة' : 'اختر قناة دراسية لمتابعة المستجدات');
    }
    activeChannel = null;
};

function resetChatDisplay(message) {
    document.getElementById('chat-inner-display').innerHTML = `
        <div class="chat-placeholder">
            <i class="fas fa-comments"></i>
            <p>${message}</p>
        </div>`;
}

window.openImagePreview = (src) => {
    const overlay = document.getElementById('image-overlay');
    const fullImg = document.getElementById('full-res-image');
    if (overlay && fullImg) {
        fullImg.src = src;
        overlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
};

window.closeImagePreview = () => {
    const overlay = document.getElementById('image-overlay');
    if (overlay) {
        overlay.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
};

async function sendImageAsMessage(url) {
    if(!activeChannel) return;
    try {
        await axios.get(WEB_APP_URL_Chat, { 
            params: { action: "sendMessage", studentId: currentUser.studentId, channelId: activeChannel, content: url } 
        });
        refreshChatContent();
    } catch (e) { console.error("فشل إرسال الصورة"); }
}

async function uploadImageToServer(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(file);
    });
}

export async function loadInternalMailbox() {
    const viewport = document.getElementById('chat-inner-display');
    const listContainer = document.getElementById('horizontal-list-container');
    if (!viewport) return; 
    if (listContainer) listContainer.innerHTML = '<div class="mail-top-msg">نظام البريد الرسمي</div>';
    viewport.innerHTML = '<div class="list-loader">جاري جلب البريد...</div>';
    try {
        const res = await axios.get(WEB_APP_URL_Chat, { 
            params: { action: "fetchMailbox", studentId: currentUser.studentId, isAdmin: "false" } 
        });
        if (res.data && Array.isArray(res.data)) {
            const mails = res.data;
            if (mails.length > 0) {
                viewport.innerHTML = `
                    <div class="internal-mail-wrapper">
                        <div class="mail-actions-bar">
                            <button class="new-mail-btn" onclick="window.openNewMailForm()">
                                <i class="fas fa-plus"></i> رسالة جديدة
                            </button>
                        </div>
                        <div class="mail-list">
                            ${mails.reverse().map(mail => {
                                try { return window.renderMailItem(mail); } 
                                catch(e) { return ''; }
                            }).join('')}
                        </div>
                    </div>
                `;
            } else {
                viewport.innerHTML = '<div class="chat-placeholder"><p>صندوق البريد فارغ</p></div>';
            }
        }
    } catch (e) { viewport.innerHTML = '<div class="list-error">فشل تحميل البريد</div>'; }
}

window.renderMailItem = (mail) => {
    const sender = mail["المرسل"] || "غير معروف";
    const subject = mail["العنوان"] || "بدون عنوان";
    const content = mail["المحتوى"] || "";
    const date = mail["تاريخ_الإرسال"] || "";
    const priority = mail["الأولوية"] || "عادية";
    const convId = mail["معرف_المحادثة"] || "";
    const isImportant = priority === "عاجلة";
    const displayDate = (typeof formatDateTime === 'function') ? formatDateTime(date) : date;

    return `
        <div class="mail-card ${isImportant ? 'priority-high' : ''}" onclick="window.viewMailThread('${convId}')">
            <div class="mail-card-header">
                <span class="mail-sender"><i class="fas fa-user-circle"></i> ${sender}</span>
                <span class="mail-date">${displayDate}</span>
            </div>
            <div class="mail-card-body">
                <span class="mail-subject">${subject}</span>
                <p class="mail-excerpt">${content.substring(0, 60)}...</p>
            </div>
        </div>
    `;
};

// الدوال المساعدة لضمان عدم توقف الكود
function formatDriveUrl(url) {
    if (!url || typeof url !== 'string') return url;
    if (url.includes('drive.google.com')) {
        const id = url.split('id=')[1] || url.split('/d/')[1].split('/')[0];
        return `https://lh3.googleusercontent.com/u/0/d/${id}`;
    }
    return url;
}

function formatDateTime(date) {
    if(!date) return "";
    const d = new Date(date);
    return isNaN(d.getTime()) ? date : d.toLocaleString('ar-EG');
}

window.openNewMailForm = () => { alert("جاري فتح نموذج البريد الجديد..."); };
window.viewMailThread = (id) => { alert("فتح الرسالة: " + id); };

// ربط الدوال بالـ Window
window.switchChatTab = window.switchChatTab;
window.handleSendMessage = handleSendMessage;
window.loadInternalMailbox = loadInternalMailbox;
window.loadHorizontalList = loadHorizontalList;
