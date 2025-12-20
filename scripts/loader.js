/**
 * loader.js - Renders content from SITE_DATA (in data.js)
 */

// --- STATE MANAGEMENT ---
const currentFilterState = {
    search: "",
    type: [], // Multi-select
    subject: [], // Multi-select
    sort: "newest" // 'newest' | 'oldest'
};

let activeData = []; // Store the full list for the current page
let activeContainerId = "";

document.addEventListener("DOMContentLoaded", () => {
    // 1. Determine which page we are on
    const path = window.location.pathname;
    const isHome = path.endsWith("index.html") || path.endsWith("/");
    const isResearch = path.endsWith("research.html");
    const isNotes = path.endsWith("notes.html");
    const isTeaching = path.endsWith("teaching.html");

    // 2. Main Logic
    if (isHome) {
        renderRecents();
    } else if (isResearch) {
        activeData = SITE_DATA.research;
        activeContainerId = "research-list";
        initFiltering();
    } else if (isNotes) {
        activeData = SITE_DATA.notes;
        activeContainerId = "notes-list";
        initFiltering();
    } else if (isTeaching) {
        // Teaching doesn't need filtering per request, just list
        renderList(SITE_DATA.teaching, "teaching-list");
    }
});


/**
 * Initializes the Filtering System (Toolbar + List)
 */
function initFiltering() {
    renderToolbar();
    refreshList(); // Initial render
}

/**
 * Renders the Search / Filter / Sort Toolbar
 */
function renderToolbar() {
    const container = document.getElementById("controls-container");
    if (!container) return;

    // Get unique values for options
    const allTypes = getUniqueValues(activeData, "tag");
    const allSubjects = getUniqueValues(activeData, "subjects", true); // true = array field

    container.innerHTML = `
        <div class="control-toolbar">
            <!-- Search -->
            <div class="control-group search-group">
                <input type="text" id="search-input" placeholder="Search..." />
                <svg class="search-icon" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
            </div>

            <!-- Filters -->
            <div class="control-group filter-group">
                 ${createDropdown("Type", "filter-type", allTypes)}
                 ${createDropdown("Subject", "filter-subject", allSubjects)}
            </div>

            <!-- Sort -->
            <div class="control-group sort-group">
                <select id="sort-select" class="control-select">
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                </select>
            </div>
        </div>
    `;

    // Bind Events
    const searchInput = document.getElementById("search-input");
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            currentFilterState.search = e.target.value.toLowerCase();
            refreshList();
        });
    }

    const sortSelect = document.getElementById("sort-select");
    if (sortSelect) {
        sortSelect.addEventListener("change", (e) => {
            currentFilterState.sort = e.target.value;
            refreshList();
        });
    }

    // Custom Dropdown Events (Delegate)
    document.querySelectorAll(".custom-select-trigger").forEach(trigger => {
        trigger.addEventListener("click", function (e) {
            e.stopPropagation();
            // Close others
            document.querySelectorAll(".custom-select").forEach(s => {
                if (s !== this.parentNode) s.classList.remove("open");
            });
            this.parentNode.classList.toggle("open");
        });
    });

    // Option Clicks
    document.querySelectorAll(".custom-option").forEach(option => {
        option.addEventListener("click", function (e) {
            e.stopPropagation(); // Keep open for multi-select
            this.classList.toggle("selected");
            const value = this.dataset.value;
            const type = this.closest(".custom-select").id === "filter-type" ? "type" : "subject";

            // Toggle in state
            if (currentFilterState[type].includes(value)) {
                currentFilterState[type] = currentFilterState[type].filter(v => v !== value);
            } else {
                currentFilterState[type].push(value);
            }

            // Update Trigger Text
            updateTriggerText(this.closest(".custom-select"), type);
            refreshList();
        });
    });

    // Close dropdowns when clicking outside
    document.addEventListener("click", () => {
        document.querySelectorAll(".custom-select").forEach(s => s.classList.remove("open"));
    });
}

/**
 * Updates the dropdown trigger text (e.g. "Type (2)")
 */
function updateTriggerText(dropdown, type) {
    const count = currentFilterState[type].length;
    const label = dropdown.querySelector(".custom-select-trigger span");
    const baseLabel = type === "type" ? "Type" : "Subject";
    if (count > 0) {
        label.textContent = `${baseLabel} (${count})`;
        dropdown.classList.add("active-filter");
    } else {
        label.textContent = baseLabel;
        dropdown.classList.remove("active-filter");
    }
}

/**
 * Creates HTML for a custom multi-select dropdown
 */
function createDropdown(label, id, options) {
    if (options.length === 0) return ""; // Don't show if no options
    return `
        <div class="custom-select" id="${id}">
            <div class="custom-select-trigger">
                <span>${label}</span>
                <div class="arrow"></div>
            </div>
            <div class="custom-options">
                ${options.map(opt => `<div class="custom-option" data-value="${opt}">${opt}</div>`).join("")}
            </div>
        </div>
    `;
}

/**
 * Refreshes the list based on current state
 */
function refreshList() {
    let results = [...activeData];

    // 1. Filter by Search
    if (currentFilterState.search) {
        const q = currentFilterState.search;
        results = results.filter(item => {
            const text = (item.title + " " + item.abstract + " " + (item.tag || "")).toLowerCase();
            return text.includes(q);
        });
    }

    // 2. Filter by Type
    if (currentFilterState.type.length > 0) {
        results = results.filter(item => currentFilterState.type.includes(item.tag));
    }

    // 3. Filter by Subject
    if (currentFilterState.subject.length > 0) {
        results = results.filter(item => {
            if (!item.subjects) return false;
            return item.subjects.some(sub => currentFilterState.subject.includes(sub));
        });
    }

    // 4. Sort
    results.sort((a, b) => {
        const dateA = parseDate(a.date);
        const dateB = parseDate(b.date);
        return currentFilterState.sort === "newest" ? dateB - dateA : dateA - dateB;
    });

    renderList(results, activeContainerId, activeContainerId === "notes-list");
}


/**
 * Helper: Extract unique values from data array
 */
function getUniqueValues(data, field, isArray = false) {
    const set = new Set();
    data.forEach(item => {
        if (isArray) {
            if (item[field]) item[field].forEach(v => set.add(v));
        } else {
            if (item[field]) set.add(item[field]);
        }
    });
    return Array.from(set).sort();
}


/**
 * Renders a full list of items into a container
 * @param {Array} items - Array of data objects
 * @param {String} containerId - DOM ID of the container
 * @param {Boolean} isNote - If true, adds 'note-card' class
 */
function renderList(items, containerId, isNote = false) {
    const container = document.getElementById(containerId);
    if (!container) return; // Guard clause

    if (items.length === 0) {
        container.innerHTML = `<div class="no-results">No entries found matching your criteria.</div>`;
        return;
    }

    // Pass the search query for highlighting
    const searchQuery = currentFilterState.search || "";
    container.innerHTML = items.map(item => createCardHTML(item, isNote, false, searchQuery)).join("");

    // Process MathJax after rendering
    if (window.MathJax) {
        window.MathJax.typesetPromise();
    }
}

/**
 * Renders the 3 most recent items (excluding teaching) for Home Page
 */
function renderRecents() {
    const container = document.getElementById("recents-list");
    if (!container) return;

    // Combine research and notes (exclude teaching)
    // Add a 'category' field to help with link overrides or styling if needed
    const allItems = [
        ...SITE_DATA.research.map(i => ({ ...i, category: 'research' })),
        ...SITE_DATA.notes.map(i => ({ ...i, category: 'notes' }))
    ];

    // Sort by date descending
    allItems.sort((a, b) => parseDate(b.date) - parseDate(a.date));

    // Take top 3
    const recents = allItems.slice(0, 3);

    // Render (No highlighting for homepage recents currently)
    container.innerHTML = recents.map(item => {
        const linkOverride = item.category === 'research' ? 'research.html' : 'notes.html';
        return createCardHTML({ ...item, linkOverride }, item.category === 'notes', true);
    }).join("");

    if (window.MathJax) {
        window.MathJax.typesetPromise();
    }
}


/**
 * Generates HTML for a single card
 * @param {Object} item - The data item to render
 * @param {Boolean} isNote - True if it's a note card
 * @param {Boolean} isRecent - True if it's a recent item (affects link logic)
 * @param {String} searchQuery - Optional search query for highlighting
 */
function createCardHTML(item, isNote, isRecent = false, searchQuery = "") {
    const cardClass = isNote ? "paper-card note-card" : "paper-card";

    // Link Logic
    let titleLink = "#";
    if (isRecent && item.linkOverride) {
        titleLink = item.linkOverride;
    } else if (item.link) {
        titleLink = item.link;
    } else if (item.links && item.links.length > 0) {
        titleLink = item.links[0].url;
    }

    // Highlight text if search query exists
    const titleHtml = highlightText(item.title, searchQuery);
    const abstractHtml = highlightText(item.abstract, searchQuery);

    // Generate Links HTML with Icons and Button Classes
    let linksHTML = "";
    if (item.links) {
        linksHTML = `<div class="paper-links">
            ${item.links.map(l => {
            const icon = getIcon(l.text) || "";
            const btnClass = getButtonClass(l.text);
            return `<a href="${l.url}" class="${btnClass}">${icon}${l.text}</a>`;
        }).join("")}
        </div>`;
    }

    // Subject Tags
    let subjectsHTML = "";
    if (item.subjects && item.subjects.length > 0) {
        subjectsHTML = `<div class="paper-subjects">
            ${item.subjects.map(sub => `<span class="paper-subject">${sub}</span>`).join("")}
        </div>`;
    }

    return `
    <article class="${cardClass}">
        <div class="paper-meta">
            <span class="paper-date">${item.date}</span>
            <span class="paper-tag">${item.tag}</span>
        </div>
        <h3 class="paper-title"><a href="${titleLink}">${titleHtml}</a></h3>
        <p class="paper-abstract">
            ${abstractHtml}
        </p>
        
        ${subjectsHTML}
        ${linksHTML}
    </article>
    `;
}

/**
 * Helper: Highlight matching text
 */
function highlightText(text, query) {
    if (!query || !text) return text;
    // Escape special regex characters in query
    const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${safeQuery})`, 'gi');
    return text.replace(regex, '<mark class="search-highlight">$1</mark>');
}

/**
 * Helper: Parse "Month Year" string to Date object
 */
function parseDate(dateStr) {
    if (!dateStr) return new Date(0);
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;
    const d2 = new Date("1 " + dateStr);
    if (!isNaN(d2.getTime())) return d2;
    return new Date(0);
}

/**
 * Helper: Get SVG Icon based on link text or URL (Outlined Style)
 */
function getIcon(text) {
    const t = text.toLowerCase();

    // PDF Icon (Outlined)
    if (t.includes("pdf")) {
        return `<svg class="link-icon" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <path d="M16 13H8"></path>
            <path d="M16 17H8"></path>
            <path d="M10 9H8"></path>
        </svg>`;
    }

    // YouTube / Video Icon (Outlined)
    if (t.includes("youtube") || t.includes("video")) {
        return `<svg class="link-icon" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"></path>
            <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" fill="currentColor" stroke="none"></polygon> 
        </svg>`;
    }

    // Details / Link Icon
    if (t.includes("details")) {
        return `<svg class="link-icon" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
        </svg>`;
    }

    return "";
}

/**
 * Helper: Get Button Class based on text
 */
function getButtonClass(text) {
    const t = text.toLowerCase();
    if (t.includes("pdf")) return "btn-pdf";
    if (t.includes("youtube") || t.includes("video")) return "btn-youtube";
    if (t.includes("github") || t.includes("git")) return "btn-github";
    if (t.includes("email") || t.includes("mail")) return "btn-email";
    if (t.includes("details")) return "btn-details";
    return "";
}
