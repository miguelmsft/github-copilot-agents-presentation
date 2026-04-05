/* ============================================================
   APP.JS — Navigation, slide loading, keyboard
   ============================================================ */

import { transitionSlide, animateSlideContent } from './transitions.js';
import { initAdmin } from './admin.js';

const TOTAL_SLIDES = 81;
let currentSlide = 0;
let slides = [];
let hiddenSlides = new Set();
let isTransitioning = false;

const container = document.getElementById('slide-container');
const scaler = document.getElementById('slide-scaler');
const counter = document.getElementById('slide-counter');
const sectionLabel = document.getElementById('section-label');
const progressBar = document.getElementById('progress-bar');
const notesOverlay = document.getElementById('speaker-notes-overlay');

// ---- Viewport scaling (PowerPoint-style) ----
const DESIGN_WIDTH = 1920;
const DESIGN_HEIGHT = 1080;
let lastScale = -1;

function fitToViewport() {
  const scaleX = window.innerWidth / DESIGN_WIDTH;
  const scaleY = window.innerHeight / DESIGN_HEIGHT;
  const scale = Math.min(scaleX, scaleY);
  if (scale !== lastScale) {
    scaler.style.transform = `translate(-50%, -50%) scale(${scale})`;
    lastScale = scale;
  }
}

window.addEventListener('resize', () => requestAnimationFrame(fitToViewport));

// Build visible slide index (excludes hidden)
function getVisibleSlides() {
  return slides.filter((_, i) => !hiddenSlides.has(i));
}

function getVisibleIndex() {
  const visible = getVisibleSlides();
  return visible.findIndex(s => s === slides[currentSlide]);
}

// Load a single slide HTML
async function loadSlide(num) {
  const padded = String(num).padStart(3, '0');
  try {
    const resp = await fetch(`${import.meta.env.BASE_URL}slides/slide-${padded}.html`);
    if (!resp.ok) return null;
    return await resp.text();
  } catch {
    return null;
  }
}

// Initialize all slides
async function init() {
  // Load all slides
  const promises = [];
  for (let i = 1; i <= TOTAL_SLIDES; i++) {
    promises.push(loadSlide(i));
  }
  const htmls = await Promise.all(promises);

  htmls.forEach((html, i) => {
    if (!html) return;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html.trim();
    const article = wrapper.querySelector('article.slide');
    if (article) {
      container.appendChild(article);
      slides.push(article);
    }
  });

  // Load hidden slides from localStorage
  const saved = localStorage.getItem('pres-hidden-slides');
  if (saved) {
    try {
      hiddenSlides = new Set(JSON.parse(saved));
    } catch {}
  }

  // Show first visible slide
  const startSlide = parseInt(localStorage.getItem('pres-current-slide') || '0', 10);
  currentSlide = Math.min(startSlide, slides.length - 1);
  if (currentSlide < 0) currentSlide = 0;

  showSlide(currentSlide, 'none');
  initAdmin(slides, hiddenSlides, goToSlide, () => currentSlide);
  setupKeyboard();
  setupTouch();
  fitToViewport();

  document.body.classList.add('loaded');
}

function showSlide(index, direction = 'none') {
  if (index < 0 || index >= slides.length) return;

  const oldSlide = slides[currentSlide];
  const newSlide = slides[index];

  if (oldSlide === newSlide && direction !== 'none') return;

  // Skip hidden slides
  if (hiddenSlides.has(index)) {
    const nextIdx = direction === 'right' ? findNextVisible(index, 1) : findNextVisible(index, -1);
    if (nextIdx !== -1) {
      showSlide(nextIdx, direction);
    }
    return;
  }

  currentSlide = index;
  localStorage.setItem('pres-current-slide', index);
  updateUI();

  if (direction === 'none') {
    // Initial load — no transition
    slides.forEach(s => {
      s.classList.remove('active');
      s.style.opacity = '0';
      s.style.visibility = 'hidden';
    });
    newSlide.classList.add('active');
    newSlide.style.opacity = '1';
    newSlide.style.visibility = 'visible';
    animateSlideContent(newSlide);
  } else {
    isTransitioning = true;
    transitionSlide(oldSlide, newSlide, direction, () => {
      animateSlideContent(newSlide);
      // Release lock after content animation starts (brief delay to prevent overlap)
      setTimeout(() => { isTransitioning = false; }, 80);
    });
  }
}

function findNextVisible(from, step) {
  let idx = from + step;
  while (idx >= 0 && idx < slides.length) {
    if (!hiddenSlides.has(idx)) return idx;
    idx += step;
  }
  return -1;
}

function updateUI() {
  // Counter
  const visibleIdx = getVisibleIndex();
  const totalVisible = getVisibleSlides().length;
  counter.textContent = `${visibleIdx + 1} / ${totalVisible}`;

  // Section label
  const slide = slides[currentSlide];
  sectionLabel.textContent = slide.dataset.section || '';

  // Progress bar
  const pct = ((visibleIdx + 1) / totalVisible) * 100;
  progressBar.style.width = `${pct}%`;

  // Speaker notes
  const notes = slide.querySelector('.speaker-notes');
  if (notes && notesOverlay.classList.contains('visible')) {
    notesOverlay.textContent = notes.textContent;
  } else if (!notes) {
    notesOverlay.textContent = '';
  }
}

function nextSlide() {
  if (isTransitioning) return;
  const next = findNextVisible(currentSlide, 1);
  if (next !== -1) showSlide(next, 'right');
}

function prevSlide() {
  if (isTransitioning) return;
  const prev = findNextVisible(currentSlide, -1);
  if (prev !== -1) showSlide(prev, 'left');
}

function goToSlide(index) {
  if (index >= 0 && index < slides.length && !hiddenSlides.has(index)) {
    showSlide(index, 'none');
  }
}

function setupKeyboard() {
  document.addEventListener('keydown', (e) => {
    // Don't handle if admin panel input is focused
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
      case ' ':
      case 'PageDown':
        e.preventDefault();
        nextSlide();
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
      case 'PageUp':
        e.preventDefault();
        prevSlide();
        break;
      case 'Home':
        e.preventDefault();
        goToSlide(findNextVisible(-1, 1));
        break;
      case 'End':
        e.preventDefault();
        goToSlide(findNextVisible(slides.length, -1));
        break;
      case 'f':
      case 'F':
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          toggleFullscreen();
        }
        break;
    }
  });
}

function setupTouch() {
  let startX = 0;
  let startY = 0;

  container.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });

  container.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      if (dx < 0) nextSlide();
      else prevSlide();
    }
  }, { passive: true });
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen();
  }
}

// Export for admin
export { slides, hiddenSlides, goToSlide, updateUI, showSlide, currentSlide };

// Boot
document.addEventListener('DOMContentLoaded', init);
