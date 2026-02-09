// ==========================================
// Mostaql Job Notifier - Popup Script
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
  // Initialize
  loadSettings();
  loadStats();
  loadTrackedProjects();
  loadPrompts();
  setupTabs();
  setupEventListeners();
});

// ==========================================
// Tabs Navigation
// ==========================================
function setupTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;

      // Update buttons
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Update content
      tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === tabId) {
          content.classList.add('active');
        }
      });
    });
  });
}

// ==========================================
// Load Settings
// ==========================================
function loadSettings() {
  chrome.storage.local.get(['settings'], (data) => {
    const settings = data.settings || {};

    // Notification settings
    document.getElementById('development').checked = settings.development !== false;
    document.getElementById('ai').checked = settings.ai !== false;
    document.getElementById('all').checked = settings.all === true;
    document.getElementById('sound').checked = settings.sound !== false;
    document.getElementById('interval').value = settings.interval || 1;
  });
}

// ==========================================
// Load Stats
// ==========================================
function loadStats() {
  chrome.storage.local.get(['stats', 'seenJobs'], (data) => {
    const stats = data.stats || {};
    const seenJobs = data.seenJobs || [];

    // Last check time
    if (stats.lastCheck) {
      const lastCheck = new Date(stats.lastCheck);
      const now = new Date();
      const diffMinutes = Math.floor((now - lastCheck) / 60000);

      let timeText;
      if (diffMinutes < 1) {
        timeText = 'الآن';
      } else if (diffMinutes < 60) {
        timeText = `منذ ${diffMinutes} دقيقة`;
      } else {
        timeText = lastCheck.toLocaleTimeString('ar-SA');
      }

      document.getElementById('lastCheck').textContent = timeText;
    } else {
      document.getElementById('lastCheck').textContent = 'لم يتم الفحص بعد';
    }

    // Today count
    document.getElementById('todayCount').textContent = stats.todayCount || 0;

    // Total seen
    document.getElementById('totalSeen').textContent = seenJobs.length;
  });
}

// ==========================================
// Tracked Projects
// ==========================================
function loadTrackedProjects() {
  const container = document.getElementById('trackedProjectsList');
  if (!container) return;

  chrome.storage.local.get(['trackedProjects'], (data) => {
    const tracked = data.trackedProjects || {};
    const ids = Object.keys(tracked);

    if (ids.length === 0) {
      container.innerHTML = '<p class="empty-msg">لا توجد مشاريع مراقبة حالياً</p>';
      return;
    }

    container.innerHTML = '';
    ids.forEach(id => {
      const project = tracked[id];
      const item = document.createElement('div');
      item.className = 'tracked-item';
      const statusClass = getStatusClass(project.status);
      item.innerHTML = `
        <div class="tracked-info">
          <div class="tracked-title" title="${project.title}">${project.title}</div>
          <div class="tracked-meta">
            <span class="status-tag ${statusClass}">${project.status}</span>
            <span class="comm-tag">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-left: 4px;">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg> 
              ${project.communications}
            </span>
          </div>
        </div>
        <div class="tracked-actions">
          <button class="btn-icon untrack-btn" data-id="${id}" title="إلغاء المراقبة">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
          <a href="${project.url}" target="_blank" class="btn-icon link-btn" title="فتح المشروع">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          </a>
        </div>
      `;
      container.appendChild(item);
    });

    // Setup untrack buttons
    container.querySelectorAll('.untrack-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        untrackProject(id);
      });
    });
  });
}

function getStatusClass(status) {
  if (status.includes('مفتوح')) return 'open';
  if (status.includes('التنفيذ')) return 'underway';
  if (status.includes('مغلق')) return 'closed';
  if (status.includes('ملغي')) return 'cancelled';
  if (status.includes('مكتمل')) return 'completed';
  return '';
}

function untrackProject(id) {
  chrome.storage.local.get(['trackedProjects'], (data) => {
    const tracked = data.trackedProjects || {};
    if (tracked[id]) {
      delete tracked[id];
      chrome.storage.local.set({ trackedProjects: tracked }, () => {
        loadTrackedProjects();
      });
    }
  });
}

// ==========================================
// Event Listeners
// ==========================================
function setupEventListeners() {
  // Notification toggles - auto save
  ['development', 'ai', 'all', 'sound'].forEach(id => {
    document.getElementById(id).addEventListener('change', saveNotificationSettings);
  });

  // Interval change
  document.getElementById('interval').addEventListener('change', (e) => {
    saveNotificationSettings();
    chrome.runtime.sendMessage({
      action: 'updateAlarm',
      interval: parseInt(e.target.value)
    });
  });

  // Check now button
  document.getElementById('checkNowBtn').addEventListener('click', checkNow);

  // Clear history button
  document.getElementById('clearHistoryBtn').addEventListener('click', clearHistory);

  // Test notification button
  document.getElementById('testNotificationBtn').addEventListener('click', testNotification);

  // Test sound button
  document.getElementById('testSoundBtn').addEventListener('click', testSound);

  // Debug button
  document.getElementById('debugBtn').addEventListener('click', debugConnection);

  // Prompts Management
  document.getElementById('addPromptBtn').addEventListener('click', () => openPromptForm());
  document.getElementById('savePromptBtn').addEventListener('click', savePrompt);
  document.getElementById('cancelPromptBtn').addEventListener('click', closePromptForm);
  document.getElementById('exportPromptsBtn').addEventListener('click', exportPrompts);

  const importBtn = document.getElementById('importPromptsBtn');
  const importInput = document.getElementById('importPromptsInput');

  if (importBtn && importInput) {
    importBtn.addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', importPrompts);
  }
}

// ==========================================
// Notification Settings
// ==========================================
function saveNotificationSettings() {
  const settings = {
    development: document.getElementById('development').checked,
    ai: document.getElementById('ai').checked,
    all: document.getElementById('all').checked,
    sound: document.getElementById('sound').checked,
    interval: parseInt(document.getElementById('interval').value)
  };

  chrome.storage.local.set({ settings });
}

// ==========================================
// Check Now
// ==========================================
function checkNow() {
  const btn = document.getElementById('checkNowBtn');
  const resultDiv = document.getElementById('checkResult');

  if (!btn) return;

  btn.disabled = true;
  btn.textContent = 'جاري الفحص...';
  resultDiv.classList.add('hidden');
  resultDiv.classList.remove('success', 'error', 'info');

  chrome.runtime.sendMessage({ action: 'checkNow' }, (response) => {
    // Always reset button
    btn.disabled = false;
    btn.textContent = 'فحص الآن';

    if (chrome.runtime.lastError) {
      resultDiv.classList.remove('hidden');
      resultDiv.classList.add('error');
      resultDiv.textContent = 'خطأ في الاتصال بالملحق. حاول مرة أخرى.';
      console.error('Runtime Error:', chrome.runtime.lastError);
      return;
    }

    resultDiv.classList.remove('hidden');

    if (response && response.success) {
      if (response.newJobs > 0) {
        resultDiv.classList.add('success');
        resultDiv.textContent = `تم العثور على ${response.newJobs} مشاريع جديدة!`;
      } else {
        resultDiv.classList.add('info');
        resultDiv.textContent = 'تم الفحص: لا توجد مشاريع جديدة حالياً';
      }
    } else {
      resultDiv.classList.add('error');
      resultDiv.textContent = `خطأ: ${response?.error || 'استجابة غير صالحة'}`;
    }

    loadStats();

    // Hide message after 5 seconds
    setTimeout(() => {
      if (resultDiv) resultDiv.classList.add('hidden');
    }, 5000);
  });
}

// ==========================================
// Clear History
// ==========================================
function clearHistory() {
  if (confirm('هل أنت متأكد من مسح سجل المشاريع؟\nسيتم اعتبار جميع المشاريع الحالية كجديدة.')) {
    chrome.runtime.sendMessage({ action: 'clearHistory' }, (response) => {
      if (response && response.success) {
        loadStats();
        alert('تم مسح السجل بنجاح');
      }
    });
  }
}

// ==========================================
// Test Notification
// ==========================================
function testNotification() {
  const statusDiv = document.getElementById('testStatus');

  chrome.runtime.sendMessage({ action: 'testNotification' }, (response) => {
    statusDiv.classList.remove('hidden', 'success', 'error');

    if (response && response.success) {
      statusDiv.classList.add('success');
      statusDiv.textContent = 'تم إرسال الإشعار التجريبي';
    } else {
      statusDiv.classList.add('error');
      statusDiv.textContent = 'فشل إرسال الإشعار';
    }

    setTimeout(() => {
      statusDiv.classList.add('hidden');
    }, 3000);
  });
}

// ==========================================
// Test Sound
// ==========================================
function testSound() {
  const statusDiv = document.getElementById('testStatus');

  chrome.runtime.sendMessage({ action: 'testSound' }, (response) => {
    statusDiv.classList.remove('hidden', 'success', 'error');

    if (response && response.success) {
      statusDiv.classList.add('success');
      statusDiv.textContent = 'تم تشغيل الصوت';
    } else {
      statusDiv.classList.add('error');
      statusDiv.textContent = 'فشل تشغيل الصوت';
    }

    setTimeout(() => {
      statusDiv.classList.add('hidden');
    }, 3000);
  });
}


// ==========================================
// Debug Connection
// ==========================================
function debugConnection() {
  const btn = document.getElementById('debugBtn');
  const resultDiv = document.getElementById('debugResult');

  btn.disabled = true;
  btn.textContent = 'جاري الفحص...';
  resultDiv.classList.remove('hidden');
  resultDiv.textContent = 'جاري الاتصال بمستقل...';

  chrome.runtime.sendMessage({ action: 'debugFetch' }, (response) => {
    btn.disabled = false;
    btn.textContent = 'فحص الاتصال بمستقل';

    if (response && response.success) {
      resultDiv.textContent = `الاتصال ناجح!\nحجم الصفحة: ${response.length} حرف\n\nافتح Console (F12) لرؤية التفاصيل`;
    } else {
      resultDiv.textContent = `فشل الاتصال: ${response?.error || 'خطأ غير معروف'}`;
    }
  });
}

// ==========================================
// Prompt Management
// ==========================================

function getDefaultPrompts() {
  return [
    {
      id: 'default_proposal',
      title: 'كتابة عرض مشروع',
      content: `أريد مساعدتك في كتابة عرض لهذا المشروع على منصة مستقل.

عنوان المشروع: {title}

تفاصيل المشروع:
{description}

رابط المشروع: {url}

يرجى كتابة عرض احترافي ومقنع يوضح خبرتي في هذا المجال ويشرح كيف يمكنني تنفيذ المطلوب بدقة.`
    }
  ];
}

function loadPrompts() {
  const container = document.getElementById('promptsList');
  if (!container) return;

  chrome.storage.local.get(['prompts'], (data) => {
    let prompts = data.prompts || [];

    // If empty, show defaults but DO NOT save them yet (unless user edits/saves).
    // Or we can save them immediately? 
    // Better to just display them.
    if (prompts.length === 0) {
      prompts = getDefaultPrompts();
      // Optional: Save defaults to storage so they persist and can be edited/deleted
      // chrome.storage.local.set({ prompts });
    }

    if (prompts.length === 0) { // Should not happen with defaults
      container.innerHTML = '<p class="empty-msg">لا توجد أوامر محفوظة</p>';
      return;
    }

    container.innerHTML = '';
    prompts.forEach((prompt, index) => {
      const item = document.createElement('div');
      item.className = 'prompt-item';
      item.innerHTML = `
        <div class="prompt-header">
          <span class="prompt-title">${prompt.title}</span>
        </div>
        <div class="prompt-preview">${prompt.content}</div>
        <div class="prompt-actions">
          <button class="btn-sm btn-edit" data-index="${index}">تعديل</button>
          <button class="btn-sm btn-delete" data-index="${index}">حذف</button>
        </div>
      `;
      container.appendChild(item);
    });

    // Event listeners for edit/delete buttons
    container.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        // Fetch fresh data in case it changed
        chrome.storage.local.get(['prompts'], (d) => {
          let currentPrompts = d.prompts || [];
          if (currentPrompts.length === 0) currentPrompts = getDefaultPrompts();

          const p = currentPrompts[btn.dataset.index];
          if (p) openPromptForm(p, btn.dataset.index);
        });
      });
    });

    container.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', () => deletePrompt(btn.dataset.index));
    });
  });
}

function openPromptForm(prompt = null, index = -1) {
  const modal = document.getElementById('promptForm');
  const titleInput = document.getElementById('promptTitle');
  const contentInput = document.getElementById('promptContent');
  const idInput = document.getElementById('promptId');

  if (prompt) {
    titleInput.value = prompt.title;
    contentInput.value = prompt.content;
    idInput.dataset.index = index;
  } else {
    titleInput.value = '';
    contentInput.value = '';
    idInput.dataset.index = -1;
  }

  modal.classList.remove('hidden');
}

function closePromptForm() {
  document.getElementById('promptForm').classList.add('hidden');
}

function savePrompt() {
  const title = document.getElementById('promptTitle').value.trim();
  const content = document.getElementById('promptContent').value.trim();
  const idInput = document.getElementById('promptId');
  const index = parseInt(idInput.dataset.index);

  if (!title || !content) {
    alert('يرجى ملء جميع الحقول');
    return;
  }

  chrome.storage.local.get(['prompts'], (data) => {
    let prompts = data.prompts || [];

    // If empty storage but we were editing a default prompt (which existed in memory), 
    // we need to initialize storage with defaults first OR just handle the push correctly.
    // Easiest is to treat "prompts" as the source of truth.
    if (prompts.length === 0) {
      // If user is adding a new one, this is fine. 
      // If user was editing a default, index might point to 0. 
      // But prompts is empty. So prompts[0] is undefined.
      // We should seed defaults if we are editing a default.
      const defaults = getDefaultPrompts();
      if (index >= 0 && index < defaults.length) {
        // We were likely editing a default.
        // Let's adopt the defaults into storage.
        prompts = defaults;
      }
    }

    // Safety check again
    if (index >= 0 && index < prompts.length) {
      // Edit existing
      prompts[index] = { ...prompts[index], title, content };
    } else {
      // Add new
      prompts.push({
        id: crypto.randomUUID(),
        title,
        content,
        createdAt: new Date().toISOString()
      });
    }

    chrome.storage.local.set({ prompts }, () => {
      closePromptForm();
      loadPrompts();
    });
  });
}

function deletePrompt(index) {
  if (confirm('هل أنت متأكد من حذف هذا الأمر؟')) {
    chrome.storage.local.get(['prompts'], (data) => {
      let prompts = data.prompts || [];

      // If deleting a default that wasn't saved yet
      if (prompts.length === 0) {
        prompts = getDefaultPrompts();
      }

      if (index >= 0 && index < prompts.length) {
        prompts.splice(index, 1);
        chrome.storage.local.set({ prompts }, loadPrompts);
      }
    });
  }
}

function exportPrompts() {
  chrome.storage.local.get(['prompts'], (data) => {
    let prompts = data.prompts || [];

    // If empty storage, export defaults
    if (prompts.length === 0) {
      prompts = getDefaultPrompts();
    }

    const blob = new Blob([JSON.stringify(prompts, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mostaql-prompts.json';
    a.click();
    URL.revokeObjectURL(url);
  });
}

function importPrompts(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const newPrompts = JSON.parse(e.target.result);
      if (!Array.isArray(newPrompts)) throw new Error('Format Invalid');

      chrome.storage.local.get(['prompts'], (data) => {
        const existingPrompts = data.prompts || [];
        // Merge strategy: Append new prompts
        const updatedPrompts = [...existingPrompts, ...newPrompts];

        chrome.storage.local.set({ prompts: updatedPrompts }, () => {
          loadPrompts();
          alert('تم استيراد الأوامر بنجاح');
        });
      });
    } catch (err) {
      alert('حدث خطأ أثناء قراءة الملف. تأكد من أنه ملف JSON صالح.');
      console.error(err);
    }
  };
  reader.readAsText(file);
  event.target.value = ''; // Reset input
}