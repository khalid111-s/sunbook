
// =========================================
// تسجيل الزيارات: بيشتغل على كل صفحة، وبيبعت "نبضة" صغيرة للباك اند
// عشان نعرف عدد الزوار وبلادهم في لوحة تحكم الأدمن
// =========================================
function getOrCreateVisitorId() {
    let id = localStorage.getItem('sunbook_visitor_id');
    if (!id) {
        id = 'v_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
        localStorage.setItem('sunbook_visitor_id', id);
    }
    return id;
}

function classifyReferrer() {
    const ref = document.referrer;
    if (!ref) return 'direct';
    try {
        const host = new URL(ref).hostname.replace('www.', '');
        if (host.includes('google.')) return 'google';
        if (host.includes('facebook.') || host.includes('fb.com')) return 'facebook';
        if (host.includes('instagram.')) return 'instagram';
        if (host.includes('tiktok.')) return 'tiktok';
        if (host.includes('twitter.') || host.includes('x.com')) return 'twitter/x';
        if (host.includes(window.location.hostname)) return 'direct'; // تنقل داخل الموقع نفسه
        return host;
    } catch (e) {
        return 'direct';
    }
}

function logPageVisit() {
    if (typeof api === 'undefined') return; // الصفحة دي مش محملة فيها api.js
    const visitorId = getOrCreateVisitorId();
    api.logVisit({
        path: window.location.pathname,
        visitorId,
        referrer: classifyReferrer(),
    }).catch(() => {
        // مش مشكلة لو فشل - التسجيل مش لازم يعطل أي حاجة في الموقع
    });
}

document.addEventListener('DOMContentLoaded', logPageVisit);

// نبضة كل 25 ثانية عشان لوحة تحكم الأدمن تعرف مين موجود فعليًا على الموقع دلوقتي
function startHeartbeat() {
    if (typeof api === 'undefined') return;
    const send = () => {
        api.sendHeartbeat({
            visitorId: getOrCreateVisitorId(),
            path: window.location.pathname,
        }).catch(() => {});
    };
    send();
    setInterval(send, 25000);
}
document.addEventListener('DOMContentLoaded', startHeartbeat);

// =========================================
// المنتجات: بتتحمّل من الباك اند (Mongo) بدل ما تكون ثابتة في الكود
// =========================================
let productsData = [];

// العملة اللي هتتعرض للزائر: EGP لو من مصر، EUR لو من أي بلد تاني
// (بتتحدد مرة واحدة وقت تحميل الصفحة، وبتتخزن لباقي الصفحات في نفس الجلسة)
let visitorCurrency = 'EGP';

async function detectVisitorCurrency() {
    const cached = sessionStorage.getItem('sunbook_currency');
    if (cached === 'EGP' || cached === 'EUR') {
        visitorCurrency = cached;
        return visitorCurrency;
    }
    if (typeof api === 'undefined') return visitorCurrency;
    try {
        const { data } = await api.getMyCountry();
        visitorCurrency = data.country === 'EG' ? 'EGP' : 'EUR';
    } catch (e) {
        visitorCurrency = 'EGP'; // افتراضي آمن لو فشل الكشف (زي وقت التطوير المحلي)
    }
    sessionStorage.setItem('sunbook_currency', visitorCurrency);
    return visitorCurrency;
}

function formatPrice(n) {
    return `LE ${Number(n).toFixed(2)}`;
}

function formatPriceEUR(n) {
    return `€${Number(n).toFixed(2)}`;
}

// بيختار السعر المناسب حسب عملة الزائر - لو مفيش سعر يورو متسجل، بيرجع للجنيه كافتراضي آمن
function displayPriceFor(priceEGP, priceEUR) {
    if (visitorCurrency === 'EUR' && priceEUR != null && priceEUR > 0) {
        return formatPriceEUR(priceEUR);
    }
    return formatPrice(priceEGP);
}

// بيحوّل شكل المنتج الجاي من الـ API لنفس الشكل اللي باقي الكود متعود عليه
function normalizeProduct(p) {
    // لو trackStock مفعّل، التوفر بيتحدد فعليًا بعدد النسخ المتبقية؛ غير كده بنعتمد على inStock اليدوي
    const available = p.trackStock ? (p.stockCount > 0) : (p.inStock !== false);
    return {
        id: p._id,
        title: p.title,
        price: displayPriceFor(p.price, p.priceEUR),
        image: p.image,
        description: p.description,
        type: p.type,
        badges: p.badges || [],
        featured: !!p.featured,
        egyptOnly: !!p.egyptOnly,
        available,
    };
}

const urlParams = new URLSearchParams(window.location.search);
const productId = urlParams.get('id');

function renderProductNotFound() {
    const titleEl = document.getElementById('product-title');
    const descEl = document.getElementById('product-desc');
    const priceEl = document.getElementById('product-price');
    const tr = (key, fallback) => (window.SunBookI18n ? window.SunBookI18n.t(key) : fallback);
    if (titleEl) titleEl.innerText = tr('product.notFound', 'Product Not Found');
    if (descEl) descEl.innerText = tr('product.notFoundDesc', 'This book is no longer available.');
    if (priceEl) priceEl.innerText = '';
}

// كود صفحة المنتج (product.html): بيجيب المنتج الواحد مباشرة من الـ API
async function loadSingleProductPage() {
    if (!productId) return;
    const titleEl = document.getElementById('product-title');
    const priceEl = document.getElementById('product-price');
    const descEl = document.getElementById('product-desc');
    const imgEl = document.getElementById('main-product-img');

    try {
        const { data: product } = await api.getProduct(productId);
        if (!product) {
            renderProductNotFound();
            return;
        }
        const normalized = normalizeProduct(product);
        if (imgEl) imgEl.src = normalized.image;
        if (titleEl) titleEl.innerText = normalized.title;
        if (priceEl) priceEl.innerText = normalized.price;
        if (descEl) descEl.innerText = normalized.description;

        // معاينة الغلاف (لايت بوكس): نحدث الصورة اللي هتتفتح
        const lightboxImgEl = document.getElementById('lightbox-img');
        if (lightboxImgEl) lightboxImgEl.src = normalized.image;

        // مزامنة شريط الشراء الثابت (موبايل) مع السعر
        const mobileBuyBarPriceEl = document.getElementById('mobileBuyBarPrice');
        if (mobileBuyBarPriceEl) mobileBuyBarPriceEl.innerText = normalized.price;
        const mobileBuyBarEl = document.getElementById('mobileBuyBar');
        if (mobileBuyBarEl) mobileBuyBarEl.hidden = false;

        const badgesEl = document.getElementById('product-badges');
        if (badgesEl) {
            badgesEl.innerHTML = (normalized.badges || [])
                .map(b => `<span class="badge">${b}</span>`)
                .join('');
        }

        // شريط "متاح في مصر فقط" - بيتحط في عمود التفاصيل بدل ما يغطي صورة الغلاف
        const egyptBannerEl = document.getElementById('productEgyptBanner');
        if (egyptBannerEl) egyptBannerEl.hidden = !normalized.egyptOnly;

        const galleryEl = document.querySelector('.product-gallery');
        if (galleryEl) {
            const existingOverlay = galleryEl.querySelector('.out-of-stock-overlay');
            if (existingOverlay) existingOverlay.remove();
            if (normalized.available === false) {
                const overlay = document.createElement('div');
                overlay.className = 'out-of-stock-overlay';
                overlay.innerText = window.SunBookI18n ? window.SunBookI18n.t('product.outOfStock') : 'Out of Stock';
                galleryEl.prepend(overlay);
            }
        }

        const addToCartLargeEl = document.querySelector('.add-to-cart-large');
        const mobileBuyBarBtnEl = document.getElementById('mobileBuyBarBtn');
        if (addToCartLargeEl) {
            if (normalized.available === false) {
                const outOfStockLabel = window.SunBookI18n ? window.SunBookI18n.t('product.outOfStock') : 'Out of Stock';
                addToCartLargeEl.disabled = true;
                addToCartLargeEl.innerText = outOfStockLabel;
                addToCartLargeEl.style.opacity = '0.5';
                addToCartLargeEl.style.cursor = 'not-allowed';
                if (mobileBuyBarBtnEl) {
                    mobileBuyBarBtnEl.disabled = true;
                    mobileBuyBarBtnEl.innerText = outOfStockLabel;
                    mobileBuyBarBtnEl.style.opacity = '0.5';
                    mobileBuyBarBtnEl.style.cursor = 'not-allowed';
                }
            } else {
                addToCartLargeEl.disabled = false;
            }
        }

        // نحدّث الكاش المحلي كمان عشان زرار "Add to Cart" يلاقي المنتج
        const existingIndex = productsData.findIndex(item => item.id == normalized.id);
        if (existingIndex >= 0) productsData[existingIndex] = normalized;
        else productsData.push(normalized);
    } catch (err) {
        console.error('Failed to load product:', err);
        renderProductNotFound();
    }
}

// عرض كارت منتج واحد (نفس الـ HTML structure المستخدم أصلاً في index.html)
function productCardHTML(product) {
    const tr = (key, fallback) => (window.SunBookI18n ? window.SunBookI18n.t(key) : fallback);
    const badgesHTML = (product.badges || [])
        .map(b => `<span class="badge">${b}</span>`)
        .join('');
    const egyptStripHTML = product.egyptOnly
        ? `<div class="egypt-only-strip">${tr('product.egyptOnly', 'Egypt Only')}</div>`
        : '';
    const outOfStock = product.available === false;
    const outOfStockLabel = tr('product.outOfStock', 'Out of Stock');
    const outOfStockOverlay = outOfStock ? `<div class="out-of-stock-overlay">${outOfStockLabel}</div>` : '';
    const addToCartBtn = outOfStock
        ? `<button class="add-to-cart-new add-to-cart" disabled style="opacity:0.5; cursor:not-allowed;">${outOfStockLabel}</button>`
        : `<button class="add-to-cart-new add-to-cart" data-id="${product.id}" data-title="${product.title.replace(/"/g, '&quot;')}">${tr('product.addToCart', 'Add to cart')}</button>`;
    // ملحوظة: عنوان الكتاب ووصفه بييجوا زي ما هما مسجلين في قاعدة البيانات (إنجليزي)
    // ومبيتترجموش تلقائيًا، بالظبط زي عناوين الكتب في أي متجر عالمي كبير
    return `
        <div class="product-card">
            <div class="card-image-wrapper">
                ${egyptStripHTML}
                ${outOfStockOverlay}
                <a href="product.html?id=${product.id}">
                    <img src="${product.image}" alt="${product.title}" class="card-img" loading="lazy">
                </a>
            </div>
            <div class="card-info-wrapper">
                <a href="product.html?id=${product.id}" style="text-decoration: none;">
                    <h3 class="card-title">${product.title}</h3>
                </a>
                <div class="card-badges">${badgesHTML}</div>
                <p class="card-desc">${product.description}</p>
                <div class="card-bottom">
                    <div class="price-block">
                        <span class="price-label">${tr('product.price', 'PRICE')}</span>
                        <span class="price-amount">${product.price}</span>
                    </div>
                    ${addToCartBtn}
                </div>
            </div>
        </div>
    `;
}

function cardsSkeletonHTML(count) {
    let html = '';
    for (let i = 0; i < count; i++) {
        html += `
            <div class="product-card">
                <div class="skeleton skeleton-img" style="height: 220px;"></div>
                <div class="card-info-wrapper">
                    <div class="skeleton skeleton-title"></div>
                    <div class="skeleton skeleton-text" style="width: 60%;"></div>
                    <div class="skeleton skeleton-text" style="width: 30%;"></div>
                </div>
            </div>
        `;
    }
    return html;
}

// نربط زراير "Add to cart" جوه grid معين باستخدام event delegation
// (أسهل وأضمن من ما نلف على كل كارت لوحده، خصوصًا إن الكروت بتتحقن ديناميكيًا)
function bindAddToCartDelegation(container) {
    if (!container || container.dataset.cartBound === 'true') return;
    container.dataset.cartBound = 'true';
    container.addEventListener('click', (e) => {
        const btn = e.target.closest('.add-to-cart');
        if (!btn || !container.contains(btn)) return;
        const id = btn.dataset.id;
        if (id) addToCart(id, 1);

        // تسجيل النقرة عشان "تحليل النقرات" في لوحة الأدمن
        if (typeof api !== 'undefined') {
            api.logEvent({
                label: 'add_to_cart',
                targetTitle: btn.dataset.title || '',
                visitorId: getOrCreateVisitorId(),
            }).catch(() => {});
        }
    });
}

// كود الصفحة الرئيسية (index.html): بيرندر Best Offers و All Products من الـ API
let allProductsFetched = false; // بيتحول true بس لما نجيب الكتالوج الكامل من /api/products (مش منتج واحد)

function trHome(key, fallback) {
    return window.SunBookI18n ? window.SunBookI18n.t(key) : fallback;
}

// بيعيد رسم الكروت من الداتا المتخزنة (من غير ما نعمل fetch تاني) - مستخدمة أول تحميل وبعد تبديل اللغة
function renderHomepageProductGrids() {
    const bestOffersGrid = document.getElementById('best-offers-grid');
    const allProductsGrid = document.getElementById('all-products-grid');
    if (!bestOffersGrid && !allProductsGrid) return;
    if (!allProductsFetched) return;

    const featured = productsData.filter(p => p.featured);
    if (bestOffersGrid) {
        bestOffersGrid.innerHTML = featured.length ? featured.map(productCardHTML).join('') : `<p>${trHome('product.noOffers', 'No offers right now.')}</p>`;
        bindAddToCartDelegation(bestOffersGrid);
    }
    if (allProductsGrid) {
        allProductsGrid.innerHTML = productsData.length ? productsData.map(productCardHTML).join('') : `<p>${trHome('product.noProducts', 'No products yet.')}</p>`;
        bindAddToCartDelegation(allProductsGrid);
    }
}

async function loadHomepageProducts() {
    const bestOffersGrid = document.getElementById('best-offers-grid');
    const allProductsGrid = document.getElementById('all-products-grid');
    if (!bestOffersGrid && !allProductsGrid) return;

    if (bestOffersGrid) bestOffersGrid.innerHTML = cardsSkeletonHTML(2);
    if (allProductsGrid) allProductsGrid.innerHTML = cardsSkeletonHTML(6);

    try {
        const { data } = await api.getProducts();
        productsData = data.map(normalizeProduct);
        allProductsFetched = true;
        renderHomepageProductGrids();
    } catch (err) {
        console.error('Failed to load products:', err);
        const errorMsg = `<p>${trHome('product.loadError', 'Could not load products. Please refresh the page.')}</p>`;
        if (bestOffersGrid) bestOffersGrid.innerHTML = errorMsg;
        if (allProductsGrid) allProductsGrid.innerHTML = errorMsg;
    }
}

// لما اللغة تتبدل، نعيد رسم كروت المنتجات (المايكروكوبي بس - العنوان والوصف فاضلين زي ما هما)
// وأي حاجة تانية محتاجة تتحدث فورًا من غير ما نستنى إعادة تحميل الصفحة
document.addEventListener('sunbook:langChanged', () => {
    renderHomepageProductGrids();
});

// قسم "كتب تانية ممكن تعجبك" في صفحة المنتج: بيعرض منتجات تانية غير المنتج الحالي
// عشان الزائر يكمّل يتصفح بدل ما يقفل الصفحة بعد ما يشوف كتاب مش عاجبه أو خلص قراءته
function loadRelatedProducts() {
    const section = document.getElementById('relatedProductsSection');
    const grid = document.getElementById('related-products-grid');
    if (!section || !grid || !productId) return;

    const candidates = productsData.filter(p => String(p.id) !== String(productId));
    if (!candidates.length) {
        section.hidden = true;
        return;
    }

    // بنخلط الترتيب عشان الاقتراحات تتنوع بين زيارة وزيارة بدل ما تفضل ثابتة
    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    const picks = shuffled.slice(0, 8);

    grid.innerHTML = picks.map(productCardHTML).join('');
    bindAddToCartDelegation(grid);
    section.hidden = false;

    initRelatedProductsCarousel();
}

// بيربط سهمي التنقل (يمين/شمال) بسكرول أفقي سلس داخل الكاروسيل، وبيعطّل السهم
// المناسب لما نوصل لأول أو آخر الصف عشان الزائر يعرف إنه وصل للنهاية
function initRelatedProductsCarousel() {
    const track = document.getElementById('related-products-grid');
    const prevBtn = document.getElementById('relatedPrevBtn');
    const nextBtn = document.getElementById('relatedNextBtn');
    if (!track || !prevBtn || !nextBtn) return;

    const scrollAmount = () => {
        const card = track.querySelector('.product-card');
        const cardWidth = card ? card.getBoundingClientRect().width : 240;
        const gap = parseFloat(getComputedStyle(track).gap) || 20;
        return cardWidth + gap;
    };

    const updateArrowState = () => {
        const maxScroll = track.scrollWidth - track.clientWidth - 2; // هامش بسيط لتفادي أخطاء التقريب
        prevBtn.disabled = track.scrollLeft <= 0;
        nextBtn.disabled = track.scrollLeft >= maxScroll;
    };

    // منربطش الأحداث أكتر من مرة لو الدالة اتنادت أكتر من مرة (مثلاً بعد فلترة تانية)
    if (!prevBtn.dataset.carouselBound) {
        prevBtn.dataset.carouselBound = 'true';
        prevBtn.addEventListener('click', () => {
            track.scrollBy({ left: -scrollAmount(), behavior: 'smooth' });
        });
    }
    if (!nextBtn.dataset.carouselBound) {
        nextBtn.dataset.carouselBound = 'true';
        nextBtn.addEventListener('click', () => {
            track.scrollBy({ left: scrollAmount(), behavior: 'smooth' });
        });
    }
    if (!track.dataset.carouselBound) {
        track.dataset.carouselBound = 'true';
        track.addEventListener('scroll', updateArrowState);
        window.addEventListener('resize', updateArrowState);
    }

    updateArrowState();
}

// كل الصفحات (بما فيها product.html) محتاجة تعرف قائمة المنتجات كاملة عشان السيرش شغال
// وعشان قسم "كتب تانية ممكن تعجبك" في صفحة المنتج. بنعتمد على allProductsFetched مش على طول
// productsData، لأن loadSingleProductPage() بيكون حط فيها المنتج الحالي بس قبل ما نوصل هنا.
async function ensureProductsLoaded() {
    if (allProductsFetched) return;
    try {
        const { data } = await api.getProducts();
        productsData = data.map(normalizeProduct);
        allProductsFetched = true;
    } catch (err) {
        console.error('Failed to preload products for search:', err);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await detectVisitorCurrency();
    await loadHomepageProducts();
    await loadSingleProductPage();
    await ensureProductsLoaded();
    if (typeof productId !== 'undefined' && productId) {
        loadProductReviews();
        loadRelatedProducts();
    }
});

// =========================================
// نظام سلة المشتريات
// =========================================
let cartItems = JSON.parse(localStorage.getItem('sunbook_cart')) || [];

// ====== كود الخصم: تخزين محلي بسيط عشان يفضل متطبق من السلة لحد صفحة الدفع ======
const PROMO_STORAGE_KEY = 'sunbook_promo';

function getStoredPromo() {
    try {
        const raw = localStorage.getItem(PROMO_STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

function setStoredPromo(promo) {
    if (promo) localStorage.setItem(PROMO_STORAGE_KEY, JSON.stringify(promo));
    else localStorage.removeItem(PROMO_STORAGE_KEY);
}

function renderCart() {
    const container = document.getElementById('cart-container');
    if (!container) return;

    // تأثير التحميل الوهمي (Skeleton) - بيظهر مرة واحدة بس أول ما الصفحة تفتح
    container.innerHTML = `
        <div class="cart-item" style="border-color: transparent;">
            <div class="skeleton skeleton-img"></div>
            <div class="cart-item-info" style="flex: 1;">
                <div class="skeleton skeleton-title"></div>
                <div class="skeleton skeleton-text" style="width: 40%;"></div>
                <div class="skeleton skeleton-text" style="width: 20%;"></div>
            </div>
        </div>
        <div class="cart-item" style="border-color: transparent;">
            <div class="skeleton skeleton-img"></div>
            <div class="cart-item-info" style="flex: 1;">
                <div class="skeleton skeleton-title"></div>
                <div class="skeleton skeleton-text" style="width: 40%;"></div>
                <div class="skeleton skeleton-text" style="width: 20%;"></div>
            </div>
        </div>
    `;

    // بعد شوية وهمية بسيطة (مظهر بس)، نعرض محتوى السلة الحقيقي
    setTimeout(() => {
        renderCartItemsNow();
    }, 600);
}

// العرض الفعلي لمحتوى السلة - فوري من غير أي تأخير ولا Skeleton،
// بيتنادى بعد كل تعديل (زيادة/تقليل كمية أو حذف منتج) عشان يبقى سلس
function renderCartItemsNow() {
    const container = document.getElementById('cart-container');
    const summaryBox = document.querySelector('.cart-summary');
    if (!container) return;

    container.innerHTML = ''; // نفضي أي محتوى قديم

    if (cartItems.length === 0) {
        if (summaryBox) summaryBox.style.display = 'none';
        container.innerHTML = `
            <div class="cart-empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--gold-color)" stroke-width="2" class="cart-empty-icon">
                    <circle cx="9" cy="21" r="1"></circle>
                    <circle cx="20" cy="21" r="1"></circle>
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                </svg>
                <h2 class="cart-empty-title">Your cart is empty</h2>
                <p class="cart-empty-text">Looks like you haven't added any books yet. Explore our collection of ancient wisdom and find your next great read.</p>
                <a href="index.html#all-products" class="btn-shop cart-empty-btn">Browse Books</a>
            </div>
        `;
        updateOrderSummary(0);
        return;
    }

    if (summaryBox) summaryBox.style.display = 'block';

    let totalPrice = 0;
    cartItems.forEach((item, index) => {
        const itemHTML = `
            <div class="cart-item reveal active">
                <img src="${item.image}" alt="Book" class="cart-item-img">
                <div class="cart-item-info">
                    <h3 class="cart-item-title">${item.title}</h3>
                    <span style="font-size: 0.75rem; color: ${item.type === 'digital' ? '#34A853' : item.type === 'booking' ? '#d8b056' : 'var(--gold-color)'}; border: 1px solid ${item.type === 'digital' ? '#34A853' : item.type === 'booking' ? '#d8b056' : 'var(--gold-color)'}; padding: 2px 8px; border-radius: 4px; display: inline-block; margin-top: 5px;">${item.type === 'digital' ? 'Digital (PDF)' : item.type === 'booking' ? 'Session' : 'Physical Book'}</span>
                </div>
                <div class="cart-item-actions">
                    <p class="cart-item-price">${item.price}</p>
                    ${item.type === 'booking' 
                        ? `` 
                        : `<div class="modern-qty">
                            <button class="qty-btn minus-btn" onclick="updateQty(${index}, -1)">−</button>
                            <input type="number" value="${item.qty}" class="qty-input-val" readonly>
                            <button class="qty-btn plus-btn" onclick="updateQty(${index}, 1)">+</button>
                           </div>`
                    }
                    <button class="remove-btn" onclick="removeItem(${index})">🗑️ Remove</button>
                </div>
            </div>
        `;
        container.innerHTML += itemHTML;
        const priceNumber = parseFloat(item.price.replace(/[^0-9.]/g, ''));
        totalPrice += (priceNumber * item.qty);
    });

    updateOrderSummary(totalPrice);
}

function updateOrderSummary(total) {
    const summaryBox = document.querySelector('.cart-summary');
    if (!summaryBox) return;

    const loggedInUser = localStorage.getItem('sunbook_username');
    let finalTotal = total;
    let discount = 0;

    if (loggedInUser && total > 0) {
        discount = total * 0.05;
        finalTotal = total - discount;
    }

    // ---- كود الخصم (لو المستخدم طبّق واحد قبل كده) ----
    const storedPromo = getStoredPromo();
    let promoDiscount = 0;
    if (storedPromo && total > 0) {
        promoDiscount = storedPromo.discountType === 'percentage'
            ? finalTotal * (storedPromo.discountValue / 100)
            : Math.min(storedPromo.discountValue, finalTotal);
        finalTotal = Math.max(0, finalTotal - promoDiscount);
    }

    let summaryHTML = `
        <h3 class="summary-title">Order Summary</h3>
        <div class="summary-row">
            <span>Subtotal</span>
            <span>LE ${total.toFixed(2)}</span>
        </div>
    `;

    if (discount > 0) {
        summaryHTML += `
        <div class="summary-row" style="color: var(--gold-color); font-weight: bold;">
            <span>Member Discount (5%)</span>
            <span>-LE ${discount.toFixed(2)}</span>
        </div>
        `;
    }

    if (storedPromo && promoDiscount > 0) {
        summaryHTML += `
        <div class="summary-row" style="color: #34A853; font-weight: bold;">
            <span>Promo "${storedPromo.code}" <a href="#" id="removePromoLink" style="color: var(--text-gray); font-weight: normal; text-decoration: underline; font-size: 0.75rem;">(remove)</a></span>
            <span>-LE ${promoDiscount.toFixed(2)}</span>
        </div>
        `;
    }

    summaryHTML += `
        <div class="promo-code-container">
            <input type="text" placeholder="Enter code" class="promo-input" id="cartPromoInput" ${storedPromo ? 'disabled' : ''} value="${storedPromo ? storedPromo.code : ''}">
            <button class="apply-btn" id="cartApplyPromoBtn" ${storedPromo ? 'disabled' : ''}>${storedPromo ? 'Applied' : 'Apply'}</button>
        </div>
        <p id="cartPromoMsg" style="font-size: 0.8rem; margin: -8px 0 12px; min-height: 14px;"></p>
        <hr class="summary-divider">
        <div class="summary-row total-row">
            <span>Total</span>
            <span>LE ${finalTotal.toFixed(2)}</span>
        </div>
        <a href="checkout.html" class="btn-shop checkout-btn" style="text-align: center; text-decoration: none; display: block;" id="mainCheckoutBtn">Proceed to Checkout</a>
    `;

    summaryBox.innerHTML = summaryHTML;
    attachCheckoutEvent(finalTotal);
    attachPromoEvents(total);
}

// بيربط زرار "Apply" ولينك "remove" في صفحة السلة بمنطق التحقق من كود الخصم
function attachPromoEvents(rawTotal) {
    const applyBtn = document.getElementById('cartApplyPromoBtn');
    const promoInput = document.getElementById('cartPromoInput');
    const promoMsg = document.getElementById('cartPromoMsg');
    const removeLink = document.getElementById('removePromoLink');

    if (applyBtn && promoInput && !getStoredPromo()) {
        applyBtn.addEventListener('click', async () => {
            const code = promoInput.value.trim();
            if (!code) {
                if (promoMsg) { promoMsg.style.color = '#e05252'; promoMsg.innerText = 'Please enter a code.'; }
                return;
            }
            applyBtn.disabled = true;
            applyBtn.innerText = 'Checking...';
            try {
                const { data } = await api.validatePromoCode(code);
                setStoredPromo(data);
                renderCartItemsNow();
            } catch (err) {
                if (promoMsg) { promoMsg.style.color = '#e05252'; promoMsg.innerText = err.message || 'Invalid promo code.'; }
                applyBtn.disabled = false;
                applyBtn.innerText = 'Apply';
            }
        });
    }

    if (removeLink) {
        removeLink.addEventListener('click', (e) => {
            e.preventDefault();
            setStoredPromo(null);
            renderCartItemsNow();
        });
    }
}

function updateQty(index, change) {
    if (cartItems[index].qty + change > 0) {
        cartItems[index].qty += change;
        localStorage.setItem('sunbook_cart', JSON.stringify(cartItems));
        renderCartItemsNow();
        updateCartBadge();
    }
}

function removeItem(index) {
    cartItems.splice(index, 1);
    localStorage.setItem('sunbook_cart', JSON.stringify(cartItems));
    renderCartItemsNow();
    updateCartBadge();
}

function updateCartBadge() {
    const badges = document.querySelectorAll('.cart-badge');
    const totalQty = cartItems.reduce((sum, item) => sum + item.qty, 0);
    badges.forEach(badge => badge.innerText = totalQty);
}

function showToast(message, type = 'success') {
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.className = 'custom-toast';

    let iconHTML = '';
    if (type === 'error') {
        toast.classList.add('error-toast');
        iconHTML = `<svg class="animated-check" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
    } else {
        iconHTML = `<svg class="animated-check" viewBox="0 0 24 24"><path d="M4 12l5 5L20 7"></path></svg>`;
    }

    toast.innerHTML = `${iconHTML}<span style="font-weight: 600; font-size: 1.1rem; letter-spacing: 0.5px;">${message}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 6000);
}

function addToCart(id, qty = 1) {
    const product = productsData.find(item => item.id == id);
    if (!product) return;

    const existingItem = cartItems.find(item => item.id == id);
    if (existingItem) {
        existingItem.qty += qty;
    } else {
        cartItems.push({ ...product, qty: qty });
    }

    localStorage.setItem('sunbook_cart', JSON.stringify(cartItems));
    updateCartBadge();
    showToast(window.SunBookI18n ? window.SunBookI18n.t('product.addedToCart') : 'Product successfully added to cart!');
}

// تفعيل زراير الكمية في صفحة المنتج
const productPageQty = document.querySelector('.single-product-section .modern-qty');
if (productPageQty) {
    const minusBtn = productPageQty.querySelector('.minus-btn');
    const plusBtn = productPageQty.querySelector('.plus-btn');
    const inputVal = productPageQty.querySelector('.qty-input-val');
    if (minusBtn && inputVal) {
        minusBtn.addEventListener('click', () => {
            let currentVal = parseInt(inputVal.value) || 1;
            if (currentVal > 1) inputVal.value = currentVal - 1;
        });
    }
    if (plusBtn && inputVal) {
        plusBtn.addEventListener('click', () => {
            let currentVal = parseInt(inputVal.value) || 1;
            inputVal.value = currentVal + 1;
        });
    }
}

// تفعيل زرار Add to Cart الكبير في صفحة المنتج
// (الـ id بقى ObjectId من MongoDB مش رقم، فمفيش داعي لـ parseInt)
const addToCartLargeBtn = document.querySelector('.add-to-cart-large');
if (addToCartLargeBtn && typeof productId !== 'undefined' && productId) {
    addToCartLargeBtn.addEventListener('click', () => {
        const qtyVal = parseInt(document.querySelector('.single-product-section .qty-input-val').value) || 1;
        addToCart(productId, qtyVal);

        if (typeof api !== 'undefined') {
            const titleEl = document.getElementById('product-title');
            api.logEvent({
                label: 'add_to_cart',
                targetTitle: titleEl ? titleEl.innerText : '',
                visitorId: getOrCreateVisitorId(),
            }).catch(() => {});
        }
    });
}

// زرار "Add to Cart" في شريط الشراء الثابت (موبايل) - بيستخدم نفس منطق الزرار الكبير
const mobileBuyBarBtn = document.getElementById('mobileBuyBarBtn');
if (mobileBuyBarBtn && addToCartLargeBtn) {
    mobileBuyBarBtn.addEventListener('click', () => {
        if (addToCartLargeBtn.disabled) return;
        addToCartLargeBtn.click();
    });
}

/* =========================================
   معاينة الغلاف (Lightbox) - بتتفتح لما تدوس على أيقونة العين فوق الصورة
   ========================================= */
function initGalleryPreviewLightbox() {
    const previewBtn = document.getElementById('galleryPreviewBtn');
    const lightbox = document.getElementById('bookPreviewLightbox');
    const closeBtn = document.getElementById('lightboxCloseBtn');
    const backdrop = document.getElementById('lightboxBackdrop');
    if (!previewBtn || !lightbox) return;

    const openLightbox = () => {
        lightbox.hidden = false;
        document.body.style.overflow = 'hidden';
    };
    const closeLightbox = () => {
        lightbox.hidden = true;
        document.body.style.overflow = '';
    };

    previewBtn.addEventListener('click', openLightbox);
    if (closeBtn) closeBtn.addEventListener('click', closeLightbox);
    if (backdrop) backdrop.addEventListener('click', closeLightbox);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !lightbox.hidden) closeLightbox();
    });
}
initGalleryPreviewLightbox();

// ملحوظة: زراير "Add to Cart" في الصفحة الرئيسية (Best Offers / All Products)
// بقت بتتربط تلقائيًا في bindAddToCartDelegation() جوه loadHomepageProducts()
// لأن الكروت دلوقتي بتتحقن ديناميكيًا من الـ API بعد ما الصفحة تحمّل.

renderCart();
updateCartBadge();

/* =========================================
   تفعيل التبويبات في صفحة المنتج (تفاصيل الطبعة / آراء القراء)
   ========================================= */
function initProductTabs() {
    const tabBtns = document.querySelectorAll('.product-tab-btn');
    if (!tabBtns.length) return;

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.tab;

            document.querySelectorAll('.product-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.product-tab-pane').forEach(p => p.classList.remove('active'));

            btn.classList.add('active');
            const pane = document.getElementById(`tab-${target}`);
            if (pane) pane.classList.add('active');
        });
    });
}
initProductTabs();

/* =========================================
   خاصية "اقرأ المزيد" لوصف المنتج (بتظهر بس لو النص فعلاً طويل)
   ========================================= */
function initProductReadMore() {
    const wrapper = document.getElementById('product-desc-wrapper');
    const descEl = document.getElementById('product-desc');
    const btn = document.getElementById('readMoreBtn');
    if (!wrapper || !descEl || !btn) return;

    const tr = (key, fallback) => (window.SunBookI18n ? window.SunBookI18n.t(key) : fallback);
    const syncButtonText = () => {
        btn.innerText = wrapper.classList.contains('expanded') ? tr('product.readLess', 'Read Less') : tr('product.readMore', 'Read More');
    };
    syncButtonText();

    // بنستنى شوية عشان الوصف يتحط فعليًا من الـ API قبل ما نقيس ارتفاعه
    const checkOverflow = () => {
        const isOverflowing = descEl.scrollHeight > descEl.clientHeight + 2;
        btn.hidden = !isOverflowing;
    };

    btn.addEventListener('click', () => {
        wrapper.classList.toggle('expanded');
        syncButtonText();
    });

    setTimeout(checkOverflow, 600);
    window.addEventListener('resize', checkOverflow);

    document.addEventListener('sunbook:langChanged', syncButtonText);
}
initProductReadMore();

/* =========================================
   المراجعات (تقييم بالنجوم + تعليق) - صفحة المنتج
   ========================================= */
let selectedReviewRating = 0;

function renderStars(container, value) {
    container.querySelectorAll('.star-btn').forEach((btn) => {
        const starVal = parseInt(btn.dataset.value, 10);
        btn.classList.toggle('filled', starVal <= value);
    });
}

function starsToText(rating) {
    const rounded = Math.round(rating);
    return '★'.repeat(rounded) + '☆'.repeat(5 - rounded);
}

function initReviewStarInput() {
    const starInput = document.getElementById('starInput');
    if (!starInput) return;

    starInput.querySelectorAll('.star-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            selectedReviewRating = parseInt(btn.dataset.value, 10);
            renderStars(starInput, selectedReviewRating);
        });
    });
}

function renderReviewsList(reviews) {
    const listEl = document.getElementById('reviewsList');
    if (!listEl) return;

    if (!reviews.length) {
        const emptyMsg = window.SunBookI18n ? window.SunBookI18n.t('product.noReviewsYet') : 'No reviews yet. Be the first to share your opinion about this book!';
        listEl.innerHTML = `<div class="empty-state" id="reviewsEmptyState"><p>${emptyMsg}</p></div>`;
        return;
    }

    const dateLocale = (window.SunBookI18n && window.SunBookI18n.getLang() === 'ar') ? 'ar-EG' : 'en-US';
    listEl.innerHTML = reviews.map((r) => `
        <div class="review-item">
            <div class="review-item-header">
                <span class="review-item-name">${r.userName}</span>
                <span class="review-item-date">${new Date(r.createdAt).toLocaleDateString(dateLocale)}</span>
            </div>
            <div class="review-item-stars">${starsToText(r.rating)}</div>
            <p class="review-item-comment">${r.comment}</p>
        </div>
    `).join('');
}

function renderReviewsSummary(count, averageRating) {
    const summaryEl = document.getElementById('reviewsSummary');
    const scoreEl = document.getElementById('reviewsAverageScore');
    const starsEl = document.getElementById('reviewsAverageStars');
    const countEl = document.getElementById('reviewsCount');
    if (!summaryEl) return;

    if (count === 0) {
        summaryEl.hidden = true;
        return;
    }

    summaryEl.hidden = false;
    if (scoreEl) scoreEl.innerText = averageRating.toFixed(1);
    if (starsEl) starsEl.innerText = starsToText(averageRating);
    if (countEl) countEl.innerText = window.SunBookI18n ? window.SunBookI18n.formatReviewCount(count) : `${count} review${count === 1 ? '' : 's'}`;
}

// إعادة رسم قائمة المراجعات والملخص لما اللغة تتبدل (عشان صيغة العدّ ونص "لا توجد مراجعات" يتحدثوا فورًا)
let lastLoadedReviews = null;
let lastReviewsCount = 0;
let lastReviewsAverage = 0;
document.addEventListener('sunbook:langChanged', () => {
    if (lastLoadedReviews !== null) {
        renderReviewsList(lastLoadedReviews);
        renderReviewsSummary(lastReviewsCount, lastReviewsAverage);
    }
});

async function loadProductReviews() {
    const token = localStorage.getItem('sunbook_token');
    const userId = localStorage.getItem('sunbook_user_id');
    const isLoggedIn = !!(token && userId);

    const formEl = document.getElementById('reviewForm');
    const loginPromptEl = document.getElementById('reviewLoginPrompt');
    const loginLinkEl = document.getElementById('reviewLoginLink');
    const deleteBtn = document.getElementById('reviewDeleteBtn');
    const commentInput = document.getElementById('reviewCommentInput');
    const starInput = document.getElementById('starInput');

    if (loginLinkEl) {
        loginLinkEl.addEventListener('click', () => {
            localStorage.setItem('sunbook_redirect_after_login', window.location.href);
        });
    }

    if (isLoggedIn) {
        if (formEl) formEl.hidden = false;
        if (loginPromptEl) loginPromptEl.hidden = true;
    } else {
        if (formEl) formEl.hidden = true;
        if (loginPromptEl) loginPromptEl.hidden = false;
    }

    try {
        const { data: reviews, count, averageRating } = await api.getProductReviews(productId);
        lastLoadedReviews = reviews;
        lastReviewsCount = count;
        lastReviewsAverage = averageRating;
        renderReviewsList(reviews);
        renderReviewsSummary(count, averageRating);

        // لو اليوزر مسجل دخول وعنده مراجعة قديمة، نحمّلها في الفورم عشان يقدر يعدلها
        if (isLoggedIn) {
            const myReview = reviews.find((r) => r.user === userId);
            if (myReview) {
                selectedReviewRating = myReview.rating;
                if (starInput) renderStars(starInput, selectedReviewRating);
                if (commentInput) commentInput.value = myReview.comment;
                if (deleteBtn) deleteBtn.hidden = false;
                if (deleteBtn) deleteBtn.dataset.reviewId = myReview._id;
            }
        }
    } catch (err) {
        console.error('Failed to load reviews:', err);
    }
}

function initProductReviewForm() {
    const formEl = document.getElementById('reviewForm');
    const deleteBtn = document.getElementById('reviewDeleteBtn');
    if (!formEl) return;

    formEl.addEventListener('submit', async (e) => {
        e.preventDefault();
        const commentInput = document.getElementById('reviewCommentInput');
        const comment = commentInput ? commentInput.value.trim() : '';
        const tr = (key, fallback) => (window.SunBookI18n ? window.SunBookI18n.t(key) : fallback);

        if (!selectedReviewRating) {
            if (typeof showToast === 'function') showToast(tr('product.selectStarFirst', 'Please select a star rating first'), 'error');
            return;
        }
        if (!comment) {
            if (typeof showToast === 'function') showToast(tr('product.writeCommentFirst', 'Please write a short comment'), 'error');
            return;
        }

        try {
            await api.submitReview(productId, selectedReviewRating, comment);
            if (typeof showToast === 'function') showToast(tr('product.thanksReview', 'Thanks for your review!'));
            loadProductReviews();
        } catch (err) {
            if (typeof showToast === 'function') showToast(err.message || tr('product.couldNotSubmitReview', 'Could not submit review'), 'error');
        }
    });

    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            const reviewId = deleteBtn.dataset.reviewId;
            if (!reviewId) return;
            const tr = (key, fallback) => (window.SunBookI18n ? window.SunBookI18n.t(key) : fallback);
            try {
                await api.deleteReview(reviewId);
                selectedReviewRating = 0;
                const commentInput = document.getElementById('reviewCommentInput');
                if (commentInput) commentInput.value = '';
                const starInput = document.getElementById('starInput');
                if (starInput) renderStars(starInput, 0);
                deleteBtn.hidden = true;
                if (typeof showToast === 'function') showToast(tr('product.reviewDeleted', 'Review deleted'));
                loadProductReviews();
            } catch (err) {
                if (typeof showToast === 'function') showToast(err.message || tr('product.couldNotDeleteReview', 'Could not delete review'), 'error');
            }
        });
    }
}

initReviewStarInput();
initProductReviewForm();

/* =========================================
   نظام الحجز والتقويم (محدث بحجز المواعيد)
   ========================================= */

// المواعيد الثابتة الثلاثة المتاحة كل يوم - لازم تكون مطابقة لنفس القيم في الباك اند (DAILY_SLOTS)
const DAILY_SLOTS = ['4:00 PM', '6:00 PM', '8:00 PM'];

// Helper: بيبني تاريخ بصيغة ISO (YYYY-MM-DD) من أرقام السنة/الشهر/اليوم - بنستخدمه دايمًا
// للحسابات الفعلية (بدل ما نعتمد على نص الشهر المعروض، اللي ممكن يبقى عربي)
function toIsoDateStr(year, monthIndex, day) {
    const mm = String(monthIndex + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
}

// Helper: بيجيب حالة المواعيد الحقيقية ليوم معين من السيرفر (مش وهمية من localStorage)
async function getAvailabilityForDate(dateStr) {
    try {
        const isoDate = new Date(dateStr).toISOString().split('T')[0];
        const { data } = await api.getBookingAvailability(isoDate);
        return data;
    } catch (err) {
        console.error('Failed to load availability:', err);
        // لو السيرفر فشل، نفترض كل المواعيد متاحة بدل ما نمنع الحجز خالص
        return { slots: DAILY_SLOTS.map(time => ({ time, booked: false })), isFullyBooked: false };
    }
}

// Helper: تحديث زراير الوقت حسب التاريخ المختار (بيانات حقيقية من السيرفر)
async function updateTimeSlotsForDate(dateStr) {
    const allSlots = document.querySelectorAll('.time-slot-btn');
    allSlots.forEach(btn => { btn.disabled = true; btn.classList.add('loading'); });

    const availability = await getAvailabilityForDate(dateStr);
    const bookedTimes = new Set(availability.slots.filter(s => s.booked).map(s => s.time));

    allSlots.forEach(btn => {
        btn.classList.remove('selected', 'booked', 'loading');
        const time = btn.innerText.trim();
        if (bookedTimes.has(time)) {
            btn.classList.add('booked');
            btn.disabled = true;
        } else {
            btn.disabled = false;
        }
    });
}

const modal = document.getElementById('bookingModal');

if (modal) {
    const closeBtn = document.getElementById('closeModalBtn');
    const triggerBtns = document.querySelectorAll('.slot-btn.available, .book-now-btn');

    triggerBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            modal.classList.add('active');
            renderCalendar();
        });
    });

    if (closeBtn) {
        closeBtn.addEventListener('click', () => modal.classList.remove('active'));
    }

    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
    });

    const monthYearDisplay = document.getElementById('monthYearDisplay');
    const calendarDays = document.getElementById('calendarDays');
    let currentDate = new Date();

    function renderCalendar() {
        if (!calendarDays) return;
        calendarDays.innerHTML = '';
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const monthNames = window.SunBookI18n ? window.SunBookI18n.getCalendarNames().months : ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        if (monthYearDisplay) monthYearDisplay.innerText = `${monthNames[month]} ${year}`;

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const startDayIndex = firstDay === 0 ? 6 : firstDay - 1;

        // أقل يوم يقدر يحجزه: بكرة (مش النهارده) - يعني بينا وبين الحجز يوم كامل على الأقل
        const earliestBookable = new Date();
        earliestBookable.setHours(0, 0, 0, 0);
        earliestBookable.setDate(earliestBookable.getDate() + 1);

        for (let i = 0; i < startDayIndex; i++) {
            const emptyDiv = document.createElement('div');
            emptyDiv.classList.add('cal-day', 'empty');
            calendarDays.appendChild(emptyDiv);
        }

        const dayDivs = [];
        for (let i = 1; i <= daysInMonth; i++) {
            const dayDiv = document.createElement('div');
            dayDiv.classList.add('cal-day');
            dayDiv.innerText = i;
            dayDiv.dataset.day = i;
            dayDiv.dataset.iso = toIsoDateStr(year, month, i);

            const thisDate = new Date(year, month, i);

            if (thisDate < earliestBookable) {
                dayDiv.classList.add('disabled');
            } else {
                dayDiv.addEventListener('click', function() {
                    if (this.classList.contains('fully-booked') || this.classList.contains('disabled')) return;
                    document.querySelectorAll('.cal-day').forEach(d => d.classList.remove('selected'));
                    this.classList.add('selected');
                    updateTimeSlotsForDate(this.dataset.iso);
                });
            }
            dayDivs.push(dayDiv);
            calendarDays.appendChild(dayDiv);
        }

        // نمسح زراير الوقت لحد ما نختار يوم من جديد
        document.querySelectorAll('.time-slot-btn').forEach(btn => {
            btn.classList.remove('selected', 'booked');
            btn.disabled = false;
        });

        // نجيب الأيام المكتملة كلها في الشهر ده بضربة واحدة، ونلوّنها
        api.getMonthAvailability(year, month + 1).then(({ data }) => {
            const fullyBookedSet = new Set(data.fullyBookedDates || []);
            dayDivs.forEach(dayDiv => {
                if (dayDiv.classList.contains('disabled')) return;
                const i = Number(dayDiv.dataset.day);
                const isoKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
                if (fullyBookedSet.has(isoKey)) {
                    dayDiv.classList.add('fully-booked');
                    dayDiv.title = window.SunBookI18n ? window.SunBookI18n.t('calendar.fullyBooked') : 'Fully booked';
                }
            });
        }).catch(err => console.error('Failed to load month availability:', err));
    }

    // نعرّضها للخارج (زي أزرار "Book now" السريعة في الصفحة الرئيسية) عشان تقدر تفتح
    // الكالندر وتحدد يوم معين مباشرة بضغطة واحدة
    window.openBookingModalForDate = function (targetDate) {
        modal.classList.add('active');
        currentDate = new Date(targetDate);
        renderCalendar();
        // نستنى لحظة عشان الأيام تتحقن في الـ DOM، وبعدين نلاقي نفس اليوم ونحدده
        setTimeout(() => {
            const dayNum = targetDate.getDate();
            const allDays = document.querySelectorAll('#calendarDays .cal-day:not(.empty)');
            allDays.forEach(dayDiv => {
                if (Number(dayDiv.dataset.day) === dayNum && !dayDiv.classList.contains('disabled')) {
                    dayDiv.click();
                }
            });
        }, 50);
    };

    // ─── تجهيز أزرار المواعيد السريعة في الصفحة الرئيسية بأيام حقيقية (مش ثابتة) ───
    const quickDatesContainer = document.getElementById('homeBookingQuickDates');
    function renderHomeQuickDates() {
        if (!quickDatesContainer) return;
        quickDatesContainer.innerHTML = '';
        const dayNames = window.SunBookI18n ? window.SunBookI18n.getCalendarNames().dayNamesShort : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const startDay = new Date();
        startDay.setHours(0, 0, 0, 0);
        startDay.setDate(startDay.getDate() + 1); // أقل يوم متاح للحجز هو بكرة

        for (let i = 0; i < 4; i++) {
            const d = new Date(startDay);
            d.setDate(d.getDate() + i);
            const pill = document.createElement('span');
            pill.className = 'booking-slot-pill booking-slot-pill--active';
            pill.innerText = `${dayNames[d.getDay()]} ${d.getDate()}`;
            pill.addEventListener('click', () => window.openBookingModalForDate(d));
            quickDatesContainer.appendChild(pill);
        }
    }
    renderHomeQuickDates();
    document.addEventListener('sunbook:langChanged', () => {
        renderHomeQuickDates();
        renderCalendar();
    });

    const prevMonthBtn = document.getElementById('prevMonth');
    const nextMonthBtn = document.getElementById('nextMonth');

    if (prevMonthBtn) {
        prevMonthBtn.addEventListener('click', () => {
            currentDate.setMonth(currentDate.getMonth() - 1);
            renderCalendar();
        });
    }

    if (nextMonthBtn) {
        nextMonthBtn.addEventListener('click', () => {
            currentDate.setMonth(currentDate.getMonth() + 1);
            renderCalendar();
        });
    }

    const timeSlots = document.querySelectorAll('.time-slot-btn');
    timeSlots.forEach(slot => {
        slot.addEventListener('click', function() {
            if (this.classList.contains('booked') || this.disabled) return;
            timeSlots.forEach(s => s.classList.remove('selected'));
            this.classList.add('selected');
        });
    });
}

/* =========================================
   نظام تبديل زرار التسجيل بالأفاتار
   ========================================= */
function switchTab(tabName) {
    document.querySelectorAll('.auth-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));

    if (tabName === 'signin') {
        document.querySelectorAll('.auth-tab')[0].classList.add('active');
        const signinForm = document.getElementById('signinForm');
        if (signinForm) signinForm.classList.add('active');
    } else {
        document.querySelectorAll('.auth-tab')[1].classList.add('active');
        const registerForm = document.getElementById('registerForm');
        if (registerForm) registerForm.classList.add('active');
    }
}

function handleAuth(event, type) {
    event.preventDefault();

    let userName = 'Seeker';
    if (type === 'register') {
        const registerNameInput = document.getElementById('registerName');
        userName = registerNameInput && registerNameInput.value.trim() ? registerNameInput.value.trim() : userName;
    }

    localStorage.setItem('sunbook_username', userName);

    const redirectUrl = localStorage.getItem('sunbook_redirect_after_login');
    if (redirectUrl) {
        localStorage.removeItem('sunbook_redirect_after_login');
        window.location.href = redirectUrl;
    } else {
        window.location.href = 'index.html';
    }
}

function handleSocialLogin(platformName) {
    localStorage.setItem('sunbook_username', platformName);

    const redirectUrl = localStorage.getItem('sunbook_redirect_after_login');
    if (redirectUrl) {
        localStorage.removeItem('sunbook_redirect_after_login');
        window.location.href = redirectUrl;
    } else {
        window.location.href = 'index.html';
    }
}

function logout() {
    localStorage.removeItem('sunbook_username');
    window.location.href = 'index.html';
}

function switchProfileTab(tabId, btnElement) {
    document.querySelectorAll('.profile-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.querySelectorAll('.profile-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    const targetContent = document.getElementById(tabId);
    if (targetContent) targetContent.classList.add('active');
    if (btnElement) btnElement.classList.add('active');
}

function checkNameChangeEligibility() {
    const nameInput = document.getElementById('profileNameInput');
    const warningText = document.getElementById('nameChangeWarning');
    const lastChangeDate = localStorage.getItem('sunbook_last_name_change');

    if (!nameInput || !warningText) return;

    if (lastChangeDate) {
        const lastDate = new Date(lastChangeDate);
        const currentDate = new Date();
        const diffTime = Math.abs(currentDate - lastDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 30) {
            const daysLeft = 30 - diffDays;
            nameInput.disabled = true;
            nameInput.style.opacity = '0.5';
            nameInput.style.cursor = 'not-allowed';
            warningText.style.color = 'var(--gold-color)';
            warningText.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                You recently changed your name. You can change it again in ${daysLeft} days.`;
        }
    }
}

function saveProfileSettings() {
    const nameInput = document.getElementById('profileNameInput');
    const phoneInput = document.getElementById('profilePhoneInput');
    const addressInput = document.getElementById('profileAddressInput');
    const displayName = document.getElementById('displayName');

    if (nameInput && !nameInput.disabled && nameInput.value.trim() !== '') {
        localStorage.setItem('sunbook_username', nameInput.value.trim());
        localStorage.setItem('sunbook_last_name_change', new Date().toISOString());
    }

    if (phoneInput) localStorage.setItem('sunbook_phone', phoneInput.value.trim());
    if (addressInput) localStorage.setItem('sunbook_address', addressInput.value.trim());

    if (typeof showToast === 'function') {
        showToast('Settings saved successfully!');
    }

    checkNameChangeEligibility();
    if (displayName && nameInput) displayName.innerText = nameInput.value.trim();
}

function loadSavedSettings() {
    const savedName = localStorage.getItem('sunbook_username');
    const savedPhone = localStorage.getItem('sunbook_phone');
    const savedAddress = localStorage.getItem('sunbook_address');

    const nameInput = document.getElementById('profileNameInput');
    const phoneInput = document.getElementById('profilePhoneInput');
    const addressInput = document.getElementById('profileAddressInput');

    if (nameInput && savedName) nameInput.value = savedName;
    if (phoneInput && savedPhone) phoneInput.value = savedPhone;
    if (addressInput && savedAddress) addressInput.value = savedAddress;

    checkNameChangeEligibility();
}

/* =========================================
   نظام التحقق من تسجيل الدخول (Seamless Auth State - No Delay)
   ========================================= */
function applyLoginState() {
    const authContainers = document.querySelectorAll('#auth-container');
    if (authContainers.length === 0) return; // لو الهيدر لسه متحطش في الصفحة، وقف هنا

    const loggedInUser = localStorage.getItem('sunbook_username');
    const isProfilePage = window.location.pathname.includes('profile.html');
    const promoBanner = document.getElementById('promo-banner');

    if (promoBanner) {
        promoBanner.style.display = loggedInUser ? 'none' : 'block';
    }

    authContainers.forEach(container => {
        // حماية للكود: لو الزرار اتغير خلاص، متعملش حاجة تاني عشان نوفر في أداء المتصفح
        if (container.dataset.loaded === 'true') return; 

        if (isProfilePage) {
            container.innerHTML = ''; 
        } else if (loggedInUser) {
            const firstLetter = loggedInUser.charAt(0).toUpperCase();
            container.innerHTML = `<a href="profile.html" class="user-avatar" title="${loggedInUser}">${firstLetter}</a>`;
        } else {
            if (container.closest('.sidebar-footer')) {
                container.innerHTML = `<a href="login.html" class="btn-shop" style="display: block; width: 100%;">Sign In / Register</a>`;
            } else {
                container.innerHTML = `<a href="login.html" class="btn-shop">Sign In / Register</a>`;
            }
        }
        
        // نعلم على الزرار إنه اتحدث عشان الكود ميرجعلوش تاني
        container.dataset.loaded = 'true'; 
    });
}

// الرادار اللي بيراقب تغييرات الصفحة لحظة بلحظة
const authObserver = new MutationObserver(() => {
    // أول ما يلمح الـ auth-container نزل في الصفحة، بيشغل الدالة فوراً
    if (document.querySelector('#auth-container')) {
        applyLoginState();
    }
});

// بنشغل الرادار أول ما الموقع يفتح
authObserver.observe(document.body, { childList: true, subtree: true });

// تشغيلة احتياطية لو الصفحة كانت محملة الهيدر أصلاً
applyLoginState();

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('profileNameInput')) {
        loadSavedSettings();
        checkNameChangeEligibility();
    }
});

function attachCheckoutEvent(finalAmount) {
    const checkoutBtn = document.getElementById('mainCheckoutBtn');
    if (!checkoutBtn) return;

    checkoutBtn.addEventListener('click', (e) => {
        if (cartItems.length === 0) {
            e.preventDefault();
            if (typeof showToast === 'function') showToast('Your cart is empty!');
            return;
        }

        const loggedInUser = localStorage.getItem('sunbook_username');
        if (!loggedInUser) {
            e.preventDefault();
            if (typeof showToast === 'function') showToast('Please sign in to complete your order!', 'error');
            localStorage.setItem('sunbook_redirect_after_login', 'checkout.html');
            setTimeout(() => { window.location.href = 'login.html'; }, 2000);
            return;
        }
    });
}

/* =========================================
   نظام تأكيد الحجز (معدل: الدفع الأول وبعدين الحجز)
   ========================================= */
const confirmBookingBtn = document.querySelector('.confirm-booking-btn');
if (confirmBookingBtn && !document.body.classList.contains('use-api-booking')) {
    confirmBookingBtn.addEventListener('click', () => {
        
        // 1. هل اختار وقت؟
        const selectedTimeBtn = document.querySelector('.time-slot-btn.selected');
        if (!selectedTimeBtn) {
            if (typeof showToast === 'function') {
                showToast('Please select a time slot before confirming your booking.', 'error');
            }
            return;
        }

        // 2. هل اختار يوم؟
        const selectedDay = document.querySelector('.cal-day.selected');
        const monthYear = document.getElementById('monthYearDisplay').innerText;
        if (!selectedDay) {
            if (typeof showToast === 'function') {
                showToast('Please select a date first!', 'error');
            }
            return;
        }

        // 3. هل مسجل دخول؟
        const token = localStorage.getItem('sunbook_token');
        const loggedInUser = localStorage.getItem('sunbook_username');
        if (!loggedInUser || !token || token === 'social_dummy_token') {
            if (typeof showToast === 'function') {
                showToast('Sign in to book this session and claim your 5% discount!', 'error');
            }
            localStorage.setItem('sunbook_redirect_after_login', 'booking-details.html');
            setTimeout(() => { window.location.href = 'login.html'; }, 2500);
            return;
        }

        // 4. تحقق نهائي: المعاد لسه فاضي؟
        const selectedDateStr = `${selectedDay.innerText} ${monthYear}`;
        const currentBookings = getBookingsForDate(selectedDateStr);
        if (currentBookings.some(b => b.time === selectedTimeBtn.innerText.trim())) {
            if (typeof showToast === 'function') {
                showToast('Sorry, this slot was just booked. Please choose another time.', 'error');
            }
            updateTimeSlotsForDate(selectedDateStr);
            return;
        }

        // ✅ NEW: بنضيف الحجز كـ "منتج" في السلة ونروح ندفع
        const bookingItem = {
            id: 'booking-' + Date.now(),
            title: 'Exclusive One-on-One Session',
            price: 'LE 199.00',
            image: 'assets/sun-icon.png',
            description: `Session on ${selectedDateStr} at ${selectedTimeBtn.innerText.trim()}`,
            type: 'booking',
            qty: 1,
            bookingDetails: {
                date: selectedDateStr,
                time: selectedTimeBtn.innerText.trim()
            }
        };

        // نضيفه للسلة (نشيل أي حجز قديم من السلة عشان ميتكررش)
        let cart = JSON.parse(localStorage.getItem('sunbook_cart')) || [];
        cart = cart.filter(item => item.type !== 'booking');
        cart.push(bookingItem);
        localStorage.setItem('sunbook_cart', JSON.stringify(cart));
        if (typeof updateCartBadge === 'function') updateCartBadge();

        // نقفل المودال ونضيف للسلة ونروح لصفحة السلة
        document.getElementById('bookingModal').classList.remove('active');
        window.location.href = 'cart.html';
    });
}

/* =========================================
   نظام الدفع الذكي (Smart Checkout System) - محدث بالكامل
   ========================================= */

function switchPayment(type) {
    document.querySelectorAll('.pay-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.pay-form').forEach(form => form.classList.remove('active'));

    if (type === 'card') {
        document.querySelectorAll('.pay-tab')[0].classList.add('active');
        document.getElementById('card-form').classList.add('active');
    } else {
        document.querySelectorAll('.pay-tab')[1].classList.add('active');
        document.getElementById('wallet-form').classList.add('active');
    }
}

function initSmartCheckout() {
    const loggedInUser = localStorage.getItem('sunbook_username');
    if (!loggedInUser) return;

    const confirmBtn = document.getElementById('confirmPaymentBtn');
    if (!confirmBtn) return;

    const shippingSection = document.getElementById('shipping-section');
    const digitalBanner = document.getElementById('digital-banner');
    const noticeSection = document.getElementById('smart-notice');

    let cart = JSON.parse(localStorage.getItem('sunbook_cart')) || [];
    if (cart.length === 0) {
        window.location.href = 'cart.html';
        return;
    }

        const hasPhysical = cart.some(item => item.type === 'physical');
    const hasDigital = cart.some(item => item.type === 'digital');
    const hasBooking = cart.some(item => item.type === 'booking');

    // 1. التحكم في ظهور/اختفاء قسم الشحن والبنرات
    if (shippingSection) {
        if (!hasPhysical && (hasDigital || hasBooking)) {
            // كلها ديجيتال أو حجز (مش محتاج شحن)
            shippingSection.style.display = 'none';
            if (digitalBanner) digitalBanner.style.display = 'block';
            if (noticeSection) noticeSection.style.display = 'none';
            confirmBtn.innerText = hasBooking ? 'Pay & Confirm Session' : 'Pay & Download Now';
        } else if (hasPhysical && (hasDigital || hasBooking)) {
            // مخلوطة
            shippingSection.style.display = 'block';
            if (digitalBanner) digitalBanner.style.display = 'none';
            if (noticeSection) {
                noticeSection.style.display = 'block';
                let msg = '<strong>Mixed Order:</strong> Digital files will be available for instant download right after payment. ';
                if (hasBooking) msg += 'Your session will be confirmed. ';
                msg += 'Physical books will be shipped to the address provided below.';
                noticeSection.innerHTML = msg;
            }
            confirmBtn.innerText = 'Pay Now & Complete Order';
        } else {
            // كلها فيزيكال
            shippingSection.style.display = 'block';
            if (digitalBanner) digitalBanner.style.display = 'none';
            if (noticeSection) noticeSection.style.display = 'none';
            confirmBtn.innerText = 'Pay Now & Complete Order';
        }
    }

    // 2. رسم ملخص الطلب
    let totalPrice = 0;
    const listContainer = document.getElementById('checkout-items-list');
    if (listContainer) {
        listContainer.innerHTML = '';
        cart.forEach(item => {
            const typeLabel = item.type === 'digital' ? 'Digital (PDF)' : item.type === 'booking' ? 'Session' : 'Physical Book';
            const typeColor = item.type === 'digital' ? '#34A853' : item.type === 'booking' ? '#d8b056' : 'var(--gold-color)';
            const priceNum = parseFloat(item.price.replace(/[^0-9.]/g, ''));
            totalPrice += (priceNum * item.qty);

            listContainer.innerHTML += `
                <div class="checkout-item-mini">
                    <img src="${item.image}" alt="Book">
                    <div class="checkout-item-info">
                        <h4>${item.title} (x${item.qty})</h4>
                        <span class="item-type-badge" style="color: ${typeColor}; border-color: ${typeColor};">${typeLabel}</span>
                    </div>
                    <p class="checkout-item-price">${item.price}</p>
                </div>
            `;
        });
    }

    // 3. حساب الإجمالي
    let finalTotal = totalPrice;
    if (loggedInUser) {
        finalTotal = totalPrice - (totalPrice * 0.05);
    }
    const totalPriceEl = document.getElementById('checkout-total-price');
    if (totalPriceEl) totalPriceEl.innerText = `LE ${finalTotal.toFixed(2)}`;
}

/* =========================================
   نظام الظهور التدريجي عند التمرير (Scroll Reveal)
   ========================================= */
function revealOnScroll() {
    const reveals = document.querySelectorAll(".reveal");
    for (let i = 0; i < reveals.length; i++) {
        const windowHeight = window.innerHeight;
        // بنحسب مسافة العنصر من أعلى الشاشة
        const elementTop = reveals[i].getBoundingClientRect().top;
        // العنصر يظهر لما يكون على بُعد 100 بيكسل من أسفل الشاشة
        const elementVisible = 100; 

        if (elementTop < windowHeight - elementVisible) {
            reveals[i].classList.add("active");
        }
    }
}

// مراقبة حركة التمرير
window.addEventListener("scroll", revealOnScroll);

// استدعاء الدالة فوراً عند تحميل الصفحة عشان تظهر العناصر اللي فوق
document.addEventListener("DOMContentLoaded", revealOnScroll);

/* =========================================
   نظام البحث المباشر (Live Search Dropdown)
   ========================================= */
(function initSearchSystem() {
    let searchDropdown = null;

    function getOrCreateDropdown(searchInput) {
        if (!searchDropdown) {
            searchDropdown = document.createElement('div');
            searchDropdown.id = 'search-dropdown';
            searchDropdown.className = 'search-dropdown-results';
            if (searchInput && searchInput.parentElement) {
                searchInput.parentElement.style.position = 'relative';
                searchInput.parentElement.appendChild(searchDropdown);
            }
        }
        return searchDropdown;
    }

    function renderDropdown(input, query) {
        const dropdown = getOrCreateDropdown(input);
        if (!query) {
            dropdown.style.display = 'none';
            return;
        }

        const matches = productsData.filter(p => 
            p.title.toLowerCase().includes(query) || 
            p.description.toLowerCase().includes(query)
        );

        if (matches.length > 0) {
            dropdown.innerHTML = matches.slice(0, 5).map(p => `
                <a href="product.html?id=${p.id}" class="search-result-item">
                    <img src="${p.image}" alt="${p.title}">
                    <div>
                        <span class="search-result-title">${p.title}</span>
                        <span class="search-result-price">${p.price}</span>
                    </div>
                </a>
            `).join('');
            dropdown.style.display = 'block';
        } else {
            dropdown.innerHTML = '<div class="search-no-results">No books found</div>';
            dropdown.style.display = 'block';
        }
    }

    // لما يكتب في السيرش
    document.addEventListener('input', function(e) {
        if (e.target && e.target.id === 'searchInput') {
            const query = e.target.value.toLowerCase().trim();
            renderDropdown(e.target, query);
        }
    });

    // لما يدوس Enter → يروح لأول نتيجة لو موجودة
    document.addEventListener('keydown', function(e) {
        if (e.target && e.target.id === 'searchInput' && e.key === 'Enter') {
            e.preventDefault();
            const query = e.target.value.toLowerCase().trim();
            if (!query) return;
            
            const matches = productsData.filter(p => 
                p.title.toLowerCase().includes(query) || 
                p.description.toLowerCase().includes(query)
            );
            
            if (matches.length > 0) {
                window.location.href = `product.html?id=${matches[0].id}`;
            }
        }
    });

    // إخفاء الـ dropdown لما يدوس بره
    document.addEventListener('click', function(e) {
        const dropdown = document.getElementById('search-dropdown');
        const input = document.getElementById('searchInput');
        if (dropdown && !input?.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
})();

/* =========================================
   نظام القائمة الجانبية للموبايل (Premium Mobile Sidebar)
   ========================================= */
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const mobileToggle = document.getElementById('mobileToggle');
        const mobileSidebar = document.getElementById('mobileSidebar');
        const sidebarOverlay = document.getElementById('sidebarOverlay');
        const sidebarClose = document.getElementById('sidebarClose');

        if (mobileToggle && mobileSidebar && sidebarOverlay && sidebarClose) {
            
            // دالة فتح القائمة
            const openMenu = () => {
                mobileSidebar.classList.add('active');
                sidebarOverlay.classList.add('active');
                document.body.style.overflow = 'hidden'; // قفل السكرول في الخلفية
            };

            // دالة قفل القائمة
            const closeMenu = () => {
                mobileSidebar.classList.remove('active');
                sidebarOverlay.classList.remove('active');
                document.body.style.overflow = 'auto'; // تشغيل السكرول تاني
            };

            // تشغيل الأحداث
            mobileToggle.addEventListener('click', openMenu);
            sidebarClose.addEventListener('click', closeMenu);
            sidebarOverlay.addEventListener('click', closeMenu);
        }

        // ---- عدسة البحث بتاعة الموبايل: بتفتح وتقفل نفس شريط البحث كـ dropdown ----
        // (نفس عنصر #searchInput الأصلي، مش نسخة تانية، عشان نظام السيرش الموجود يفضل شغال زي ما هو)
        const mobileSearchToggle = document.getElementById('mobileSearchToggle');
        const searchWrapperEl = document.querySelector('.search-wrapper');

        if (mobileSearchToggle && searchWrapperEl) {
            mobileSearchToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const willOpen = !searchWrapperEl.classList.contains('mobile-search-active');
                searchWrapperEl.classList.toggle('mobile-search-active', willOpen);
                if (willOpen) {
                    const input = document.getElementById('searchInput');
                    if (input) setTimeout(() => input.focus(), 50);
                }
            });

            // قفل لوحة البحث لو دوس بره منها
            document.addEventListener('click', (e) => {
                if (
                    searchWrapperEl.classList.contains('mobile-search-active') &&
                    !searchWrapperEl.contains(e.target) &&
                    !mobileSearchToggle.contains(e.target)
                ) {
                    searchWrapperEl.classList.remove('mobile-search-active');
                }
            });
        }
    }, 500); 
});

/* =========================================
   نظام الناف بار الذكي (Smooth Fixed Navbar - No Glitch)
   ========================================= */
document.addEventListener('DOMContentLoaded', () => {
    // بنستنى نص ثانية عشان ملف الـ loader يحقن الهيدر في الصفحة
    setTimeout(() => {
        const header = document.querySelector('.header');
        const promoBanner = document.getElementById('promo-banner');
        
        if (header) {
            // هنعمل عنصر وهمي (Spacer) ياخد مكان الناف بار وهو Fixed
            const spacer = document.createElement('div');
            spacer.id = 'header-spacer';
            spacer.style.display = 'none'; // مخفي في البداية
            
            // هنحط العنصر الوهمي ده قبل الناف بار مباشرة في الـ HTML
            header.parentNode.insertBefore(spacer, header);

            window.addEventListener('scroll', () => {
                const bannerHeight = promoBanner ? promoBanner.offsetHeight : 40;
                
                // لو نزلنا بالماوس مسافة أكبر من ارتفاع البنر الإعلاني
                if (window.scrollY > bannerHeight) {
                    // نتأكد إنه لسه ماخدش كلاس التثبيت عشان ما نعملش لود عالفاضي
                    if (!header.classList.contains('scrolled')) {
                        // ندي للعنصر الوهمي نفس ارتفاع الناف بار ونظهره
                        spacer.style.height = `${header.offsetHeight}px`;
                        spacer.style.display = 'block';
                        header.classList.add('scrolled'); // نثبت الناف بار
                    }
                } else {
                    // لو رجعنا لفوق خالص
                    if (header.classList.contains('scrolled')) {
                        header.classList.remove('scrolled'); // نرجع الناف بار مكانه
                        spacer.style.display = 'none'; // نخفي العنصر الوهمي
                    }
                }
            });
        }
    }, 500); 
});


// ====== أيقونة "عين" لإظهار/إخفاء كلمة السر في أي خانة باسورد في الموقع كله ======
document.addEventListener('DOMContentLoaded', () => {
    const eyeOpenSVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
    const eyeClosedSVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';

    document.querySelectorAll('input[type="password"]').forEach(input => {
        // ماتلفش خانة اتلفت قبل كده (لو الصفحة عملت re-render لأي سبب)
        if (input.dataset.eyeWired) return;
        input.dataset.eyeWired = 'true';

        const wrapper = document.createElement('div');
        wrapper.style.position = 'relative';
        input.parentNode.insertBefore(wrapper, input);
        wrapper.appendChild(input);

        input.style.paddingRight = '42px';

        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.setAttribute('aria-label', 'Show password');
        toggleBtn.innerHTML = eyeClosedSVG;
        toggleBtn.style.cssText = 'position:absolute; right:12px; top:50%; transform:translateY(-50%); background:none; border:none; color:var(--text-gray); cursor:pointer; padding:4px; display:flex; align-items:center;';

        toggleBtn.addEventListener('click', () => {
            const isHidden = input.type === 'password';
            input.type = isHidden ? 'text' : 'password';
            toggleBtn.innerHTML = isHidden ? eyeOpenSVG : eyeClosedSVG;
            toggleBtn.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
        });

        wrapper.appendChild(toggleBtn);
    });
});

// =========================================
// أكورديون صفحة الأسئلة الشائعة (faq.html) - بيفتح/يقفل كل سؤال لوحده
// من غير ما يقفل باقي الأسئلة المفتوحة (كل سؤال شغال مستقل عن التاني)
// =========================================
function initFaqAccordion() {
    const questions = document.querySelectorAll('.faq-question');
    if (!questions.length) return;

    questions.forEach((btn) => {
        btn.addEventListener('click', () => {
            const item = btn.closest('.faq-item');
            const answer = item.querySelector('.faq-answer');
            const isOpen = item.classList.contains('active');

            if (isOpen) {
                item.classList.remove('active');
                btn.setAttribute('aria-expanded', 'false');
                answer.style.maxHeight = null;
            } else {
                item.classList.add('active');
                btn.setAttribute('aria-expanded', 'true');
                answer.style.maxHeight = answer.scrollHeight + 'px';
            }
        });
    });
}
document.addEventListener('DOMContentLoaded', initFaqAccordion);
