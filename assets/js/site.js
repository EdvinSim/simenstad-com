document.addEventListener('DOMContentLoaded', async () => {
  const currentPath = window.location.pathname;
  const pageMap = {
    'index.html': 'home',
    '/index.html': 'home',
    'scores.html': 'scores',
    '/scores.html': 'scores'
  };

  const currentPage = pageMap[currentPath.split('/').pop()] || 'home';

  const loadComponent = async (selector, url) => {
    const target = document.querySelector(selector);
    if (!target) return;

    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Could not load ${url}`);

      target.innerHTML = await response.text();

      const currentLink = target.querySelector(`[data-page="${currentPage}"]`);
      if (currentLink) {
        currentLink.setAttribute('aria-current', 'page');
        currentLink.style.color = 'var(--ivory)';
      }
    } catch (error) {
      console.warn(error);
    }
  };

  await loadComponent('[data-component="header"]', 'components/header.html');
  await loadComponent('[data-component="footer"]', 'components/footer.html');
});
