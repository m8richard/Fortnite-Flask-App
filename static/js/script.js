// State management
const state = {
    statsData: [],
    darkMode: false
};

// DOM Elements
const elements = {
    playerSelect: document.getElementById('playerSelect'),
    tournamentSelect: document.getElementById('tournamentSelect'),
    windowSelect: document.getElementById('windowSelect'),
    refreshButton: document.getElementById('refreshButton'),
    themeToggle: document.getElementById('themeToggle'),
    lastUpdateTime: document.getElementById('lastUpdateTime'),
    statsDisplay: document.getElementById('statsDisplay'),
    errorDisplay: document.getElementById('errorDisplay'),
    statCardTemplate: document.getElementById('statCardTemplate'),
    errorTemplate: document.getElementById('errorTemplate')
};

// API Functions
const api = {
    async fetchStats() {
        try {
            const response = await fetch('/api/stats');
            if (!response.ok) throw new Error('Network response was not ok');
            return await response.json();
        } catch (error) {
            throw new Error('Error fetching stats: ' + error.message);
        }
    },

    async refreshData() {
        try {
            const response = await fetch('/api/refresh', { method: 'POST' });
            if (!response.ok) throw new Error('Network response was not ok');
            return await response.json();
        } catch (error) {
            throw new Error('Error during refresh: ' + error.message);
        }
    }
};

// UI Components
const components = {
    createStatCard(title, mainValue, subtextValue) {
        const template = elements.statCardTemplate.content.cloneNode(true);
        template.querySelector('.card-title').textContent = title;
        template.querySelector('.stat-value').innerHTML = mainValue;
        template.querySelector('.subtext').innerHTML = subtextValue || '';
        return template;
    },

    showError(message) {
        const template = elements.errorTemplate.content.cloneNode(true);
        template.querySelector('.alert').textContent = message;
        elements.errorDisplay.innerHTML = '';
        elements.errorDisplay.appendChild(template);
        setTimeout(() => elements.errorDisplay.innerHTML = '', 5000);
    }
};

// Utility Functions
const utils = {
    formatNumber(num) {
        if (!num || num === -1) return "0";
        return new Intl.NumberFormat().format(parseFloat(num));
    },

    calculateStats(stats, isTournament) {
        return {
            accuracy: !isTournament 
                ? (stats.hits / stats.shots * 100 || 0)
                : (stats.hitsToPlayers / stats.shots * 100 || 0),
            winRate: !isTournament 
                ? (stats.top1 / stats.matchesPlayed * 100 || 0)
                : 0
        };
    }
};

// UI Update Functions
const ui = {
    updateTournamentOptions() {
        const selectedPlayer = elements.playerSelect.value;
        elements.tournamentSelect.innerHTML = '<option value="">Select a tournament</option>';
        elements.windowSelect.innerHTML = '<option value="">Select a window</option>';
        
        if (!selectedPlayer) {
            elements.tournamentSelect.disabled = true;
            elements.windowSelect.disabled = true;
            return;
        }

        const tournaments = [...new Set(state.statsData
            .filter(stat => stat.epic_username === selectedPlayer)
            .map(stat => stat.event_id)
            .filter(id => id !== ''))];

        tournaments.forEach(tournament => {
            const option = document.createElement('option');
            option.value = tournament;
            option.textContent = tournament;
            elements.tournamentSelect.appendChild(option);
        });

        elements.tournamentSelect.disabled = false;
        ui.updateStatsDisplay();
    },

    updateWindowOptions() {
        const selectedPlayer = elements.playerSelect.value;
        const selectedTournament = elements.tournamentSelect.value;
        elements.windowSelect.innerHTML = '<option value="">Select a window</option>';
        
        if (!selectedTournament) {
            elements.windowSelect.disabled = true;
            return;
        }

        const windows = state.statsData
            .filter(stat => 
                stat.epic_username === selectedPlayer && 
                stat.event_id === selectedTournament)
            .map(stat => stat.window_id);

        windows.forEach(window => {
            const option = document.createElement('option');
            option.value = window;
            option.textContent = window;
            elements.windowSelect.appendChild(option);
        });

        elements.windowSelect.disabled = false;
        ui.updateStatsDisplay();
    },

    updateStatsDisplay() {
        const selectedPlayer = elements.playerSelect.value;
        if (!selectedPlayer) {
            elements.statsDisplay.innerHTML = '';
            return;
        }

        const selectedTournament = elements.tournamentSelect.value;
        const selectedWindow = elements.windowSelect.value;
        
        let stats;
        if (selectedTournament && selectedWindow) {
            stats = state.statsData.find(stat => 
                stat.epic_username === selectedPlayer && 
                stat.event_id === selectedTournament &&
                stat.window_id === selectedWindow
            );
        } else {
            stats = state.statsData.find(stat => 
                stat.epic_username === selectedPlayer && 
                stat.event_id === ''
            );
        }

        if (!stats) {
            elements.statsDisplay.innerHTML = '<div class="col-12">No stats available</div>';
            return;
        }

        const isTournament = !!selectedTournament;
        const { accuracy, winRate } = utils.calculateStats(stats, isTournament);
        elements.statsDisplay.innerHTML = '';

        // Add Matches & Eliminations card
        elements.statsDisplay.appendChild(
            components.createStatCard(
                '⌛ Matches & Eliminations',
                `Elims: ${utils.formatNumber(isTournament ? stats.eliminations : stats.humanElims)}`,
                `Matches: ${utils.formatNumber(stats.matchesPlayed)}`
            )
        );

        // Add Health & Shield card
        elements.statsDisplay.appendChild(
            components.createStatCard(
                '🎯 Health & Shield',
                `Health taken: ${utils.formatNumber(stats.healthTaken)}`,
                `Shield taken: ${utils.formatNumber(stats.shieldTaken)}`
            )
        );

        // Add Damage & Accuracy card
        elements.statsDisplay.appendChild(
            components.createStatCard(
                '💥 Damage & Accuracy',
                `Damage: ${utils.formatNumber(stats.damageToPlayers)}`,
                `Accuracy: ${accuracy.toFixed(1)}%`
            )
        );

        // Add Performance card
        elements.statsDisplay.appendChild(
            components.createStatCard(
                '🏆 Performance',
                `${!isTournament ? 'Global Stats:' : 'Tournament Stats'}<br>
                 ${!isTournament ? `Win Rate: ${winRate.toFixed(1)}%<br>` : ''}
                 ${!isTournament ? `Deaths: ${utils.formatNumber(stats.deaths)}` : ''}`
            )
        );
    },

    toggleTheme() {
        state.darkMode = !state.darkMode;
        document.body.classList.toggle('dark-theme');
        document.body.classList.toggle('light-theme');
        elements.themeToggle.innerHTML = state.darkMode ? '☀️ Light Mode' : '🌙 Dark Mode';
        elements.themeToggle.classList.toggle('btn-light');
        elements.themeToggle.classList.toggle('btn-dark');
    }
};

// Event Handlers
const handlers = {
    async refreshButtonClick() {
        try {
            elements.refreshButton.disabled = true;
            elements.refreshButton.innerHTML = '🔄 Refreshing...';
            
            const data = await api.refreshData();
            
            if (data.success) {
                elements.lastUpdateTime.textContent = new Date(data.timestamp).toLocaleString();
                if (data.newData) {
                    state.statsData = await api.fetchStats();
                    ui.updateTournamentOptions();
                }
            } else {
                components.showError('Refresh failed: ' + data.error);
            }
        } catch (error) {
            components.showError(error.message);
        } finally {
            elements.refreshButton.disabled = false;
            elements.refreshButton.innerHTML = '🔄 Refresh Data';
        }
    }
};

// Initialize
async function initialize() {
    try {
        // Set initial theme
        document.body.classList.add('light-theme');
        
        // Add event listeners
        elements.playerSelect.addEventListener('change', ui.updateTournamentOptions);
        elements.tournamentSelect.addEventListener('change', ui.updateWindowOptions);
        elements.windowSelect.addEventListener('change', ui.updateStatsDisplay);
        elements.refreshButton.addEventListener('click', handlers.refreshButtonClick);
        elements.themeToggle.addEventListener('click', ui.toggleTheme);
        
        // Fetch initial data
        state.statsData = await api.fetchStats();
        ui.updateTournamentOptions();
    } catch (error) {
        components.showError(error.message);
    }
}

// Start the application
initialize();