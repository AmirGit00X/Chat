// script.js (توابع کلیدی)

// تابع ارسال مدیا
document.getElementById('media-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // ۱. آپلود در استوریج سوپابیس
    const fileName = `${Date.now()}_${file.name}`;
    const { data, error } = await _supabase.storage
        .from('chat-media')
        .upload(fileName, file);

    if (data) {
        const { data: urlData } = _supabase.storage.from('chat-media').getPublicUrl(fileName);
        const publicUrl = urlData.publicUrl;

        // ۲. ثبت در جدول پیام‌ها
        await _supabase.from('messages').insert([{
            content: '📸 تصویر',
            user_id: currentUser.id,
            media_url: publicUrl,
            reply_to_id: replyingToId
        }]);
        cancelReply();
    }
});

// تابع نمایش پیام با گرافیک جدید
function renderMessage(msg) {
    const isMe = msg.user_id === currentUser.id;
    const chatBox = document.getElementById('chat-box');
    
    const msgDiv = document.createElement('div');
    msgDiv.id = `msg-${msg.id}`;
    msgDiv.className = `message ${isMe ? 'my-msg' : 'other-msg'}`;
    
    // بخش ریپلای اگر وجود داشت
    let replyHtml = '';
    if (msg.reply_to_id) {
        replyHtml = `<div class="reply-in-msg">پاسخ به پیام قبلی</div>`;
    }

    // بخش مدیا اگر وجود داشت
    let mediaHtml = '';
    if (msg.media_url) {
        mediaHtml = `<img src="${msg.media_url}" class="msg-media" onclick="window.open('${msg.media_url}')">`;
    }

    msgDiv.innerHTML = `
        ${replyHtml}
        ${mediaHtml}
        <div class="msg-body" oncontextmenu="event.preventDefault(); showMenu('${msg.id}', '${msg.content}')">
            <span>${msg.content}</span>
        </div>
        <div style="font-size: 9px; opacity: 0.5; text-align: left; margin-top: 4px;">
            ${new Date(msg.created_at).toLocaleTimeString('fa-IR', {hour: '2-digit', minute:'2-digit'})}
        </div>
    `;

    // قابلیت ریپلای با کلیک روی پیام
    msgDiv.onclick = () => setReply(msg.id, msg.content);
    
    chatBox.appendChild(msgDiv);
    scrollToBottom();
}

// منوی حذف پیام (با نگه داشتن روی پیام یا کلیک راست در ادمین)
function showMenu(id, text) {
    if (confirm("آیا این پیام حذف شود؟")) {
        deleteMessage(id);
    }
}
