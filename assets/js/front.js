/**
 * TechMark 科技书签 - 前台脚本
 */

// ========================================
// 前台功能
// ========================================
const FrontApp = {
    categories: [],
    bookmarks: [],
    currentCategory: 0,
    isStarFilter: false,
    searchTimer: null,

    init() {
        this.loadData();
    },

    resolveSitePath(path) {
        return new URL(path, window.location.href).toString();
    },

    loadData() {
        const dataUrl = new URL('./data/bookmarks.json', window.location.href);
        dataUrl.searchParams.set('v', Date.now());

        fetch(dataUrl.toString())
            .then(res => res.json())
            .then(data => {
                this.categories = data.categories || [];
                this.bookmarks = data.bookmarks || [];
                this.renderCategories();
                this.loadBookmarks();
                this.loadTotalCount();
                this.bindEvents();
            })
            .catch(err => {
                document.getElementById('bookmarkGrid').innerHTML = '<div class="empty-state"><div class="empty-icon">❌</div><p>加载数据失败</p></div>';
            });
    },

    bindEvents() {
        const menuToggle = document.getElementById('menuToggle');
        const sidebar = document.getElementById('sidebar');
        const sidebarOverlay = document.getElementById('sidebarOverlay');
        const categoryList = document.getElementById('categoryList');
        const bookmarkGrid = document.getElementById('bookmarkGrid');
        const searchInput = document.getElementById('searchInput');
        const mobileSearchInput = document.getElementById('mobileSearchInput');
        const searchClear = document.getElementById('searchClear');
        const mobileSearchClear = document.getElementById('mobileSearchClear');
        const starFilter = document.getElementById('starFilter');
        const contentTitle = document.getElementById('contentTitle');
        const bookmarkCount = document.getElementById('bookmarkCount');
        const emptyState = document.getElementById('emptyState');
        const backToTop = document.getElementById('backToTop');

        if (menuToggle) {
            menuToggle.addEventListener('click', function() {
                sidebar.classList.toggle('open');
            });
        }

        if (sidebarOverlay) {
            sidebarOverlay.addEventListener('click', function() {
                sidebar.classList.remove('open');
            });
        }

        if (categoryList) {
            categoryList.addEventListener('click', function(e) {
                const item = e.target.closest('.category-item');
                if (!item) return;

                document.querySelectorAll('.category-item').forEach(el => el.classList.remove('active'));
                item.classList.add('active');

                FrontApp.currentCategory = parseInt(item.dataset.id);
                FrontApp.isStarFilter = false;
                if (starFilter) starFilter.classList.remove('active');

                const iconHtml = item.querySelector('.cat-icon').innerHTML.trim();
                const name = item.querySelector('.cat-name').textContent;
                if (contentTitle) contentTitle.innerHTML = iconHtml + ' ' + name;

                FrontApp.loadBookmarks();
                sidebar.classList.remove('open');
            });
        }

        const onSearchInput = (sourceInput) => {
            clearTimeout(FrontApp.searchTimer);
            if (searchClear) searchClear.style.display = sourceInput.value ? 'block' : 'none';
            if (mobileSearchClear) mobileSearchClear.style.display = sourceInput.value ? 'block' : 'none';
            FrontApp.searchTimer = setTimeout(() => FrontApp.loadBookmarks(), 300);
        };

        if (searchInput) {
            searchInput.addEventListener('input', function() {
                onSearchInput(this);
                if (mobileSearchInput) mobileSearchInput.value = this.value;
            });
        }

        if (mobileSearchInput) {
            mobileSearchInput.addEventListener('input', function() {
                onSearchInput(this);
                if (searchInput) searchInput.value = this.value;
            });
        }

        if (searchClear) {
            searchClear.addEventListener('click', function() {
                if (searchInput) searchInput.value = '';
                if (mobileSearchInput) mobileSearchInput.value = '';
                if (searchClear) searchClear.style.display = 'none';
                if (mobileSearchClear) mobileSearchClear.style.display = 'none';
                FrontApp.loadBookmarks();
                if (searchInput) searchInput.focus();
            });
        }

        if (mobileSearchClear) {
            mobileSearchClear.addEventListener('click', function() {
                if (searchInput) searchInput.value = '';
                if (mobileSearchInput) mobileSearchInput.value = '';
                if (searchClear) searchClear.style.display = 'none';
                if (mobileSearchClear) mobileSearchClear.style.display = 'none';
                FrontApp.loadBookmarks();
                if (mobileSearchInput) mobileSearchInput.focus();
            });
        }

        if (starFilter) {
            starFilter.addEventListener('click', function() {
                FrontApp.isStarFilter = !FrontApp.isStarFilter;
                this.classList.toggle('active');
                
                if (FrontApp.isStarFilter) {
                    if (contentTitle) contentTitle.textContent = '⭐ 收藏的书签';
                    document.querySelectorAll('.category-item').forEach(el => el.classList.remove('active'));
                } else {
                    const activeItem = document.querySelector('.category-item.active');
                    if (activeItem) {
                        const iconHtml = activeItem.querySelector('.cat-icon').innerHTML.trim();
                        const name = activeItem.querySelector('.cat-name').textContent;
                        if (contentTitle) contentTitle.innerHTML = iconHtml + ' ' + name;
                    }
                }
                
                FrontApp.loadBookmarks();
            });
        }

        if (backToTop) {
            window.addEventListener('scroll', function() {
                backToTop.classList.toggle('visible', window.scrollY > 300);
            });

            backToTop.addEventListener('click', function() {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }
    },

    renderCategories() {
        const list = document.getElementById('categoryList');
        if (!list) return;
        
        list.innerHTML = '<li class="category-item active" data-id="0"><span class="cat-icon"><img src="assets/images/category-icons/0.png" alt=""></span><span class="cat-name">全部书签</span><span class="cat-count" id="totalCount">0</span></li>';
        
        this.categories.forEach(cat => {
            const count = this.bookmarks.filter(b => parseInt(b.category_id) === parseInt(cat.id)).length;
            const li = document.createElement('li');
            li.className = 'category-item';
            li.dataset.id = cat.id;
            const iconHtml = /\.(png|jpe?g|gif|svg|webp)$/i.test(cat.icon) 
                ? '<img src="' + this.escapeHtml(cat.icon) + '" alt="">' 
                : this.escapeHtml(cat.icon);
            li.innerHTML = '<span class="cat-icon">' + iconHtml + '</span><span class="cat-name">' + this.escapeHtml(cat.name) + '</span><span class="cat-count">' + count + '</span>';
            list.appendChild(li);
        });
        
        const totalEl = document.getElementById('totalCount');
        if (totalEl) totalEl.textContent = this.bookmarks.length;
    },

    loadBookmarks() {
        const search = (document.getElementById('searchInput')?.value || document.getElementById('mobileSearchInput')?.value || '').trim();
        let filtered = this.bookmarks.slice();
        
        if (!this.isStarFilter && this.currentCategory > 0) {
            filtered = filtered.filter(b => parseInt(b.category_id) === this.currentCategory);
        }
        if (this.isStarFilter) {
            filtered = filtered.filter(b => b.is_starred == 1);
        }
        if (search) {
            const s = search.toLowerCase();
            filtered = filtered.filter(b => 
                (b.title || '').toLowerCase().includes(s) || 
                (b.description || '').toLowerCase().includes(s) || 
                (b.url || '').toLowerCase().includes(s)
            );
        }

        this.renderBookmarks(filtered);
    },

    renderBookmarks(bookmarks) {
        const grid = document.getElementById('bookmarkGrid');
        const countEl = document.getElementById('bookmarkCount');
        const emptyState = document.getElementById('emptyState');
        
        if (countEl) countEl.textContent = bookmarks.length;

        if (bookmarks.length === 0) {
            grid.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        grid.style.display = 'grid';
        emptyState.style.display = 'none';

        grid.innerHTML = bookmarks.map(bm => {
            const favicon = bm.favicon || (() => {
                try { const u = new URL(bm.url); return u.protocol + '//' + u.host + '/favicon.ico'; } catch { return ''; }
            })();
            return '<div class="bookmark-card">' +
                '<div class="bookmark-header">' +
                    '<div class="bookmark-favicon"><img class="bookmark-favicon-img" src="' + (favicon ? this.escapeHtml(encodeURI(favicon)) : '#') + '" alt=""></div>' +
                    '<div class="bookmark-title">' + this.escapeHtml(bm.title) + '</div>' +
                    (bm.is_starred == 1 ? '<span class="bookmark-star starred">★</span>' : '') +
                '</div>' +
                '<div class="bookmark-url">' + this.escapeHtml(bm.url) + '</div>' +
                (bm.description ? '<div class="bookmark-desc">' + this.escapeHtml(bm.description) + '</div>' : '') +
                '<a href="' + this.escapeHtml(this.safeUrl(bm.url)) + '" target="_blank" rel="noopener noreferrer" class="bookmark-link">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>' +
                    '访问网站' +
                '</a>' +
            '</div>';
        }).join('');

        grid.querySelectorAll('.bookmark-favicon-img').forEach(img => {
            img.addEventListener('error', function() {
                this.style.display = 'none';
                this.parentElement.innerHTML = '<span class="fallback-icon">🌐</span>';
            });
        });
    },

    loadTotalCount() {
        const el = document.getElementById('totalCount');
        if (el) el.textContent = this.bookmarks.length;
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
    }
};