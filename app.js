// --- GOOGLE BRIDGE CONFIGURATION ---
// After deploying your Google Apps Script, paste the Web App URL here:
const API_CONFIG = {
    url: 'https://script.google.com/macros/s/AKfycbz7rGCCULvJ1oVheLSYOT_j6Z__Kzk5iwlurp-bH8uBJEYYZjiszCwrevBJZyaTp-WSNg/exec',
    enabled: true // Set to true after pasting the URL
};

// Initial Data Configuration (Fallback)
const DEFAULT_DATA = {
    targetAmount: 5000000,
    currentAmount: 1250000,
    batches: [
        { id: 1, type: "progress", batch: "صيانة القاعات الكبرى", date: "2026-03-20", amount: 0, image: "assets/uofg-med.jpg", status: "ongoing" },
        { id: 2, type: "funding", batch: "دفعة 38", date: "2026-03-22", amount: 450000, image: "assets/uofg-intro-show.jpg", status: "done" }
    ]
};

let appState = DEFAULT_DATA;

// Fetch Data from Google Bridge or LocalStorage
async function initAppData() {
    if (API_CONFIG.enabled && API_CONFIG.url) {
        try {
            const response = await fetch(API_CONFIG.url);
            const cloudData = await response.json();

            // Map Cloud Data to App State
            appState = {
                targetAmount: cloudData.stats.target_amount || DEFAULT_DATA.targetAmount,
                currentAmount: cloudData.stats.total_collected || DEFAULT_DATA.currentAmount,
                batches: cloudData.gallery.map(item => ({
                    id: item.id,
                    type: item.type,
                    batch: item.category, // Using category as batch name from sheet
                    date: item.date,
                    amount: item.amount || 0,
                    image: item.url,
                    status: item.status === 'active' ? 'done' : 'ongoing'
                }))
            };

            // Sync with local cache
            localStorage.setItem('emaar_state', JSON.stringify(appState));
        } catch (error) {
            console.error("Failed to fetch cloud data, using local storage:", error);
            const saved = localStorage.getItem('emaar_state');
            if (saved) appState = JSON.parse(saved);
        }
    } else {
        const saved = localStorage.getItem('emaar_state');
        if (saved) appState = JSON.parse(saved);
        else localStorage.setItem('emaar_state', JSON.stringify(DEFAULT_DATA));
    }

    updateUI();
}

// Update UI Components
// Update UI Components
function updateUI() {
    const state = appState;

    // Update Progress
    const currentTotal = state.currentAmount;
    const target = state.targetAmount;

    const currentAmountEl = document.getElementById('current-amount');
    const targetAmountEl = document.getElementById('target-amount');

    if (targetAmountEl) targetAmountEl.innerText = target.toLocaleString();

    // Intersection Observer for Animation
    if (currentAmountEl) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    animateValue('current-amount', 0, currentTotal, 2000);
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.5 });
        observer.observe(document.querySelector('.progress-card'));
    }

    const percentage = Math.min((currentTotal / target) * 100, 100);
    const progressBar = document.getElementById('progress-bar');
    const progressPercentage = document.getElementById('progress-percentage');

    if (progressBar) progressBar.style.width = percentage + '%';
    if (progressPercentage) progressPercentage.innerText = Math.round(percentage) + '%';

    // Calculate Leaderboard
    const batchTotals = {};
    state.batches.forEach(b => {
        if (b.type === 'funding') {
            batchTotals[b.batch] = (batchTotals[b.batch] || 0) + b.amount;
        }
    });

    const leaderboardData = Object.keys(batchTotals)
        .map(name => ({ name, amount: batchTotals[name] }))
        .sort((a, b) => b.amount - a.amount);

    const leaderboard = document.getElementById('leaderboard-container');
    if (leaderboard) {
        leaderboard.innerHTML = '';

        // Find max total for ratio
        const maxTotal = Math.max(...Object.values(batchTotals), 1);

        if (leaderboardData.length === 0) {
            leaderboard.innerHTML = '<div class="placeholder-msg">لا توجد مساهمات حتى الآن</div>';
        } else {
            leaderboardData.forEach((item, index) => {
                const row = document.createElement('div');
                const rank = index + 1;
                const ratio = (item.amount / maxTotal) * 100;

                row.className = `leader-row rank-${rank}`;
                row.style.setProperty('--contribution-width', `${ratio}%`);

                row.innerHTML = `
                    <div class="leader-info">
                        <div class="rank-badge">${rank}</div>
                        <span class="batch-name">${item.name}</span>
                    </div>
                    <div class="batch-total">${item.amount.toLocaleString()} <span style="font-size: 0.8rem; font-weight: 600;">ج.س</span></div>
                `;
                leaderboard.appendChild(row);
            });
        }
    }

    if (progressGallery) progressGallery.innerHTML = '';

    const sortedEntries = state.batches.slice().reverse();

    sortedEntries.forEach(item => {
        // STRICT PRIVACY: Receipts are NEVER shown in any public gallery
        if (item.type === 'funding') return;

        const card = document.createElement('div');
        card.className = 'gallery-item fade-in';

        const statusBadge = item.type === 'progress'
            ? `<span class="status-badge ${item.status}">${item.status === 'done' ? 'تم الإنجاز' : 'جاري العمل'}</span>`
            : '';

        // Media Detection
        const isVideo = item.image.toLowerCase().match(/\.(mp4|webm|ogg|mov)$/) || item.image.includes('youtube.com') || item.image.includes('vimeo.com');
        const mediaHtml = isVideo
            ? `<video src="${item.image}" class="gallery-img" muted loop playsinline onmouseover="this.play()" onmouseout="this.pause()"></video>
               <div class="video-overlay"><i class="fas fa-play"></i></div>`
            : `<img src="${item.image}" alt="صورة" class="gallery-img">`;

        card.innerHTML = `
            ${statusBadge}
            <div class="media-container ${isVideo ? 'video-type' : ''}">
                ${mediaHtml}
            </div>
            <div class="gallery-info">
                <span class="gallery-batch">${item.batch}</span>
                <span class="gallery-date">${item.date}</span>
                ${item.amount > 0 ? `<p style="margin-top: 5px;">القيمة: ${item.amount.toLocaleString()} ج.س</p>` : ''}
            </div>
        `;

        if (item.type === 'progress' && progressGallery) {
            progressGallery.appendChild(card);
        }
    });

    if (progressGallery && progressGallery.innerHTML === '') {
        progressGallery.innerHTML = '<div class="placeholder-msg">لا توجد أعمال لعرضها</div>';
    }

    // Full Gallery Page Logic
    const fullGallery = document.getElementById('full-gallery-grid');
    if (fullGallery) {
        renderFullGallery('all');
    }
}

function renderFullGallery(filter = 'all') {
    const fullGallery = document.getElementById('full-gallery-grid');
    if (!fullGallery) return;

    fullGallery.innerHTML = '';
    const state = appState;

    const entries = state.batches.slice().reverse().filter(item => {
        // STRICT PRIVACY: Receipts are NEVER shown in the public gallery
        if (item.type === 'funding') return false;

        if (filter === 'all') return true;
        return item.type === filter;
    });

    if (entries.length === 0) {
        fullGallery.innerHTML = '<div class="placeholder-msg">لا توجد صور في هذا التصنيف</div>';
        return;
    }

    entries.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'gallery-item fade-in';
        card.style.animationDelay = `${index * 0.1}s`;

        const statusBadge = item.type === 'progress'
            ? `<span class="status-badge ${item.status}">${item.status === 'done' ? 'تم الإنجاز' : 'جاري العمل'}</span>`
            : '';

        const isVideo = item.image.toLowerCase().match(/\.(mp4|webm|ogg|mov)$/) || item.image.includes('youtube.com') || item.image.includes('vimeo.com');
        const mediaHtml = isVideo
            ? `<video src="${item.image}" class="gallery-img" controls></video>`
            : `<img src="${item.image}" alt="صورة" class="gallery-img">`;

        card.innerHTML = `
            ${statusBadge}
            <div class="media-container ${isVideo ? 'video-type' : ''}">
                ${mediaHtml}
            </div>
            <div class="gallery-info">
                <span class="gallery-batch">${item.batch}</span>
                <span class="gallery-date">${item.date}</span>
                ${item.amount > 0 ? `<p style="margin-top: 5px;">القيمة: ${item.amount.toLocaleString()} ج.س</p>` : ''}
            </div>
        `;
        fullGallery.appendChild(card);
    });
}

function filterGallery(type) {
    // Update buttons
    const btns = document.querySelectorAll('.filter-btn');
    btns.forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent.includes(type === 'all' ? 'الكل' : 'الإعمار')) {
            btn.classList.add('active');
        }
    });

    renderFullGallery(type);
}

// Helper: Animate Value
function animateValue(id, start, end, duration) {
    const obj = document.getElementById(id);
    if (!obj) return;

    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const value = Math.floor(progress * (end - start) + start);
        obj.innerHTML = value.toLocaleString();
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

// Copy Text Helper
function copyText(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert('تم نسخ الرقم بنجاح');
    });
}

// Initial Load
document.addEventListener('DOMContentLoaded', initAppData);

// Listen for storage changes
window.addEventListener('storage', (e) => {
    if (e.key === 'emaar_state') {
        appState = JSON.parse(e.newValue);
        updateUI();
    }
});
