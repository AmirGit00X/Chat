// تنظیمات اتصال به Supabase
const SB_URL = "https://fskpkxyhtbmfgysenvpk.supabase.co";
const SB_KEY = "sb_publishable_HG69pw06imFQNfmeY3d7ng_hS2dPGkt";
const _supabase = supabase.createClient(SB_URL, SB_KEY);

// اطلاعات کاربران (بصورت کدگذاری شده برای امنیت در لایه کلاینت)
const USERS = {
    'amirhossein': { name: 'امیرحسین', pass: 'amir13855', avatar: 'https://ui-avatars.com/api/?name=Amirhossein&background=0084ff&color=fff' },
    'mahdieh': { name: 'مهدیه', pass: 'mahi1385', avatar: 'https://ui-avatars.com/api/?name=Mahdieh&background=ff4b91&color=fff' }
};

let currentUser = null;
let partnerUser = null;
let replyingToId = null;
let typingTimeout;

// --- سیستم ورود (Login) ---
document.getElementById('login-btn').addEventListener('click', () => {
    const userIn = document.getElementById('username').value.toLowerCase().trim();
    const passIn = document.getElementById('password').value.toLowerCase().trim();
    const errorEl = document.getElementById('login-error');

    if (USERS[userIn] && USERS[userIn].pass === passIn) {
        currentUser = { id: userIn, ...USERS[userIn] };
        partnerUser = userIn === 'amirhossein' ? { id: 'mahdieh', ...USERS['mahdieh'] } : { id: 'amirhossein', ...USERS['amirhossein'] };
        initApp();
    } else {
        errorEl.innerText = "نام کاربری یا رمز عبور اشتباه است.";
    }
});

function initApp() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('chat-app').classList.remove('hidden');
    document.getElementById('my-display-name').innerText = currentUser.name;
    document.getElementById('my-avatar').style.backgroundImage = `url('${currentUser.avatar}')`;
    document.getElementById('partner-name').innerText = partnerUser.name;
    document.getElementById('partner-avatar').style.backgroundImage = `url('${partnerUser.avatar}')`;
    
    loadMessages();
    subscribeToChanges();
    updateOnlineStatus(true);
}

// --- مدیریت پیام‌ها ---
async function loadMessages() {
    const { data, error } = await _supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true });

    if (data) {
        document.getElementById('chat-box').innerHTML = '';
        data.forEach(msg => renderMessage(msg));
        scrollToBottom();
    }
}

function subscribeToChanges() {
    _supabase
        .channel('schema-db-changes')
        .on('postgres_changes', { event: '*', table: 'messages' }, (payload) => {
            if (payload.eventType === 'INSERT') renderMessage(payload.new);
            if (payload.eventType === 'DELETE') document.getElementById(`msg-${payload.old.id}`)?.remove();
            scrollToBottom();
        })
        .subscribe();

    // سیستم وضعیت آنلاین و تایپ (Real-time Presence)
    const presenceChannel = _supabase.channel('room-1');
    presenceChannel
        .on('presence', { event: 'sync' }, () => {
            const state = presenceChannel.presenceState();
            const isPartnerOnline = Object.values(state).flat().some(u => u.user === partnerUser.id);
            document.getElementById('online-status').innerText = isPartnerOnline ? 'آنلاین' : 'آخرین بازدید به تازگی';
        })
        .on('broadcast', { event: 'typing' }, (payload) => {
            if (payload.payload.user === partnerUser.id) {
                const indicator = document.getElementById('typing-indicator');
                indicator.classList.toggle('hidden', !payload.payload.isTyping);
            }
        })
        .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await presenceChannel.track({ user: currentUser.id, online_at: new Date().toISOString() });
            }
        });
}

// ارسال پیام
document.getElementById('chat-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('message-input');
    const content = input.value.trim();
    if (!content) return;

    await _supabase.from('messages').insert([{
        content: content,
        user_id: currentUser.id,
        reply_to_id: replyingToId
    }]);

    input.value = '';
    cancelReply();
});

function renderMessage(msg) {
    const isMe = msg.user_id === currentUser.id;
    const chatBox = document.getElementById('chat-box');
    
    const msgDiv = document.createElement('div');
    msgDiv.id = `msg-${msg.id}`;
    msgDiv.className = `message ${isMe ? 'my-msg' : 'other-msg'}`;
    
    msgDiv.innerHTML = `
        <div class="msg-body" onclick="setReply('${msg.id}', '${msg.content}')">
            ${msg.reply_to_id ? `<div class="replied-part">پاسخ به: ...</div>` : ''}
            <span class="text">${msg.content}</span>
        </div>
        <div class="msg-actions" onclick="deleteMessage('${msg.id}')">حذف</div>
    `;
    chatBox.appendChild(msgDiv);
}

// --- توابع کمکی ---
async function deleteMessage(id) {
    if (confirm('حذف پیام؟')) {
        await _supabase.from('messages').delete().eq('id', id);
    }
}

function setReply(id, text) {
    replyingToId = id;
    document.getElementById('reply-preview').classList.remove('hidden');
    document.getElementById('reply-to-text').innerText = text.substring(0, 30) + '...';
}

function cancelReply() {
    replyingToId = null;
    document.getElementById('reply-preview').classList.add('hidden');
}

function scrollToBottom() {
    const chatBox = document.getElementById('chat-box');
    chatBox.scrollTop = chatBox.scrollHeight;
}

// هندل کردن وضعیت تایپ
document.getElementById('message-input').addEventListener('input', () => {
    _supabase.channel('room-1').send({
        type: 'broadcast',
        event: 'typing',
        payload: { user: currentUser.id, isTyping: true }
    });
    
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        _supabase.channel('room-1').send({
            type: 'broadcast',
            event: 'typing',
            payload: { user: currentUser.id, isTyping: false }
        });
    }, 2000);
});
