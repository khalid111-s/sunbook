window.sunbookComponents = window.sunbookComponents || {};
window.sunbookComponents.header = `
<div id="promo-banner" class="promo-banner">
    <span data-i18n="header.promoText">✨ Become a member today and get 5% off all books and exclusive sessions!</span>
    <a href="login.html" class="promo-banner-link" data-i18n="header.promoLink">Sign Up Now</a>
</div>
<header class="header">
    <nav class="navbar">
        <a href="index.html" class="logo">
            <span class="logo-text">THE SUN</span>
            <img src="assets/sun-icon.png" alt="Sun Book Icon" class="logo-icon">
            <span class="logo-text">BOOK</span>
        </a>

        <div class="search-wrapper">
            <div class="search-container">
                <input type="text" class="input" placeholder="Search collection..." id="searchInput" data-i18n-placeholder="header.searchPlaceholder">
                <div class="search__icon">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                </div>
            </div>
        </div>

        <div class="nav-actions">
            <!-- عدسة البحث بتاعة الموبايل - بتفتح نفس شريط البحث كـ dropdown تحت الناف بار -->
            <div class="mobile-search-toggle" id="mobileSearchToggle">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
            </div>
            <a href="cart.html" class="cart-container">
                <svg class="cart-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="9" cy="21" r="1"></circle>
                    <circle cx="20" cy="21" r="1"></circle>
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                </svg>
                <span class="cart-badge">0</span>
            </a>
            <button type="button" class="lang-toggle-btn" style="display:none;">العربية</button>
            <div id="auth-container">
                <a href="login.html" class="btn-shop" data-i18n="header.signIn">Sign In / Register</a>
            </div>

            <!-- زرار الموبايل (Hamburger Menu) اللي ضفناه -->
            <div class="mobile-toggle" id="mobileToggle">
                <span class="bar"></span>
                <span class="bar"></span>
                <span class="bar"></span>
            </div>
        </div>

        <!-- الطبقة المعتمة (Overlay) -->
        <div class="sidebar-overlay" id="sidebarOverlay"></div>
        
        <!-- القائمة الجانبية (Sidebar) -->
        <div class="mobile-sidebar" id="mobileSidebar">
            <!-- الهيدر بتاع القائمة -->
            <div class="sidebar-header">
                <a href="index.html" class="logo">
                    <span class="logo-text" style="font-size: 1.2rem;">THE SUN BOOK</span>
                </a>
                <button class="sidebar-close" id="sidebarClose">
                    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
            
            <!-- الروابط الأساسية -->
            <ul class="sidebar-links">
                <li><a href="index.html" data-i18n="header.navHome">Home</a></li>
                <li><a href="about.html" data-i18n="header.navAbout">About Us</a></li>
                <li><a href="faq.html" data-i18n="header.navFaq">FAQ</a></li>
                <li><a href="contact.html" data-i18n="header.navContact">Contact Us</a></li>
                <li><a href="policies.html" data-i18n="header.navPolicies">Policies</a></li>
            </ul>
            
            <!-- الفوتر بتاع القائمة (تسجيل الدخول / الحساب) -->
            <div class="sidebar-footer">
                <button type="button" class="lang-toggle-btn lang-toggle-btn--sidebar" style="display:none;">العربية</button>
                <div id="auth-container" style="width: 100%; text-align: center;">
                    <a href="login.html" class="btn-shop" style="display: block; width: 100%;" data-i18n="header.signIn">Sign In / Register</a>
                </div>
            </div>
        </div>
    </nav>
</header>
`;