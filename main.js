let data; // global data

// Simple image caching - just cache the URLs to avoid re-requests
const imageCache = new Set();

function formatDateEuropean(dateString) {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

function getTurkishWeekday(dateString) {
    const date = new Date(dateString);
    const weekdays = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    return weekdays[date.getDay()];
}

function getScoreColorClass(resultColor) {
    if (resultColor.includes("green")) return "match-score-win";
    if (resultColor.includes("red")) return "match-score-loss";
    if (resultColor.includes("slate")) return "match-score-draw";
    return "match-score-pending";
}

function getPredictionClasses(isCompleted, prediction, isCorrect) {
    let classes = "prediction-badge";
    if (isCompleted && prediction) {
        classes += isCorrect ? " prediction-badge-correct" : " prediction-badge-incorrect";
    }
    return classes;
}

function getPredictionValueClass(isCompleted, prediction, isCorrect) {
    if (!isCompleted || !prediction) return "prediction-value-pending";
    return isCorrect ? "prediction-value-correct" : "prediction-value-incorrect";
}

document.addEventListener("DOMContentLoaded", function() {
    loadData();
    initializeTheme();
});

async function loadData() {
    try {
        const res = await fetch(`data.json`);
        data = await res.json(); // Store globally

        displayLeaderboard(data.matches, data.guesses);

        // display all matches in merged view
        displayAllMatches();

        // fixed loading time
        setTimeout(hideLoadingOverlay, 500);
    } catch (error) {
        console.error("Error loading data:", error);
        setTimeout(hideLoadingOverlay, 500);
    }
}

function hideLoadingOverlay() {
    const loadingOverlay = document.getElementById("loading-overlay");
    if (loadingOverlay) {
        loadingOverlay.classList.add("hidden");
        // remove from DOM after animation completes
        setTimeout(() => {
            if (loadingOverlay.parentNode) {
                loadingOverlay.parentNode.removeChild(loadingOverlay);
            }
        }, 300);
    }
}




function isPredictionCorrect(prediction, result, isHome) {
    if (!prediction || !result) return false;

    // extract scores
    const resultMatch = result.match(/(\d+)-(\d+)/);
    if (!resultMatch) return false;

    const homeScore = parseInt(resultMatch[1]); // home team score
    const awayScore = parseInt(resultMatch[2]); // away team score

    // determine team score and opponent score based on home/away
    const teamScore = isHome ? homeScore : awayScore;
    const opponentScore = isHome ? awayScore : homeScore;

    // actual outcome
    let actualOutcome;
    if (teamScore > opponentScore) {
        actualOutcome = 'W'; // win
    } else if (teamScore < opponentScore) {
        actualOutcome = 'L'; // loss
    } else {
        actualOutcome = 'D'; // draw
    }

    // compare with prediction
    return prediction === actualOutcome;
}

function displayLeaderboard(matches, guesses) {
    const stats = calculateStats(matches, guesses);

    // sort by points (points descending, name ascending)
    const sortedByPoints = [...stats].sort((a, b) => {
        if (b.points !== a.points) {
            return b.points - a.points;
        }
        return a.name.localeCompare(b.name);
    });

    displayPointsLeaderboard(sortedByPoints);
}

function calculateStats(matches, guesses) {
    return guesses.map(person => {
        let correct = 0;
        let total = 0;

        matches.forEach(match => {
            if (match.result && match.result !== "null") {
                const prediction = person.predictions[match.id];
                if (prediction) {
                    total++;
                    if (isPredictionCorrect(prediction, match.result, match.home)) {
                        correct++;
                    }
                }
            }
        });

        return {
            name: person.name,
            points: correct * 3,
            correct: correct,
            total: total,
            accuracy: total > 0 ? ((correct / total) * 100) : 0
        };
    });
}

function displayPointsLeaderboard(sortedStats) {
    const topContainer = document.getElementById("top-players");
    const restContainer = document.getElementById("remaining-players");

    topContainer.innerHTML = '';
    restContainer.innerHTML = '';

    sortedStats.forEach((player, index) => {
        const position = index + 1;
        let positionEmoji = "";

        if (position === 1) {
            positionEmoji = "🥇";
        } else if (position === 2) {
            positionEmoji = "🥈";
        } else if (position === 3) {
            positionEmoji = "🥉";
        } else if (position === 4) {
            positionEmoji = "🫃";
        } else if (position === 5) {
            positionEmoji = "🫏";
        } else {
            positionEmoji = "♿";
        }

        const playerDiv = document.createElement("div");
        let cardClasses = "player-card";
        if (position === 1) cardClasses += " player-card-winner";
        playerDiv.className = cardClasses;

        playerDiv.innerHTML = `
            <div class="player-info">
                <span class="player-emoji">${positionEmoji}</span>
                <div>
                    <div class="player-name">${player.name}</div>
                    <div class="player-position">#${position}</div>
                </div>
            </div>
            <div class="player-stats">
                <div>
                    <div class="player-points">${player.points}</div>
                    <div class="player-points-label">puan</div>
                </div>
                <div>
                    <div class="player-accuracy ${player.accuracy >= 50 ? 'player-accuracy-good' : 'player-accuracy-poor'}">
                        ${player.accuracy.toFixed(1)}%
                    </div>
                    <div class="player-accuracy-details">${player.correct}/${player.total} doğru</div>
                </div>
            </div>
        `;

        // show top 1 player
        if (index === 0) {
            topContainer.appendChild(playerDiv);
        } else {
            restContainer.appendChild(playerDiv);
        }
    });
}


function toggleLeaderboard() {
    const restBoard = document.getElementById("remaining-players");
    const button = document.getElementById("show-more-players-btn");

    if (restBoard.classList.contains("hidden")) {
        restBoard.classList.remove("hidden");
        button.textContent = "futbol cahillerini     gizle";
    } else {
        restBoard.classList.add("hidden");
        button.textContent = "diğerleri";
    }
}


let allMatchesData = []; // Store all matches for lazy loading

function displayAllMatches() {
    const container = document.getElementById("all-matches");

    // Keep skeleton until real content loads to prevent layout shift
    const hasSkeletons = container.querySelectorAll('.match-card-skeleton').length > 0;

    // get all matches
    const allMatches = [...data.matches].sort((a, b) => {
        const dateA = new Date(a.date + ' ' + (a.time || '00:00'));
        const dateB = new Date(b.date + ' ' + (b.time || '00:00'));
        return dateA - dateB;
    });

    // group by date
    const matchesByDate = {};
    allMatches.forEach(match => {
        if (!matchesByDate[match.date]) {
            matchesByDate[match.date] = { galatasaray: [] };
        }
        if (match.team === "Galatasaray") {
            matchesByDate[match.date].galatasaray.push(match);
        }
    });

    // flatten matches for lazy loading
    allMatchesData = [];
    const sortedDates = Object.keys(matchesByDate).sort((a, b) => a.localeCompare(b));

    sortedDates.forEach(date => {
        const dayMatches = matchesByDate[date];
        dayMatches.galatasaray.forEach(match => {
            allMatchesData.push(match);
        });
    });


    // Load first batch immediately (first 10 matches to test)
    const initialBatch = allMatchesData.slice(0, 10);
    const fragment = document.createDocumentFragment();

    initialBatch.forEach(match => {
        renderMatchCard(match, fragment);
    });

    // Clear skeleton content before adding real content
    if (hasSkeletons) {
        container.innerHTML = '';
    }

    container.appendChild(fragment);

    // Set up lazy loading for remaining matches
    if (allMatchesData.length > 10) {
        setupLazyLoading(container);
    }
}

function setupLazyLoading(container) {
    let loadedCount = 10;
    const batchSize = 3;
    let isLoading = false;

    // Create intersection observer for infinite scroll
    const observer = new IntersectionObserver((entries) => {
        const lastEntry = entries[0];
        console.log('Observer triggered:', lastEntry.isIntersecting, 'isLoading:', isLoading, 'loadedCount:', loadedCount, 'totalMatches:', allMatchesData.length);

        if (lastEntry.isIntersecting && !isLoading && loadedCount < allMatchesData.length) {
            console.log('Loading next batch...');
            isLoading = true;
            loadNextBatch(container);
        }
    }, {
        rootMargin: '100px' // Load when 100px before reaching bottom
    });

    function loadNextBatch(container) {
        const nextBatch = allMatchesData.slice(loadedCount, loadedCount + batchSize);
        const fragment = document.createDocumentFragment();

        nextBatch.forEach(match => {
            renderMatchCard(match, fragment);
        });

        container.appendChild(fragment);
        loadedCount += nextBatch.length;
        isLoading = false;

        // Observe the last element for next batch
        if (loadedCount < allMatchesData.length) {
            const lastCard = container.lastElementChild;
            if (lastCard) {
                observer.observe(lastCard);
            }
        }
    }

    // Start observing the last initially loaded card
    const lastCard = container.lastElementChild;
    if (lastCard) {
        observer.observe(lastCard);
    }
}

function getResultColor(match) {
    if (match.result === null || match.result === "null") {
        return "match-score-pending";
    }
    
    const scores = match.result.split('-');
    const homeScore = parseInt(scores[0]);
    const awayScore = parseInt(scores[1]);

    if (homeScore === awayScore) {
        return "text-slate-400";
    }
    
    const teamWon = match.home ? homeScore > awayScore : awayScore > homeScore;
    return teamWon ? "text-green-800" : "text-red-800";
}

function getCardClasses(isCompleted, resultColor) {
    let cardClasses = "match-card";
    if (isCompleted) {
        if (resultColor.includes("green")) cardClasses += " match-card-completed-win";
        else if (resultColor.includes("red")) cardClasses += " match-card-completed-loss";
        else if (resultColor.includes("slate")) cardClasses += " match-card-completed-draw";
    }
    return cardClasses;
}

function generateMatchHeader(match, leftTeam, rightTeam, resultColor) {
    const isCompleted = match.result !== null;

    return `
        <div class="match-header">
            <div class="team-info team-info-left">
                <div class="team-logo-container">
                    <img src="${leftTeam.logo}" alt="${leftTeam.name}" class="team-logo" loading="lazy" width="32" height="32">
                </div>
                <div class="team-name-container">
                    <span class="team-name">${leftTeam.name}</span>
                </div>
            </div>
            <div class="match-score-container">
                <div class="match-score ${getScoreColorClass(resultColor)}">
                    ${isCompleted ? `${match.result}` : "vs"}
                </div>
                <div class="match-date">
                    ${formatDateEuropean(match.date)}
                </div>
                <div class="match-time">
                    ${getTurkishWeekday(match.date)} ${match.time || "TBD"}
                </div>
            </div>
            <div class="team-info team-info-right">
                <div class="team-logo-container">
                    <img src="${rightTeam.logo}" alt="${rightTeam.name}" class="team-logo" loading="lazy" width="32" height="32">
                </div>
                <div class="team-name-container">
                    <span class="team-name">${rightTeam.name}</span>
                </div>
            </div>
        </div>
    `;
}

function generatePredictions(match) {
    const isCompleted = match.result !== null;
    const numUsers = data.guesses.length;                                                               
    let html = `<div class="predictions-grid" style="grid-template-columns: repeat(${numUsers},         
1fr);">`;                                                                                                
    data.guesses.forEach(person => {
        const prediction = person.predictions[match.id];
        const isCorrect = isCompleted && prediction ? isPredictionCorrect(prediction, match.result, match.home) : false;

        const badgeClasses = getPredictionClasses(isCompleted, prediction, isCorrect);
        const valueClasses = getPredictionValueClass(isCompleted, prediction, isCorrect);

        html += `<div class="${badgeClasses}">
                    <div class="prediction-name">${person.name}</div>
                    <div class="prediction-value ${valueClasses}">${prediction || "-"}</div>
                </div>`;
    });
    
    html += `</div>`;
    return html;
}

function renderMatchCard(match, container) {
    const teamInfo = data.teams[match.team];
    const opponentInfo = data.teams[match.opponent];
    const isCompleted = match.result !== null;

    const resultColor = getResultColor(match);
    const homeTeam = { name: match.team, logo: teamInfo.logo };
    const awayTeam = { name: match.opponent, logo: opponentInfo.logo };
    const leftTeam = match.home ? homeTeam : awayTeam;
    const rightTeam = match.home ? awayTeam : homeTeam;

    const matchDiv = document.createElement("div");
    matchDiv.className = getCardClasses(isCompleted, resultColor);

    const matchHeader = generateMatchHeader(match, leftTeam, rightTeam, resultColor);
    const predictions = generatePredictions(match);

    matchDiv.innerHTML = matchHeader + predictions;

    // Cache images for better performance
    imageCache.add(leftTeam.logo);
    imageCache.add(rightTeam.logo);

    if (container.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
        container.appendChild(matchDiv);
    } else {
        container.appendChild(matchDiv);
    }
}

// Theme functionality
function initializeTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    const savedTheme = localStorage.getItem('theme') || 'light';

    // Apply saved theme
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    // Add click event listener
    themeToggle.addEventListener('click', toggleTheme);

    // Add keyboard support
    themeToggle.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleTheme();
        }
    });

    // Add global keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + Shift + D for dark mode toggle
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'D') {
            e.preventDefault();
            toggleTheme();
        }
    });
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);

    // Announce theme change to screen readers
    const announcement = `Theme switched to ${newTheme} mode`;
    announceToScreenReader(announcement);
}

function announceToScreenReader(message) {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.style.position = 'absolute';
    announcement.style.left = '-10000px';
    announcement.style.width = '1px';
    announcement.style.height = '1px';
    announcement.style.overflow = 'hidden';

    document.body.appendChild(announcement);
    announcement.textContent = message;

    setTimeout(() => {
        document.body.removeChild(announcement);
    }, 1000);
}

function updateThemeIcon(theme) {
    const themeToggle = document.getElementById('theme-toggle');
    themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
}

