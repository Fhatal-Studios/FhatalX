/* assets/js/main.js */

/**
 * Cookie Consent Manager
 * Handles GDPR-style consent with localStorage persistence.
 */
const ConsentManager = (() => {
    const STORAGE_KEY = 'fhatalx_consent_v3';
    const banner = document.getElementById('cookie-banner');
    const modal = document.getElementById('cookie-preferences-modal');
    
    // Default State
    let state = {
        necessary: true,
        analytics: false,
        marketing: false,
        timestamp: null,
        version: 3
    };

    const init = () => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                // Check versioning if needed in future
                state = { ...state, ...parsed };
                applyConsent();
            } catch (e) {
                console.error('Consent parse error', e);
                showBanner();
            }
        } else {
            // No consent found, show banner after short delay
            setTimeout(showBanner, 1000);
        }

        bindEvents();
    };

    const save = (newState) => {
        state = { ...state, ...newState, timestamp: new Date().toISOString() };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        applyConsent();
        hideBanner();
        hideModal();
    };

    const applyConsent = () => {
        if (state.analytics) {
            // Placeholder: Initialize Analytics (e.g., GA4)
            console.log('Analytics Consent Granted - Initializing trackers...');
            // loadGA4(); // Uncomment and implement when ID is provided or generic logic needed
        } else {
            console.log('Analytics Consent Denied');
            // Remove cookies if possible or disable tracking flags
        }
        
        // Update UI toggles if modal is open
        document.querySelectorAll('input[name="consent-type"]').forEach(input => {
            if (state[input.value] !== undefined) {
                input.checked = state[input.value];
            }
        });
    };

    const showBanner = () => banner?.classList.add('show');
    const hideBanner = () => banner?.classList.remove('show');
    const showModal = () => {
        applyConsent(); // Sync toggles
        modal?.classList.remove('hidden');
        modal?.classList.add('flex');
    };
    const hideModal = () => {
        modal?.classList.add('hidden');
        modal?.classList.remove('flex');
    };

    const bindEvents = () => {
        // Banner Actions
        document.getElementById('btn-accept-all')?.addEventListener('click', () => {
            save({ analytics: true, marketing: false }); // Marketing disabled per user request to remove ads
        });
        document.getElementById('btn-reject-all')?.addEventListener('click', () => {
            save({ analytics: false, marketing: false });
        });
        document.getElementById('btn-customize')?.addEventListener('click', showModal);

        // Footer Link
        document.getElementById('link-manage-cookies')?.addEventListener('click', (e) => {
            e.preventDefault();
            showModal();
        });

        // Modal Actions
        document.getElementById('btn-save-preferences')?.addEventListener('click', () => {
            const analytics = document.getElementById('chk-analytics')?.checked || false;
            // marketing removed as per request
            save({ analytics, marketing: false });
        });
        document.getElementById('btn-close-modal')?.addEventListener('click', hideModal);
    };

    return { init };
})();

/**
 * UI Interactions
 * Mobile menu, Tilt effects, Count ups
 */
const UI = (() => {
    
    // Mobile Menu
    const initMobileMenu = () => {
        const btn = document.getElementById('mobile-menu-btn');
        const menu = document.getElementById('mobile-menu');
        
        btn?.addEventListener('click', () => {
            const isOpen = menu.classList.contains('open');
            menu.classList.toggle('open');
            btn.setAttribute('aria-expanded', !isOpen);
            
            // Icon toggle
            const svg = btn.querySelector('svg');
            if(!isOpen) {
               svg.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />';
            } else {
               svg.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />';
            }
        });
    };

    // 3D Tilt Effect
    const initTilt = () => {
        const box = document.getElementById('tilt-card');
        if(!box) return;
        
        const handleMove = (e) => {
            const rect = box.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;
            
            const rX = -(y - 0.5) * 20; // Max rotation deg
            const rY = (x - 0.5) * 20;
            
            box.style.transform = `perspective(1000px) rotateX(${rX}deg) rotateY(${rY}deg) scale3d(1.02, 1.02, 1.02)`;
        };
        
        const handleLeave = () => {
            box.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)';
        };

        box.addEventListener('mousemove', handleMove);
        box.addEventListener('mouseleave', handleLeave);
    };

    // Number Counter
    const initCounters = () => {
        const counters = document.querySelectorAll('[data-count-to]');
        
        const animate = (counter) => {
            const target = +counter.getAttribute('data-count-to');
            const data = +counter.innerText.replace(/,/g, '');
            const speed = 200; // time in speed
            const inc = target / speed;
            
            if(data < target) {
                counter.innerText = Math.ceil(data + inc).toLocaleString();
                setTimeout(() => animate(counter), 10);
            } else {
                counter.innerText = target.toLocaleString();
            }
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if(entry.isIntersecting) {
                    animate(entry.target);
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.5 });

        counters.forEach(c => observer.observe(c));
    };

    // Dynamic Year
    const initYear = () => {
        const el = document.getElementById('year');
        if(el) el.textContent = new Date().getFullYear();
    };

    return {
        init: () => {
            initMobileMenu();
            initTilt();
            initCounters();
            initYear();
        }
    };
})();

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    ConsentManager.init();
    UI.init();
});
