/* =========================================================
   SunBook i18n — English/Arabic language engine
   ---------------------------------------------------------
   - Persists the chosen language in localStorage
   - Sets <html lang> + <html dir> so the browser and CSS both
     know the real reading direction (not a fake mirror effect)
   - Translates any element carrying data-i18n / data-i18n-placeholder /
     data-i18n-aria-label / data-i18n-title
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

            // ------- Cart page (cart.html) -------
            'cart.yourCart': 'Your Cart',
            'cart.emptyCart': 'Your cart is empty!',
            'cart.signInToCheckout': 'Please sign in to complete your order!',
            'cart.emptyTitle': 'Your cart is empty',
            'cart.emptyText': "Looks like you haven't added any books yet. Explore our collection of ancient wisdom and find your next great read.",
            'cart.browseBooks': 'Browse Books',
            'cart.typeDigital': 'Digital (PDF)',
            'cart.typeSession': 'Session',
            'cart.typePhysical': 'Physical Book',
            'cart.typeBoth': 'Physical + Digital',
            'cart.remove': 'Remove',
            'cart.orderSummary': 'Order Summary',
            'cart.subtotal': 'Subtotal',
            'cart.memberDiscount': 'Member Discount (5%)',
            'cart.promoLabel': 'Promo',
            'cart.promoPlaceholder': 'Enter code',
            'cart.promoPlaceholderExample': 'Enter code (e.g. SUN7)',
            'cart.applied': 'Applied',
            'cart.apply': 'Apply',
            'cart.total': 'Total',
            'cart.proceedCheckout': 'Proceed to Checkout',
            'cart.enterCode': 'Please enter a code.',
            'cart.checking': 'Checking...',
            'cart.invalidCode': 'Invalid promo code.',

            // ------- Auth page (login.html) -------
            'auth.signIn': 'Sign In',
            'auth.register': 'Register',
            'auth.emailAddress': 'Email Address',
            'auth.password': 'Password',
            'auth.forgotPassword': 'Forgot Password?',
            'auth.fullName': 'Full Name',
            'auth.createAccount': 'Create Account',
            'auth.orContinueWith': 'or continue with',
            'auth.facebookNotConfigured': 'Facebook login is not configured yet.',

            // ------- Checkout page (checkout.html) -------
            'checkout.instantDigitalTitle': 'Instant Digital Delivery',
            'checkout.instantDigitalText': 'No shipping needed. Your books will be available for download immediately after payment.',
            'checkout.shippingAddress': 'Shipping Address',
            'checkout.firstName': 'First Name',
            'checkout.lastName': 'Last Name',
            'checkout.fullAddress': 'Full Address (Street, Building, Apt)',
            'checkout.selectGovernorate': 'Select Governorate',
            'checkout.selectDistrict': 'Select District',
            'checkout.select': 'Select',
            'checkout.paymentMethod': 'Payment Method',
            'checkout.securePaymentNotice': "You'll be redirected to our secure payment page to enter your card or mobile wallet details safely.",
            'checkout.payNowComplete': 'Pay Now & Complete Order',
            'checkout.payConfirmSession': 'Pay & Confirm Session',
            'checkout.payDownloadNow': 'Pay & Download Now',
            'checkout.processing': 'Processing...',
            'checkout.discount': 'Discount',
            'checkout.totalToPay': 'Total to pay',
            'checkout.paymentSuccessful': 'Payment Successful!',
            'checkout.orderPlacedSecurely': 'Your order has been placed securely.',
            'checkout.yourDigitalLibrary': 'Your Digital Library',
            'checkout.digitalBook': 'Digital Book',
            'checkout.downloadAll': 'Download All',
            'checkout.downloading': 'Downloading...',
            'checkout.orderNumberLabel': 'Order Number',
            'checkout.copyOrderNumber': 'Copy order number',
            'checkout.copied': 'Copied!',
            'checkout.goToProfile': 'Go to My Profile',
            'checkout.paymentConfirmedOrder': 'Payment confirmed — order #{orderNum} is on its way.',
            'checkout.paymentNotCompleted': 'Payment Not Completed',
            'checkout.couldNotConfirmPayment': "We couldn't confirm your payment. Your cart is still saved — please try again.",
            'checkout.signInToBookSession': 'Please sign in with your account to book a session.',
            'checkout.bookingFailed': 'Booking failed',
            'checkout.orderFailed': 'Order failed',
            'checkout.downloadsLeft': '{n} Downloads left',
            'checkout.limitReached': 'Limit reached',
            'checkout.downloadLimitReached': 'Download limit reached for this book.',
            'checkout.downloadingPrefix': 'Downloading: ',
            'checkout.fieldRequired': 'This field is required',
            'checkout.invalidEgyptianPhone': 'Please enter a valid Egyptian number (11 digits starting with 01)',
            'checkout.fillAllFields': 'Please fill in all required fields correctly.',
            'checkout.digitalReadyPrefix': 'Your digital books are ready for download. ',
            'checkout.sessionConfirmedFragment': 'Your session has been confirmed. ',
            'checkout.physicalShippedFragment': 'Physical items will be shipped to your address.',
            'checkout.digitalReadyOnly': 'Your digital books are ready! Click below to download.',
            'checkout.sessionBookedPhysical': 'Your session has been booked successfully! Physical items will be shipped to your address.',
            'checkout.sessionBookedOnly': 'Your session has been booked successfully! Check your profile for details.',
            'checkout.orderPlacedGeneric': 'Your order has been placed securely. A receipt has been sent to your email.',
            'checkout.sessionBookingTitle': 'Session Booking',
            'checkout.sessionBookingText': 'Your one-on-one session will be confirmed immediately after payment. No shipping required.',
            'checkout.instantDeliverySessionTitle': 'Instant Delivery & Session',
            'checkout.instantDeliverySessionText': 'Your digital books will be available for download and your session will be confirmed immediately after payment.',
            'checkout.physicalOrderNotice': '<strong>{label}:</strong> Please provide your shipping address below. Your books will be delivered to your door.',
            'checkout.physicalOrderLabel': 'Physical Order',
            'checkout.mixedOrderLabel': 'Mixed Order',
            'checkout.orderSummaryLabel': 'Order Summary',
            'checkout.mixedDigitalPhysicalNotice': '<strong>{label}:</strong> Digital files will be available for instant download. Physical books will be shipped to your address below.',
            'checkout.summaryPhysicalSessionNotice': '<strong>{label}:</strong> Your session will be confirmed after payment. Physical books will be shipped to your address below.',
            'checkout.mixedAllNotice': '<strong>{label}:</strong> Your session will be confirmed and digital files will be available for download. Physical books will be shipped to your address below.',
            // ملحوظة: أسماء المحافظات دي أسماء أماكن رسمية معروفة، فترجمتها مضمونة ودقيقة
            'checkout.gov.Cairo': 'Cairo',
            'checkout.gov.Alexandria': 'Alexandria',
            'checkout.gov.Giza': 'Giza',
            'checkout.gov.Sharqia': 'Sharqia',
            'checkout.gov.Beheira': 'Beheira',
            'checkout.gov.Qalyubia': 'Qalyubia',
            'checkout.gov.Monufia': 'Monufia',
            'checkout.gov.Gharbia': 'Gharbia',
            'checkout.gov.Dakahlia': 'Dakahlia',
            'checkout.gov.KafrElSheikh': 'Kafr El Sheikh',
            'checkout.gov.Damietta': 'Damietta',
            'checkout.gov.PortSaid': 'Port Said',
            'checkout.gov.Suez': 'Suez',
            'checkout.gov.Ismailia': 'Ismailia',
            'checkout.gov.Faiyum': 'Faiyum',
            'checkout.gov.BeniSuef': 'Beni Suef',
            'checkout.gov.Minya': 'Minya',
            'checkout.gov.Asyut': 'Asyut',
            'checkout.gov.Sohag': 'Sohag',
            'checkout.gov.Qena': 'Qena',
            'checkout.gov.Luxor': 'Luxor',
            'checkout.gov.Aswan': 'Aswan',
            'checkout.gov.RedSea': 'Red Sea',
            'checkout.gov.Matrouh': 'Matrouh',
            'checkout.gov.NorthSinai': 'North Sinai',
            'checkout.gov.SouthSinai': 'South Sinai',
            'checkout.gov.NewValley': 'New Valley',

            // ------- Booking details page (booking-details.html) -------
            'bookingDetails.taxIncluded': 'Tax included.',
            'bookingDetails.tagline': 'A private 30-minute one-on-one zoom session with Ahmed Salem for personalized guidance and insight.',
            'bookingDetails.p1': 'Sometimes You Don’t Need More Information. You Need Clarity from Someone Who Actually Gets It.',
            'bookingDetails.p2': 'You’ve evolved too far to settle for surface-level advice, but not far enough to unlock the next level alone.',
            'bookingDetails.p3': 'That’s where Seeking Advice comes in; a real 1-on-1 conversation with Ahmed Salem to sort through the noise and find what truly matters.',
            'bookingDetails.notTherapy': 'Not therapy. Not coaching.',
            'bookingDetails.p4': 'But a direct transmission of clarity, personal insight, and decoded truth drawn from ancient systems, depth psychology, symbolism, and occultism.',
            'bookingDetails.chanceTo': 'It’s your chance to:',
            'bookingDetails.li1': 'Ask the real questions.',
            'bookingDetails.li2': 'See what’s been in front of you the whole time.',
            'bookingDetails.li3': 'Make connections no one else could help you make.',
            'bookingDetails.p5': "I don't usually offer this but I'm opening a limited window for one-on-one sessions. One 30 minute call can save you years of wasted time, confusion, and misaligned choices.",
            'bookingDetails.p6': 'Feel free to book your session today.',

            // ------- Profile page (profile.html) -------
            'profile.physicalOrders': 'Physical Orders',
            'profile.digitalLibrary': 'Digital Library',
            'profile.bookedSessions': 'Booked Sessions',
            'profile.settings': 'Settings',
            'profile.goToAdmin': 'Go to Admin Panel',
            'profile.signOut': 'Sign Out',
            'profile.physicalOrdersTracking': 'Physical Orders & Tracking',
            'profile.myDigitalLibrary': 'My Digital Library',
            'profile.upcomingSessions': 'Upcoming Sessions',
            'profile.accountSettings': 'Account Settings',
            'profile.personalInfo': 'Personal Information',
            'profile.nameChangeNote': 'You can only change your name once every 30 days.',
            'profile.defaultShippingAddress': 'Default Shipping Address',
            'profile.streetBuildingApt': 'Street, Building, Apartment, City',
            'profile.preferences': 'Preferences',
            'profile.newsletterCheckbox': 'Receive newsletter and exclusive ancient wisdom offers',
            'profile.changePassword': 'Change Password',
            'profile.currentPassword': 'Current Password',
            'profile.newPassword': 'New Password',
            'profile.confirmNewPassword': 'Confirm New Password',
            'profile.saveAllChanges': 'Save All Changes',
            'profile.deleteAccount': 'Delete Account',
            'profile.deleteAccountText': 'Permanently delete your account and all associated data, including your orders, bookings, and reviews. This action cannot be undone.',
            'profile.deleteMyAccount': 'Delete My Account',
            'profile.rescheduleSession': 'Reschedule Session',
            'profile.rescheduleNote': 'You can only reschedule a session once. Choose a new date and time below.',
            'profile.newDate': 'New Date',
            'profile.newTime': 'New Time',
            'profile.confirmNewTime': 'Confirm New Time',
            'profile.deleteAccountModalTextBefore': 'This will permanently delete your account and all your data. This action cannot be undone. Type',
            'profile.deleteAccountModalTextAfter': 'below to confirm.',
            'profile.typeDeleteToConfirm': 'Type DELETE to confirm',
            'profile.permanentlyDeleteBtn': 'Permanently Delete My Account',
            'profile.noPhysicalOrders': 'No physical orders to track.',
            'profile.statusProcessing': 'Processing',
            'profile.statusShipped': 'Shipped',
            'profile.statusDelivered': 'Delivered',
            'profile.statusCancelled': 'Cancelled',
            'profile.orderHash': 'Order #',
            'profile.totalLabel': 'Total:',
            'profile.dateLabel': 'Date:',
            'profile.trackPlaced': 'Placed',
            'profile.cancelOrder': 'Cancel Order',
            'profile.cancellingState': 'Cancelling...',
            'profile.cancelOrderConfirm': 'Cancel this order and get a full refund? This cannot be undone.',
            'profile.orderCancelledRefunded': 'Order cancelled and refunded.',
            'profile.couldNotLoadOrders': 'Could not load your orders right now.',
            'profile.emptyLibrary': 'Your digital library is empty.',
            'profile.downloadLimitReached': 'Download Limit Reached',
            'profile.downloadPdf': 'Download PDF',
            'profile.downloadingAlert': 'Downloading',
            'profile.noUpcomingSessions': 'No upcoming sessions.',
            'profile.oneOnOneSessionDefault': 'One-on-One Session',
            'profile.minSuffix': 'min',
            'profile.joinSession': 'Join Session',
            'profile.completedStatus': 'Completed',
            'profile.reschedule': 'Reschedule',
            'profile.cancelSession': 'Cancel Session',
            'profile.waitingPaymentConfirmation': 'Waiting for payment confirmation.',
            'profile.sessionWillAppear': 'Session will appear here once confirmed.',
            'profile.cancelSessionConfirm': "Cancel this session? Free cancellation applies since it's more than 4 hours away.",
            'profile.sessionCancelledRefunded': 'Session cancelled and refunded.',
            'profile.errorLoadingSessions': 'Error loading sessions:',
            'profile.nameRequired': 'Name is required',
            'profile.settingsSaved': 'Settings saved successfully!',
            'profile.failedSaveSettings': 'Failed to save settings',
            'profile.recentNameChangeNote': 'You recently changed your name. You can change it again in {days} days.',
            'profile.pleaseSelectDateTime': 'Please select a date and time.',
            'profile.reschedulingState': 'Rescheduling...',
            'profile.sessionRescheduled': 'Session rescheduled successfully!',
            'profile.couldNotReschedule': 'Could not reschedule. Please try again.',
            'profile.pleaseTypeDelete': 'Please type DELETE to confirm.',
            'profile.deletingState': 'Deleting...',
            'profile.accountDeleted': 'Your account has been deleted.',
            'profile.failedDeleteAccount': 'Failed to delete account. Please try again.',
            // حالات الجلسة/الحجز الخام القادمة من الباك إند (fallback للقيمة الأصلية لو مش موجودة هنا)
            'profile.status.live': 'Live',
            'profile.status.scheduled': 'Scheduled',
            'profile.status.completed': 'Completed',
            'profile.status.cancelled': 'Cancelled',
            'profile.status.pending': 'Pending',
            'profile.status.paid': 'Paid',

            // ------- About page (about.html) -------
            'about.ourStory': 'Our Story',
            'about.storyText': 'Welcome to <strong>The Sun Book</strong>, a sanctuary for seekers of truth and ancient wisdom. We traverse the boundaries of time to bring you the most profound esoteric literature, hidden knowledge, and forgotten rituals.',
            'about.ourMission': 'Our Mission',
            'about.missionText': 'For centuries, the wisdom of the ancients has been guarded by secret societies and lost in the sands of time. Our mission is to curate and preserve these mystical texts, making them accessible to modern scholars, occultists, and those who dare to look beyond the veil.',

            // ------- FAQ page (faq.html) -------
            'faq.title': 'Frequently Asked Questions',
            'faq.subtitle': 'Everything you need to know about orders, digital books, sessions, and payments',
            'faq.stillNeedHelp': 'Still have a question?',
            'faq.cat.shipping': 'Orders & Shipping',
            'faq.shipping.q1': 'Do you ship physical books outside Egypt?',
            'faq.shipping.a1': "Right now, physical book delivery is available across Egypt only — from Cairo and Alexandria to every governorate in the country. If you're outside Egypt, you can still enjoy our Digital (PDF) editions or book a live one-on-one session instantly, from anywhere in the world.",
            'faq.shipping.q2': 'How much does shipping cost?',
            'faq.shipping.a2': 'Shipping is free on every physical order across Egypt — the price you see at checkout is the price you pay, with no extra delivery fees added.',
            'faq.shipping.q3': 'How long will my order take to arrive?',
            'faq.shipping.a3': "Delivery times vary slightly by governorate, with Cairo and Alexandria usually arriving fastest. You can follow your order's progress anytime from your Profile — if it's taking longer than expected, message us on WhatsApp and we'll check on it for you.",
            'faq.shipping.q4': 'Can I track my order?',
            'faq.shipping.a4': 'Yes — open your Profile and check the "Physical Orders & Tracking" section. Each order shows its current status: Processing, Shipped, or Delivered.',
            'faq.shipping.q5': 'What does the "Egypt Only" label on a book mean?',
            'faq.shipping.a5': 'Some rare or limited titles are marked "Egypt Only" on their product page. This means that specific edition can only be delivered within Egypt and isn\'t available for international shipping, even as part of a mixed cart.',
            'faq.cat.digital': 'Digital Books',
            'faq.digital.q1': "What's the difference between a Physical and a Digital book?",
            'faq.digital.a1': 'A Physical book is the real printed copy, shipped to your door anywhere in Egypt. A Digital book is a PDF edition you can download and read instantly on any device — no shipping required, and available to anyone, anywhere in the world.',
            'faq.digital.q2': 'Where do I find my digital books after buying them?',
            'faq.digital.a2': 'Right after payment, your download links appear directly on the confirmation screen. From then on, every digital book you\'ve bought stays saved in "My Digital Library" inside your Profile, ready to download anytime.',
            'faq.digital.q3': 'Can I re-download a digital book if I lose the file?',
            'faq.digital.a3': 'Yes — your digital books live permanently in "My Digital Library" in your Profile, so you can come back and download them again anytime without paying for them twice.',
            'faq.cat.payments': 'Payments & Pricing',
            'faq.payments.q1': 'What payment methods do you accept?',
            'faq.payments.a1': "We accept credit/debit cards and mobile wallets. At checkout, you'll be redirected to our secure payment page to enter your details safely.",
            'faq.payments.q2': 'Is it safe to pay on The Sun Book?',
            'faq.payments.a2': 'Yes. We never see or store your card details ourselves — every payment is processed through a secure, encrypted payment gateway, the same kind of technology used by major online stores.',
            'faq.payments.q3': 'Why do I see prices in Euros (€) instead of Egyptian Pounds?',
            'faq.payments.a3': 'Prices are shown in Egyptian Pounds (LE) for visitors browsing from Egypt, and in Euros (€) for visitors from other countries — detected automatically based on your location, so you always see a currency that makes sense for you.',
            'faq.payments.q4': 'Do you offer any discounts?',
            'faq.payments.a4': 'Yes — creating a free account gets you an automatic 5% member discount on every order. We also feature limited-time deals on select titles in our "Best Offers" section.',
            'faq.payments.q5': 'How do I use a promo code?',
            'faq.payments.a5': 'Enter your code in the "Enter code" box in your Cart and press Apply. The discount is calculated automatically before you pay — no need to contact us.',
            'faq.cat.sessions': 'One-on-One Sessions',
            'faq.sessions.q1': 'How do the one-on-one sessions work?',
            'faq.sessions.a1': 'One-on-one sessions are live video sessions with a mentor, held in a secure video room. Once you\'ve paid, your session is confirmed instantly and appears under "Upcoming Sessions" in your Profile, with a "Join" button that activates at your scheduled time.',
            'faq.sessions.q2': 'Can I reschedule or cancel a session?',
            'faq.sessions.a2': 'Yes. Each session can be rescheduled once, or cancelled for a full refund — both up to 4 hours before your scheduled time, right from "Upcoming Sessions" in your Profile. After that window, sessions can no longer be changed.',
            'faq.sessions.q3': 'What happens if I miss my scheduled session?',
            'faq.sessions.a3': "If you miss a session without cancelling at least 4 hours beforehand, it's marked as missed and isn't automatically refunded. Reach out to us on WhatsApp and we'll review it with you.",
            'faq.cat.account': 'Returns, Refunds & Account',
            'faq.account.q1': 'What is your return and refund policy?',
            'faq.account.a1': 'Physical orders can be cancelled for a full refund anytime before they ship, right from your Profile. Once an order has shipped, our standard 14-day return policy applies instead — see our full <a href="policies.html#refund">Refund Policy</a> for details. Digital books can\'t be cancelled or refunded, since the files are delivered to you immediately after payment.',
            'faq.account.q2': 'Do I need to create an account to buy something?',
            'faq.account.a2': 'Yes, a free account is required at checkout. This keeps your order history, digital library, and session bookings all in one place, and lets you track everything from your Profile.',
            'faq.account.q3': 'How do I delete my account?',
            'faq.account.a3': "You can permanently delete your account and all its data anytime from your Profile → Account Settings → Delete Account. This action is permanent and can't be undone.",
            'faq.account.q4': 'Is my personal information safe?',
            'faq.account.a4': 'Absolutely. We only collect the minimum data needed to process your orders and never sell or share your personal information — see our full <a href="policies.html#privacy">Privacy Policy</a> for details.',

            // ------- Contact page (contact.html) -------
            'contact.getInTouch': 'Get in Touch',
            'contact.subtitle': 'Reach out to us for any inquiries about our ancient collections, esoteric knowledge, or seeking wisdom.',
            'contact.info': 'Contact Information',
            'contact.emailUs': 'Email Us',
            'contact.whatsappPhone': 'WhatsApp & Phone',
            'contact.workingHours': 'Working Hours',
            'contact.workingHoursValue': 'Mon - Fri: 9:00 AM - 6:00 PM<br>Cairo Time (EEST)',
            'contact.yourName': 'Your Name',
            'contact.yourEmail': 'Your Email',
            'contact.subject': 'Subject',
            'contact.yourMessage': 'Your Message...',
            'contact.sendMessage': 'Send Message',
            'contact.messageSent': 'Message sent successfully! We will get back to you soon.',

            // ------- Policies page (policies.html) -------
            'policies.privacyTitle': 'Privacy Policy',
            'policies.privacyText1': 'At <strong>The Sun Book</strong>, we are committed to protecting your privacy. We collect minimal personal data required to process your orders and improve your shopping experience.',
            'policies.privacyText2': 'We do not sell, trade, or rent your personal identification information to others. Any data collected through our newsletter or checkout process is securely encrypted.',
            'policies.termsTitle': 'Terms of Service',
            'policies.termsText1': 'By using <strong>The Sun Book</strong> website, you agree to be bound by these terms. All content, including books, descriptions, and designs, is intellectual property.',
            'policies.termsText2': 'We reserve the right to modify prices, discontinue products, or update these terms at any time without prior notice.',
            'policies.refundTitle': 'Refund Policy',
            'policies.refundText1': 'We want you to be completely satisfied with your mystery books. If you are not happy with your purchase, you may return it within <strong>14 days</strong> of delivery.',
            'policies.refundText2': 'Items must be returned in their original, unused condition. Shipping costs for returns are the responsibility of the customer unless the item arrived damaged.',

            // ------- Forgot/Reset password pages -------
            'forgotPw.title': 'Forgot Password?',
            'forgotPw.subtitle': "Enter your email and we'll send you a link to reset your password.",
            'forgotPw.sendResetLink': 'Send Reset Link',
            'forgotPw.backToSignIn': '← Back to Sign In',
            'forgotPw.sending': 'Sending...',
            'forgotPw.linkSentIfExists': 'If an account with that email exists, a reset link has been sent.',
            'forgotPw.somethingWentWrong': 'Something went wrong. Please try again.',
            'resetPw.title': 'Set a New Password',
            'resetPw.subtitle': 'Choose a new password for your account.',
            'resetPw.resetPassword': 'Reset Password',
            'resetPw.invalidLink': 'This reset link is invalid. Please request a new one from the sign-in page.',
            'resetPw.tooShort': 'Password must be at least 6 characters.',
            'resetPw.noMatch': 'Passwords do not match.',
            'resetPw.resetting': 'Resetting...',
            'resetPw.updatedRedirecting': 'Password updated! Redirecting...',
            'resetPw.invalidOrExpired': 'This link is invalid or has expired.',

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

            // ------- Cart page (cart.html) -------
            'cart.yourCart': 'سلتك',
            'cart.emptyCart': 'سلتك فارغة!',
            'cart.signInToCheckout': 'يُرجى تسجيل الدخول لإتمام طلبك!',
            'cart.emptyTitle': 'سلتك فارغة',
            'cart.emptyText': 'يبدو أنك لم تُضِف أي كتب بعد. استكشف مجموعتنا من حكمة القدماء وابحث عن قراءتك القادمة.',
            'cart.browseBooks': 'تصفّح الكتب',
            'cart.typeDigital': 'نسخة رقمية (PDF)',
            'cart.typeSession': 'جلسة',
            'cart.typePhysical': 'كتاب ورقي',
            'cart.typeBoth': 'ورقي + رقمي',
            'cart.remove': 'إزالة',
            'cart.orderSummary': 'ملخص الطلب',
            'cart.subtotal': 'المجموع الفرعي',
            'cart.memberDiscount': 'خصم الأعضاء (5%)',
            'cart.promoLabel': 'كود الخصم',
            'cart.promoPlaceholder': 'أدخل الكود',
            'cart.promoPlaceholderExample': 'أدخل الكود (مثال: SUN7)',
            'cart.applied': 'تم التطبيق',
            'cart.apply': 'تطبيق',
            'cart.total': 'الإجمالي',
            'cart.proceedCheckout': 'المتابعة إلى الدفع',
            'cart.enterCode': 'يُرجى إدخال كود الخصم.',
            'cart.checking': 'جارٍ التحقق...',
            'cart.invalidCode': 'كود الخصم غير صالح.',

            // ------- Auth page (login.html) -------
            'auth.signIn': 'تسجيل الدخول',
            'auth.register': 'حساب جديد',
            'auth.emailAddress': 'البريد الإلكتروني',
            'auth.password': 'كلمة المرور',
            'auth.forgotPassword': 'نسيت كلمة المرور؟',
            'auth.fullName': 'الاسم الكامل',
            'auth.createAccount': 'إنشاء حساب',
            'auth.orContinueWith': 'أو تابع باستخدام',
            'auth.facebookNotConfigured': 'تسجيل الدخول عبر فيسبوك غير مُفعّل حاليًا.',

            // ------- Checkout page (checkout.html) -------
            'checkout.instantDigitalTitle': 'تسليم رقمي فوري',
            'checkout.instantDigitalText': 'لا حاجة للشحن. ستكون كتبك متاحة للتحميل فور إتمام الدفع.',
            'checkout.shippingAddress': 'عنوان الشحن',
            'checkout.firstName': 'الاسم الأول',
            'checkout.lastName': 'اسم العائلة',
            'checkout.fullAddress': 'العنوان بالكامل (الشارع، المبنى، الشقة)',
            'checkout.selectGovernorate': 'اختر المحافظة',
            'checkout.selectDistrict': 'اختر الحي',
            'checkout.select': 'اختر',
            'checkout.paymentMethod': 'طريقة الدفع',
            'checkout.securePaymentNotice': 'سيتم تحويلك إلى صفحة الدفع الآمنة لإدخال بيانات بطاقتك أو محفظتك الإلكترونية بأمان.',
            'checkout.payNowComplete': 'ادفع الآن وأكمل الطلب',
            'checkout.payConfirmSession': 'ادفع وأكّد الجلسة',
            'checkout.payDownloadNow': 'ادفع وحمّل الآن',
            'checkout.processing': 'جارٍ المعالجة...',
            'checkout.discount': 'الخصم',
            'checkout.totalToPay': 'الإجمالي المطلوب دفعه',
            'checkout.paymentSuccessful': 'تم الدفع بنجاح!',
            'checkout.orderPlacedSecurely': 'تم تسجيل طلبك بأمان.',
            'checkout.yourDigitalLibrary': 'مكتبتك الرقمية',
            'checkout.digitalBook': 'كتاب رقمي',
            'checkout.downloadAll': 'تحميل الكل',
            'checkout.downloading': 'جارٍ التحميل...',
            'checkout.orderNumberLabel': 'رقم الطلب',
            'checkout.copyOrderNumber': 'نسخ رقم الطلب',
            'checkout.copied': 'تم النسخ!',
            'checkout.goToProfile': 'الذهاب إلى حسابي',
            'checkout.paymentConfirmedOrder': 'تم تأكيد الدفع — الطلب رقم #{orderNum} في طريقه إليك.',
            'checkout.paymentNotCompleted': 'لم تكتمل عملية الدفع',
            'checkout.couldNotConfirmPayment': 'تعذّر تأكيد عملية الدفع. سلتك محفوظة كما هي — يُرجى المحاولة مرة أخرى.',
            'checkout.signInToBookSession': 'يُرجى تسجيل الدخول لحجز جلسة.',
            'checkout.bookingFailed': 'فشل الحجز',
            'checkout.orderFailed': 'فشل تنفيذ الطلب',
            'checkout.downloadsLeft': 'باقي {n} تحميلات',
            'checkout.limitReached': 'انتهى الحد المسموح',
            'checkout.downloadLimitReached': 'تم الوصول للحد الأقصى من التحميلات لهذا الكتاب.',
            'checkout.downloadingPrefix': 'جارٍ تحميل: ',
            'checkout.fieldRequired': 'هذا الحقل مطلوب',
            'checkout.invalidEgyptianPhone': 'يُرجى إدخال رقم مصري صحيح (11 رقمًا يبدأ بـ 01)',
            'checkout.fillAllFields': 'يُرجى تعبئة جميع الحقول المطلوبة بشكل صحيح.',
            'checkout.digitalReadyPrefix': 'كتبك الرقمية جاهزة للتحميل. ',
            'checkout.sessionConfirmedFragment': 'تم تأكيد جلستك. ',
            'checkout.physicalShippedFragment': 'سيتم شحن الكتب الورقية إلى عنوانك.',
            'checkout.digitalReadyOnly': 'كتبك الرقمية جاهزة! اضغط أدناه للتحميل.',
            'checkout.sessionBookedPhysical': 'تم حجز جلستك بنجاح! سيتم شحن الكتب الورقية إلى عنوانك.',
            'checkout.sessionBookedOnly': 'تم حجز جلستك بنجاح! راجع حسابك للتفاصيل.',
            'checkout.orderPlacedGeneric': 'تم تسجيل طلبك بأمان. تم إرسال إيصال إلى بريدك الإلكتروني.',
            'checkout.sessionBookingTitle': 'حجز جلسة',
            'checkout.sessionBookingText': 'سيتم تأكيد جلستك الفردية فور إتمام الدفع. لا حاجة للشحن.',
            'checkout.instantDeliverySessionTitle': 'تسليم فوري وجلسة',
            'checkout.instantDeliverySessionText': 'ستكون كتبك الرقمية متاحة للتحميل وستُؤكَّد جلستك فور إتمام الدفع.',
            'checkout.physicalOrderNotice': '<strong>{label}:</strong> يُرجى إدخال عنوان الشحن أدناه. سيتم توصيل كتبك إلى باب منزلك.',
            'checkout.physicalOrderLabel': 'طلب كتب ورقية',
            'checkout.mixedOrderLabel': 'طلب متعدد',
            'checkout.orderSummaryLabel': 'ملخص الطلب',
            'checkout.mixedDigitalPhysicalNotice': '<strong>{label}:</strong> ستكون الملفات الرقمية متاحة للتحميل الفوري. سيتم شحن الكتب الورقية إلى عنوانك أدناه.',
            'checkout.summaryPhysicalSessionNotice': '<strong>{label}:</strong> سيتم تأكيد جلستك بعد الدفع. سيتم شحن الكتب الورقية إلى عنوانك أدناه.',
            'checkout.mixedAllNotice': '<strong>{label}:</strong> سيتم تأكيد جلستك وستكون الملفات الرقمية متاحة للتحميل. سيتم شحن الكتب الورقية إلى عنوانك أدناه.',
            // أسماء المحافظات المصرية - أسماء رسمية معروفة
            'checkout.gov.Cairo': 'القاهرة',
            'checkout.gov.Alexandria': 'الإسكندرية',
            'checkout.gov.Giza': 'الجيزة',
            'checkout.gov.Sharqia': 'الشرقية',
            'checkout.gov.Beheira': 'البحيرة',
            'checkout.gov.Qalyubia': 'القليوبية',
            'checkout.gov.Monufia': 'المنوفية',
            'checkout.gov.Gharbia': 'الغربية',
            'checkout.gov.Dakahlia': 'الدقهلية',
            'checkout.gov.KafrElSheikh': 'كفر الشيخ',
            'checkout.gov.Damietta': 'دمياط',
            'checkout.gov.PortSaid': 'بورسعيد',
            'checkout.gov.Suez': 'السويس',
            'checkout.gov.Ismailia': 'الإسماعيلية',
            'checkout.gov.Faiyum': 'الفيوم',
            'checkout.gov.BeniSuef': 'بني سويف',
            'checkout.gov.Minya': 'المنيا',
            'checkout.gov.Asyut': 'أسيوط',
            'checkout.gov.Sohag': 'سوهاج',
            'checkout.gov.Qena': 'قنا',
            'checkout.gov.Luxor': 'الأقصر',
            'checkout.gov.Aswan': 'أسوان',
            'checkout.gov.RedSea': 'البحر الأحمر',
            'checkout.gov.Matrouh': 'مطروح',
            'checkout.gov.NorthSinai': 'شمال سيناء',
            'checkout.gov.SouthSinai': 'جنوب سيناء',
            'checkout.gov.NewValley': 'الوادي الجديد',

            // ------- Booking details page (booking-details.html) -------
            'bookingDetails.taxIncluded': 'شامل الضريبة.',
            'bookingDetails.tagline': 'جلسة خاصة عبر الزوم لمدة 30 دقيقة مع أحمد سالم، لتوجيه شخصي ورؤية أعمق.',
            'bookingDetails.p1': 'أحيانًا لا تحتاج إلى مزيد من المعلومات، بل تحتاج إلى وضوح من شخص يفهم الأمر فعلًا.',
            'bookingDetails.p2': 'لقد تجاوزت مرحلة الاكتفاء بالنصائح السطحية، لكنك لم تصل بعد إلى القدرة على الانتقال للمستوى التالي وحدك.',
            'bookingDetails.p3': 'وهنا يأتي دور "طلب الاستشارة"؛ محادثة حقيقية فردية مع أحمد سالم لتصفية الضجيج والوصول إلى ما يهم فعلًا.',
            'bookingDetails.notTherapy': 'ليست علاجًا نفسيًا. وليست تدريبًا.',
            'bookingDetails.p4': 'بل نقل مباشر للوضوح والرؤية الشخصية والحقيقة المفكوكة رموزها، مستمدة من الأنظمة القديمة وعلم النفس التحليلي والرمزية وعلوم الغيب.',
            'bookingDetails.chanceTo': 'إنها فرصتك لكي:',
            'bookingDetails.li1': 'تطرح الأسئلة الحقيقية.',
            'bookingDetails.li2': 'ترى ما كان أمامك طوال الوقت.',
            'bookingDetails.li3': 'تكتشف روابط ما كان أحد ليساعدك على إدراكها.',
            'bookingDetails.p5': 'لا أقدّم هذا عادةً، لكنني أفتح نافذة محدودة لجلسات فردية. مكالمة واحدة مدتها 30 دقيقة قد توفّر عليك سنوات من الوقت الضائع والحيرة والقرارات الخاطئة.',
            'bookingDetails.p6': 'لا تتردد في حجز جلستك اليوم.',

            // ------- Profile page (profile.html) -------
            'profile.physicalOrders': 'الطلبات الورقية',
            'profile.digitalLibrary': 'المكتبة الرقمية',
            'profile.bookedSessions': 'الجلسات المحجوزة',
            'profile.settings': 'الإعدادات',
            'profile.goToAdmin': 'الذهاب إلى لوحة التحكم',
            'profile.signOut': 'تسجيل الخروج',
            'profile.physicalOrdersTracking': 'الطلبات الورقية وتتبعها',
            'profile.myDigitalLibrary': 'مكتبتي الرقمية',
            'profile.upcomingSessions': 'الجلسات القادمة',
            'profile.accountSettings': 'إعدادات الحساب',
            'profile.personalInfo': 'البيانات الشخصية',
            'profile.nameChangeNote': 'يمكنك تغيير اسمك مرة واحدة فقط كل 30 يومًا.',
            'profile.defaultShippingAddress': 'عنوان الشحن الافتراضي',
            'profile.streetBuildingApt': 'الشارع، المبنى، الشقة، المدينة',
            'profile.preferences': 'التفضيلات',
            'profile.newsletterCheckbox': 'أرغب في تلقي النشرة البريدية والعروض الحصرية لحكمة القدماء',
            'profile.changePassword': 'تغيير كلمة المرور',
            'profile.currentPassword': 'كلمة المرور الحالية',
            'profile.newPassword': 'كلمة المرور الجديدة',
            'profile.confirmNewPassword': 'تأكيد كلمة المرور الجديدة',
            'profile.saveAllChanges': 'حفظ كل التغييرات',
            'profile.deleteAccount': 'حذف الحساب',
            'profile.deleteAccountText': 'سيؤدي هذا إلى حذف حسابك وكل بياناته المرتبطة به نهائيًا، بما في ذلك طلباتك وحجوزاتك وتقييماتك. لا يمكن التراجع عن هذا الإجراء.',
            'profile.deleteMyAccount': 'حذف حسابي',
            'profile.rescheduleSession': 'إعادة جدولة الجلسة',
            'profile.rescheduleNote': 'يمكنك إعادة جدولة الجلسة مرة واحدة فقط. اختر تاريخًا ووقتًا جديدين أدناه.',
            'profile.newDate': 'التاريخ الجديد',
            'profile.newTime': 'الوقت الجديد',
            'profile.confirmNewTime': 'تأكيد الموعد الجديد',
            'profile.deleteAccountModalTextBefore': 'سيؤدي هذا إلى حذف حسابك وكل بياناتك نهائيًا. لا يمكن التراجع عن هذا الإجراء. اكتب',
            'profile.deleteAccountModalTextAfter': 'أدناه للتأكيد.',
            'profile.typeDeleteToConfirm': 'اكتب DELETE للتأكيد',
            'profile.permanentlyDeleteBtn': 'حذف حسابي نهائيًا',
            'profile.noPhysicalOrders': 'لا توجد طلبات ورقية لتتبعها.',
            'profile.statusProcessing': 'قيد التجهيز',
            'profile.statusShipped': 'تم الشحن',
            'profile.statusDelivered': 'تم التسليم',
            'profile.statusCancelled': 'ملغي',
            'profile.orderHash': 'الطلب رقم #',
            'profile.totalLabel': 'الإجمالي:',
            'profile.dateLabel': 'التاريخ:',
            'profile.trackPlaced': 'تم الطلب',
            'profile.cancelOrder': 'إلغاء الطلب',
            'profile.cancellingState': 'جارٍ الإلغاء...',
            'profile.cancelOrderConfirm': 'هل تريد إلغاء هذا الطلب واسترداد كامل المبلغ؟ لا يمكن التراجع عن هذا الإجراء.',
            'profile.orderCancelledRefunded': 'تم إلغاء الطلب واسترداد المبلغ.',
            'profile.couldNotLoadOrders': 'تعذّر تحميل طلباتك الآن.',
            'profile.emptyLibrary': 'مكتبتك الرقمية فارغة.',
            'profile.downloadLimitReached': 'تم الوصول للحد الأقصى من التحميلات',
            'profile.downloadPdf': 'تحميل PDF',
            'profile.downloadingAlert': 'جارٍ تحميل',
            'profile.noUpcomingSessions': 'لا توجد جلسات قادمة.',
            'profile.oneOnOneSessionDefault': 'جلسة فردية',
            'profile.minSuffix': 'دقيقة',
            'profile.joinSession': 'انضم إلى الجلسة',
            'profile.completedStatus': 'مكتملة',
            'profile.reschedule': 'إعادة الجدولة',
            'profile.cancelSession': 'إلغاء الجلسة',
            'profile.waitingPaymentConfirmation': 'في انتظار تأكيد الدفع.',
            'profile.sessionWillAppear': 'ستظهر الجلسة هنا فور تأكيدها.',
            'profile.cancelSessionConfirm': 'هل تريد إلغاء هذه الجلسة؟ الإلغاء مجاني لأن الموعد يبعد أكثر من 4 ساعات.',
            'profile.sessionCancelledRefunded': 'تم إلغاء الجلسة واسترداد المبلغ.',
            'profile.errorLoadingSessions': 'حدث خطأ أثناء تحميل الجلسات:',
            'profile.nameRequired': 'الاسم مطلوب',
            'profile.settingsSaved': 'تم حفظ الإعدادات بنجاح!',
            'profile.failedSaveSettings': 'تعذّر حفظ الإعدادات',
            'profile.recentNameChangeNote': 'لقد قمت بتغيير اسمك مؤخرًا. يمكنك تغييره مرة أخرى خلال {days} يومًا.',
            'profile.pleaseSelectDateTime': 'يُرجى اختيار التاريخ والوقت.',
            'profile.reschedulingState': 'جارٍ إعادة الجدولة...',
            'profile.sessionRescheduled': 'تمت إعادة جدولة الجلسة بنجاح!',
            'profile.couldNotReschedule': 'تعذّرت إعادة الجدولة. يُرجى المحاولة مرة أخرى.',
            'profile.pleaseTypeDelete': 'يُرجى كتابة DELETE للتأكيد.',
            'profile.deletingState': 'جارٍ الحذف...',
            'profile.accountDeleted': 'تم حذف حسابك.',
            'profile.failedDeleteAccount': 'تعذّر حذف الحساب. يُرجى المحاولة مرة أخرى.',
            // حالات الجلسة/الحجز الخام القادمة من الباك إند
            'profile.status.live': 'مباشرة الآن',
            'profile.status.scheduled': 'مجدولة',
            'profile.status.completed': 'مكتملة',
            'profile.status.cancelled': 'ملغاة',
            'profile.status.pending': 'قيد الانتظار',
            'profile.status.paid': 'مدفوعة',

            // ------- About page (about.html) -------
            'about.ourStory': 'قصتنا',
            'about.storyText': 'مرحبًا بك في <strong>The Sun Book</strong>، ملاذ الباحثين عن الحقيقة والحكمة القديمة. نعبر حدود الزمن لنقدّم لك أعمق النصوص الباطنية، والمعرفة الخفية، والطقوس المنسية.',
            'about.ourMission': 'رسالتنا',
            'about.missionText': 'على مدى قرون، ظلّت حكمة القدماء محفوظة لدى الجمعيات السرية، وضاع بعضها بين رمال الزمن. رسالتنا هي جمع هذه النصوص الغامضة وحفظها، وإتاحتها للباحثين المعاصرين، ودارسي علوم الغيب، ولكل من يجرؤ على النظر خلف الحجاب.',

            // ------- FAQ page (faq.html) -------
            'faq.title': 'الأسئلة الشائعة',
            'faq.subtitle': 'كل ما تحتاج معرفته عن الطلبات والكتب الرقمية والجلسات والدفع',
            'faq.stillNeedHelp': 'لا يزال لديك سؤال؟',
            'faq.cat.shipping': 'الطلبات والشحن',
            'faq.shipping.q1': 'هل تشحنون الكتب الورقية خارج مصر؟',
            'faq.shipping.a1': 'حاليًا، التوصيل للكتب الورقية متاح داخل مصر فقط — من القاهرة والإسكندرية إلى كل محافظات الجمهورية. لو كنت خارج مصر، يمكنك الاستمتاع بنسخنا الرقمية (PDF) أو حجز جلسة فردية مباشرة فورًا من أي مكان في العالم.',
            'faq.shipping.q2': 'كام تكلفة الشحن؟',
            'faq.shipping.a2': 'الشحن مجاني على كل طلب ورقي داخل مصر — السعر اللي بتشوفه عند الدفع هو السعر النهائي، من غير أي رسوم توصيل إضافية.',
            'faq.shipping.q3': 'هيوصل طلبي في قد إيه؟',
            'faq.shipping.a3': 'مدة التوصيل تختلف قليلًا حسب المحافظة، وعادة القاهرة والإسكندرية بيوصلوا أسرع. تقدر تتابع حالة طلبك في أي وقت من صفحة حسابك — ولو الطلب اتأخر أكتر من المتوقع، راسلنا على واتساب وهنتابعه معاك.',
            'faq.shipping.q4': 'أقدر أتابع طلبي؟',
            'faq.shipping.a4': 'أيوه — افتح صفحة حسابك وشوف قسم "الطلبات الورقية وتتبعها". كل طلب بيوضح حالته الحالية: قيد التجهيز، تم الشحن، أو تم التسليم.',
            'faq.shipping.q5': 'إيه معنى علامة "داخل مصر فقط" اللي بتظهر على بعض الكتب؟',
            'faq.shipping.a5': 'بعض الإصدارات النادرة أو المحدودة بتتحط عليها علامة "داخل مصر فقط" في صفحة المنتج. ده معناه إن النسخة دي بالذات متاحة للتوصيل داخل مصر بس ومش متاحة للشحن الدولي، حتى لو كانت جزء من سلة فيها كتب تانية.',
            'faq.cat.digital': 'الكتب الرقمية',
            'faq.digital.q1': 'إيه الفرق بين الكتاب الورقي والكتاب الرقمي؟',
            'faq.digital.a1': 'الكتاب الورقي هو النسخة المطبوعة الحقيقية، بتوصلك لباب بيتك في أي مكان داخل مصر. أما الكتاب الرقمي فهو نسخة PDF تقدر تحمّلها وتقرأها فورًا على أي جهاز — من غير أي شحن، ومتاح لأي شخص في أي مكان في العالم.',
            'faq.digital.q2': 'هلاقي كتبي الرقمية فين بعد ما أشتريها؟',
            'faq.digital.a2': 'فور إتمام الدفع، هتظهر روابط التحميل مباشرة على شاشة التأكيد. وبعد كده، كل كتاب رقمي اشتريته بيفضل محفوظ في "مكتبتي الرقمية" داخل صفحة حسابك، جاهز للتحميل في أي وقت.',
            'faq.digital.q3': 'أقدر أعيد تحميل كتاب رقمي لو ضيّعت الملف؟',
            'faq.digital.a3': 'أيوه — كتبك الرقمية بتفضل محفوظة بشكل دائم في "مكتبتي الرقمية" داخل صفحة حسابك، فتقدر ترجع وتحمّلها تاني في أي وقت من غير ما تدفع تاني.',
            'faq.cat.payments': 'الدفع والأسعار',
            'faq.payments.q1': 'إيه طرق الدفع المتاحة؟',
            'faq.payments.a1': 'بنقبل البطاقات الائتمانية وبطاقات الخصم والمحافظ الإلكترونية. عند إتمام الطلب، هيتم تحويلك لصفحة الدفع الآمنة عشان تدخل بياناتك بأمان.',
            'faq.payments.q2': 'هل الدفع على The Sun Book آمن؟',
            'faq.payments.a2': 'أيوه. إحنا مش بنشوف أو نخزن بيانات بطاقتك أبدًا — كل عملية دفع بتتم من خلال بوابة دفع آمنة ومشفّرة، بنفس التقنية اللي بتستخدمها المتاجر الإلكترونية الكبرى.',
            'faq.payments.q3': 'ليه بشوف الأسعار باليورو (€) بدل الجنيه المصري؟',
            'faq.payments.a3': 'الأسعار بتظهر بالجنيه المصري للزوار من داخل مصر، وباليورو (€) للزوار من دول تانية — وده بيتحدد تلقائيًا حسب موقعك، عشان دايمًا تشوف العملة اللي تناسبك.',
            'faq.payments.q4': 'فيه خصومات متاحة؟',
            'faq.payments.a4': 'أيوه — إنشاء حساب مجاني بيديك خصم أعضاء تلقائي 5% على كل طلب. وكمان بنعرض عروض محدودة على مجموعة مختارة من الكتب في قسم "أفضل العروض".',
            'faq.payments.q5': 'إزاي أستخدم كود الخصم؟',
            'faq.payments.a5': 'اكتب الكود في خانة "أدخل الكود" في سلتك واضغط "تطبيق". الخصم بيتحسب تلقائيًا قبل ما تدفع — من غير أي حاجة تانية منك.',
            'faq.cat.sessions': 'الجلسات الفردية',
            'faq.sessions.q1': 'إزاي بتشتغل الجلسات الفردية؟',
            'faq.sessions.a1': 'الجلسات الفردية عبارة عن جلسات فيديو مباشرة مع أحد المرشدين، بتتم في غرفة فيديو آمنة. بعد إتمام الدفع، بيتأكد حجزك فورًا ويظهر تحت "الجلسات القادمة" في صفحة حسابك، مع زرار "انضمام" بيتفعّل في الموعد المحدد.',
            'faq.sessions.q2': 'أقدر أعيد جدولة أو ألغي جلسة؟',
            'faq.sessions.a2': 'أيوه. كل جلسة تقدر تعيد جدولتها مرة واحدة، أو تلغيها واسترداد كامل المبلغ — الاتنين متاحين حتى 4 ساعات قبل الموعد، من "الجلسات القادمة" في صفحة حسابك. بعد المدة دي، مش هتقدر تغيّر في الجلسة.',
            'faq.sessions.q3': 'هيحصل إيه لو فوّت جلستي؟',
            'faq.sessions.a3': 'لو فوّت جلسة من غير إلغاء قبلها بـ 4 ساعات على الأقل، بتتسجل كجلسة فايتة ومش بترجعلك فلوسها تلقائيًا. تواصل معانا على واتساب وهنراجعها معاك.',
            'faq.cat.account': 'الاسترجاع والحساب',
            'faq.account.q1': 'إيه سياسة الاسترجاع والاسترداد عندكم؟',
            'faq.account.a1': 'الطلبات الورقية تقدر تلغيها واسترداد كامل المبلغ في أي وقت قبل ما تُشحن، من صفحة حسابك مباشرة. بعد ما الطلب يتشحن، بتنطبق سياسة الاسترجاع القياسية لمدة 14 يوم بدلًا من كده — راجع <a href="policies.html#refund">سياسة الاسترجاع</a> كاملة للتفاصيل. الكتب الرقمية مينفعش تتلغي أو تسترد فلوسها، لأن الملفات بتوصلك فورًا بعد الدفع.',
            'faq.account.q2': 'لازم أعمل حساب عشان أشتري حاجة؟',
            'faq.account.a2': 'أيوه، لازم حساب مجاني عند إتمام الطلب. ده بيخلي كل تاريخ طلباتك ومكتبتك الرقمية وحجوزاتك في مكان واحد، وتقدر تتابع كل حاجة من صفحة حسابك.',
            'faq.account.q3': 'إزاي أحذف حسابي؟',
            'faq.account.a3': 'تقدر تحذف حسابك وكل بياناته نهائيًا في أي وقت من صفحة حسابك ← إعدادات الحساب ← حذف الحساب. الإجراء ده نهائي ومينفعش نرجع فيه.',
            'faq.account.q4': 'بياناتي الشخصية آمنة؟',
            'faq.account.a4': 'بالتأكيد. إحنا بناخد بس الحد الأدنى من البيانات اللازمة لمعالجة طلباتك، ومبنبيعش أو نشارك بياناتك الشخصية أبدًا — راجع <a href="policies.html#privacy">سياسة الخصوصية</a> كاملة للتفاصيل.',

            // ------- Contact page (contact.html) -------
            'contact.getInTouch': 'تواصل معنا',
            'contact.subtitle': 'راسلنا لأي استفسار عن مجموعاتنا القديمة أو المعرفة الباطنية أو رحلتك في طلب الحكمة.',
            'contact.info': 'بيانات التواصل',
            'contact.emailUs': 'راسلنا عبر البريد الإلكتروني',
            'contact.whatsappPhone': 'واتساب والهاتف',
            'contact.workingHours': 'ساعات العمل',
            'contact.workingHoursValue': 'من الإثنين إلى الجمعة: 9:00 ص - 6:00 م<br>بتوقيت القاهرة (EEST)',
            'contact.yourName': 'اسمك',
            'contact.yourEmail': 'بريدك الإلكتروني',
            'contact.subject': 'الموضوع',
            'contact.yourMessage': 'رسالتك...',
            'contact.sendMessage': 'إرسال الرسالة',
            'contact.messageSent': 'تم إرسال رسالتك بنجاح! سنتواصل معك قريبًا.',

            // ------- Policies page (policies.html) -------
            'policies.privacyTitle': 'سياسة الخصوصية',
            'policies.privacyText1': 'في <strong>The Sun Book</strong>، نلتزم بحماية خصوصيتك. نجمع الحد الأدنى فقط من البيانات الشخصية اللازمة لمعالجة طلباتك وتحسين تجربتك في التسوق.',
            'policies.privacyText2': 'لا نبيع بياناتك الشخصية أو نتاجر بها أو نؤجرها لأي طرف آخر. أي بيانات يتم جمعها من خلال نشرتنا البريدية أو عملية الدفع يتم تشفيرها بأمان.',
            'policies.termsTitle': 'شروط الخدمة',
            'policies.termsText1': 'باستخدامك لموقع <strong>The Sun Book</strong>، فإنك توافق على الالتزام بهذه الشروط. جميع المحتويات، بما في ذلك الكتب والأوصاف والتصاميم، هي ملكية فكرية محفوظة.',
            'policies.termsText2': 'نحتفظ بالحق في تعديل الأسعار، أو إيقاف منتجات، أو تحديث هذه الشروط في أي وقت من غير إشعار مسبق.',
            'policies.refundTitle': 'سياسة الاسترجاع',
            'policies.refundText1': 'نريدك أن تكون راضيًا تمامًا عن كتبك الغامضة. لو لم تكن راضيًا عن مشترياتك، يمكنك إرجاعها خلال <strong>14 يومًا</strong> من تاريخ الاستلام.',
            'policies.refundText2': 'يجب إرجاع المنتجات في حالتها الأصلية وغير المستخدمة. تكاليف الشحن الخاصة بالإرجاع تقع على عاتق العميل، إلا إذا وصل المنتج تالفًا.',

            // ------- Forgot/Reset password pages -------
            'forgotPw.title': 'نسيت كلمة المرور؟',
            'forgotPw.subtitle': 'أدخل بريدك الإلكتروني وسنرسل لك رابطًا لإعادة تعيين كلمة المرور.',
            'forgotPw.sendResetLink': 'إرسال رابط إعادة التعيين',
            'forgotPw.backToSignIn': '→ العودة لتسجيل الدخول',
            'forgotPw.sending': 'جارٍ الإرسال...',
            'forgotPw.linkSentIfExists': 'إذا كان هناك حساب مرتبط بهذا البريد الإلكتروني، فسيتم إرسال رابط إعادة التعيين إليه.',
            'forgotPw.somethingWentWrong': 'حدث خطأ ما. يُرجى المحاولة مرة أخرى.',
            'resetPw.title': 'تعيين كلمة مرور جديدة',
            'resetPw.subtitle': 'اختر كلمة مرور جديدة لحسابك.',
            'resetPw.resetPassword': 'إعادة تعيين كلمة المرور',
            'resetPw.invalidLink': 'رابط إعادة التعيين هذا غير صالح. يُرجى طلب رابط جديد من صفحة تسجيل الدخول.',
            'resetPw.tooShort': 'يجب أن تتكون كلمة المرور من 6 أحرف على الأقل.',
            'resetPw.noMatch': 'كلمتا المرور غير متطابقتين.',
            'resetPw.resetting': 'جارٍ إعادة التعيين...',
            'resetPw.updatedRedirecting': 'تم تحديث كلمة المرور! جارٍ التحويل...',
            'resetPw.invalidOrExpired': 'هذا الرابط غير صالح أو منتهي الصلاحية.',

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

    // أسماء الأحياء والمراكز المصرية - أسماء أماكن حقيقية، القيمة (value) بتفضل
    // إنجليزي زي ما هي عشان متتأثرش بمنطق ربط المحافظة بالحي، والعربي ده للعرض بس
    var districtNamesAr = {
        // القاهرة
        "Nasr City": "مدينة نصر", "Maadi": "المعادي", "Heliopolis": "مصر الجديدة",
        "5th Settlement": "التجمع الخامس", "Downtown": "وسط البلد", "Garden City": "جاردن سيتي",
        "Zamalek": "الزمالك", "Mokattam": "المقطم", "Helwan": "حلوان", "Shubra": "شبرا",
        // الإسكندرية
        "Agami": "العجمي", "Shatby": "الشاطبي", "Sidi Bishr": "سيدي بشر", "Smouha": "سموحة",
        "Raml Station": "محطة الرمل", "Roushdy": "رشدي", "Stanley": "ستانلي", "Montaza": "المنتزه",
        "Asafra": "العصافرة", "Glim": "جليم",
        // الجيزة
        "Dokki": "الدقي", "Mohandessin": "المهندسين", "Agouza": "العجوزة", "Imbaba": "إمبابة",
        "Faisal": "فيصل", "Haram Gardens": "حدائق الأهرام", "Sheikh Zayed": "الشيخ زايد",
        "6th of October": "السادس من أكتوبر", "Hawamdiya": "الحوامدية", "Badrshein": "البدرشين",
        // الشرقية
        "Zagazig": "الزقازيق", "10th of Ramadan": "العاشر من رمضان", "Minya El Qamh": "منيا القمح",
        "Belbeis": "بلبيس", "Faqous": "فاقوس", "Abu Hammad": "أبو حماد", "Diyarb Negm": "ديرب نجم",
        "Hihya": "ههيا", "El Qurein": "القرين", "Olad Saqr": "أولاد صقر",
        // البحيرة
        "Damanhour": "دمنهور", "Kafr El Dawwar": "كفر الدوار", "Rashid": "رشيد",
        "Etay El Barud": "إيتاي البارود", "Abu El Matamir": "أبو المطامير", "Mahmoudiyah": "المحمودية",
        "Shabrakhit": "شبراخيت", "Kom Hamada": "كوم حمادة", "Delengat": "الدلنجات",
        "Wadi El Natrun": "وادي النطرون",
        // القليوبية
        "Benha": "بنها", "Shubra El Kheima": "شبرا الخيمة", "Qalyub": "قليوب", "Khanka": "الخانكة",
        "Khusus": "الخصوص", "Obour": "العبور", "Qanater": "القناطر الخيرية", "Toukh": "طوخ",
        "Kafr Shukr": "كفر شكر", "El Bagour": "الباجور",
        // المنوفية
        "Shebin El Kom": "شبين الكوم", "Sadat City": "مدينة السادات", "Menouf": "منوف",
        "Ashmoun": "أشمون", "Berket El Sab": "بركة السبع", "Tala": "تلا", "Quesna": "قويسنا",
        "El Shohada": "الشهداء", "Sers El Lyan": "سرس الليان",
        // الغربية
        "Tanta": "طنطا", "El Mahalla": "المحلة الكبرى", "Kafr El Zayat": "كفر الزيات",
        "Zifta": "زفتى", "Samanoud": "سمنود", "Kotour": "قطور", "Basyoun": "بسيون",
        // الدقهلية
        "Mansoura": "المنصورة", "Mit Ghamr": "ميت غمر", "Talkha": "طلخا", "Aga": "أجا",
        "Dikirnis": "دكرنس", "Belqas": "بلقاس", "Sherbin": "شربين", "El Manzala": "المنزلة",
        "El Matareya": "المطرية", "Gamasa": "جمصة",
        // كفر الشيخ
        "Kafr El Sheikh": "كفر الشيخ", "Desouk": "دسوق", "Fouh": "فوة", "Baltim": "بلطيم",
        "Metoubes": "مطوبس", "El Hamool": "الحامول", "Riyadh": "الرياض", "Sidi Salem": "سيدي سالم",
        // دمياط
        "Damietta": "دمياط", "New Damietta": "دمياط الجديدة", "Ras El Bar": "رأس البر",
        "Fareskur": "فارسكور", "Kafr Saad": "كفر سعد", "El Zarqa": "الزرقا",
        // بورسعيد
        "Port Fouad": "بورفؤاد", "Al Arab": "العرب", "Al Ganoub": "الجنوب", "Al Zohour": "الزهور",
        "Al Manakh": "المناخ",
        // السويس
        "Al Arbaeen": "الأربعين", "Al Ganayen": "الجناين", "Attaka": "عتاقة", "Ganoub Suez": "جنوب السويس",
        // الإسماعيلية
        "Ismailia City": "مدينة الإسماعيلية", "Fayed": "فايد", "Kantara": "القنطرة",
        "Abu Swear": "أبو صوير", "El Tal El Kebir": "التل الكبير",
        // الفيوم
        "Faiyum City": "مدينة الفيوم", "Tamiya": "طامية", "Senorus": "سنورس",
        "Ibsheway": "إبشواي", "Yusuf El Sediaq": "يوسف الصديق",
        // بني سويف
        "Beni Suef City": "مدينة بني سويف", "Nasser": "ناصر", "Ihnasya": "إهناسيا",
        "Beba": "ببا", "Fashn": "الفشن", "Al Wasta": "الواسطى",
        // المنيا
        "Minya City": "مدينة المنيا", "Mallawi": "ملوي", "Samalut": "سمالوط",
        "Beni Mazar": "بني مزار", "Maghagha": "مغاغة", "Adwa": "أدوة", "Matay": "مطاي",
        // أسيوط
        "Asyut City": "مدينة أسيوط", "Dairut": "ديروط", "Manfalut": "منفلوط", "Qusiya": "القوصية",
        "Abnoub": "أبنوب", "El Badari": "البداري", "Sahel Selim": "ساحل سليم", "El Ghanayem": "الغنايم",
        // سوهاج
        "Sohag City": "مدينة سوهاج", "Akhmim": "أخميم", "Gerga": "جرجا", "Tama": "طما",
        "Tahta": "طهطا", "Baliana": "البلينا", "El Maragha": "المراغة", "Monsha'a": "المنشأة",
        // قنا
        "Qena City": "مدينة قنا", "Nag Hammadi": "نجع حمادي", "Qus": "قوص", "Dishna": "دشنا",
        "Farshout": "فرشوط", "Abu Tesht": "أبوتشت", "Naqada": "نقادة",
        // الأقصر
        "Luxor City": "مدينة الأقصر", "Armant": "أرمنت", "Esna": "إسنا", "Tod": "الطود",
        "Al Bayadiya": "البياضية",
        // أسوان
        "Aswan City": "مدينة أسوان", "Kom Ombo": "كوم أمبو", "Edfu": "إدفو", "Daraw": "دراو",
        "Nasr El Nuba": "نصر النوبة", "Al Basilia": "البصيلية",
        // البحر الأحمر
        "Hurghada": "الغردقة", "El Gouna": "الجونة", "Safaga": "سفاجا", "Marsa Alam": "مرسى علم",
        "Ras Gharib": "رأس غارب", "Quseer": "القصير",
        // مطروح
        "Marsa Matrouh": "مرسى مطروح", "El Hamam": "الحمام", "Alamein": "العلمين", "Siwa": "سيوة",
        "Dabaa": "الضبعة", "Sidi Barrani": "سيدي براني",
        // شمال سيناء
        "El Arish": "العريش", "Sheikh Zuweid": "الشيخ زويد", "Rafah": "رفح", "Bir El Abd": "بئر العبد",
        "Hassana": "حسنة", "Nakhl": "نخل",
        // جنوب سيناء
        "Sharm El Sheikh": "شرم الشيخ", "Dahab": "دهب", "Taba": "طابا", "Nuweiba": "نويبع",
        "Saint Catherine": "سانت كاترين", "Tor Sinai": "طور سيناء",
        // الوادي الجديد
        "Kharga": "الخارجة", "Dakhla": "الداخلة", "Farafra": "الفرافرة", "Baris": "باريس", "Balat": "بلاط"
    };

    function getDistrictLabel(englishName) {
        if (getLang() === 'ar' && Object.prototype.hasOwnProperty.call(districtNamesAr, englishName)) {
            return districtNamesAr[englishName];
        }
        return englishName;
    }

    // النصوص "المحتوى" اللي ممكن الأدمن يعدّلها من لوحة التحكم (زي الأسئلة
    // الشائعة والسياسات) - بتتجاب من السيرفر وتنطبق فوق القاموس الأساسي فوق،
    // من غير ما تلمس النصوص التقنية التانية (رسايل الأخطاء، حالات الأزرار...)
    var contentOverrides = { en: {}, ar: {} };

    function getSiteContentApiUrl() {
        var host = window.location.hostname;
        var isLocal = host === 'localhost' || host === '127.0.0.1' || host === '';
        return (isLocal ? 'http://localhost:5000/api' : 'https://sunbook.vercel.app/api') + '/site-content';
    }

    function loadContentOverrides() {
        // بنحط مهلة قصوى للطلب (8 ثواني) عشان لو الباك إند بطيء أو معلّق،
        // المتصفح يوقف الطلب ويكمل الصفحة عادي بالنصوص الافتراضية، بدل ما
        // يفضل التاب شكله "بيحمل" للأبد وهو فعليًا مستني رد مش هيجيله.
        var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
        var timeoutId = controller ? setTimeout(function () { controller.abort(); }, 8000) : null;

        fetch(getSiteContentApiUrl(), controller ? { signal: controller.signal } : undefined)
            .then(function (res) { return res.json(); })
            .then(function (json) {
                if (timeoutId) clearTimeout(timeoutId);
                if (!json || !json.success || !Array.isArray(json.data)) return;
                var newEn = {};
                var newAr = {};
                json.data.forEach(function (item) {
                    if (typeof item.en === 'string') newEn[item.key] = item.en;
                    if (typeof item.ar === 'string') newAr[item.key] = item.ar;
                });
                contentOverrides.en = newEn;
                contentOverrides.ar = newAr;
                refresh(); // إعادة تطبيق الترجمة فور ما نص الأدمن يوصل، فوق أي حاجة اتعرضت قبل كده
            })
            .catch(function () {
                if (timeoutId) clearTimeout(timeoutId);
                // السيرفر نايم أو الشبكة اتقطعت أو الطلب اتلغى بسبب المهلة - نفضل نستخدم النصوص الافتراضية في الكود، وده طبيعي تمامًا
            });
    }

    function getLang() {
        var stored = localStorage.getItem(STORAGE_KEY);
        return stored === 'ar' || stored === 'en' ? stored : 'en';
    }

    function t(key) {
        var lang = getLang();
        var overrideTable = contentOverrides[lang] || {};
        if (Object.prototype.hasOwnProperty.call(overrideTable, key)) return overrideTable[key];
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

        // نفس الفكرة بس للنصوص اللي محتاجة تحتفظ بتاج HTML جواها (زي <strong> حوالين اسم الموقع)
        var htmlNodes = document.querySelectorAll('[data-i18n-html]');
        for (var h = 0; h < htmlNodes.length; h++) {
            var hEl = htmlNodes[h];
            var hVal = t(hEl.getAttribute('data-i18n-html'));
            if (hEl.innerHTML !== hVal) hEl.innerHTML = hVal;
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

        var titles = document.querySelectorAll('[data-i18n-title]');
        for (var tI = 0; tI < titles.length; tI++) {
            var tEl = titles[tI];
            var tVal = t(tEl.getAttribute('data-i18n-title'));
            if (tEl.getAttribute('title') !== tVal) tEl.setAttribute('title', tVal);
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
        var shortLabel = getLang() === 'ar' ? 'EN' : 'AR';
        // اتجاه الزرار لازم يطابق لغة الكلمة المكتوبة جواه (مش لغة الصفحة الحالية،
        // لأن الزرار بيعرض دايمًا اسم اللغة "التانية"). من غيرها، المتصفح كان بيحسب
        // توسيط النص أفقيًا بناءً على اتجاه الصفحة (ltr/rtl) مش اتجاه النص نفسه،
        // وده كان بيخلي الكلمة تتزحلق لحرف من حروف الزرار بدل ما تفضل في النص بالظبط.
        var btnDir = getLang() === 'ar' ? 'ltr' : 'rtl';
        for (var i = 0; i < buttons.length; i++) {
            var btn = buttons[i];
            if (btn.textContent !== label) btn.textContent = label;
            if (btn.getAttribute('data-lang-short') !== shortLabel) btn.setAttribute('data-lang-short', shortLabel);
            if (btn.getAttribute('dir') !== btnDir) btn.setAttribute('dir', btnDir);
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
        // بنوقف المراقب مؤقتًا وإحنا بنغيّر النصوص، عشان مايراقبش التغييرات
        // اللي إحنا بنعملها بنفسنا ويرجع يشتغل تاني فوق نفسه في نفس اللحظة
        // (خصوصًا وقت تبديل اللغة لما نصوص كتير بتتغيّر مرة واحدة)
        if (observer) observer.disconnect();
        setDocumentDirection();
        applyStaticTranslations();
        updateToggleButton();
        if (observer) observer.observe(document.body, { childList: true, subtree: true });
    }

    // بيراقب أي جزء من الصفحة بيتغيّر (زي حقن الهيدر/الفوتر أو زرار تسجيل الدخول)
    // ويعيد تطبيق الترجمة تلقائيًا. التحديث بيحصل بس لو القيمة اتغيرت فعليًا،
    // فمفيش خطر لوب لا نهائي حتى لو الـ observer شاف التغييرات دي.
    var observer = new MutationObserver(function () { refresh(); });

    function start() {
        refresh();
        observer.observe(document.body, { childList: true, subtree: true });
        loadContentOverrides();
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
        getDistrictLabel: getDistrictLabel,
        setLanguage: function (lang) {
            localStorage.setItem(STORAGE_KEY, lang === 'ar' ? 'ar' : 'en');
            refresh();
            document.dispatchEvent(new CustomEvent('sunbook:langChanged', { detail: { lang: getLang() } }));
        },
        refresh: refresh
    };
})();
