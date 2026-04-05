// ============================================================
// Family of Minds — Paper Card Component
//
// Define papers once here. Embed anywhere with:
//   <div data-paper="rec-clock"></div>
//   <div data-paper="rec-clock" data-compact="true"></div>
//
// Full card:    shows abstract, Read Online toggle, Download, View Project
// Compact card: shows title + short abstract + Download only (for sidebars)
// ============================================================

var FOM_PAPERS = {

  'rec-clock': {
    status:      'Published',
    statusClass: 'badge-active',
    date:        '2026 \u2014 Family of Minds',
    title:       'The National REC Debt Clock: Making Our Clean Energy Deficit Visible',
    abstract:    'We propose the National REC Debt Clock, a near real-time public visualization that translates America\u2019s clean energy deficit into a single, tangible number. Using a straightforward formula \u2014 total U.S. electricity consumed (EIA) minus total RECs retired (regional registries) \u2014 the clock makes an invisible crisis undeniable. This paper details the methodology, data sourcing, and the case for why data visceralization is a necessary tool for public accountability in the energy transition, particularly in the context of AI-driven electricity demand growth.',
    pdf:         'docs/rec-debt-clock-whitepaper.pdf',
    project:     'projects.html#rec-clock',
    featured:    true
  }

  // Add future papers here:
  // 'algernon-arch': {
  //   status: 'In Progress', statusClass: 'badge-dev',
  //   date: '2026 \u2014 Family of Minds',
  //   title: 'Persistent Identity in Stateless Systems: The Algernon Architecture',
  //   abstract: '...',
  //   pdf: null, project: 'projects.html#algernon', featured: false
  // }

};

// ── Render ────────────────────────────────────────────────────
(function () {
  var viewerCount = 0;

  function resolvePath(relPath) {
    // Works from any depth (root pages or blog/posts/*.html)
    var depth = window.location.pathname.split('/').length - 2;
    var prefix = '';
    for (var i = 0; i < depth; i++) prefix += '../';
    return prefix + relPath;
  }

  function buildFullCard(paper, viewerId) {
    var pdfPath    = resolvePath(paper.pdf);
    var projectPath = paper.project ? resolvePath(paper.project) : null;
    var hasPdf     = !!paper.pdf;

    var actionsHtml = '';
    if (hasPdf) {
      actionsHtml += '<button class="btn btn-outline" onclick="togglePdfViewer(\'' + viewerId + '\', this)" style="width:100%;justify-content:center;">Read Online &#8599;</button>';
      actionsHtml += '<a href="' + pdfPath + '" class="btn btn-primary" onclick="return confirmDownload(\'' + paper.title.replace(/'/g, "\\'") + '\', this.href)" download style="justify-content:center;">Download PDF &darr;</a>';
    }
    if (projectPath) {
      actionsHtml += '<a href="' + projectPath + '" class="btn btn-outline" style="justify-content:center;">View Project &rarr;</a>';
    }

    var viewerHtml = hasPdf
      ? '<div class="pdf-viewer-wrap" id="' + viewerId + '">' +
          '<iframe src="' + pdfPath + '" title="' + paper.title + '" loading="lazy"></iframe>' +
          '<p class="pdf-viewer-note">Having trouble viewing? <a href="' + pdfPath + '" onclick="return confirmDownload(\'' + paper.title.replace(/'/g, "\\'") + '\', this.href)">Download the PDF</a> instead.</p>' +
        '</div>'
      : '';

    return '<div class="paper-card' + (paper.featured ? ' featured' : '') + '">' +
      '<div>' +
        '<div class="paper-meta">' +
          '<span class="badge ' + paper.statusClass + '">' + paper.status + '</span>' +
          '<span class="paper-date">' + paper.date + '</span>' +
        '</div>' +
        '<h3>' + paper.title + '</h3>' +
        '<p class="abstract">' + paper.abstract + '</p>' +
      '</div>' +
      '<div class="paper-actions">' + actionsHtml + '</div>' +
      viewerHtml +
    '</div>';
  }

  function buildCompactCard(paper) {
    var pdfPath = paper.pdf ? resolvePath(paper.pdf) : null;
    var shortAbstract = paper.abstract.length > 180
      ? paper.abstract.substring(0, 180).replace(/\s\S*$/, '') + '\u2026'
      : paper.abstract;

    return '<div class="sidebar-card">' +
      '<h3 style="font-size:.7rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--accent);margin-bottom:.75rem;">Latest Paper</h3>' +
      '<p style="font-size:.875rem;font-weight:600;color:var(--text);margin-bottom:.4rem;">' + paper.title + '</p>' +
      '<p style="font-size:.8rem;color:var(--text-muted);line-height:1.6;margin-bottom:1rem;">' + shortAbstract + '</p>' +
      (pdfPath
        ? '<a href="' + pdfPath + '" class="btn btn-primary" onclick="return confirmDownload(\'' + paper.title.replace(/'/g, "\\'") + '\', this.href)" download style="width:100%;justify-content:center;">Download PDF &darr;</a>'
        : '<span class="btn btn-outline" style="width:100%;justify-content:center;opacity:.45;cursor:default;">Coming Soon</span>') +
    '</div>';
  }

  function init() {
    document.querySelectorAll('[data-paper]').forEach(function (el) {
      var id      = el.getAttribute('data-paper');
      var compact = el.getAttribute('data-compact') === 'true';
      var paper   = FOM_PAPERS[id];

      if (!paper) {
        el.innerHTML = '<p style="color:#555;font-size:.8rem;">Paper \u201c' + id + '\u201d not found.</p>';
        return;
      }

      var viewerId = 'pdf-viewer-' + (++viewerCount);
      el.innerHTML = compact ? buildCompactCard(paper) : buildFullCard(paper, viewerId);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
