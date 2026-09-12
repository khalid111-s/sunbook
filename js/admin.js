// =========================================
// Admin Panel: Products CRUD
// =========================================

const gateEl = document.getElementById('adminGate');
const deniedEl = document.getElementById('adminDenied');
const panelEl = document.getElementById('adminPanel');

let currentProducts = [];
let editingId = null;

function showGateMessage(html) {
    if (gateEl) gateEl.innerHTML = html;
}

// ---------- 1. التأكد إن المستخدم مسجل دخول وهو "admin" ----------
async function checkAdminAccess() {
    const token = localStorage.getItem('sunbook_token');

    if (!token) {
        window.location.href = 'admin-login.html';
        return;
    }

    try {
        const { data: user } = await api.getMe();
        if (user.role !== 'admin') {
            // الحساب ده مبقاش admin (اتشال من صفحة admin-setup مثلاً) - نشيله من قايمة السويتشر المحفوظة في المتصفح ده كمان
            removeAdminAccount(user.email);
            localStorage.removeItem('sunbook_token');
            localStorage.removeItem('sunbook_username');
            localStorage.removeItem('sunbook_user_id');
            window.location.href = 'admin-login.html?denied=1';
            return;
        }

        // نتأكد إن الحساب اللي داخل بيه دلوقتي متسجّل في قايمة حسابات الأدمن المحفوظة، عشان يظهر في السويتشر
        saveAdminAccount({ _id: user._id, name: user.name, email: user.email, token });

        if (gateEl) gateEl.style.display = 'none';
        if (panelEl) panelEl.style.display = 'block';
        renderAdminAccountSwitcher(user.email);
        initAdminPanel();
    } catch (err) {
        // التوكن غير صالح أو منتهي - نرجعه لصفحة دخول الأدمن
        localStorage.removeItem('sunbook_token');
        window.location.href = 'admin-login.html';
    }
}

// ---------- سويتشر الحسابات: يوري مين الأدمن الداخل بيه دلوقتي، ويسمح بالتبديل من غير logout ----------
function renderAdminAccountSwitcher(activeEmail) {
    const chip = document.getElementById('adminAccountChip');
    const avatar = document.getElementById('adminAccountAvatar');
    const label = document.getElementById('adminAccountLabel');
    const dropdown = document.getElementById('adminAccountDropdown');
    if (!chip || !dropdown) return;

    const accounts = getSavedAdminAccounts();
    const active = accounts.find((a) => a.email === activeEmail);

    avatar.textContent = ((active?.name || activeEmail || '?').charAt(0)).toUpperCase();
    label.textContent = active?.name || activeEmail;
    chip.style.display = 'flex';

    function renderDropdown() {
        const optionsHtml = accounts.map((a) => {
            const isActive = a.email === activeEmail;
            const initial = (a.name || a.email).charAt(0).toUpperCase();
            return `
                <button type="button" class="admin-account-option ${isActive ? 'active' : ''}" data-email="${a.email}">
                    <span class="admin-avatar-circle">${initial}</span>
                    <span>
                        <span class="acc-name">${a.name || 'Admin'}</span>
                        <span class="acc-email">${a.email}</span>
                    </span>
                    ${isActive ? '<span class="acc-check">✓</span>' : ''}
                </button>
            `;
        }).join('');

        dropdown.innerHTML = `
            <div class="admin-account-dropdown-label">Admin accounts</div>
            ${optionsHtml}
            <div class="admin-account-dropdown-divider"></div>
            <button type="button" class="admin-account-dropdown-action" id="addAdminAccountBtn">+ Add another admin account</button>
            <button type="button" class="admin-account-dropdown-action danger" id="signOutAccountBtn">Sign out this account</button>
        `;

        dropdown.querySelectorAll('.admin-account-option').forEach((btn) => {
            btn.addEventListener('click', () => {
                const email = btn.dataset.email;
                if (email === activeEmail) { dropdown.classList.remove('open'); return; }
                const target = accounts.find((a) => a.email === email);
                if (target) {
                    activateAdminAccount(target);
                    window.location.reload();
                }
            });
        });

        document.getElementById('addAdminAccountBtn').addEventListener('click', () => {
            window.location.href = 'admin-login.html?return=admin';
        });

        document.getElementById('signOutAccountBtn').addEventListener('click', () => {
            const remaining = removeAdminAccount(activeEmail);
            localStorage.removeItem('sunbook_token');
            localStorage.removeItem('sunbook_username');
            localStorage.removeItem('sunbook_user_id');
            if (remaining.length) {
                activateAdminAccount(remaining[0]);
                window.location.reload();
            } else {
                window.location.href = 'admin-login.html';
            }
        });
    }

    renderDropdown();
    chip.onclick = (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('open');
    };
    document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target) && e.target !== chip) dropdown.classList.remove('open');
    });
}

// ---------- 2. تحميل جدول المنتجات ----------
async function loadProductsTable() {
    const tbody = document.getElementById('productsTableBody');
    tbody.innerHTML = '<tr><td colspan="10">Loading...</td></tr>';

    try {
        const { data } = await api.getProducts();
        currentProducts = data;

        if (!data.length) {
            tbody.innerHTML = '<tr><td colspan="10">No products yet. Add your first one above.</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(p => {
            let stockCell = '<span style="color:var(--text-gray);">Not tracked</span>';
            if (p.trackStock) {
                const low = p.stockCount <= 3;
                const out = p.stockCount <= 0;
                stockCell = `<span style="color:${out ? '#e05252' : low ? '#e0a552' : 'inherit'};">${p.stockCount} ${out ? '(Out)' : low ? '(Low)' : ''}</span>`;
            }
            return `
            <tr>
                <td><img src="${p.image}" alt="${p.title}" onerror="this.src='assets/sun-icon.png'"></td>
                <td>${p.title}</td>
                <td>LE ${Number(p.price).toFixed(2)}</td>
                <td>${p.priceEUR ? `€${Number(p.priceEUR).toFixed(2)}` : '—'}</td>
                <td>${p.type}</td>
                <td>${p.featured ? '<span class="admin-badge-yes">Yes</span>' : '—'}</td>
                <td>${p.egyptOnly ? '<span class="admin-badge-yes">🇪🇬 Yes</span>' : '—'}</td>
                <td>${stockCell}</td>
                <td>${p.order ?? 0}</td>
                <td>
                    <div class="admin-row-actions">
                        <button class="edit-btn" data-id="${p._id}">Edit</button>
                        <button class="delete-btn" data-id="${p._id}">Delete</button>
                    </div>
                </td>
            </tr>
        `;
        }).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="10" style="color:#e05252;">Failed to load products: ${err.message}</td></tr>`;
    }
}

// ---------- 3. فورم الإضافة/التعديل ----------
function resetForm() {
    editingId = null;
    document.getElementById('productIdField').value = '';
    document.getElementById('fieldTitle').value = '';
    document.getElementById('fieldPrice').value = '';
    document.getElementById('fieldPriceEUR').value = '';
    document.getElementById('fieldImage').value = '';
    document.getElementById('fieldType').value = 'physical';
    document.getElementById('fieldBadges').value = '';
    document.getElementById('fieldOrder').value = 0;
    document.getElementById('fieldDescription').value = '';
    document.getElementById('fieldDescriptionAr').value = '';
    document.getElementById('fieldFeatured').checked = false;
    document.getElementById('fieldInStock').checked = true;
    document.getElementById('fieldEgyptOnly').checked = false;
    document.getElementById('fieldTrackStock').checked = false;
    document.getElementById('fieldStockCount').value = 0;
    document.getElementById('stockCountWrap').style.display = 'none';
    document.getElementById('formTitle').innerText = 'Add New Product';
    document.getElementById('submitBtn').innerText = 'Add Product';
    document.getElementById('cancelEditBtn').style.display = 'none';
    document.getElementById('formError').innerText = '';
}

function fillFormForEdit(product) {
    editingId = product._id;
    document.getElementById('productIdField').value = product._id;
    document.getElementById('fieldTitle').value = product.title;
    document.getElementById('fieldPrice').value = product.price;
    document.getElementById('fieldPriceEUR').value = product.priceEUR ?? '';
    document.getElementById('fieldImage').value = product.image;
    document.getElementById('fieldType').value = product.type;
    document.getElementById('fieldBadges').value = (product.badges || []).join(', ');
    document.getElementById('fieldOrder').value = product.order ?? 0;
    document.getElementById('fieldDescription').value = product.description || '';
    document.getElementById('fieldDescriptionAr').value = product.descriptionAr || '';
    document.getElementById('fieldFeatured').checked = !!product.featured;
    document.getElementById('fieldInStock').checked = product.inStock !== false;
    document.getElementById('fieldEgyptOnly').checked = !!product.egyptOnly;
    document.getElementById('fieldTrackStock').checked = !!product.trackStock;
    document.getElementById('fieldStockCount').value = product.stockCount ?? 0;
    document.getElementById('stockCountWrap').style.display = product.trackStock ? 'block' : 'none';
    document.getElementById('formTitle').innerText = `Edit: ${product.title}`;
    document.getElementById('submitBtn').innerText = 'Save Changes';
    document.getElementById('cancelEditBtn').style.display = 'inline-block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function readFormData() {
    const badgesRaw = document.getElementById('fieldBadges').value.trim();
    return {
        title: document.getElementById('fieldTitle').value.trim(),
        price: parseFloat(document.getElementById('fieldPrice').value),
        priceEUR: document.getElementById('fieldPriceEUR').value
            ? parseFloat(document.getElementById('fieldPriceEUR').value)
            : null,
        image: document.getElementById('fieldImage').value.trim(),
        type: document.getElementById('fieldType').value,
        badges: badgesRaw ? badgesRaw.split(',').map(b => b.trim()).filter(Boolean) : [],
        order: parseInt(document.getElementById('fieldOrder').value) || 0,
        description: document.getElementById('fieldDescription').value.trim(),
        descriptionAr: document.getElementById('fieldDescriptionAr').value.trim(),
        featured: document.getElementById('fieldFeatured').checked,
        inStock: document.getElementById('fieldInStock').checked,
        egyptOnly: document.getElementById('fieldEgyptOnly').checked,
        trackStock: document.getElementById('fieldTrackStock').checked,
        stockCount: parseInt(document.getElementById('fieldStockCount').value) || 0,
    };
}

let revenueChartInstance = null;
let visitsChartInstance = null;
let ordersChartInstance = null;
let onlinePollInterval = null;

// ---------- 3. لوحة الإحصائيات (Dashboard) ----------
async function loadDashboardStats() {
    try {
        const [orderStatsRes, visitStatsRes, clickStatsRes, ordersListRes] = await Promise.all([
            api.getOrderStats(),
            api.getVisitStats(),
            api.getClickStats('add_to_cart'),
            api.getOrders(),
        ]);

        const orderStats = orderStatsRes.data;
        const visitStats = visitStatsRes.data;
        const clickStats = clickStatsRes.data;
        const orders = ordersListRes.data;

        document.getElementById('statTotalOrders').innerText = orderStats.totalOrders;
        document.getElementById('statTotalRevenue').innerText = `LE ${Number(orderStats.totalRevenue).toFixed(2)}`;
        document.getElementById('statUniqueVisitors').innerText = visitStats.totalUniqueVisitors;
        document.getElementById('statPageViews').innerText = visitStats.totalPageViews;
        document.getElementById('statReturningVisitors').innerText = visitStats.returningVisitors;
        document.getElementById('statNewVisitors').innerText = visitStats.newVisitors;

        const avgOrderValue = orderStats.totalOrders > 0 ? orderStats.totalRevenue / orderStats.totalOrders : 0;
        document.getElementById('statAvgOrderValue').innerText = `LE ${avgOrderValue.toFixed(2)}`;

        // نسبة وعدد السلة المتروكة: من كل الزوار اللي وصلوا لصفحة الـ checkout، كام واحد فعلاً خلّص طلب
        const cartAbandonmentEl = document.getElementById('statCartAbandonment');
        const abandonedCountEl = document.getElementById('statAbandonedCount');
        if (visitStats.checkoutVisitors > 0) {
            const abandonedCount = Math.max(0, visitStats.checkoutVisitors - orderStats.totalOrders);
            const abandonRate = (abandonedCount / visitStats.checkoutVisitors) * 100;
            cartAbandonmentEl.innerText = `${abandonRate.toFixed(0)}%`;
            abandonedCountEl.innerText = abandonedCount;
        } else {
            cartAbandonmentEl.innerText = '—';
            abandonedCountEl.innerText = '—';
        }

        // ---- كام طلب دفع بالجنيه مقابل باليورو ----
        const ordersByCurrency = orderStats.ordersByCurrency || { EGP: { orders: 0 }, EUR: { orders: 0 } };
        document.getElementById('statOrdersEGP').innerText = ordersByCurrency.EGP.orders;
        document.getElementById('statOrdersEUR').innerText = ordersByCurrency.EUR.orders;

        // ---- كام زائر من مصر مقابل من برة مصر ----
        document.getElementById('statVisitorsEgypt').innerText = visitStats.egyptVisitors ?? '—';
        document.getElementById('statVisitorsAbroad').innerText = visitStats.abroadVisitors ?? '—';

        // ---- أكتر المنتجات مبيعًا ----
        const topProductsBody = document.getElementById('topProductsBody');
        topProductsBody.innerHTML = orderStats.topProducts.length
            ? orderStats.topProducts.map(p => `
                <tr>
                    <td>${p.title}</td>
                    <td>${p.quantitySold}</td>
                    <td>LE ${Number(p.revenue).toFixed(2)}</td>
                </tr>
            `).join('')
            : '<tr><td colspan="3">No orders yet.</td></tr>';

        // ---- أكتر المنتجات نقرًا على "Add to Cart" ----
        const topClickedBody = document.getElementById('topClickedBody');
        topClickedBody.innerHTML = clickStats.topClicked.length
            ? clickStats.topClicked.map(c => `<tr><td>${c.title}</td><td>${c.clicks}</td></tr>`).join('')
            : '<tr><td colspan="2">No clicks recorded yet.</td></tr>';

        // ---- أكتر الصفحات زيارة ----
        const topPagesBody = document.getElementById('topPagesBody');
        if (topPagesBody) {
            topPagesBody.innerHTML = (visitStats.topPages || []).length
                ? visitStats.topPages.map(p => `<tr><td>${p.path || '/'}</td><td>${p.pageViews}</td><td>${p.visitors}</td></tr>`).join('')
                : '<tr><td colspan="3">No visits recorded yet.</td></tr>';
        }

        // ---- الزوار حسب الدولة ----
        const topCountriesBody = document.getElementById('topCountriesBody');
        topCountriesBody.innerHTML = visitStats.topCountries.length
            ? visitStats.topCountries.map(c => `<tr><td>${c.country}</td><td>${c.visitors}</td></tr>`).join('')
            : '<tr><td colspan="2">No visits recorded yet.</td></tr>';

        // ---- مصادر الزيارات ----
        const topReferrersBody = document.getElementById('topReferrersBody');
        topReferrersBody.innerHTML = visitStats.topReferrers.length
            ? visitStats.topReferrers.map(r => `<tr><td>${r.referrer}</td><td>${r.visitors}</td></tr>`).join('')
            : '<tr><td colspan="2">No visits recorded yet.</td></tr>';

        // ---- الإيرادات حسب النوع ----
        const revenueByTypeBody = document.getElementById('revenueByTypeBody');
        const typeLabels = { physical: 'Physical Books', digital: 'Digital Books', both: 'Physical + Digital', booking: 'Sessions' };
        revenueByTypeBody.innerHTML = orderStats.revenueByType.length
            ? orderStats.revenueByType.map(t => `
                <tr><td>${typeLabels[t.type] || t.type}</td><td>LE ${Number(t.revenue).toFixed(2)}</td></tr>
            `).join('')
            : '<tr><td colspan="2">No revenue yet.</td></tr>';

        // ---- جدول الطلبات المفصّل ----
        const detailedOrdersBody = document.getElementById('detailedOrdersBody');
        detailedOrdersBody.innerHTML = orders.length
            ? orders.slice(0, 50).map(o => {
                const itemsSummary = o.items.map(i => `${i.title} ×${i.qty}`).join(', ');
                const accountName = o.user && o.user.name ? o.user.name : '—';
                const hasPhysical = o.items.some(i => i.type === 'physical' || i.type === 'both');
                const fulfillmentCell = hasPhysical
                    ? `<select class="fulfillment-select" data-id="${o._id}" style="background:#1a1b1d;color:#fff;border:1px solid #444;border-radius:4px;padding:4px 6px;font-size:0.8rem;">
                        <option value="processing" ${o.fulfillmentStatus === 'processing' || !o.fulfillmentStatus ? 'selected' : ''}>Processing</option>
                        <option value="shipped" ${o.fulfillmentStatus === 'shipped' ? 'selected' : ''}>Shipped</option>
                        <option value="delivered" ${o.fulfillmentStatus === 'delivered' ? 'selected' : ''}>Delivered</option>
                       </select>`
                    : '—';
                return `
                    <tr>
                        <td>${new Date(o.createdAt).toLocaleDateString()}</td>
                        <td>${accountName}</td>
                        <td>${o.customerName}</td>
                        <td>${itemsSummary}</td>
                        <td>LE ${Number(o.totalAmount).toFixed(2)}</td>
                        <td>${o.country || 'Unknown'}</td>
                        <td>${o.status === 'paid' ? '<span class="admin-badge-yes">Paid</span>' : o.status}</td>
                        <td>${fulfillmentCell}</td>
                    </tr>
                `;
            }).join('')
            : '<tr><td colspan="8">No orders yet.</td></tr>';
    } catch (err) {
        console.error('Failed to load dashboard stats:', err);
    }
}

// ---------- التحكم في فترة الرسومات البيانية (يوم / أسبوع / شهر / سنة) ----------
// كل رسم بياني ليه شريط تحكم مستقل تمامًا عن التانيين - ممكن رسم يعرض يوم معين
// والتاني يعرض شهر مختلف والتالت سنة مختلفة، من غير ما يأثروا على بعض.

function formatRangeLabel(granularity, rangeStart, rangeEnd) {
    const start = new Date(rangeStart);
    const endInclusive = new Date(new Date(rangeEnd).getTime() - 1);
    const opts = { day: 'numeric', month: 'short', year: 'numeric' };

    if (granularity === 'day') return start.toLocaleDateString('en-GB', opts);
    if (granularity === 'week') {
        return `${start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${endInclusive.toLocaleDateString('en-GB', opts)}`;
    }
    if (granularity === 'year') return `${start.getUTCFullYear()}`;
    return start.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }); // month
}

function formatChartLabel(dateStr, unit) {
    const d = new Date(dateStr);
    if (unit === 'hour') {
        // نظام 12 ساعة (AM/PM) بدل الـ24 ساعة
        let hours = d.getUTCHours();
        const period = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        if (hours === 0) hours = 12;
        return `${hours} ${period}`;
    }
    if (unit === 'month') return d.toLocaleDateString('en-GB', { month: 'short' });
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); // day
}

// factory بيبني شريط تحكم مستقل (Day/Week/Month/Year + تاريخ + Today) لأي رسم بياني
function createRangeController({ toolbarId, dateInputId, todayBtnId, labelId, onLoad }) {
    let granularity = 'month';
    let rangeDate = null; // null = النهاردة

    async function load() {
        try {
            await onLoad(granularity, rangeDate || undefined, (rangeStart, rangeEnd) => {
                const labelEl = document.getElementById(labelId);
                if (labelEl) labelEl.innerText = formatRangeLabel(granularity, rangeStart, rangeEnd);
            });
        } catch (err) {
            console.error(`Failed to load range for ${toolbarId}:`, err);
        }
    }

    function init() {
        const toolbar = document.getElementById(toolbarId);
        if (!toolbar) return;
        const buttons = toolbar.querySelectorAll('.range-btn');
        const dateInput = document.getElementById(dateInputId);
        const todayBtn = document.getElementById(todayBtnId);

        if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);

        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                granularity = btn.dataset.granularity;
                load();
            });
        });

        if (dateInput) {
            dateInput.addEventListener('change', () => {
                rangeDate = dateInput.value || null;
                load();
            });
        }

        if (todayBtn) {
            todayBtn.addEventListener('click', () => {
                rangeDate = null;
                if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
                load();
            });
        }

        load();
    }

    return { init };
}

const revenueRangeController = createRangeController({
    toolbarId: 'revenueRangeToolbar',
    dateInputId: 'revenueRangeDate',
    todayBtnId: 'revenueRangeToday',
    labelId: 'revenueRangeLabel',
    onLoad: async (granularity, date, setLabel) => {
        const { data } = await api.getOrderStats(granularity, date);
        setLabel(data.rangeStart, data.rangeEnd);
        renderRevenueChart(data.dailyRevenue, data.seriesUnit);
    },
});

const visitsRangeController = createRangeController({
    toolbarId: 'visitsRangeToolbar',
    dateInputId: 'visitsRangeDate',
    todayBtnId: 'visitsRangeToday',
    labelId: 'visitsRangeLabel',
    onLoad: async (granularity, date, setLabel) => {
        const { data } = await api.getVisitStats(granularity, date);
        setLabel(data.rangeStart, data.rangeEnd);
        renderVisitsChart(data.dailyVisits, data.seriesUnit);
    },
});

const ordersRangeController = createRangeController({
    toolbarId: 'ordersRangeToolbar',
    dateInputId: 'ordersRangeDate',
    todayBtnId: 'ordersRangeToday',
    labelId: 'ordersRangeLabel',
    onLoad: async (granularity, date, setLabel) => {
        const { data } = await api.getOrderStats(granularity, date);
        setLabel(data.rangeStart, data.rangeEnd);
        renderOrdersChart(data.dailyRevenue, data.seriesUnit);
    },
});

function initAllRangeControllers() {
    revenueRangeController.init();
    visitsRangeController.init();
    ordersRangeController.init();
}

// ---------- عداد "الموجودين حاليًا" - بيتحدث لوحده كل 20 ثانية ----------
async function refreshOnlineCount() {
    try {
        const { data } = await api.getOnlineCount();
        const el = document.getElementById('statOnlineNow');
        if (el) el.innerText = data.online;
    } catch (err) {
        console.error('Failed to load online count:', err);
    }
}

function startOnlinePolling() {
    refreshOnlineCount();
    if (onlinePollInterval) clearInterval(onlinePollInterval);
    onlinePollInterval = setInterval(refreshOnlineCount, 20000);
}

function renderRevenueChart(dailyRevenue, unit) {
    const canvas = document.getElementById('revenueChart');
    if (!canvas || typeof Chart === 'undefined') return;

    const labels = dailyRevenue.map(d => formatChartLabel(d.date, unit));
    const data = dailyRevenue.map(d => d.revenue);

    if (revenueChartInstance) revenueChartInstance.destroy();

    revenueChartInstance = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Revenue (LE)',
                data,
                borderColor: '#d8b056',
                backgroundColor: 'rgba(216,176,86,0.15)',
                fill: true,
                tension: 0.3,
                pointRadius: 2,
            }],
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: '#c4c4c4', maxTicksLimit: 10 }, grid: { color: 'rgba(255,255,255,0.05)' } },
                y: { ticks: { color: '#c4c4c4' }, grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true },
            },
        },
    });
}

function renderVisitsChart(dailyVisits, unit) {
    const canvas = document.getElementById('visitsChart');
    if (!canvas || typeof Chart === 'undefined') return;

    const labels = dailyVisits.map(d => formatChartLabel(d.date, unit));

    if (visitsChartInstance) visitsChartInstance.destroy();

    visitsChartInstance = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Page Views',
                    data: dailyVisits.map(d => d.pageViews),
                    borderColor: '#6ea8fe',
                    backgroundColor: 'rgba(110,168,254,0.1)',
                    tension: 0.3,
                    pointRadius: 2,
                },
                {
                    label: 'Unique Visitors',
                    data: dailyVisits.map(d => d.visitors),
                    borderColor: '#d8b056',
                    backgroundColor: 'rgba(216,176,86,0.1)',
                    tension: 0.3,
                    pointRadius: 2,
                },
            ],
        },
        options: {
            responsive: true,
            plugins: { legend: { labels: { color: '#c4c4c4' } } },
            scales: {
                x: { ticks: { color: '#c4c4c4', maxTicksLimit: 10 }, grid: { color: 'rgba(255,255,255,0.05)' } },
                y: { ticks: { color: '#c4c4c4' }, grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true },
            },
        },
    });
}

function renderOrdersChart(dailyRevenue, unit) {
    const canvas = document.getElementById('ordersChart');
    if (!canvas || typeof Chart === 'undefined') return;

    const labels = dailyRevenue.map(d => formatChartLabel(d.date, unit));

    if (ordersChartInstance) ordersChartInstance.destroy();

    ordersChartInstance = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Orders',
                data: dailyRevenue.map(d => d.orders),
                backgroundColor: 'rgba(216,176,86,0.5)',
            }],
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: '#c4c4c4', maxTicksLimit: 10 }, grid: { color: 'rgba(255,255,255,0.05)' } },
                y: { ticks: { color: '#c4c4c4', stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true },
            },
        },
    });
}

// ---------- Export orders to CSV ----------
function downloadOrdersCSV(orders) {
    const headers = ['Date', 'Customer', 'Phone', 'Items', 'Total (LE)', 'Status'];
    const rows = orders.map(o => [
        new Date(o.createdAt).toLocaleString(),
        o.customerName,
        o.phone || '',
        o.items.map(i => `${i.title} x${i.qty}`).join(' | '),
        o.totalAmount,
        o.status,
    ]);

    const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sunbook-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ---------- Export helper مشترك (بيبني ملف CSV من أي مصفوفة صفوف ويحمّله) ----------
function downloadCSV(headers, rows, filenamePrefix) {
    const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
        .join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ---------- Export sessions (bookings) to CSV ----------
function downloadSessionsCSV(bookings) {
    const headers = ['Date & Time', 'Student Name', 'Student Email', 'Student Phone', 'Subject', 'Price (LE)', 'Payment Status'];
    const rows = bookings.map(b => [
        new Date(b.date).toLocaleString(),
        b.student?.name || '',
        b.student?.email || '',
        b.student?.phone || '',
        b.subject || '',
        b.price,
        b.status,
    ]);
    downloadCSV(headers, rows, 'sunbook-sessions');
}

// ---------- Export users to CSV ----------
function downloadUsersCSV(users) {
    const headers = ['Name', 'Email', 'Registered On', 'Orders Made'];
    const rows = users.map(u => [
        u.name,
        u.email,
        new Date(u.createdAt).toLocaleDateString(),
        u.orderCount ?? 0,
    ]);
    downloadCSV(headers, rows, 'sunbook-users');
}

// ---------- 4. الأحداث ----------
const tabPanelIds = {
    products: 'tabProducts',
    dashboard: 'tabDashboard',
    sessions: 'tabSessions',
    users: 'tabUsers',
    promocodes: 'tabPromoCodes',
    archives: 'tabArchives',
    content: 'tabSiteContent',
};

// كل تاب من التابات دي بيتحمّل أول مرة بس تفتحه، مش من أول ما الصفحة تفتح
const tabLoaders = {
    sessions: () => loadSessionsTable(),
    users: () => loadUsersTable(),
    promocodes: () => loadPromoCodesTable(),
    archives: () => loadArchivesList(),
    content: () => loadSiteContentTab(),
};
const loadedTabs = new Set();

function initTabs() {
    const buttons = document.querySelectorAll('.admin-tab-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const target = btn.dataset.tab;
            Object.entries(tabPanelIds).forEach(([key, id]) => {
                document.getElementById(id).style.display = key === target ? 'block' : 'none';
            });
            if (tabLoaders[target] && !loadedTabs.has(target)) {
                loadedTabs.add(target);
                tabLoaders[target]();
            }
        });
    });
}

// ---------- تاب الجلسات ----------
async function loadSessionsTable() {
    const tbody = document.getElementById('sessionsTableBody');
    tbody.innerHTML = '<tr><td colspan="9">Loading...</td></tr>';
    try {
        const { data } = await api.getAllBookings();
        if (!data.length) {
            tbody.innerHTML = '<tr><td colspan="9">No sessions booked yet.</td></tr>';
            return;
        }
        const statusBadge = (status) => {
            if (status === 'paid' || status === 'confirmed' || status === 'completed') {
                return `<span class="admin-badge-yes">${status}</span>`;
            }
            if (status === 'cancelled') return `<span style="color:#e05252;">${status}</span>`;
            return status; // pending
        };
        // شارة حالة الجلسة نفسها (مختلفة عن حالة الدفع) - عشان الأدمن يعرف الجلسة live دلوقتي ولا لسه ولا فاتت
        const sessionStatusBadge = (sessionStatus) => {
            if (!sessionStatus) return '<span style="color:#888;">—</span>';
            if (sessionStatus === 'live') return '<span style="color:#34A853; font-weight:bold;">live now</span>';
            if (sessionStatus === 'completed') return '<span class="admin-badge-yes">completed</span>';
            if (sessionStatus === 'missed') return '<span style="color:#e05252;">missed</span>';
            if (sessionStatus === 'cancelled') return '<span style="color:#e05252;">cancelled</span>';
            return sessionStatus; // scheduled
        };
        // بنعتبر الجلسة "قريبة" لو هيبدأ خلال أقل من 24 ساعة ولسه في انتظارها
        const isSoon = (dateStr, sessionStatus) => {
            if (!['scheduled', 'live'].includes(sessionStatus)) return false;
            const hoursUntil = (new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60);
            return hoursUntil <= 24 && hoursUntil > -1;
        };
        const joinCell = (b) => {
            if (!b.sessionId || !['scheduled', 'live'].includes(b.sessionStatus)) {
                return '<span style="color:#888;">—</span>';
            }
            const label = b.sessionStatus === 'live' ? 'Join (live)' : 'Join';
            return `<a href="session.html?id=${b.sessionId}&from=admin" target="_blank" rel="noopener" class="admin-badge-yes" style="text-decoration:none; padding:6px 14px; border-radius:6px;">${label}</a>`;
        };
        tbody.innerHTML = data.map(b => {
            const soon = isSoon(b.date, b.sessionStatus);
            return `
            <tr${soon ? ' style="background: rgba(216,176,86,0.12);"' : ''}>
                <td>${new Date(b.date).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}${soon ? ' <span style="color:#d8b056; font-size:0.75rem;">● soon</span>' : ''}</td>
                <td>${b.student?.name || '—'}</td>
                <td>${b.student?.email || '—'}</td>
                <td>${b.student?.phone || '—'}</td>
                <td>${b.subject || '—'}</td>
                <td>LE ${Number(b.price).toFixed(2)}</td>
                <td>${statusBadge(b.status)}</td>
                <td>${sessionStatusBadge(b.sessionStatus)}</td>
                <td>${joinCell(b)}</td>
            </tr>
        `;
        }).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="9" style="color:#e05252;">Failed to load sessions: ${err.message}</td></tr>`;
    }
}

// ---------- تاب المستخدمين ----------
async function loadUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '<tr><td colspan="4">Loading...</td></tr>';
    try {
        const { data } = await api.getUsers();
        if (!data.length) {
            tbody.innerHTML = '<tr><td colspan="4">No registered users yet.</td></tr>';
            return;
        }
        tbody.innerHTML = data.map(u => `
            <tr>
                <td>${u.name}</td>
                <td>${u.email}</td>
                <td>${new Date(u.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                <td>${u.orderCount ?? 0}</td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="4" style="color:#e05252;">Failed to load users: ${err.message}</td></tr>`;
    }
}

// ---------- تاب أكواد الخصم ----------
async function loadPromoCodesTable() {
    const tbody = document.getElementById('promoCodesTableBody');
    tbody.innerHTML = '<tr><td colspan="6">Loading...</td></tr>';
    try {
        const { data } = await api.getPromoCodes();
        if (!data.length) {
            tbody.innerHTML = '<tr><td colspan="6">No promo codes yet. Generate one above.</td></tr>';
            return;
        }
        const now = Date.now();
        tbody.innerHTML = data.map(p => {
            const expired = new Date(p.expiresAt).getTime() < now;
            const discountLabel = p.discountType === 'percentage' ? `${p.discountValue}%` : `LE ${p.discountValue}`;
            const usageLabel = p.usageLimit ? `${p.timesUsed} / ${p.usageLimit}` : `${p.timesUsed} / ∞`;
            const perUserLabel = p.perUserLimit ? `${p.perUserLimit}x per person` : 'Unlimited per person';
            let statusLabel;
            if (!p.active) statusLabel = '<span style="color:#e05252;">Deactivated</span>';
            else if (expired) statusLabel = '<span style="color:#e05252;">Expired</span>';
            else statusLabel = '<span class="admin-badge-yes">Active</span>';
            return `
                <tr>
                    <td>
                        <strong style="color:var(--gold-color);">${p.code}</strong>
                        <button class="copy-promo-btn" data-code="${p.code}" title="Copy code" style="background:transparent;border:1px solid rgba(216,176,86,0.4);color:var(--gold-color);border-radius:4px;padding:2px 7px;font-size:0.75rem;cursor:pointer;margin-left:6px;">Copy</button>
                    </td>
                    <td>${discountLabel}</td>
                    <td>${usageLabel}<br><span style="color:var(--text-gray); font-size:0.75rem;">${perUserLabel}</span></td>
                    <td>${new Date(p.expiresAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                    <td>${statusLabel}</td>
                    <td>
                        <div class="admin-row-actions">
                            ${p.active ? `<button class="edit-btn deactivate-promo-btn" data-id="${p._id}">Deactivate</button>` : ''}
                            <button class="delete-btn delete-promo-btn" data-id="${p._id}">Delete</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" style="color:#e05252;">Failed to load promo codes: ${err.message}</td></tr>`;
    }
}

function initAdminPanel() {
    initTabs();
    initAllRangeControllers();
    loadProductsTable();
    loadDashboardStats();
    startOnlinePolling();

    document.getElementById('fieldTrackStock').addEventListener('change', (e) => {
        document.getElementById('stockCountWrap').style.display = e.target.checked ? 'block' : 'none';
    });

    document.getElementById('productForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const errorEl = document.getElementById('formError');
        errorEl.innerText = '';
        const payload = readFormData();

        if (!payload.title || Number.isNaN(payload.price) || !payload.image) {
            errorEl.innerText = 'Please fill in title, price and image path.';
            return;
        }

        try {
            if (editingId) {
                await api.updateProduct(editingId, payload);
            } else {
                await api.createProduct(payload);
            }
            resetForm();
            loadProductsTable();
        } catch (err) {
            errorEl.innerText = err.message || 'Something went wrong.';
        }
    });

    document.getElementById('cancelEditBtn').addEventListener('click', resetForm);

    document.getElementById('productsTableBody').addEventListener('click', async (e) => {
        const editBtn = e.target.closest('.edit-btn');
        const deleteBtn = e.target.closest('.delete-btn');

        if (editBtn) {
            const product = currentProducts.find(p => p._id === editBtn.dataset.id);
            if (product) fillFormForEdit(product);
        }

        if (deleteBtn) {
            const product = currentProducts.find(p => p._id === deleteBtn.dataset.id);
            if (!product) return;
            const confirmed = confirm(`Delete "${product.title}"? This can't be undone.`);
            if (!confirmed) return;
            try {
                await api.deleteProduct(deleteBtn.dataset.id);
                loadProductsTable();
            } catch (err) {
                alert('Failed to delete: ' + err.message);
            }
        }
    });

    // ---- تحديث حالة الشحن (Fulfillment) من جدول الطلبات المفصّل ----
    document.getElementById('detailedOrdersBody').addEventListener('change', async (e) => {
        const select = e.target.closest('.fulfillment-select');
        if (!select) return;
        const orderId = select.dataset.id;
        const newStatus = select.value;
        select.disabled = true;
        try {
            await api.updateOrderFulfillment(orderId, newStatus);
        } catch (err) {
            alert('Failed to update fulfillment status: ' + err.message);
        } finally {
            select.disabled = false;
        }
    });

    document.getElementById('exportOrdersBtn').addEventListener('click', async (e) => {
        const btn = e.target;
        const originalText = btn.innerText;
        btn.innerText = 'Preparing...';
        btn.disabled = true;
        try {
            const { data: orders } = await api.getOrders();
            if (!orders.length) {
                alert('No orders to export yet.');
            } else {
                downloadOrdersCSV(orders);
            }
        } catch (err) {
            alert('Failed to export orders: ' + err.message);
        } finally {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    });

    document.getElementById('exportSessionsBtn').addEventListener('click', async (e) => {
        const btn = e.target;
        const originalText = btn.innerText;
        btn.innerText = 'Preparing...';
        btn.disabled = true;
        try {
            const { data: bookings } = await api.getAllBookings();
            if (!bookings.length) {
                alert('No sessions to export yet.');
            } else {
                downloadSessionsCSV(bookings);
            }
        } catch (err) {
            alert('Failed to export sessions: ' + err.message);
        } finally {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    });

    document.getElementById('exportUsersBtn').addEventListener('click', async (e) => {
        const btn = e.target;
        const originalText = btn.innerText;
        btn.innerText = 'Preparing...';
        btn.disabled = true;
        try {
            const { data: users } = await api.getUsers();
            if (!users.length) {
                alert('No users to export yet.');
            } else {
                downloadUsersCSV(users);
            }
        } catch (err) {
            alert('Failed to export users: ' + err.message);
        } finally {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    });

    // ---- سعر الصرف الاحتياطي (fallback) ----
    api.getSettings().then(({ data }) => {
        const input = document.getElementById('eurToEgpRateInput');
        if (input) input.value = data.eurToEgpRate;
    }).catch((err) => console.error('Failed to load settings:', err));

    document.getElementById('saveRateBtn').addEventListener('click', async (e) => {
        const btn = e.target;
        const msg = document.getElementById('rateSaveMsg');
        const rateVal = parseFloat(document.getElementById('eurToEgpRateInput').value);
        if (!rateVal || rateVal <= 0) {
            msg.innerText = 'Enter a valid rate.';
            return;
        }
        btn.disabled = true;
        try {
            await api.updateSettings({ eurToEgpRate: rateVal });
            msg.style.color = '#34A853';
            msg.innerText = 'Saved.';
            setTimeout(() => { msg.innerText = ''; }, 2500);
        } catch (err) {
            msg.style.color = '#e05252';
            msg.innerText = err.message || 'Failed to save.';
        } finally {
            btn.disabled = false;
        }
    });
    // ---- أكواد الخصم ----
    document.getElementById('promoCodeForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const errorEl = document.getElementById('promoFormError');
        errorEl.innerText = '';
        const submitBtn = document.getElementById('promoSubmitBtn');

        const payload = {
            code: document.getElementById('promoFieldCode').value.trim(),
            discountType: document.getElementById('promoFieldDiscountType').value,
            discountValue: parseFloat(document.getElementById('promoFieldDiscountValue').value),
            usageLimit: document.getElementById('promoFieldUsageLimit').value
                ? parseInt(document.getElementById('promoFieldUsageLimit').value, 10)
                : null,
            perUserLimit: parseInt(document.getElementById('promoFieldPerUserLimit').value, 10) || 1,
            durationAmount: parseInt(document.getElementById('promoFieldDurationAmount').value, 10),
            durationUnit: document.getElementById('promoFieldDurationUnit').value,
        };

        if (!payload.discountValue || payload.discountValue <= 0) {
            errorEl.innerText = 'Please enter a valid discount value.';
            return;
        }
        if (!payload.durationAmount || payload.durationAmount <= 0) {
            errorEl.innerText = 'Please enter a valid duration.';
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerText = 'Generating...';
        try {
            await api.createPromoCode(payload);
            document.getElementById('promoCodeForm').reset();
            document.getElementById('promoFieldDurationAmount').value = 1;
            loadPromoCodesTable();
        } catch (err) {
            errorEl.innerText = err.message || 'Something went wrong.';
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerText = 'Generate Code';
        }
    });

    document.getElementById('promoCodesTableBody').addEventListener('click', async (e) => {
        const deactivateBtn = e.target.closest('.deactivate-promo-btn');
        const deleteBtn = e.target.closest('.delete-promo-btn');
        const copyBtn = e.target.closest('.copy-promo-btn');

        if (copyBtn) {
            const code = copyBtn.dataset.code;
            try {
                await navigator.clipboard.writeText(code);
            } catch (err) {
                // fallback لو clipboard API متاحش (مثلاً http بدل https)
                const tmp = document.createElement('textarea');
                tmp.value = code;
                document.body.appendChild(tmp);
                tmp.select();
                document.execCommand('copy');
                document.body.removeChild(tmp);
            }
            const originalText = copyBtn.innerText;
            copyBtn.innerText = 'Copied!';
            setTimeout(() => { copyBtn.innerText = originalText; }, 1500);
            return;
        }

        if (deactivateBtn) {
            try {
                await api.deactivatePromoCode(deactivateBtn.dataset.id);
                loadPromoCodesTable();
            } catch (err) {
                alert('Failed to deactivate: ' + err.message);
            }
        }

        if (deleteBtn) {
            const confirmed = confirm('Delete this promo code? This can\'t be undone.');
            if (!confirmed) return;
            try {
                await api.deletePromoCode(deleteBtn.dataset.id);
                loadPromoCodesTable();
            } catch (err) {
                alert('Failed to delete: ' + err.message);
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', checkAdminAccess);

// ---------- تاب الأرشيف الشهري: ملخص PDF لكل شهر (مش بيمسح ولا يلمس أي بيانات أصلية) ----------
async function loadArchivesList() {
    const wrap = document.getElementById('archivesListWrap');
    wrap.innerHTML = '<p style="color: var(--text-gray); padding: 16px;">Loading...</p>';
    try {
        const { data: months } = await api.getAvailableMonths();
        if (!months.length) {
            wrap.innerHTML = '<p style="color: var(--text-gray); padding: 16px;">No data yet to build a report from.</p>';
            return;
        }
        wrap.innerHTML = months.map((m) => `
            <div style="display:flex; align-items:center; justify-content:space-between; padding: 14px 16px; border-bottom: 1px solid rgba(216,176,86,0.12);">
                <span style="color:#f2f2f2;">${m.label}</span>
                <button type="button" class="archive-download-btn" data-year="${m.year}" data-month="${m.month}" data-label="${m.label}" style="background: transparent; border: 1px solid var(--gold-color); color: var(--gold-color); padding: 6px 16px; border-radius: 6px; cursor: pointer; font-size: 0.85rem;">Download PDF</button>
            </div>
        `).join('');

        wrap.querySelectorAll('.archive-download-btn').forEach((btn) => {
            btn.addEventListener('click', () => downloadMonthlyArchive(btn));
        });
    } catch (err) {
        wrap.innerHTML = `<p style="color:#e05252; padding: 16px;">Failed to load: ${err.message}</p>`;
    }
}

async function downloadMonthlyArchive(btn) {
    const { year, month } = btn.dataset;
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Building...';
    try {
        const { data } = await api.getMonthlyReportData(year, month);
        await buildArchivePdf(data);
    } catch (err) {
        alert('Failed to build report: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

// بيرسم شارت على canvas مخفي مؤقت، ويرجّعه كـ صورة عشان نحطها جوه الـ PDF
async function renderChartToImage(config, width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.style.position = 'fixed';
    canvas.style.left = '-9999px';
    document.body.appendChild(canvas);
    const chart = new Chart(canvas, config);
    await new Promise((resolve) => setTimeout(resolve, 300)); // نستنى الرسم يخلص قبل ما ناخد الصورة
    const imgData = canvas.toDataURL('image/png', 1.0);
    chart.destroy();
    canvas.remove();
    return imgData;
}

async function buildArchivePdf(data) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const gold = [216, 176, 86];
    let y = 50;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(...gold);
    doc.text('The Sun Book', 40, y);
    y += 24;
    doc.setFontSize(14);
    doc.setTextColor(40, 40, 40);
    doc.setFont('helvetica', 'normal');
    doc.text(`Monthly Report — ${data.label}`, 40, y);
    y += 30;

    doc.setFontSize(11);
    const summaryLines = [
        `Store revenue: LE ${Number(data.orders.totalRevenue).toFixed(2)}  (${data.orders.totalOrders} orders)`,
        `Sessions revenue: LE ${Number(data.bookings.totalRevenue).toFixed(2)}  (${data.bookings.totalBookings} bookings)`,
        `New users this month: ${data.newUsers}`,
    ];
    summaryLines.forEach((line) => {
        doc.text(line, 40, y);
        y += 18;
    });
    y += 12;

    const chartColors = ['#d8b056', '#4caf50', '#e05252', '#5a8dee', '#888888'];
    let chartsBottom = y;

    if (data.orders.byStatus.length) {
        const chartImg = await renderChartToImage({
            type: 'pie',
            data: {
                labels: data.orders.byStatus.map((s) => s.status),
                datasets: [{ data: data.orders.byStatus.map((s) => s.count), backgroundColor: chartColors }],
            },
            options: { responsive: false, animation: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } } },
        }, 460, 320);
        doc.setFontSize(12);
        doc.setTextColor(...gold);
        doc.text('Orders by status', 40, y);
        doc.addImage(chartImg, 'PNG', 40, y + 8, 230, 160);
        chartsBottom = Math.max(chartsBottom, y + 8 + 160);
    }

    if (data.bookings.byStatus.length) {
        const chartImg2 = await renderChartToImage({
            type: 'pie',
            data: {
                labels: data.bookings.byStatus.map((s) => s.status),
                datasets: [{ data: data.bookings.byStatus.map((s) => s.count), backgroundColor: chartColors }],
            },
            options: { responsive: false, animation: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } } },
        }, 460, 320);
        doc.setFontSize(12);
        doc.setTextColor(...gold);
        doc.text('Bookings by status', pageWidth / 2 + 10, y);
        doc.addImage(chartImg2, 'PNG', pageWidth / 2 + 10, y + 8, 230, 160);
        chartsBottom = Math.max(chartsBottom, y + 8 + 160);
    }
    y = chartsBottom + 24;

    if (data.topProducts.length) {
        doc.setFontSize(12);
        doc.setTextColor(...gold);
        doc.text('Top products', 40, y);
        y += 18;
        doc.setFontSize(10);
        doc.setTextColor(40, 40, 40);
        data.topProducts.forEach((p) => {
            doc.text(`${p.title} — ${p.quantitySold} sold — LE ${Number(p.revenue).toFixed(2)}`, 50, y);
            y += 16;
        });
    }

    doc.save(`sunbook-report-${data.year}-${String(data.month).padStart(2, '0')}.pdf`);
}

// ---------- تاب المحتوى: النصوص القابلة للتعديل بالعربي والإنجليزي ----------
const groupDisplayNames = {
    about: 'About Page',
    faq: 'FAQ Page',
    policies: 'Policies Page',
    bookingDetails: 'Booking Details Page',
};

async function loadSiteContentTab() {
    const wrap = document.getElementById('siteContentGroups');
    wrap.innerHTML = '<p style="color: var(--text-gray); padding: 16px;">Loading...</p>';

    try {
        const { data } = await api.getSiteContent();

        // نجمّع كل النصوص حسب القسم بتاعها (about / faq / policies / bookingDetails)
        const groups = {};
        data.forEach((item) => {
            if (!groups[item.group]) groups[item.group] = [];
            groups[item.group].push(item);
        });

        let html = '';
        Object.keys(groups).forEach((groupKey) => {
            const groupLabel = groupDisplayNames[groupKey] || groupKey;
            html += `<details class="site-content-group"><summary>${groupLabel} (${groups[groupKey].length})</summary>`;
            groups[groupKey].forEach((item) => {
                html += `
                <div class="site-content-item">
                    <label>${item.label}</label>
                    <div class="site-content-item-fields">
                        <textarea data-key="${item.key}" data-lang="en" dir="ltr" placeholder="English">${escapeHtmlForTextarea(item.en)}</textarea>
                        <textarea data-key="${item.key}" data-lang="ar" dir="rtl" placeholder="عربي">${escapeHtmlForTextarea(item.ar)}</textarea>
                    </div>
                </div>`;
            });
            html += `</details>`;
        });

        wrap.innerHTML = html || '<p style="color: var(--text-gray); padding: 16px;">No content items found.</p>';
    } catch (err) {
        wrap.innerHTML = `<p style="color: #ff4d4d; padding: 16px;">Failed to load content: ${err.message}</p>`;
    }
}

// بنحول أي علامات < > جوه النص لصيغتها الآمنة عشان نعرضها جوه textarea
// من غير ما تتفسر كتاج HTML حقيقي (النص ممكن يحتوي على <strong> مقصودة كنص)
function escapeHtmlForTextarea(str) {
    return (str || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

document.getElementById('siteContentSaveBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('siteContentSaveBtn');
    const msgEl = document.getElementById('siteContentMsg');
    const textareas = document.querySelectorAll('#siteContentGroups textarea[data-key]');

    // بنجمّع كل textarea (إنجليزي وعربي) في عنصر واحد لكل key
    const itemsByKey = {};
    textareas.forEach((ta) => {
        const key = ta.dataset.key;
        const lang = ta.dataset.lang;
        if (!itemsByKey[key]) itemsByKey[key] = { key };
        // بنرجّع &lt; &gt; لعلامات < > الحقيقية قبل ما نبعتها للسيرفر
        itemsByKey[key][lang] = ta.value.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    });

    const items = Object.values(itemsByKey);

    btn.disabled = true;
    btn.innerText = 'Saving...';
    msgEl.style.color = '';
    msgEl.innerText = '';

    try {
        await api.updateSiteContent(items);
        msgEl.style.color = '#34A853';
        msgEl.innerText = 'Saved successfully!';
    } catch (err) {
        msgEl.style.color = '#ff4d4d';
        msgEl.innerText = err.message || 'Failed to save changes.';
    } finally {
        btn.disabled = false;
        btn.innerText = 'Save All Changes';
    }
});
