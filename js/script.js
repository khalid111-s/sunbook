
// 1. قاعدة البيانات المصغرة
const productsData = [
    { id: 1, title: "Trio Wisdom Bundle - English Paperback x3", price: "£79.99", image: "assets/book-bundle.png", description: "A powerful collection of ancient wisdom...", type: "physical" },
    { id: 2, title: "Book of Symbolism - E-Book", price: "£34.99", image: "assets/book-symbolism.png", description: "Unlock the hidden meanings...", type: "digital" },
    { id: 3, title: "The Golden Path - Hardcover", price: "£45.00", image: "assets/book-bundle.png", description: "Trace the steps of the ancients...", type: "physical" },
    { id: 4, title: "Secrets of the Ancients - Digital Edition", price: "£30.00", image: "assets/book-symbolism.png", description: "A deep dive into the esoteric knowledge...", type: "digital" },
    { id: 5, title: "Lost Rituals - Standard Edition", price: "£25.99", image: "assets/book-wisdom.png", description: "Discover the forgotten ceremonies that shaped the ancient civilizations and their connection to the cosmos.", type: "digital" },
    { id: 6, title: "The Lunar Chronicles", price: "£22.50", image: "assets/book-prophecy.png", description: "Understand the profound influence of lunar cycles on ancient magic, prophecies, and human history.", type: "digital" },
    { id: 7, title: "Mystic Elements Bundle", price: "£60.00", image: "assets/book-bundle.png", description: "Master the elements. This exclusive bundle brings together the core teachings of earth, water, air, and fire.", type: "physical" },
    { id: 8, title: "The Sun Book - Exclusive", price: "£55.00", image: "assets/book-symbolism.png", description: "The masterpiece of our collection. The Sun Book holds the ultimate truth of the solar deities.", type: "physical" }
];

// 2. كود صفحة المنتج
const urlParams = new URLSearchParams(window.location.search);
const productId = urlParams.get('id');

if (productId) {
    const product = productsData.find(item => item.id == productId);
    if (product) {
        const imgEl = document.getElementById('main-product-img');
        const titleEl = document.getElementById('product-title');
        const priceEl = document.getElementById('product-price');
        const descEl = document.getElementById('product-desc');
        if (imgEl) imgEl.src = product.image;
        if (titleEl) titleEl.innerText = product.title;
        if (priceEl) priceEl.innerText = product.price;
        if (descEl) descEl.innerText = product.description;
    } else {
        const titleEl = document.getElementById('product-title');
        if (titleEl) titleEl.innerText = "Product Not Found";
    }
}

// =========================================
// نظام سلة المشتريات
// =========================================
let cartItems = JSON.parse(localStorage.getItem('sunbook_cart')) || [];

function renderCart() {
    const container = document.getElementById('cart-container');
    const summaryBox = document.querySelector('.cart-summary');
    if (!container) return;

    // 1. إظهار تأثير التحميل الوهمي (Skeleton) الأول
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

    // 2. بعد 600 ملي ثانية (تأخير وهمي كأننا بنجيب البيانات من السيرفر)، نعرض المنتجات الحقيقية
    setTimeout(() => {
        container.innerHTML = ''; // نفضي التحميل

        if (cartItems.length === 0) {
            if (summaryBox) summaryBox.style.display = 'none';
            container.innerHTML = `
                <div style="width: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 40vh; text-align: center;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="var(--gold-color)" stroke-width="2" style="width: 60px; height: 60px; margin-bottom: 20px;">
                        <circle cx="9" cy="21" r="1"></circle>
                        <circle cx="20" cy="21" r="1"></circle>
                        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                    </svg>
                    <p style="color: var(--gold-color); font-size: 1.8rem; font-weight: bold; letter-spacing: 1px; font-family: var(--font-logo);">Your cart is currently empty.</p>
                    <a href="index.html" class="btn-shop" style="margin-top: 25px; padding: 12px 30px; font-size: 1.1rem; text-decoration: none;">Return to Shop</a>
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
                        <p class="cart-item-price">${item.price}</p>
                        <span style="font-size: 0.75rem; color: ${item.type === 'digital' ? '#34A853' : item.type === 'booking' ? '#d8b056' : 'var(--gold-color)'}; border: 1px solid ${item.type === 'digital' ? '#34A853' : item.type === 'booking' ? '#d8b056' : 'var(--gold-color)'}; padding: 2px 8px; border-radius: 4px; display: inline-block; margin-top: 5px;">${item.type === 'digital' ? 'Digital (PDF)' : item.type === 'booking' ? 'Session' : 'Physical Book'}</span>
                    </div>
                    <div class="cart-item-actions">
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
            const priceNumber = parseFloat(item.price.replace('£', ''));
            totalPrice += (priceNumber * item.qty);
        });

        updateOrderSummary(totalPrice);
    }, 600); // مدة التحميل (600 ملي ثانية)
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

    let summaryHTML = `
        <h3 class="summary-title">Order Summary</h3>
        <div class="summary-row">
            <span>Subtotal</span>
            <span>£${total.toFixed(2)}</span>
        </div>
    `;

    if (discount > 0) {
        summaryHTML += `
        <div class="summary-row" style="color: var(--gold-color); font-weight: bold;">
            <span>Member Discount (5%)</span>
            <span>-£${discount.toFixed(2)}</span>
        </div>
        `;
    }

    summaryHTML += `
        <div class="promo-code-container">
            <input type="text" placeholder="Enter code" class="promo-input">
            <button class="apply-btn">Apply</button>
        </div>
        <hr class="summary-divider">
        <div class="summary-row total-row">
            <span>Total</span>
            <span>£${finalTotal.toFixed(2)}</span>
        </div>
        <a href="checkout.html" class="btn-shop checkout-btn" style="text-align: center; text-decoration: none; display: block;" id="mainCheckoutBtn">Proceed to Checkout</a>
    `;

    summaryBox.innerHTML = summaryHTML;
    attachCheckoutEvent(finalTotal);
}

function updateQty(index, change) {
    if (cartItems[index].qty + change > 0) {
        cartItems[index].qty += change;
        localStorage.setItem('sunbook_cart', JSON.stringify(cartItems));
        renderCart();
        updateCartBadge();
    }
}

function removeItem(index) {
    cartItems.splice(index, 1);
    localStorage.setItem('sunbook_cart', JSON.stringify(cartItems));
    renderCart();
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
    showToast('Product successfully added to cart!');
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
const addToCartLargeBtn = document.querySelector('.add-to-cart-large');
if (addToCartLargeBtn && typeof productId !== 'undefined' && productId) {
    addToCartLargeBtn.addEventListener('click', () => {
        const qtyVal = parseInt(document.querySelector('.single-product-section .qty-input-val').value) || 1;
        addToCart(parseInt(productId), qtyVal);
    });
}

// تفعيل زراير Add to Cart في الصفحة الرئيسية
document.querySelectorAll('.product-card').forEach(card => {
    const btn = card.querySelector('.add-to-cart');
    const link = card.querySelector('a');
    if (btn && link) {
        btn.addEventListener('click', () => {
            const url = new URL(link.href, document.baseURI);
            const id = url.searchParams.get('id');
            if (id) addToCart(parseInt(id), 1);
        });
    }
});

renderCart();
updateCartBadge();

/* =========================================
   نظام الحجز والتقويم (محدث بحجز المواعيد)
   ========================================= */

// Helper: جلب كل الحجوزات لتاريخ معين
function getBookingsForDate(dateStr) {
    const bookings = JSON.parse(localStorage.getItem('sunbook_bookings')) || [];
    return bookings.filter(b => b.date === dateStr);
}

// Helper: تحديث زراير الوقت حسب التاريخ المختار
function updateTimeSlotsForDate(dateStr) {
    const bookings = getBookingsForDate(dateStr);
    const bookedTimes = bookings.map(b => b.time);
    const allSlots = document.querySelectorAll('.time-slot-btn');
    
    allSlots.forEach(btn => {
        btn.classList.remove('selected', 'booked');
        btn.disabled = false;
        
        if (bookedTimes.includes(btn.innerText.trim())) {
            btn.classList.add('booked');
            btn.disabled = true;
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
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        if (monthYearDisplay) monthYearDisplay.innerText = `${monthNames[month]} ${year}`;

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const startDayIndex = firstDay === 0 ? 6 : firstDay - 1;
        const today = new Date();

        for (let i = 0; i < startDayIndex; i++) {
            const emptyDiv = document.createElement('div');
            emptyDiv.classList.add('cal-day', 'empty');
            calendarDays.appendChild(emptyDiv);
        }

        for (let i = 1; i <= daysInMonth; i++) {
            const dayDiv = document.createElement('div');
            dayDiv.classList.add('cal-day');
            dayDiv.innerText = i;
            
            const thisDate = new Date(year, month, i);
            const dateStr = `${i} ${monthNames[month]} ${year}`;
            const dayBookings = getBookingsForDate(dateStr);
            const isFullyBooked = dayBookings.length >= 3; // عندنا 3 مواعيد في اليوم

            if (thisDate < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
                dayDiv.classList.add('disabled');
            } else if (isFullyBooked) {
                dayDiv.classList.add('fully-booked');
                dayDiv.title = "Fully booked";
            } else {
                dayDiv.addEventListener('click', function() {
                    document.querySelectorAll('.cal-day').forEach(d => d.classList.remove('selected'));
                    this.classList.add('selected');
                    updateTimeSlotsForDate(dateStr);
                });
                
                // لو اليوم ده هو اليوم الحالي ونفس الشهر، نحدده تلقائي
                if (thisDate.getTime() === new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) {
                    dayDiv.classList.add('selected');
                }
            }
            calendarDays.appendChild(dayDiv);
        }

        // بعد الرسم: لو فيه يوم محدد نحدث زراير الوقت، لو مفيش نمسح الحالة القديمة
        const selectedDay = document.querySelector('.cal-day.selected');
        if (selectedDay) {
            const selectedDateStr = `${selectedDay.innerText} ${monthNames[month]} ${year}`;
            updateTimeSlotsForDate(selectedDateStr);
        } else {
            // لو بنعرض شهر تاني مفيش يوم محدد، نفضي زراير الوقت
            document.querySelectorAll('.time-slot-btn').forEach(btn => {
                btn.classList.remove('selected', 'booked');
                btn.disabled = false;
            });
        }
    }

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
            price: '£199.00',
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
            const priceNum = parseFloat(item.price.replace('£', ''));
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
    if (totalPriceEl) totalPriceEl.innerText = `£${finalTotal.toFixed(2)}`;
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

