// Family of Minds — Shared JS
// Mark the active nav link based on current page

(function () {
  const path = window.location.pathname.replace(/\/$/, '');
  const page = path.split('/').pop() || 'index.html';

  document.querySelectorAll('.nav-links a').forEach(function (link) {
    const href = link.getAttribute('href').replace(/^\.\.\//, '');
    const linkPage = href.split('/').pop() || 'index.html';
    if (
      linkPage === page ||
      (page === '' && linkPage === 'index.html') ||
      (page.startsWith('blog') && href.includes('blog'))
    ) {
      link.classList.add('active');
    }
  });
})();
