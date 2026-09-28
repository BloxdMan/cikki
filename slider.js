/* slider.js - simple page slider behavior */
(function () {
    let slider, pages, maxPage, currentPage = -1;

    function initSlider() {
        slider = document.querySelector('.page-slider');
        if (!slider) return;

        pages = slider.querySelectorAll('.page');
        maxPage = Math.max(0, pages.length - 1);
        goToPage(currentPage, false);

        let startX = 0;
        let startY = 0;
        slider.addEventListener('touchstart', e => {
            if (document.body.classList.contains('modal-open') || document.body.classList.contains('group-edit-mode')) return;
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        }, { passive: true });

        slider.addEventListener('touchend', e => {
            if (document.body.classList.contains('modal-open') || document.body.classList.contains('group-edit-mode')) return;
            const endX = e.changedTouches[0].clientX;
            const endY = e.changedTouches[0].clientY;
            const diff = startX - endX;
            const verticalDiff = startY - endY;
            if (Math.abs(diff) > 50 && Math.abs(diff) > Math.abs(verticalDiff)) {
                if (diff > 0 && currentPage < maxPage) goToPage(currentPage + 1, true, 'horizontal');
                if (diff < 0 && currentPage > 0) goToPage(currentPage - 1, true, 'horizontal');
            } else if (Math.abs(verticalDiff) > 60 && Math.abs(verticalDiff) > Math.abs(diff)) {
                const page = pages[currentPage];
                const atBoundary = verticalDiff > 0
                    ? page.scrollTop + page.clientHeight >= page.scrollHeight - 2
                    : page.scrollTop <= 0;
                if (!atBoundary) return;
                if (verticalDiff > 0 && currentPage < maxPage) goToPage(currentPage + 1, true, 'vertical');
                if (verticalDiff < 0 && currentPage > 0) goToPage(currentPage - 1, true, 'vertical');
            }
        });
    }

    function goToPage(index, shouldAnimate = true, axis = 'horizontal') {
        if (!slider) return;
        if (document.body.classList.contains('modal-open') || document.body.classList.contains('group-edit-mode')) return;

        const previousPage = currentPage;
        currentPage = Math.max(0, Math.min(index, maxPage));
        if (currentPage === previousPage && shouldAnimate) return;
        const animate = shouldAnimate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        slider.classList.toggle('page-swap', animate && axis === 'horizontal');
        slider.style.transform = `translateX(-${currentPage * (100 / pages.length)}%)`;
        if (animate && axis === 'horizontal') {
            window.setTimeout(() => slider.classList.remove('page-swap'), 420);
        }
        document.querySelectorAll('.nav-btn').forEach((btn, i) => btn.classList.toggle('active', i === currentPage));
        if (animate && axis === 'vertical') {
            const page = pages[currentPage];
            page.animate([
                { transform: `translateY(${previousPage < currentPage ? '18px' : '-18px'})`, opacity: 0 },
                { transform: 'translateY(0)', opacity: 1 }
            ], { duration: 360, easing: 'cubic-bezier(0.22, 0.8, 0.2, 1)' });
        }
        window.dispatchEvent(new CustomEvent('cikki:tabchange', { detail: { index: currentPage } }));
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSlider);
    } else {
        initSlider();
    }

    window.Slider = { goToPage, getCurrentPage: () => currentPage };
})();