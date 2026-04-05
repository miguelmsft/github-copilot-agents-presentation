/* ============================================================
   ADMIN.JS — Theme switch, hide slides, notes toggle, PDF export
   ============================================================ */

let slidesRef = [];
let hiddenRef = new Set();
let goToFn = null;
let getCurrentSlideIndex = null;

export function initAdmin(slides, hidden, goTo, getIndex) {
  slidesRef = slides;
  hiddenRef = hidden;
  goToFn = goTo;
  getCurrentSlideIndex = getIndex;

  const toggle = document.getElementById('admin-toggle');
  const panel = document.getElementById('admin-panel');
  const overlay = document.getElementById('admin-overlay');
  const themeSelect = document.getElementById('theme-select');
  const notesToggle = document.getElementById('notes-toggle');
  const notesOverlay = document.getElementById('speaker-notes-overlay');
  const checklist = document.getElementById('slide-checklist');
  const gotoInput = document.getElementById('goto-input');
  const gotoBtn = document.getElementById('goto-btn');

  // ---- Panel open/close ----
  toggle.addEventListener('click', () => {
    panel.classList.toggle('open');
    overlay.classList.toggle('active');
  });

  overlay.addEventListener('click', () => {
    panel.classList.remove('open');
    overlay.classList.remove('active');
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panel.classList.contains('open')) {
      panel.classList.remove('open');
      overlay.classList.remove('active');
    }
  });

  // ---- Theme ----
  const savedTheme = localStorage.getItem('pres-theme') || 'github-cosmos';
  applyTheme(savedTheme);
  themeSelect.value = savedTheme;

  themeSelect.addEventListener('change', () => {
    applyTheme(themeSelect.value);
    localStorage.setItem('pres-theme', themeSelect.value);
  });

  // ---- Speaker notes ----
  const notesOn = localStorage.getItem('pres-notes') === 'true';
  notesToggle.checked = notesOn;
  if (notesOn) notesOverlay.classList.add('visible');

  notesToggle.addEventListener('change', () => {
    notesOverlay.classList.toggle('visible', notesToggle.checked);
    localStorage.setItem('pres-notes', notesToggle.checked);
    // Update notes content
    updateNotesContent();
  });

  // ---- Slide checklist ----
  buildChecklist(checklist);

  // ---- Go to slide ----
  gotoBtn.addEventListener('click', () => {
    const num = parseInt(gotoInput.value, 10);
    if (num >= 1 && num <= slidesRef.length) {
      goToFn(num - 1);
      panel.classList.remove('open');
      overlay.classList.remove('active');
    }
  });

  gotoInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') gotoBtn.click();
  });

  // ---- PDF export ----
  const exportBtn = document.getElementById('export-pdf');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      // Mark hidden slides for print exclusion
      slidesRef.forEach((slide, i) => {
        slide.classList.toggle('print-hidden', hiddenRef.has(i));
      });
      // Make all non-hidden slides visible for printing
      slidesRef.forEach(s => {
        if (!s.classList.contains('print-hidden')) {
          s.style.opacity = '1';
          s.style.visibility = 'visible';
        }
      });
      // Close the admin panel
      panel.classList.remove('open');
      overlay.classList.remove('active');

      window.print();

      // Restore after print
      window.addEventListener('afterprint', () => {
        const currentIdx = getCurrentSlideIndex ? getCurrentSlideIndex() : 0;
        slidesRef.forEach((s, i) => {
          if (i !== currentIdx) {
            s.style.opacity = '0';
            s.style.visibility = 'hidden';
          }
          s.classList.remove('print-hidden');
        });
      }, { once: true });
    });
  }
}

function applyTheme(name) {
  document.documentElement.setAttribute('data-theme', name);
}

function buildChecklist(container) {
  container.innerHTML = '';
  slidesRef.forEach((slide, i) => {
    const label = document.createElement('label');
    label.className = 'slide-check-item' + (hiddenRef.has(i) ? ' hidden-slide' : '');

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !hiddenRef.has(i);

    const title = slide.querySelector('.slide-title');
    const num = i + 1;
    const text = title ? title.textContent.substring(0, 40) : `Slide ${num}`;

    const span = document.createElement('span');
    span.textContent = `${num}. ${text}`;

    cb.addEventListener('change', () => {
      if (cb.checked) {
        hiddenRef.delete(i);
        label.classList.remove('hidden-slide');
      } else {
        hiddenRef.add(i);
        label.classList.add('hidden-slide');
        // If hiding the current slide, navigate to next visible
        const currentIdx = getCurrentSlideIndex ? getCurrentSlideIndex() : 0;
        if (i === currentIdx && goToFn) {
          // Find next visible slide forward, then backward
          let next = -1;
          for (let j = i + 1; j < slidesRef.length; j++) {
            if (!hiddenRef.has(j)) { next = j; break; }
          }
          if (next === -1) {
            for (let j = i - 1; j >= 0; j--) {
              if (!hiddenRef.has(j)) { next = j; break; }
            }
          }
          if (next !== -1) goToFn(next);
        }
      }
      localStorage.setItem('pres-hidden-slides', JSON.stringify([...hiddenRef]));
    });

    label.appendChild(cb);
    label.appendChild(span);
    container.appendChild(label);
  });
}

function updateNotesContent() {
  const notesOverlay = document.getElementById('speaker-notes-overlay');
  if (!notesOverlay.classList.contains('visible')) return;

  // Find current active slide
  const active = document.querySelector('.slide.active');
  if (!active) return;

  const notes = active.querySelector('.speaker-notes');
  notesOverlay.textContent = notes ? notes.textContent : '';
}

// Observe slide changes
const observer = new MutationObserver(() => {
  updateNotesContent();
});

// Start observing after init
setTimeout(() => {
  const container = document.getElementById('slide-container');
  if (container) {
    observer.observe(container, { attributes: true, subtree: true, attributeFilter: ['class'] });
  }
}, 500);
