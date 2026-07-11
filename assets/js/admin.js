/**
 * TechMark 科技书签 - 后台管理脚本（纯前端静态实现）
 * 密码仅存储在浏览器 localStorage 中
 */

const AdminApp = {
    categories: [],
    bookmarks: [],
    csrfToken: '',
    needsPasswordChange: false,
    ADMIN_PASSWORD_KEY: 'site_admin_password_hash',
    captchaCode: '',
    loginAttempts: 0,
    lockUntil: 0,
    MAX_LOGIN_ATTEMPTS: 5,
    LOCK_DURATION_MS: 60000,

    init() {
        this.restoreGuard();
        this.seedAccess();
        this.beginFlow();
    },

    resolveSitePath(path) {
        return new URL(path, window.location.href).toString();
    },

    decodeSecret(token) {
        try {
            const raw = typeof atob === 'function' ? atob(token) : token;
            const seed = 'gh-static-v1';
            let out = '';
            for (let i = 0; i < raw.length; i++) {
                const keyChar = seed.charCodeAt(i % seed.length);
                out += String.fromCharCode(raw.charCodeAt(i) ^ keyChar);
            }
            return out;
        } catch (e) {
            return '';
        }
    },

    getDefaultPassword() {
        return this.decodeSecret('HxAfQ0RYQVha').trim();
    },

    readStoredHash() {
        return localStorage.getItem(this.ADMIN_PASSWORD_KEY) || this.seedAccess();
    },

    storeHash(hash) {
        localStorage.setItem(this.ADMIN_PASSWORD_KEY, hash);
    },

    seedAccess() {
        const expectedHash = this.hashPassword(this.getDefaultPassword());
        const storedHash = localStorage.getItem(this.ADMIN_PASSWORD_KEY);
        if (!storedHash || storedHash !== expectedHash) {
            localStorage.setItem(this.ADMIN_PASSWORD_KEY, expectedHash);
        }
        return expectedHash;
    },

    hashPassword(password) {
        const salt = 'techmark-admin-v1';
        const text = String(password || '');
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        const saltHash = this.hashText(salt);
        return this.toHexString((hash >>> 0) ^ saltHash);
    },

    hashText(value) {
        let hash = 0;
        for (let i = 0; i < value.length; i++) {
            hash = (hash << 5) - hash + value.charCodeAt(i);
            hash = hash & hash;
        }
        return hash >>> 0;
    },

    toHexString(value) {
        return (value >>> 0).toString(16).padStart(8, '0');
    },

    confirmPassword(password) {
        const expectedHash = this.seedAccess();
        return this.hashPassword(password) === expectedHash;
    },

    beginFlow() {
        const isLoggedIn = sessionStorage.getItem('admin_logged_in') === '1';
        if (isLoggedIn) {
            this.openPanel();
        } else {
            this.openLogin();
        }
    },

    openLogin() {
        document.getElementById('loginPage').style.display = 'flex';
        document.getElementById('adminPanel').style.display = 'none';
        document.getElementById('passwordChangeNotice').style.display = 'none';
        this.updateLoginButtonState();
        this.renderCaptcha();
        this.attachLogin();
    },

    openPanel() {
        document.getElementById('loginPage').style.display = 'none';
        document.getElementById('adminPanel').style.display = 'block';
        
        // 首次使用：提示设置密码
        if (!this.readStoredHash()) {
            this.needsPasswordChange = true;
            document.getElementById('passwordChangeNotice').innerHTML = '<div class="notice-content"><span class="notice-icon">🔑</span><span class="notice-text">欢迎！请设置您的管理密码（在"数据设置"中设置）</span></div>';
            document.getElementById('passwordChangeNotice').style.display = 'block';
        } else {
            this.needsPasswordChange = false;
            document.getElementById('passwordChangeNotice').style.display = 'none';
        }
        
        // 先绑定事件，确保用户操作时事件已就绪
        if (!this._eventsBound) {
            this.bindAdminEvents();
            this._eventsBound = true;
        }
        // 再异步加载数据
        this.loadData();
    },

    loadData() {
        const useDraft = this.loadDraft();
        if (!useDraft) {
            const dataUrl = new URL('./data/bookmarks.json', window.location.href);
            dataUrl.searchParams.set('v', Date.now());

            fetch(dataUrl.toString())
                .then(res => res.json())
                .then(data => {
                    this.categories = Array.isArray(data.categories) ? data.categories : [];
                    this.bookmarks = Array.isArray(data.bookmarks) ? data.bookmarks : [];
                    this.loadStats();
                    this.loadCategories();
                    this.loadBookmarks();
                })
                .catch(err => {
                    this.categories = [];
                    this.bookmarks = [];
                    this.loadStats();
                    this.loadCategories();
                    this.loadBookmarks();
                    this.toast('加载数据失败，使用空数据集', 'error');
                });
        } else {
            this.loadStats();
            this.loadCategories();
            this.loadBookmarks();
        }
    },

    attachLogin() {
        const form = document.getElementById('loginForm');
        if (!form || form.dataset.bound) return;
        form.dataset.bound = '1';
        
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const password = form.querySelector('[name="password"]').value;
            const captcha = form.querySelector('[name="captcha"]').value;
            const errorEl = document.getElementById('loginError');

            if (this.isLocked()) {
                errorEl.textContent = '登录已被暂时锁定，请稍后再试';
                this.shakeLoginCard();
                return;
            }

            if (!this.checkCaptcha(captcha)) {
                this.recordFailedLogin('验证码错误');
                return;
            }
            if (this.confirmPassword(password)) {
                this.resetGuard();
                sessionStorage.setItem('admin_logged_in', '1');
                this.openPanel();
            } else {
                this.recordFailedLogin('密码错误');
            }
        });

        const passwordInput = document.getElementById('login-password');
        const captchaInput = document.getElementById('login-captcha');
        const refreshBtn = document.getElementById('refreshCaptchaBtn');
        const captchaCodeEl = document.getElementById('captchaCode');

        if (passwordInput && captchaInput) {
            passwordInput.addEventListener('keydown', (e) => {
                if (e.key === 'Tab' && !e.shiftKey) {
                    e.preventDefault();
                    captchaInput.focus();
                    captchaInput.select();
                }
            });
        }

        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.renderCaptcha());
        }
        if (captchaCodeEl) {
            captchaCodeEl.addEventListener('click', () => this.renderCaptcha());
            captchaCodeEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.renderCaptcha();
                }
            });
        }
    },

    renderCaptcha() {
        const code = String(Math.floor(1000 + Math.random() * 9000));
        this.captchaCode = code;
        const codeEl = document.getElementById('captchaCode');
        const inputEl = document.getElementById('login-captcha');
        if (codeEl) {
            codeEl.textContent = code;
        }
        if (inputEl) {
            inputEl.value = '';
        }
    },

    checkCaptcha(inputCode) {
        return String(inputCode || '').trim() === String(this.captchaCode);
    },

    restoreGuard() {
        const storedUntil = Number(localStorage.getItem('site_admin_login_lock_until') || 0);
        const storedAttempts = Number(localStorage.getItem('site_admin_login_attempts') || 0);
        this.lockUntil = storedUntil > Date.now() ? storedUntil : 0;
        this.loginAttempts = storedAttempts;
    },

    saveGuard() {
        localStorage.setItem('site_admin_login_attempts', String(this.loginAttempts));
        if (this.lockUntil > 0) {
            localStorage.setItem('site_admin_login_lock_until', String(this.lockUntil));
        } else {
            localStorage.removeItem('site_admin_login_lock_until');
        }
    },

    isLocked() {
        return Date.now() < this.lockUntil;
    },

    updateLoginButtonState() {
        const submitBtn = document.getElementById('loginSubmitBtn');
        const passwordInput = document.getElementById('login-password');
        const captchaInput = document.getElementById('login-captcha');
        const refreshBtn = document.getElementById('refreshCaptchaBtn');
        const locked = this.isLocked();
        if (submitBtn) submitBtn.disabled = locked;
        if (passwordInput) passwordInput.disabled = locked;
        if (captchaInput) captchaInput.disabled = locked;
        if (refreshBtn) refreshBtn.disabled = locked;
        if (locked) {
            submitBtn && (submitBtn.textContent = '已锁定');
        } else if (submitBtn) {
            submitBtn.textContent = '登 录';
        }
    },

    recordFailedLogin(message) {
        const errorEl = document.getElementById('loginError');
        this.loginAttempts += 1;
        this.saveGuard();
        this.shakeLoginCard();
        this.renderCaptcha();
        this.updateLoginButtonState();

        if (this.loginAttempts >= this.MAX_LOGIN_ATTEMPTS) {
            this.lockUntil = Date.now() + this.LOCK_DURATION_MS;
            this.saveGuard();
            errorEl.textContent = '连续错误过多，已锁定 60 秒';
            this.updateLoginButtonState();
        } else {
            errorEl.textContent = message || '密码或验证码错误';
        }
    },

    resetGuard() {
        this.loginAttempts = 0;
        this.lockUntil = 0;
        this.saveGuard();
        this.updateLoginButtonState();
    },

    shakeLoginCard() {
        const card = document.querySelector('.login-card');
        if (!card) return;
        card.classList.remove('shake');
        void card.offsetWidth;
        card.classList.add('shake');
        setTimeout(() => card.classList.remove('shake'), 500);
    },

    bindAdminEvents() {
        // Tab switching
        document.querySelectorAll('.admin-nav-item').forEach(item => {
            item.addEventListener('click', function(e) {
                e.preventDefault();
                const tab = this.dataset.tab;
                
                document.querySelectorAll('.admin-nav-item').forEach(el => el.classList.remove('active'));
                item.classList.add('active');
                
                document.querySelectorAll('.admin-tab').forEach(el => el.classList.remove('active'));
                const targetTab = document.getElementById('tab-' + tab);
                if (targetTab) {
                    targetTab.classList.add('active');
                }
                
                document.getElementById('adminSidebar').classList.remove('open');
            });
        });

        // Admin menu toggle
        const adminMenuToggle = document.getElementById('adminMenuToggle');
        const adminSidebar = document.getElementById('adminSidebar');
        const adminSidebarOverlay = document.getElementById('adminSidebarOverlay');
        
        if (adminMenuToggle) {
            adminMenuToggle.addEventListener('click', () => adminSidebar.classList.toggle('open'));
        }
        
        if (adminSidebarOverlay) {
            adminSidebarOverlay.addEventListener('click', () => adminSidebar.classList.remove('open'));
        }

        // Logout
        document.getElementById('logoutBtn').addEventListener('click', () => {
            sessionStorage.removeItem('admin_logged_in');
            location.reload();
        });

        // Change password button
        const changePasswordBtn = document.getElementById('changePasswordBtn');
        if (changePasswordBtn) {
            changePasswordBtn.addEventListener('click', () => this.showChangePasswordModal());
        }

        // Add bookmark
        document.getElementById('addBookmarkBtn').addEventListener('click', () => this.showBookmarkModal());

        // Add category
        document.getElementById('addCategoryBtn').addEventListener('click', () => this.showCategoryModal());

        // Filter
        const filterCategory = document.getElementById('filterCategory');
        if (filterCategory) {
            filterCategory.addEventListener('change', () => this.loadBookmarks());
        }
        
        const filterSearch = document.getElementById('filterSearch');
        if (filterSearch) {
            let searchTimer;
            filterSearch.addEventListener('input', function() {
                clearTimeout(searchTimer);
                searchTimer = setTimeout(() => AdminApp.loadBookmarks(), 300);
            });
        }

        // Modal close
        document.getElementById('modalClose').addEventListener('click', () => this.closeModal());
        document.addEventListener('click', (e) => {
            if (e.target.closest('.js-close-modal')) this.closeModal();
        });
        document.getElementById('modalOverlay').addEventListener('click', function(e) {
            if (e.target === this) AdminApp.closeModal();
        });

        // Category table actions
        document.getElementById('categoryTableBody')?.addEventListener('click', (e) => {
            const editButton = e.target.closest('.js-edit-category');
            const deleteButton = e.target.closest('.js-delete-category');

            if (editButton) this.showCategoryModal(parseInt(editButton.dataset.id));
            if (deleteButton) this.deleteCategory(parseInt(deleteButton.dataset.id));
        });

        // Bookmark table actions
        document.getElementById('bookmarkTableBody')?.addEventListener('click', (e) => {
            const editButton = e.target.closest('.js-edit-bookmark');
            const deleteButton = e.target.closest('.js-delete-bookmark');

            if (editButton) this.showBookmarkModal(parseInt(editButton.dataset.id));
            if (deleteButton) this.deleteBookmark(parseInt(deleteButton.dataset.id));
        });

        // Settings
        document.getElementById('exportJsonBtn')?.addEventListener('click', () => this.exportJson());
        document.getElementById('importJsonBtn')?.addEventListener('click', () => document.getElementById('importFile').click());
        document.getElementById('importFile')?.addEventListener('change', (e) => this.importJson(e));
        document.getElementById('updatePasswordBtn')?.addEventListener('click', () => this.updatePassword());
    },

    loadStats() {
        const totalBookmarks = this.bookmarks.length;
        const totalCategories = this.categories.length;
        const starredCount = this.bookmarks.filter(b => b.is_starred == 1).length;
        const today = new Date().toISOString().slice(0, 10);
        const todayBookmarks = this.bookmarks.filter(b => (b.created_at || '').startsWith(today)).length;

        document.getElementById('statBookmarks').textContent = totalBookmarks;
        document.getElementById('statCategories').textContent = totalCategories;
        document.getElementById('statStarred').textContent = starredCount;
        document.getElementById('statToday').textContent = todayBookmarks;
    },

    loadCategories() {
        const tbody = document.getElementById('categoryTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = this.categories.map(cat => {
            const iconHtml = /\.(png|jpe?g|gif|svg|webp)$/i.test(cat.icon)
                ? '<img class="admin-cat-icon" src="' + this.escapeHtml(cat.icon) + '" alt="">'
                : '<span class="cat-icon-text">' + this.escapeHtml(cat.icon) + '</span>';
            return '<tr>' +
                '<td>' + iconHtml + '</td>' +
                '<td><strong>' + this.escapeHtml(cat.name) + '</strong></td>' +
                '<td class="hide-mobile">' + (cat.sort_order || 0) + '</td>' +
                '<td><span class="badge badge-success">' + (this.bookmarks.filter(b => b.category_id == cat.id).length) + ' 个</span></td>' +
                '<td><div class="table-actions"><button class="btn btn-sm btn-outline js-edit-category" data-id="' + cat.id + '">编辑</button><button class="btn btn-sm btn-danger js-delete-category" data-id="' + cat.id + '">删除</button></div></td>' +
            '</tr>';
        }).join('');

        // Update filter select
        const filterCategory = document.getElementById('filterCategory');
        if (filterCategory) {
            const existing = filterCategory.querySelectorAll('option:not([value="0"])');
            existing.forEach(opt => opt.remove());
            this.categories.forEach(cat => {
                const opt = document.createElement('option');
                opt.value = cat.id;
                opt.textContent = cat.name;
                filterCategory.appendChild(opt);
            });
        }
    },

    loadBookmarks() {
        const categoryId = document.getElementById('filterCategory').value;
        const search = document.getElementById('filterSearch').value;
        
        let filtered = this.bookmarks.slice();
        if (categoryId > 0) filtered = filtered.filter(b => b.category_id == categoryId);
        if (search) {
            const s = search.toLowerCase();
            filtered = filtered.filter(b => 
                (b.title || '').toLowerCase().includes(s) || 
                (b.url || '').toLowerCase().includes(s)
            );
        }
        this.renderBookmarkTable(filtered);
    },

    renderBookmarkTable(bookmarks) {
        const tbody = document.getElementById('bookmarkTableBody');
        if (!tbody) return;

        if (bookmarks.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-muted)">暂无书签</td></tr>';
            return;
        }

        tbody.innerHTML = bookmarks.map(bm => {
            const cat = this.categories.find(c => c.id == bm.category_id);
            const catName = cat ? this.renderIcon(cat.icon) + ' ' + this.escapeHtml(cat.name) : '未分类';
            return '<tr>' +
                '<td><div class="bookmark-info-cell"><span class="title"><a href="' + this.escapeHtml(this.safeUrl(bm.url)) + '" target="_blank" rel="noopener noreferrer">' + this.escapeHtml(bm.title) + '</a></span><span class="url"><a href="' + this.escapeHtml(this.safeUrl(bm.url)) + '" target="_blank" rel="noopener noreferrer" class="small">' + this.escapeHtml(bm.url) + '</a></span></div></td>' +
                '<td class="hide-mobile">' + catName + '</td>' +
                '<td class="hide-mobile" style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + this.escapeHtml(bm.description || '-') + '</td>' +
                '<td>' + (bm.is_starred == 1 ? '<span class="badge badge-warning">⭐ 收藏</span>' : '<span class="badge badge-success">普通</span>') + '</td>' +
                '<td><div class="table-actions"><button class="btn btn-sm btn-outline js-edit-bookmark" data-id="' + bm.id + '">编辑</button><button class="btn btn-sm btn-danger js-delete-bookmark" data-id="' + bm.id + '">删除</button></div></td>' +
            '</tr>';
        }).join('');
    },

    showBookmarkModal(id) {
        const isEdit = !!id;
        let bookmark = { title: '', url: '', description: '', category_id: 0, is_starred: 0, sort_order: 0 };

        const loadAndShow = () => {
            const selCat = this.categories.find(c => c.id == (bookmark.category_id || 0));
            const selectedIcon = (bookmark.category_id || 0) == 0 ? 'assets/images/category-icons/0.png' : (selCat ? selCat.icon : 'assets/images/category-icons/0.png');
            const selectedName = (bookmark.category_id || 0) == 0 ? '未分类' : (selCat ? selCat.name : '未分类');

            document.getElementById('modalTitle').textContent = isEdit ? '编辑书签' : '添加书签';
            document.getElementById('modalBody').innerHTML = '<form id="bookmarkForm">' +
                '<input type="hidden" name="id" value="' + (id || '') + '">' +
                '<div class="form-group"><label for="bookmark-title">标题 *</label><input id="bookmark-title" type="text" name="title" value="' + this.escapeHtml(bookmark.title) + '" required placeholder="请输入书签标题"></div>' +
                '<div class="form-group"><label for="bookmark-url">网址 *</label><input id="bookmark-url" type="url" name="url" value="' + this.escapeHtml(bookmark.url) + '" required placeholder="https://"></div>' +
                '<div class="form-group"><label for="bookmark-description">描述</label><textarea id="bookmark-description" name="description" placeholder="简短描述">' + this.escapeHtml(bookmark.description) + '</textarea></div>' +
                '<div class="form-row"><div class="form-group"><label for="bookmark-category">分类</label><div class="custom-select" id="bookmark-category"><div class="custom-select-trigger"><img class="custom-select-icon" src="' + this.escapeHtml(selectedIcon) + '" alt=""><span class="custom-select-label">' + this.escapeHtml(selectedName) + '</span><span class="custom-select-arrow">▾</span></div><div class="custom-select-options"><div class="custom-select-option ' + ((bookmark.category_id || 0) == 0 ? 'selected' : '') + '" data-value="0"><img class="custom-select-icon" src="assets/images/category-icons/0.png" alt=""><span class="custom-select-label">未分类</span></div>' + this.categories.map(c => '<div class="custom-select-option ' + (c.id == bookmark.category_id ? 'selected' : '') + '" data-value="' + c.id + '"><img class="custom-select-icon" src="' + this.escapeHtml(c.icon) + '" alt=""><span class="custom-select-label">' + this.escapeHtml(c.name) + '</span></div>').join('') + '</div><input type="hidden" name="category_id" value="' + (bookmark.category_id || 0) + '"></div></div>' +
                '<div class="form-group"><label for="bookmark-sort">排序</label><input id="bookmark-sort" type="number" name="sort_order" value="' + (bookmark.sort_order || 0) + '" min="0"></div></div>' +
                '<div class="form-group"><div class="checkbox-group"><input id="bookmark-starred" type="checkbox" name="is_starred" value="1" ' + (bookmark.is_starred == 1 ? 'checked' : '') + '><label for="bookmark-starred" style="margin:0">⭐ 收藏此书签</label></div></div>' +
                '<div class="btn-row"><button type="button" class="btn btn-outline js-close-modal">取消</button><button type="submit" class="btn btn-primary">' + (isEdit ? '保存修改' : '添加书签') + '</button></div>' +
            '</form>';

            this.openModal();

            document.getElementById('bookmarkForm').addEventListener('submit', (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const isStarred = formData.get('is_starred') ? 1 : 0;
                const title = formData.get('title').trim();
                const url = formData.get('url').trim();
                
                if (!title || !url) {
                    this.toast('标题和链接不能为空', 'error');
                    return;
                }

                const bookmarkData = {
                    title: title,
                    url: url,
                    description: formData.get('description').trim(),
                    category_id: parseInt(formData.get('category_id') || '0'),
                    is_starred: isStarred,
                    sort_order: parseInt(formData.get('sort_order') || '0')
                };

                if (isEdit) {
                    const idx = this.bookmarks.findIndex(b => b.id == id);
                    if (idx !== -1) {
                        bookmarkData.id = parseInt(id);
                        bookmarkData.favicon = this.bookmarks[idx].favicon || '';
                        bookmarkData.created_at = this.bookmarks[idx].created_at || new Date().toISOString();
                        this.bookmarks[idx] = bookmarkData;
                    }
                } else {
                    bookmarkData.id = Date.now();
                    bookmarkData.favicon = '';
                    bookmarkData.created_at = new Date().toISOString();
                    this.bookmarks.push(bookmarkData);
                }

                this.toast(isEdit ? '书签更新成功' : '书签添加成功', 'success');
                this.closeModal();
                this.loadBookmarks();
                this.loadStats();
                this.loadCategories();
                this.autoSave();
            });
            this.bindCustomSelect(document.getElementById('bookmark-category'));
        };

        if (isEdit) {
            const bm = this.bookmarks.find(b => b.id == id);
            if (bm) bookmark = bm;
            loadAndShow();
        } else {
            loadAndShow();
        }
    },

    showCategoryModal(id) {
        const isEdit = !!id;
        let category = { name: '', icon: '📁', sort_order: 0 };

        if (isEdit) {
            const cat = this.categories.find(c => c.id == id);
            if (cat) category = cat;
        }

        document.getElementById('modalTitle').textContent = isEdit ? '编辑分类' : '添加分类';
        document.getElementById('modalBody').innerHTML = '<form id="categoryForm">' +
            '<input type="hidden" name="id" value="' + (id || '') + '">' +
            '<div class="form-group"><label for="category-name">分类名称 *</label><input id="category-name" type="text" name="name" value="' + this.escapeHtml(category.name) + '" required placeholder="请输入分类名称"></div>' +
            '<div class="form-row"><div class="form-group"><label for="category-icon">图标</label><input id="category-icon" type="text" name="icon" value="' + this.escapeHtml(category.icon) + '" placeholder="📁" maxlength="200"></div>' +
            '<div class="form-group"><label for="category-sort">排序</label><input id="category-sort" type="number" name="sort_order" value="' + (category.sort_order || 0) + '" min="0"></div></div>' +
            '<div class="btn-row"><button type="button" class="btn btn-outline js-close-modal">取消</button><button type="submit" class="btn btn-primary">' + (isEdit ? '保存修改' : '添加分类') + '</button></div>' +
        '</form>';

        this.openModal();

        document.getElementById('categoryForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const catData = {
                name: formData.get('name').trim(),
                icon: formData.get('icon').trim() || '📁',
                sort_order: parseInt(formData.get('sort_order') || '0')
            };

            if (!catData.name) {
                this.toast('分类名称不能为空', 'error');
                return;
            }

            if (isEdit) {
                const idx = this.categories.findIndex(c => c.id == id);
                if (idx !== -1) {
                    catData.id = parseInt(id);
                    catData.created_at = this.categories[idx].created_at || '';
                    this.categories[idx] = catData;
                }
            } else {
                catData.id = Date.now();
                catData.created_at = new Date().toISOString();
                this.categories.push(catData);
            }

            this.toast(isEdit ? '分类更新成功' : '分类添加成功', 'success');
            this.closeModal();
            this.loadCategories();
            this.loadStats();
            this.autoSave();
        });
    },

    showChangePasswordModal() {
        document.getElementById('modalTitle').textContent = '修改密码';
        document.getElementById('modalBody').innerHTML = '<form id="passwordForm">' +
            '<div class="form-group"><label for="old-password">旧密码 *</label><input id="old-password" type="password" name="old_password" required placeholder="请输入旧密码"></div>' +
            '<div class="form-group"><label for="new-password">新密码 *</label><input id="new-password" type="password" name="new_password" required minlength="6" placeholder="请输入新密码（至少6位）"></div>' +
            '<div class="form-group"><label for="confirm-password">确认密码 *</label><input id="confirm-password" type="password" name="confirm_password" required minlength="6" placeholder="请再次输入新密码"></div>' +
            '<div class="btn-row"><button type="button" class="btn btn-outline js-close-modal">取消</button><button type="submit" class="btn btn-primary">确认修改</button></div>' +
        '</form>';

        this.openModal();

        document.getElementById('passwordForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const oldPassword = e.target.old_password.value;
            const newPassword = e.target.new_password.value;
            const confirmPassword = e.target.confirm_password.value;

            if (!this.checkPassword(oldPassword)) {
                this.toast('旧密码不正确', 'error');
                return;
            }
            if (newPassword.length < 6) {
                this.toast('密码长度至少6位', 'error');
                return;
            }
            if (newPassword !== confirmPassword) {
                this.toast('两次输入的密码不一致', 'error');
                return;
            }

            this.setPasswordHash(this.hashPassword(newPassword));
            this.needsPasswordChange = false;
            document.getElementById('passwordChangeNotice').style.display = 'none';
            this.toast('密码修改成功', 'success');
            this.closeModal();
        });
    },

    deleteBookmark(id) {
        if (!confirm('确定要删除这个书签吗？')) return;
        this.bookmarks = this.bookmarks.filter(b => b.id != id);
        this.toast('书签删除成功', 'success');
        this.loadBookmarks();
        this.loadStats();
        this.autoSave();
    },

    deleteCategory(id) {
        if (!confirm('确定要删除这个分类吗？该分类下的书签将移到"未分类"。')) return;
        this.bookmarks.forEach(b => { if (b.category_id == id) b.category_id = 0; });
        this.categories = this.categories.filter(c => c.id != id);
        this.toast('分类删除成功', 'success');
        this.loadCategories();
        this.loadBookmarks();
        this.loadStats();
        this.autoSave();
    },

    openModal() {
        document.getElementById('modalOverlay').classList.add('active');
    },

    closeModal() {
        document.getElementById('modalOverlay').classList.remove('active');
    },

    toast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = 'toast toast-' + type;
        toast.textContent = message;
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(30px)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    safeUrl(url) {
        if (!url) return '#';
        const u = String(url).trim();
        if (/^https?:\/\//i.test(u)) return u;
        return 'http://' + u;
    },

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    renderIcon(icon) {
        if (!icon) return '';
        if (/\.(png|jpe?g|gif|svg|webp)$/i.test(icon)) {
            return '<img class="admin-cat-icon" src="' + this.escapeHtml(icon) + '" alt="">';
        }
        return '<span class="cat-icon-text">' + this.escapeHtml(icon) + '</span>';
    },

    bindCustomSelect(container) {
        if (!container) return;
        const trigger = container.querySelector('.custom-select-trigger');
        const options = container.querySelector('.custom-select-options');
        const hidden = container.querySelector('input[type="hidden"]');
        if (!trigger || !options) return;

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            container.classList.toggle('open');
        });

        options.querySelectorAll('.custom-select-option').forEach(opt => {
            opt.addEventListener('click', (e) => {
                e.stopPropagation();
                if (hidden) hidden.value = opt.dataset.value;
                const icon = opt.querySelector('.custom-select-icon');
                const label = opt.querySelector('.custom-select-label');
                const tIcon = trigger.querySelector('.custom-select-icon');
                const tLabel = trigger.querySelector('.custom-select-label');
                if (icon && tIcon) tIcon.src = icon.src;
                if (label && tLabel) tLabel.textContent = label.textContent;
                options.querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
                container.classList.remove('open');
            });
        });

        document.addEventListener('click', (e) => {
            if (container.classList.contains('open') && !container.contains(e.target)) {
                container.classList.remove('open');
            }
        });
    },

    autoSave() {
        const data = {
            categories: this.categories,
            bookmarks: this.bookmarks,
            exported_at: new Date().toISOString()
        };
        localStorage.setItem('bookmarks_draft', JSON.stringify(data));
    },

    loadDraft() {
        const draft = localStorage.getItem('bookmarks_draft');
        if (draft) {
            try {
                const data = JSON.parse(draft);
                if (data.categories && data.bookmarks) {
                    this.categories = data.categories;
                    this.bookmarks = data.bookmarks;
                    return true;
                }
            } catch {}
        }
        return false;
    },

    exportJson() {
        const data = {
            categories: this.categories,
            bookmarks: this.bookmarks,
            exported_at: new Date().toISOString()
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'bookmarks.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.toast('已导出 bookmarks.json，请上传到 data/ 目录', 'success');
    },

    importJson(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target.result);
                if (data.categories && Array.isArray(data.categories) && data.bookmarks && Array.isArray(data.bookmarks)) {
                    if (confirm('导入将覆盖当前所有数据，确定继续吗？')) {
                        this.categories = data.categories;
                        this.bookmarks = data.bookmarks;
                        this.loadStats();
                        this.loadCategories();
                        this.loadBookmarks();
                        this.autoSave();
                        this.toast('JSON 导入成功', 'success');
                    }
                } else {
                    this.toast('JSON 格式不正确', 'error');
                }
            } catch {
                this.toast('JSON 解析失败', 'error');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    },

    updatePassword() {
        const input = document.getElementById('adminPasswordInput');
        const newPassword = input.value.trim();
        if (!newPassword || newPassword.length < 4) {
            this.toast('当前登录密码已由系统固定，请联系站点管理员', 'info');
            return;
        }
        this.setPasswordHash(this.ensureDefaultPassword());
        this.needsPasswordChange = false;
        document.getElementById('passwordChangeNotice').style.display = 'none';
        input.value = '';
        this.toast('当前登录密码已由系统固定，请联系站点管理员', 'success');
    }
};