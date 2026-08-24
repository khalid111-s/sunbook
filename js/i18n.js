/* =========================================================
   SunBook i18n — English/Arabic language engine
   ---------------------------------------------------------
   - Persists the chosen language in localStorage
   - Sets <html lang> + <html dir> so the browser and CSS both
     know the real reading direction (not a fake mirror effect)
   - Translates any element carrying data-i18n / data-i18n-placeholder /
     data-i18n-aria-label
   - Re-applies itself automatically whenever the header/footer
     (or any other part of the page) gets injected later, and
     whenever the language is toggled — safely, with no infinite
     update loops (it only writes when a value actually changed)
   ========================================================= */
(function () {
    'use strict';

    var STORAGE_KEY = 'sunbook_lang';

    // كل نصوص الواجهة (مش عناوين الكتب ولا اللوجو) بالإنجليزي والعربي
    var dict = {
        en: {
            // ------- Header -------
            'header.promoText': '✨ Become a member today and get 5% off all books and exclusive sessions!',
            'header.promoLink': 'Sign Up Now',
            'header.searchPlaceholder': 'Search collection...',
            'header.signIn': 'Sign In / Register',
            'header.navHome': 'Home',
            'header.navAbout': 'About Us',
            'header.navFaq': 'FAQ',
            'header.navContact': 'Contact Us',
            'header.navPolicies': 'Policies',

            // ------- Footer -------
            'footer.quickLinks': 'Quick Links',
            'footer.about': 'About Us',
            'footer.faq': 'FAQ',
            'footer.contact': 'Contact Us',
            'footer.newsletter': 'Newsletter',
            'footer.emailPlaceholder': 'Enter your email',
            'footer.subscribe': 'Subscribe',
            'footer.followUs': 'Follow Us',
            'footer.privacy': 'Privacy Policy',
            'footer.terms': 'Terms of Service',
            'footer.refund': 'Refund Policy',
            'footer.copyright': '© 2026 The Sun Book. All rights reserved.',

            // ------- Homepage -------
            'index.heroCaption': 'Discover the timeless wisdom hidden in the ancient world.',
            'index.exploreCollection': 'Explore Collection',
            'index.bestOffers': 'Best Offers',
            'index.bestOffersSub': 'Shop our exclusive deals and special offers',
            'index.allProducts': 'All Products',
            'index.allProductsSub': 'Explore our complete collection of ancient mysteries and wisdom',
            'index.bookingWith': 'Exclusive one-on-one with Ahmed Salem',
            'index.duration': '30 minutes',
            'index.fromPrice': 'From LE 199.00',
            'index.available': 'Available',
            'index.viewFullDetails': 'View full details',
            'index.bookNow': 'Book now',

            // ------- Booking modal -------
            'modal.bookMeeting': 'Book a 30 minutes meeting',
            'modal.quantity': 'Quantity 1',
            'modal.whatTime': 'What time works best?',
            'modal.cairoTime': 'Cairo Time',
            'modal.cancellationPolicy': 'Free cancellation up to 4 hours before your session. After that, the booking is final.',
            'modal.confirmBook': 'Confirm & Book',
            'modal.booking': 'Booking...',

            // ------- Product card microcopy (titles/descriptions stay as entered in the DB) -------
            'product.price': 'PRICE',
            'product.addToCart': 'Add to cart',
            'product.outOfStock': 'Out of Stock',
            'product.egyptOnly': 'Egypt Only',
            'product.noOffers': 'No offers right now.',
            'product.noProducts': 'No products yet.',
            'product.loadError': 'Could not load products. Please refresh the page.',

            // ------- Product detail page (product.html) -------
            'product.loadingTitle': 'Loading...',
            'product.loadingDesc': "Loading the book's details and the mysteries within...",
            'product.readMore': 'Read More',
            'product.readLess': 'Read Less',
            'product.previewBook': 'Preview book',
            'product.closePreview': 'Close preview',
            'product.previewComingSoon': 'Full page preview — coming soon',
            'product.tabDetails': 'Edition Details',
            'product.tabReviews': 'Reader Reviews',
            'product.status': 'Status',
            'product.tba': 'To be announced soon',
            'product.yourRating': 'Your rating',
            'product.star1': '1 star',
            'product.star2': '2 stars',
            'product.star3': '3 stars',
            'product.star4': '4 stars',
            'product.star5': '5 stars',
            'product.shareThoughts': 'Share your thoughts about this book...',
            'product.submitReview': 'Submit Review',
            'product.deleteReview': 'Delete my review',
            'product.signInToReview': 'Sign in to leave a rating and share your opinion about this book.',
            'product.signInLink': 'Sign In',
            'product.noReviewsYet': 'No reviews yet. Be the first to share your opinion about this book!',
            'product.relatedTitle': 'You Might Also Like',
            'product.relatedSubtitle': 'More treasures from our collection worth exploring',
            'product.prevBooks': 'Previous books',
            'product.nextBooks': 'Next books',
            'product.notFound': 'Product Not Found',
            'product.notFoundDesc': 'This book is no longer available.',
            'product.selectStarFirst': 'Please select a star rating first',
            'product.writeCommentFirst': 'Please write a short comment',
            'product.thanksReview': 'Thanks for your review!',
            'product.couldNotSubmitReview': 'Could not submit review',
            'product.reviewDeleted': 'Review deleted',
            'product.couldNotDeleteReview': 'Could not delete review',
            'product.addedToCart': 'Product successfully added to cart!',

            // ------- Calendar / booking JS -------
            'calendar.fullyBooked': 'Fully booked',

            // ------- Toasts used on the homepage booking flow -------
            'toast.selectDateTime': 'Please select date & time',
            'toast.signInFirst': 'Please sign in first',
            'toast.redirecting': 'Redirecting to payment...',
            'toast.bookedSuccess': 'Booked successfully!'
        },
        ar: {
            // ------- Header -------
            'header.promoText': '✨ اشترك في العضوية الآن واحصل على خصم 5% على جميع الكتب والجلسات الخاصة!',
            'header.promoLink': 'اشترك الآن',
            'header.searchPlaceholder': 'ابحث في المجموعة...',
            'header.signIn': 'تسجيل الدخول / حساب جديد',
            'header.navHome': 'الرئيسية',
            'header.navAbout': 'من نحن',
            'header.navFaq': 'الأسئلة الشائعة',
            'header.navContact': 'تواصل معنا',
            'header.navPolicies': 'السياسات',

            // ------- Footer -------
            'footer.quickLinks': 'روابط سريعة',
            'footer.about': 'من نحن',
            'footer.faq': 'الأسئلة الشائعة',
            'footer.contact': 'تواصل معنا',
            'footer.newsletter': 'النشرة البريدية',
            'footer.emailPlaceholder': 'أدخل بريدك الإلكتروني',
            'footer.subscribe': 'اشتراك',
            'footer.followUs': 'تابعنا',
            'footer.privacy': 'سياسة الخصوصية',
            'footer.terms': 'شروط الخدمة',
            'footer.refund': 'سياسة الاسترجاع',
            'footer.copyright': '© 2026 The Sun Book. جميع الحقوق محفوظة.',

            // ------- Homepage -------
            'index.heroCaption': 'اكتشف الحكمة الخالدة المخبأة في عالم القدماء.',
            'index.exploreCollection': 'استكشف المجموعة',
            'index.bestOffers': 'أفضل العروض',
            'index.bestOffersSub': 'تسوّق عروضنا الحصرية والخاصة',
            'index.allProducts': 'كل المنتجات',
            'index.allProductsSub': 'استكشف مجموعتنا الكاملة من أسرار وحكمة القدماء',
            'index.bookingWith': 'جلسة خاصة فردية مع أحمد سالم',
            'index.duration': '30 دقيقة',
            'index.fromPrice': 'بسعر يبدأ من 199 جنيه',
            'index.available': 'متاح',
            'index.viewFullDetails': 'عرض كل التفاصيل',
            'index.bookNow': 'احجز الآن',

            // ------- Booking modal -------
            'modal.bookMeeting': 'احجز جلسة مدتها 30 دقيقة',
            'modal.quantity': 'الكمية 1',
            'modal.whatTime': 'ما هو الموعد الأنسب لك؟',
            'modal.cairoTime': 'بتوقيت القاهرة',
            'modal.cancellationPolicy': 'إلغاء مجاني حتى 4 ساعات قبل الجلسة، وبعد ذلك يصبح الحجز نهائيًا.',
            'modal.confirmBook': 'تأكيد الحجز',
            'modal.booking': 'جارٍ الحجز...',

            // ------- Product card microcopy -------
            'product.price': 'السعر',
            'product.addToCart': 'أضف إلى السلة',
            'product.outOfStock': 'غير متوفر',
            'product.egyptOnly': 'داخل مصر فقط',
            'product.noOffers': 'لا توجد عروض حاليًا.',
            'product.noProducts': 'لا توجد منتجات بعد.',
            'product.loadError': 'تعذّر تحميل المنتجات. يُرجى تحديث الصفحة.',

            // ------- Product detail page (product.html) -------
            'product.loadingTitle': 'جارٍ التحميل...',
            'product.loadingDesc': 'جارٍ تحميل تفاصيل الكتاب وأسراره...',
            'product.readMore': 'اقرأ المزيد',
            'product.readLess': 'عرض أقل',
            'product.previewBook': 'معاينة الكتاب',
            'product.closePreview': 'إغلاق المعاينة',
            'product.previewComingSoon': 'معاينة الصفحات الكاملة — قريبًا',
            'product.tabDetails': 'تفاصيل الطبعة',
            'product.tabReviews': 'آراء القرّاء',
            'product.status': 'الحالة',
            'product.tba': 'سيُعلن عنها قريبًا',
            'product.yourRating': 'تقييمك',
            'product.star1': 'نجمة واحدة',
            'product.star2': 'نجمتان',
            'product.star3': '3 نجوم',
            'product.star4': '4 نجوم',
            'product.star5': '5 نجوم',
            'product.shareThoughts': 'شاركنا رأيك في هذا الكتاب...',
            'product.submitReview': 'إرسال التقييم',
            'product.deleteReview': 'حذف تقييمي',
            'product.signInToReview': 'سجّل الدخول لإضافة تقييم ومشاركة رأيك في هذا الكتاب.',
            'product.signInLink': 'تسجيل الدخول',
            'product.noReviewsYet': 'لا توجد تقييمات بعد. كن أول من يشارك رأيه في هذا الكتاب!',
            'product.relatedTitle': 'قد يعجبك أيضًا',
            'product.relatedSubtitle': 'كنوز أخرى من مجموعتنا تستحق الاستكشاف',
            'product.prevBooks': 'الكتب السابقة',
            'product.nextBooks': 'الكتب التالية',
            'product.notFound': 'المنتج غير موجود',
            'product.notFoundDesc': 'هذا الكتاب لم يعد متاحًا.',
            'product.selectStarFirst': 'يُرجى اختيار تقييم بالنجوم أولاً',
            'product.writeCommentFirst': 'يُرجى كتابة تعليق قصير',
            'product.thanksReview': 'شكرًا لك على تقييمك!',
            'product.couldNotSubmitReview': 'تعذّر إرسال التقييم',
            'product.reviewDeleted': 'تم حذف التقييم',
            'product.couldNotDeleteReview': 'تعذّر حذف التقييم',
            'product.addedToCart': 'تمت إضافة المنتج إلى السلة بنجاح!',

            // ------- Calendar / booking JS -------
            'calendar.fullyBooked': 'محجوز بالكامل',

            // ------- Toasts -------
            'toast.selectDateTime': 'من فضلك اختر التاريخ والوقت',
            'toast.signInFirst': 'من فضلك سجّل الدخول أولاً',
            'toast.redirecting': 'جارٍ تحويلك إلى صفحة الدفع...',
            'toast.bookedSuccess': 'تم الحجز بنجاح!'
        }
    };

    // أسماء الشهور وأيام الأسبوع للكالندر - منفصلة عن القاموس العادي لأنها arrays
    var calendarNames = {
        en: {
            months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
            weekdaysShort: ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'],
            dayNamesShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        },
        ar: {
            months: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
            weekdaysShort: ['إثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت', 'أحد'],
            dayNamesShort: ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت']
        }
    };

    function getLang() {
        var stored = localStorage.getItem(STORAGE_KEY);
        return stored === 'ar' || stored === 'en' ? stored : 'en';
    }

    function t(key) {
        var lang = getLang();
        var table = dict[lang] || dict.en;
        if (Object.prototype.hasOwnProperty.call(table, key)) return table[key];
        if (Object.prototype.hasOwnProperty.call(dict.en, key)) return dict.en[key];
        return key;
    }

    function getCalendarNames() {
        return calendarNames[getLang()] || calendarNames.en;
    }

    // العربية بتفرّق بين واحد/اتنين/جمع قليل/جمع كتير في العدّ، عكس الإنجليزي
    // اللي بس بيفرّق بين مفرد وجمع. الدالة دي بترجع الصياغة الصح حسب العدد.
    function formatReviewCount(count) {
        if (getLang() === 'ar') {
            if (count === 1) return 'تقييم واحد';
            if (count === 2) return 'تقييمان';
            if (count >= 3 && count <= 10) return `${count} تقييمات`;
            return `${count} تقييمًا`;
        }
        return `${count} review${count === 1 ? '' : 's'}`;
    }

    function setDocumentDirection() {
        var lang = getLang();
        var dir = lang === 'ar' ? 'rtl' : 'ltr';
        if (document.documentElement.getAttribute('lang') !== lang) {
            document.documentElement.setAttribute('lang', lang);
        }
        if (document.documentElement.getAttribute('dir') !== dir) {
            document.documentElement.setAttribute('dir', dir);
        }
    }

    function applyStaticTranslations() {
        var nodes = document.querySelectorAll('[data-i18n]');
        for (var i = 0; i < nodes.length; i++) {
            var el = nodes[i];
            var val = t(el.getAttribute('data-i18n'));
            if (el.textContent !== val) el.textContent = val;
        }

        var placeholders = document.querySelectorAll('[data-i18n-placeholder]');
        for (var j = 0; j < placeholders.length; j++) {
            var pEl = placeholders[j];
            var pVal = t(pEl.getAttribute('data-i18n-placeholder'));
            if (pEl.getAttribute('placeholder') !== pVal) pEl.setAttribute('placeholder', pVal);
        }

        var arias = document.querySelectorAll('[data-i18n-aria-label]');
        for (var k = 0; k < arias.length; k++) {
            var aEl = arias[k];
            var aVal = t(aEl.getAttribute('data-i18n-aria-label'));
            if (aEl.getAttribute('aria-label') !== aVal) aEl.setAttribute('aria-label', aVal);
        }

        // خلايا أيام الأسبوع في هيدر الكالندر (MO/TU/...) بتتبدل حسب index في مصفوفة weekdaysShort
        var weekdayCells = document.querySelectorAll('[data-i18n-weekday]');
        var weekdayNames = getCalendarNames().weekdaysShort;
        for (var w = 0; w < weekdayCells.length; w++) {
            var wEl = weekdayCells[w];
            var idx = parseInt(wEl.getAttribute('data-i18n-weekday'), 10);
            var wVal = weekdayNames[idx];
            if (wVal !== undefined && wEl.textContent !== wVal) wEl.textContent = wVal;
        }
    }

    function updateToggleButton() {
        var buttons = document.querySelectorAll('.lang-toggle-btn');
        var label = getLang() === 'ar' ? 'English' : 'العربية';
        for (var i = 0; i < buttons.length; i++) {
            var btn = buttons[i];
            if (btn.textContent !== label) btn.textContent = label;
            if (btn.style.display === 'none') btn.style.display = '';
            if (!btn.dataset.bound) {
                btn.dataset.bound = 'true';
                btn.addEventListener('click', function () {
                    var next = getLang() === 'ar' ? 'en' : 'ar';
                    localStorage.setItem(STORAGE_KEY, next);
                    refresh();
                    document.dispatchEvent(new CustomEvent('sunbook:langChanged', { detail: { lang: next } }));
                });
            }
        }
    }

    function refresh() {
        setDocumentDirection();
        applyStaticTranslations();
        updateToggleButton();
    }

    // بيراقب أي جزء من الصفحة بيتغيّر (زي حقن الهيدر/الفوتر أو زرار تسجيل الدخول)
    // ويعيد تطبيق الترجمة تلقائيًا. التحديث بيحصل بس لو القيمة اتغيرت فعليًا،
    // فمفيش خطر لوب لا نهائي حتى لو الـ observer شاف التغييرات دي.
    var observer = new MutationObserver(function () { refresh(); });

    function start() {
        refresh();
        observer.observe(document.body, { childList: true, subtree: true });
    }

    if (document.body) {
        start();
    } else {
        document.addEventListener('DOMContentLoaded', start);
    }

    window.SunBookI18n = {
        t: t,
        getLang: getLang,
        getCalendarNames: getCalendarNames,
        formatReviewCount: formatReviewCount,
        setLanguage: function (lang) {
            localStorage.setItem(STORAGE_KEY, lang === 'ar' ? 'ar' : 'en');
            refresh();
            document.dispatchEvent(new CustomEvent('sunbook:langChanged', { detail: { lang: getLang() } }));
        },
        refresh: refresh
    };
})();
