// Progressive enhancement: all links remain visible when JavaScript is unavailable.
(() => {
  const nav = document.querySelector('.site-nav');
  if (nav) {
    const inner = nav.querySelector('.nav-inner');
    if (inner) {
      nav.id = 'primary-navigation';
      const button = document.createElement('button');
      button.className = 'mobile-nav-toggle';
      button.type = 'button';
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-controls', nav.id);
      button.setAttribute('aria-label', 'Show all navigation links');
      button.innerHTML = 'More <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 6 4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      const links = [...inner.querySelectorAll('a')];
      if (links.slice(3).some(link => link.getAttribute('aria-current') === 'page')) button.dataset.current = 'true';
      function expand(open) {
        nav.toggleAttribute('data-expanded', open);
        button.setAttribute('aria-expanded', String(open));
        button.setAttribute('aria-label', open ? 'Hide additional navigation links' : 'Show all navigation links');
      }
      button.addEventListener('click', () => expand(button.getAttribute('aria-expanded') !== 'true'));
      nav.addEventListener('keydown', event => {
        if (event.key === 'Escape' && button.getAttribute('aria-expanded') === 'true') { expand(false); button.focus(); }
      });
      document.addEventListener('click', event => {
        if (!nav.contains(event.target)) expand(false);
      });
      inner.appendChild(button);
      nav.dataset.enhanced = 'true';
      const desktop = window.matchMedia?.('(min-width: 1000px)');
      desktop?.addEventListener?.('change', () => expand(false));
    }
  }
  // Make wide data tables keyboard-scrollable, including tables rendered after refresh.
  const main = document.querySelector('main');
  function enhanceTables() {
    main?.querySelectorAll('.table-scroll').forEach(wrapper => {
      if (wrapper.hasAttribute('tabindex')) return;
      wrapper.setAttribute('tabindex', '0');
      wrapper.setAttribute('role', 'region');
      wrapper.setAttribute('aria-label', wrapper.querySelector('caption')?.textContent || 'Table; scroll horizontally to see all columns');
    });
  }
  enhanceTables();
  if (main && window.MutationObserver) new window.MutationObserver(enhanceTables).observe(main, {childList:true, subtree:true});
})();
