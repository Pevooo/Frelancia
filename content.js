// ==========================================
// Mostaql Project Tracker - Content Script
// ==========================================

function isContextValid() {
    return !!chrome.runtime && !!chrome.runtime.id;
}

function injectTrackButton() {
    // Look for the action buttons in the header
    const actionContainer = document.querySelector('.header_action-wide-container');
    if (!actionContainer) return;

    // --- Container for Extension Buttons ---
    let buttonContainer = document.getElementById('mostaql-ext-btn-container');
    if (!buttonContainer) {
        buttonContainer = document.createElement('div');
        buttonContainer.id = 'mostaql-ext-btn-container';
        buttonContainer.style.display = 'inline-flex';
        buttonContainer.style.alignItems = 'center';
        buttonContainer.style.flexDirection = 'row';
        buttonContainer.style.flexWrap = 'nowrap';
        buttonContainer.style.whiteSpace = 'nowrap'; // Force single line text
        buttonContainer.style.width = 'max-content'; // Force container to fit content
        buttonContainer.style.minWidth = 'max-content';
        buttonContainer.style.gap = '5px';
        buttonContainer.style.marginRight = '10px';
        buttonContainer.style.flexShrink = '0'; // Prevent container from shrinking

        // Find the main "Apply" button or similar primary action
        const primaryBtn = actionContainer.querySelector('a.btn-primary, button.btn-primary, .btn-primary');

        if (primaryBtn) {
            // Re-insert BEFORE (The "Opposite")
            // Visual Goal: [Container] [Primary] 
            // In RTL Row: Container (Right), Primary (Left of Container)
            primaryBtn.insertAdjacentElement('beforebegin', buttonContainer);

            // Adjust margins for "Container First"
            buttonContainer.style.marginRight = '0px';
            buttonContainer.style.marginLeft = '10px';

            // Remove Explicit Order (Let DOM decide)
            buttonContainer.style.removeProperty('order');

            // Ensure the parent container flexes correctly and isn't constrained
            if (primaryBtn.parentElement) {
                const parent = primaryBtn.parentElement;

                // 1. Force Parent Layout
                parent.style.setProperty('display', 'flex', 'important');
                parent.style.setProperty('flex-direction', 'row', 'important');
                parent.style.setProperty('align-items', 'center', 'important');
                parent.style.setProperty('flex-wrap', 'nowrap', 'important');
                parent.style.setProperty('justify-content', 'flex-start', 'important'); // Aligns to Right in RTL
                parent.style.setProperty('width', 'auto', 'important');
                parent.style.setProperty('max-width', 'none', 'important');
                parent.style.setProperty('min-width', 'max-content', 'important');
                parent.style.setProperty('overflow', 'visible', 'important');

                // 2. Tame the Primary Button
                primaryBtn.style.removeProperty('order'); // Remove explicit order
                primaryBtn.style.setProperty('float', 'none', 'important');
                primaryBtn.style.setProperty('flex', '0 0 auto', 'important');
                primaryBtn.style.setProperty('width', 'auto', 'important');
                primaryBtn.style.setProperty('max-width', 'none', 'important');
                // Remove potential conflict margins
                primaryBtn.style.setProperty('margin-left', '0px', 'important');
                primaryBtn.style.setProperty('margin-right', '0px', 'important');
            }
        } else {
            // Fallback: Append to the action container
            actionContainer.appendChild(buttonContainer);
            if (actionContainer) {
                actionContainer.style.display = 'flex';
                actionContainer.style.flexDirection = 'row';
                actionContainer.style.alignItems = 'center';
                actionContainer.style.flexWrap = 'nowrap';
                actionContainer.style.width = 'auto';
                actionContainer.style.minWidth = 'max-content';
            }
        }
    }

    // --- Track Button ---
    if (!document.getElementById('track-project-btn')) {
        const trackBtn = document.createElement('button');
        trackBtn.id = 'track-project-btn';
        trackBtn.className = 'btn btn-success'; // Removed mrg--rs as gap handles spacing
        trackBtn.innerHTML = '<i class="fa fa-fw fa-eye"></i> مراقبة المشروع';
        trackBtn.style.order = '2'; // Force detailed order (swap with ChatGPT)

        // Check if already tracked
        const projectId = getProjectId();
        if (isContextValid()) {
            chrome.storage.local.get(['trackedProjects'], (data) => {
                if (chrome.runtime.lastError) return;
                const tracked = data.trackedProjects || {};
                if (tracked[projectId]) {
                    setButtonTracked(trackBtn);
                }
            });
        }

        trackBtn.addEventListener('click', () => {
            handleTrackClick(trackBtn);
        });

        buttonContainer.appendChild(trackBtn);
    }

    // --- ChatGPT Button ---
    if (!document.getElementById('chatgpt-project-btn')) {
        const chatGptBtn = document.createElement('button');
        chatGptBtn.id = 'chatgpt-project-btn';
        chatGptBtn.className = 'btn btn-primary';
        chatGptBtn.style.order = '1'; // Force detailed order (First)
        // Using a chat icon (fa-comments or similar available in Mostaql's FA)
        chatGptBtn.innerHTML = '<i class="fa fa-fw fa-comments-o"></i> استشارة ChatGPT';
        // chatGptBtn.style.marginRight = '10px'; // Handled by gap
        chatGptBtn.style.backgroundColor = '#2386c8'; // Forces Mostaql Blue
        chatGptBtn.style.borderColor = '#2386c8';
        chatGptBtn.title = 'نسخ تفاصيل المشروع وفتح ChatGPT';

        chatGptBtn.addEventListener('click', handleChatGptClick);

        buttonContainer.appendChild(chatGptBtn);
    }
}

function setButtonTracked(btn) {
    btn.innerHTML = '<i class="fa fa-fw fa-eye-slash"></i> إلغاء المراقبة';
    btn.classList.remove('btn-success');
    btn.classList.add('btn-danger');
}

function setButtonUntracked(btn) {
    btn.innerHTML = '<i class="fa fa-fw fa-eye"></i> مراقبة المشروع';
    btn.classList.remove('btn-danger');
    btn.classList.add('btn-success');
}

function getProjectId() {
    const match = window.location.pathname.match(/\/project\/(\d+)/);
    return match ? match[1] : null;
}

function extractProjectData() {
    // Extract Status
    const statusLabel = document.querySelector('.label-prj-open, .label-prj-closed, .label-prj-completed, .label-prj-cancelled, .label-prj-underway, .label-prj-processing');
    const status = statusLabel ? statusLabel.textContent.trim() : 'غير معروف';

    // Extract Ongoing Communications (التواصلات الجارية)
    // Looking for the table row that contains "التواصلات الجارية"
    let communications = '0';
    const metaRows = document.querySelectorAll('.meta-row, .table-meta tr');
    metaRows.forEach(row => {
        if (row && row.textContent.includes('التواصلات الجارية')) {
            const val = row.querySelector('.meta-value, td:last-child');
            if (val) {
                communications = val.textContent.trim();
            }
        }
    });

    const title = document.querySelector('.heada__title span[data-type="page-header-title"]')?.textContent.trim() || document.title;

    return {
        status,
        communications,
        title,
        url: window.location.href,
        lastChecked: new Date().toISOString()
    };
}

function getProjectDescription() {
    // Select the project description text area
    const descriptionElement = document.querySelector('#project-brief .text-wrapper-div, #projectDetailsTab .text-wrapper-div');
    if (descriptionElement) {
        return descriptionElement.innerText.trim();
    }
    return '';
}

function handleTrackClick(btn) {
    if (!isContextValid()) {
        alert('حدث خطأ في الملحق (تم تحديث الإضافة). يرجى تحديث الصفحة للمتابعة.');
        return;
    }

    const projectId = getProjectId();
    if (!projectId) return;

    chrome.storage.local.get(['trackedProjects'], (data) => {
        if (chrome.runtime.lastError) return;
        const tracked = data.trackedProjects || {};

        if (tracked[projectId]) {
            // Untrack
            delete tracked[projectId];
            chrome.storage.local.set({ trackedProjects: tracked }, () => {
                if (!chrome.runtime.lastError) {
                    setButtonUntracked(btn);
                }
            });
        } else {
            // Track
            const projectData = extractProjectData();
            tracked[projectId] = projectData;
            chrome.storage.local.set({ trackedProjects: tracked }, () => {
                if (!chrome.runtime.lastError) {
                    setButtonTracked(btn);
                }
            });
        }
    });
}

function handleChatGptClick() {
    const projectData = extractProjectData(); // Gets title and url
    const description = getProjectDescription();

    if (!description) {
        alert('لم يتم العثور على وصف المشروع.');
        return;
    }

    // Prepare the prompt
    const prompt = `أريد مساعدتك في كتابة عرض لهذا المشروع على منصة مستقل.
    
عنوان المشروع: ${projectData.title}
    
تفاصيل المشروع:
${description}
    
رابط المشروع: ${projectData.url}
    
يرجى كتابة عرض احترافي ومقنع يوضح خبرتي في هذا المجال ويشرح كيف يمكنني تنفيذ المطلوب بدقة.`;

    // Save prompt to storage for the ChatGPT content script to pick up
    chrome.storage.local.set({ 'pendingChatGptPrompt': prompt }, () => {
        // Open ChatGPT in a new tab
        window.open('https://chatgpt.com/', '_blank');
    });
}

// Initial injection
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectTrackButton);
} else {
    injectTrackButton();
}

