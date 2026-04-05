// Family of Minds — Shared JS

// ── Active nav link ──────────────────────────────────────────
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

// ── Download confirmation modal ──────────────────────────────
function confirmDownload(title, url) {
  // Prevent default link navigation — we'll trigger manually if confirmed
  var overlay = document.createElement('div');
  overlay.id = 'dl-overlay';
  overlay.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:9999',
    'background:rgba(0,0,0,0.72)', 'display:flex',
    'align-items:center', 'justify-content:center',
    'padding:1.5rem', 'backdrop-filter:blur(4px)'
  ].join(';');

  var box = document.createElement('div');
  box.style.cssText = [
    'background:#161616', 'border:1px solid #2a2a2a',
    'border-radius:8px', 'padding:2rem',
    'max-width:420px', 'width:100%',
    'font-family:Inter,system-ui,sans-serif'
  ].join(';');

  box.innerHTML = [
    '<p style="font-size:.7rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;',
    'color:#e8720c;margin-bottom:.75rem;">Download</p>',
    '<p style="font-size:1rem;font-weight:700;color:#e8e6e3;margin-bottom:.5rem;">',
    title, '</p>',
    '<p style="font-size:.875rem;color:#888;line-height:1.6;margin-bottom:1.75rem;">',
    'This will download a PDF to your device. Continue?</p>',
    '<div style="display:flex;gap:.75rem;justify-content:flex-end;">',
    '<button id="dl-cancel" style="padding:.6rem 1.2rem;border-radius:6px;border:1px solid #2a2a2a;',
    'background:transparent;color:#e8e6e3;font-size:.875rem;font-weight:600;cursor:pointer;">Cancel</button>',
    '<a id="dl-confirm" href="' + url + '" download target="_blank" rel="noopener"',
    ' style="padding:.6rem 1.2rem;border-radius:6px;border:none;background:#e8720c;',
    'color:#fff;font-size:.875rem;font-weight:600;cursor:pointer;text-decoration:none;',
    'display:inline-flex;align-items:center;gap:.3rem;">Download &#8595;</a>',
    '</div>'
  ].join('');

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  function close() { document.body.removeChild(overlay); }

  document.getElementById('dl-cancel').addEventListener('click', close);
  overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
  });

  // After confirm click, close modal after short delay
  document.getElementById('dl-confirm').addEventListener('click', function () {
    setTimeout(close, 400);
  });

  return false; // always prevent default on the triggering link
}

// ── Inline PDF viewer toggle ─────────────────────────────────
function togglePdfViewer(viewerId, btn) {
  var viewer = document.getElementById(viewerId);
  if (!viewer) return;
  var isOpen = viewer.style.display !== 'none' && viewer.style.display !== '';
  if (isOpen) {
    viewer.style.display = 'none';
    btn.textContent = 'Read Online \u2197';
  } else {
    viewer.style.display = 'block';
    btn.textContent = 'Close Reader \u00d7';
    viewer.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
