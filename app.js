// STG-Backup-Explorer Logic
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    const headerFileInput = document.getElementById('header-file-input');
    const emptyState = document.getElementById('empty-state');
    const mainApp = document.getElementById('main-app');
    
    // Sidebar elements
    const groupsList = document.getElementById('groups-list');
    const searchInput = document.getElementById('search-input');
    const totalGroupsEl = document.getElementById('total-groups');
    const totalTabsEl = document.getElementById('total-tabs');
    
    // Content elements
    const groupHeaderIcon = document.getElementById('group-header-icon');
    const groupHeaderTitle = document.getElementById('group-header-title');
    const groupHeaderMeta = document.getElementById('group-header-meta');
    const tabsList = document.getElementById('tabs-list');
    const openAllBtn = document.getElementById('open-all-btn');
    const mobileBackBtn = document.getElementById('mobile-back-btn');
    
    // Export elements
    const exportBtn = document.getElementById('export-btn');
    const exportDropdown = document.getElementById('export-dropdown');
    const exportMarkdown = document.getElementById('export-markdown');
    const exportText = document.getElementById('export-text');
    const exportHtml = document.getElementById('export-html');
    
    // Toast container
    const toastContainer = document.getElementById('toast-container');

    // App state
    let backupData = null;
    let activeGroupId = null;
    let searchTerm = '';

    // Initialize Event Listeners
    setupDragAndDrop();
    setupFileInputs();
    setupDropdowns();
    setupSearch();
    setupKeyboardShortcuts();
    setupMobileView();

    // 1. Drag and Drop handlers
    function setupDragAndDrop() {
        ['dragenter', 'dragover'].forEach(eventName => {
            dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.classList.add('dragover');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.classList.remove('dragover');
            }, false);
        });

        dropzone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files.length) {
                handleFile(files[0]);
            }
        });

        dropzone.addEventListener('click', () => {
            fileInput.click();
        });
    }

    // 2. File inputs handlers
    function setupFileInputs() {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length) {
                handleFile(e.target.files[0]);
            }
        });

        headerFileInput.addEventListener('change', (e) => {
            if (e.target.files.length) {
                handleFile(e.target.files[0]);
            }
        });
    }

    // 3. File Processor
    function handleFile(file) {
        if (!file.name.endsWith('.json')) {
            showToast('Please select a valid .json file.', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (!data.groups || !Array.isArray(data.groups)) {
                    throw new Error('Invalid STG Backup format: "groups" array is missing.');
                }
                
                backupData = data;
                showToast(`Successfully loaded ${file.name}!`, 'success');
                initDashboard();
            } catch (err) {
                console.error(err);
                showToast(`Failed to parse file: ${err.message}`, 'error');
            }
        };
        reader.readAsText(file);
    }

    // 4. Initialize Dashboard view after parsing
    function initDashboard() {
        // Toggle view states
        emptyState.classList.add('hidden');
        mainApp.classList.remove('hidden');
        mainApp.classList.add('show-sidebar');
        mainApp.classList.remove('show-content');

        // Reset state
        activeGroupId = null;
        searchTerm = '';
        searchInput.value = '';

        // Calculate and Render overall stats
        const totalGroups = backupData.groups.length;
        let totalTabs = 0;
        backupData.groups.forEach(g => {
            totalTabs += (g.tabs ? g.tabs.length : 0);
        });

        totalGroupsEl.textContent = totalGroups;
        totalTabsEl.textContent = totalTabs;

        // Render groups sidebar
        renderGroups();

        // Select first group by default
        if (totalGroups > 0) {
            selectGroup(backupData.groups[0].id);
        }
    }

    // 5. Render Sidebar Groups
    function renderGroups() {
        groupsList.innerHTML = '';
        
        const filteredGroups = backupData.groups.filter(group => {
            // Group matches search term if the title matches OR any tab inside matches
            if (group.title.toLowerCase().includes(searchTerm.toLowerCase())) return true;
            if (group.tabs) {
                return group.tabs.some(tab => 
                    tab.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                    tab.url.toLowerCase().includes(searchTerm.toLowerCase())
                );
            }
            return false;
        });

        if (filteredGroups.length === 0) {
            groupsList.innerHTML = '<div class="no-results" style="padding: 2rem 1rem;"><div class="no-results-icon">🔍</div><div>No groups found</div></div>';
            return;
        }

        filteredGroups.forEach(group => {
            const count = group.tabs ? group.tabs.length : 0;
            const item = document.createElement('div');
            item.className = `group-item ${group.id === activeGroupId ? 'active' : ''}`;
            item.dataset.id = group.id;

            // Use group color if it exists, fallback to accent color
            const color = group.iconColor || '#6366f1';

            // Support both standard URL and base64 data URI group icons
            let iconHtml = `<span class="group-color-indicator" style="color: ${color}; background-color: ${color}"></span>`;
            if (group.iconUrl && group.iconUrl.trim() !== '') {
                iconHtml = `
                    <div class="group-icon-container" style="border: 1px solid ${color}40;">
                        <img class="group-icon-img" src="${group.iconUrl}" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                        <span class="group-color-indicator" style="display:none; color: ${color}; background-color: ${color}"></span>
                    </div>
                `;
            }

            item.innerHTML = `
                <div class="group-info">
                    ${iconHtml}
                    <span class="group-title" title="${escapeHtml(group.title)}">${escapeHtml(group.title)}</span>
                </div>
                <span class="group-count">${count}</span>
            `;

            item.addEventListener('click', () => selectGroup(group.id, true));
            groupsList.appendChild(item);
        });
     }

    // 6. Select Group
    function selectGroup(groupId, switchMobileView = false) {
        activeGroupId = groupId;

        if (switchMobileView) {
            mainApp.classList.add('show-content');
            mainApp.classList.remove('show-sidebar');
        }
        
        // Update active class in sidebar
        const items = groupsList.querySelectorAll('.group-item');
        items.forEach(item => {
            if (parseInt(item.dataset.id) === groupId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        const group = backupData.groups.find(g => g.id === groupId);
        if (!group) return;

        // Render Group Header
        groupHeaderTitle.textContent = group.title;
        const count = group.tabs ? group.tabs.length : 0;
        groupHeaderMeta.textContent = `${count} tab${count === 1 ? '' : 's'} • Color: ${group.iconColor || 'Default'}`;

        // Set icon
        groupHeaderIcon.innerHTML = '';
        if (group.iconUrl && group.iconUrl.trim() !== '') {
            const img = document.createElement('img');
            img.src = group.iconUrl;
            img.alt = group.title;
            img.onerror = () => {
                groupHeaderIcon.innerHTML = `<span style="color: ${group.iconColor || '#6366f1'}; font-weight: bold;">${group.title.charAt(0)}</span>`;
            };
            groupHeaderIcon.appendChild(img);
        } else {
            groupHeaderIcon.innerHTML = `<span style="color: ${group.iconColor || '#6366f1'}; font-weight: bold; font-size: 1.2rem;">${group.title.charAt(0)}</span>`;
        }

        // Setup "Open All" Button
        openAllBtn.onclick = () => {
            if (group.tabs && group.tabs.length) {
                if (confirm(`Are you sure you want to open all ${group.tabs.length} tabs in new browser tabs?`)) {
                    group.tabs.forEach(tab => {
                        window.open(tab.url, '_blank');
                    });
                }
            }
        };

        // Render Tabs list
        renderTabs(group);
    }

    // 7. Render Group Tabs
    function renderTabs(group) {
        tabsList.innerHTML = '';
        const tabs = group.tabs || [];

        // Apply filter to tabs as well if search term is active
        const filteredTabs = tabs.filter(tab => 
            tab.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
            tab.url.toLowerCase().includes(searchTerm.toLowerCase())
        );

        if (filteredTabs.length === 0) {
            tabsList.innerHTML = `
                <div class="no-results">
                    <div class="no-results-icon">📁</div>
                    <h3>No tabs found</h3>
                    <p>${tabs.length ? 'Try refining your search filter.' : 'This tab group is empty.'}</p>
                </div>
            `;
            return;
        }

        filteredTabs.forEach((tab, index) => {
            const card = document.createElement('div');
            card.className = 'tab-card';

            // Get domain for fallback favicon character
            let domain = 'T';
            try {
                domain = new URL(tab.url).hostname;
            } catch(e) {}
            const fallbackChar = domain.replace('www.', '').charAt(0);

            // Favicon display logic
            let faviconHtml = `<div class="tab-favicon-fallback">${fallbackChar}</div>`;
            if (tab.favIconUrl && tab.favIconUrl.startsWith('data:')) {
                faviconHtml = `<img src="${tab.favIconUrl}" alt="icon" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                               <div class="tab-favicon-fallback" style="display:none;">${fallbackChar}</div>`;
            } else if (tab.url) {
                // Try fetching external favicon fallback safely using Google Favicon API
                const extFavicon = `https://www.google.com/s2/favicons?sz=32&domain=${domain}`;
                faviconHtml = `<img src="${extFavicon}" alt="icon" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                               <div class="tab-favicon-fallback" style="display:none;">${fallbackChar}</div>`;
            }

            card.innerHTML = `
                <a href="${tab.url}" target="_blank" class="tab-main">
                    <div class="tab-favicon">
                        ${faviconHtml}
                    </div>
                    <div class="tab-details">
                        <div class="tab-title" title="${escapeHtml(tab.title)}">${escapeHtml(tab.title) || 'Untitled Page'}</div>
                        <div class="tab-url" title="${escapeHtml(tab.url)}">${escapeHtml(tab.url)}</div>
                    </div>
                </a>
                <div class="tab-actions">
                    <button class="btn-icon copy-url-btn" data-tooltip="Copy URL">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    </button>
                    <a href="${tab.url}" target="_blank" class="btn-icon" data-tooltip="Open in new tab">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                    </a>
                </div>
            `;

            // Copy to clipboard listener
            card.querySelector('.copy-url-btn').addEventListener('click', (e) => {
                e.preventDefault();
                navigator.clipboard.writeText(tab.url)
                    .then(() => showToast('URL copied to clipboard!', 'success'))
                    .catch(() => showToast('Failed to copy URL', 'error'));
            });

            tabsList.appendChild(card);
        });
    }

    // 8. Search implementation
    function setupSearch() {
        searchInput.addEventListener('input', (e) => {
            searchTerm = e.target.value;
            
            // Rerender sidebar groups
            renderGroups();
            
            // If active group is still valid, rerender tabs
            if (activeGroupId !== null) {
                const group = backupData.groups.find(g => g.id === activeGroupId);
                if (group) renderTabs(group);
            }
        });
    }

    // 9. Dropdown Export Menu Setup
    function setupDropdowns() {
        exportBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            exportDropdown.classList.toggle('active');
        });

        document.addEventListener('click', () => {
            exportDropdown.classList.remove('active');
        });

        exportDropdown.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // Click handlers for formats
        exportMarkdown.addEventListener('click', () => {
            exportActiveGroup('markdown');
            exportDropdown.classList.remove('active');
        });

        exportText.addEventListener('click', () => {
            exportActiveGroup('text');
            exportDropdown.classList.remove('active');
        });

        exportHtml.addEventListener('click', () => {
            exportActiveGroup('html');
            exportDropdown.classList.remove('active');
        });
    }

    // 10. Export Functions
    function exportActiveGroup(format) {
        if (!activeGroupId || !backupData) {
            showToast('No active group loaded to export.', 'error');
            return;
        }

        const group = backupData.groups.find(g => g.id === activeGroupId);
        if (!group || !group.tabs || group.tabs.length === 0) {
            showToast('Current group has no tabs to export.', 'error');
            return;
        }

        let content = '';
        let fileExtension = '';
        let mimeType = 'text/plain';

        const safeTitle = group.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();

        if (format === 'markdown') {
            content = `# ${group.title}\n\n`;
            group.tabs.forEach(tab => {
                content += `- [${tab.title || 'Untitled'}](${tab.url})\n`;
            });
            fileExtension = 'md';
        } else if (format === 'text') {
            group.tabs.forEach(tab => {
                content += `${tab.url}\n`;
            });
            fileExtension = 'txt';
        } else if (format === 'html') {
            // Netscape HTML Bookmarks Format
            content = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and written by auto-generated tools.
     Do NOT edit! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3 ADD_DATE="${Math.floor(Date.now()/1000)}" LAST_MODIFIED="${Math.floor(Date.now()/1000)}">Simple Tab Groups Export</H3>
    <DL><p>
        <DT><H3 ADD_DATE="${Math.floor(Date.now()/1000)}" LAST_MODIFIED="${Math.floor(Date.now()/1000)}" COLOR="${group.iconColor || ''}">${escapeHtml(group.title)}</H3>
        <DL><p>
`;
            group.tabs.forEach(tab => {
                const addDate = Math.floor(Date.now()/1000);
                content += `            <DT><A HREF="${escapeHtml(tab.url)}" ADD_DATE="${addDate}" ICON="${tab.favIconUrl || ''}">${escapeHtml(tab.title || 'Untitled')}</A>\n`;
            });

            content += `        </DL><p>
    </DL><p>
</DL><p>
`;
            fileExtension = 'html';
            mimeType = 'text/html';
        }

        // Trigger browser file download
        const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `stg_group_${safeTitle}.${fileExtension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast(`Exported ${group.title} as ${format.toUpperCase()}!`, 'success');
    }

    // 11. Custom Keyboard shortcuts
    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Focus search input on Ctrl+F or Alt+S
            if ((e.ctrlKey && e.key === 'f') || (e.altKey && e.key === 's')) {
                // Only if app is active
                if (!mainApp.classList.contains('hidden')) {
                    e.preventDefault();
                    searchInput.focus();
                }
            }
        });
    }

    // 12. Setup Mobile View navigation
    function setupMobileView() {
        if (mobileBackBtn) {
            mobileBackBtn.addEventListener('click', () => {
                mainApp.classList.remove('show-content');
                mainApp.classList.add('show-sidebar');
            });
        }
    }

    // Helpers
    function escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        let icon = 'ℹ️';
        if (type === 'success') icon = '✅';
        if (type === 'error') icon = '❌';

        toast.innerHTML = `
            <span>${icon}</span>
            <span>${message}</span>
        `;

        toastContainer.appendChild(toast);

        // Auto remove
        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) reverse forwards';
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 3000);
    }
});
