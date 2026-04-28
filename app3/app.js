// Configuración de colores
const COLORS = {
    bg: '#0f172a',
    grid: '#334155',
    text: '#94a3b8',
    textLight: '#f8fafc',
    accent: '#06b6d4',
    male: '#3b82f6',
    female: '#ec4899',
    positive: '#10b981',
    negative: '#ef4444'
};

// Variables globales
let map, geojsonLayer;
let barChart, lineChart, pyramidChart;
let currentYear = 2022;
let currentType = 'all';
let currentVar = 'population';
let selectedParish = null; // null = DMQ total
let currentMethodology = 'v1';
let DATA;

// ==========================================
// Helper Data Accessors
// ==========================================
function getParishPop(pid, year) {
    const p = DATA.parishes[pid];
    if (p.totals[year]) return p.totals[year].total;
    const base = p.totals['2022'].total;
    return Math.round(base * Math.pow(1 + (p.tcac / 100), year - 2022));
}

function getFilteredParishIDs() {
    return Object.keys(DATA.parishes).filter(pid => 
        currentType === 'all' || (DATA_V1.parishes[pid] && DATA_V1.parishes[pid].type === currentType)
    );
}

// ==========================================
// 1. INICIALIZACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    DATA = DATA_V1;
    initMap();
    initCharts();
    initEventListeners();
    updateDashboard();
});

// ==========================================
// 2. EVENT LISTENERS
// ==========================================
function initEventListeners() {
    document.getElementById('methodology-select').addEventListener('change', (e) => {
        currentMethodology = e.target.value;
        DATA = currentMethodology === 'v1' ? DATA_V1 : DATA_V2;
        updateDashboard();
    });

    document.getElementById('year-select').addEventListener('change', (e) => {
        currentYear = parseInt(e.target.value);
        updateDashboard();
    });

    document.getElementById('type-filter').addEventListener('change', (e) => {
        currentType = e.target.value;
        selectedParish = null; // Reset selection on type change
        updateDashboard();
    });

    document.getElementById('map-variable').addEventListener('change', (e) => {
        currentVar = e.target.value;
        updateMap();
    });

    document.getElementById('table-search').addEventListener('input', (e) => {
        renderTable(e.target.value);
    });

    // Sort table headers
    document.querySelectorAll('th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const sortKey = th.dataset.sort;
            // Simple sort logic (assuming current data state)
            sortDataAndRenderTable(sortKey);
        });
    });
}

// ==========================================
// 3. ACTUALIZACIÓN GENERAL
// ==========================================
function updateDashboard() {
    updateKPIs();
    updateMap();
    updateBarChart();
    updateLineChart();
    updatePyramidChart();
    renderTable();
}

// Filtrar datos según tipo
function getFilteredParishes() {
    return getFilteredParishIDs().map(pid => ({
        pid: pid,
        ...DATA.parishes[pid],
        type: DATA_V1.parishes[pid] ? DATA_V1.parishes[pid].type : 'Desconocido'
    }));
}

// ==========================================
// 4. KPIs
// ==========================================
function updateKPIs() {
    let p2010, p2022, pSel, tcac;

    if (selectedParish) {
        const p = DATA.parishes[selectedParish];
        p2010 = p.totals['2010'].total;
        p2022 = p.totals['2022'].total;
        pSel = getParishPop(selectedParish, currentYear);
        tcac = p.tcac;
    } else {
        // Calcular para DMQ total o tipo específico (Urbano/Rural)
        const pids = getFilteredParishIDs();
        p2010 = pids.reduce((sum, pid) => sum + DATA.parishes[pid].totals['2010'].total, 0);
        p2022 = pids.reduce((sum, pid) => sum + DATA.parishes[pid].totals['2022'].total, 0);
        pSel = pids.reduce((sum, pid) => sum + getParishPop(pid, currentYear), 0);
        tcac = ((Math.pow(p2022 / p2010, 1/12) - 1) * 100).toFixed(2);
    }

    const absGrowth = p2022 - p2010;
    const pctGrowth = (absGrowth / p2010 * 100).toFixed(1);

    document.getElementById('kpi-population').textContent = pSel.toLocaleString();
    document.getElementById('kpi-growth-abs').textContent = (absGrowth > 0 ? '+' : '') + absGrowth.toLocaleString();
    document.getElementById('kpi-growth-abs').className = `kpi-value ${absGrowth >= 0 ? 'pos-val' : 'neg-val'}`;
    
    document.getElementById('kpi-growth-pct').textContent = (pctGrowth > 0 ? '+' : '') + pctGrowth + '%';
    document.getElementById('kpi-growth-pct').className = `kpi-value ${pctGrowth >= 0 ? 'pos-val' : 'neg-val'}`;
    
    document.getElementById('kpi-tcac').textContent = (tcac > 0 ? '+' : '') + tcac + '%';
}

// ==========================================
// 5. MAPA (Leaflet)
// ==========================================
function initMap() {
    // Coordenadas centrales de Quito
    map = L.map('map').setView([-0.180653, -78.467834], 10);

    // CartoDB Dark Matter tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    // Usar la variable GEO_DATA inyectada desde geo_data.js
    window.geoData = GEO_DATA;
    updateMap();
}

function updateMap() {
    if (!window.geoData) return;

    if (geojsonLayer) {
        map.removeLayer(geojsonLayer);
    }

    // Definir escalas de color
    const getPopColor = (d) => {
        return d > 100000 ? '#08519c' :
               d > 50000  ? '#3182bd' :
               d > 25000  ? '#6baed6' :
               d > 10000  ? '#9ecae1' :
               d > 5000   ? '#c6dbef' :
                            '#eff3ff';
    };

    const getTcacColor = (d) => {
        return d > 4   ? '#006837' :
               d > 2   ? '#31a354' :
               d > 0   ? '#78c679' :
               d > -2  ? '#fec44f' :
                         '#d95f0e';
    };

    geojsonLayer = L.geoJson(window.geoData, {
        filter: function(feature) {
            if (currentType === 'all') return true;
            return feature.properties.type === currentType;
        },
        style: function(feature) {
            const code = feature.properties.code;
            const pData = DATA.parishes[code];
            if (!pData) return { color: '#333', weight: 1, fillOpacity: 0 }; // No data

            let fillColor;
            if (currentVar === 'population') {
                const pop = getParishPop(code, currentYear);
                fillColor = getPopColor(pop);
            } else {
                fillColor = getTcacColor(pData.tcac);
            }

            const isSelected = selectedParish === code;

            return {
                fillColor: fillColor,
                weight: isSelected ? 3 : 1,
                opacity: 1,
                color: isSelected ? '#06b6d4' : '#475569',
                fillOpacity: isSelected ? 0.9 : 0.7
            };
        },
        onEachFeature: function(feature, layer) {
            const code = feature.properties.code;
            const pData = DATA.parishes[code];
            
            if (pData) {
                const pop = getParishPop(code, currentYear);
                const tcac = pData.tcac;
                
                const tooltipContent = `
                    <div class="info-tooltip">
                        <h4>${pData.name}</h4>
                        <p><strong>Pob (${currentYear}):</strong> ${pop.toLocaleString()}</p>
                        <p><strong>TCAC:</strong> ${tcac > 0 ? '+' : ''}${tcac}%</p>
                    </div>
                `;
                layer.bindTooltip(tooltipContent, {className: 'leaflet-tooltip', sticky: true});
            }

            layer.on({
                mouseover: (e) => {
                    const layer = e.target;
                    if (feature.properties.code !== selectedParish) {
                        layer.setStyle({ weight: 2, color: '#94a3b8', fillOpacity: 0.9 });
                    }
                    if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
                        layer.bringToFront();
                    }
                },
                mouseout: (e) => {
                    geojsonLayer.resetStyle(e.target);
                },
                click: (e) => {
                    // Toggle selection
                    if (selectedParish === feature.properties.code) {
                        selectedParish = null;
                    } else {
                        selectedParish = feature.properties.code;
                    }
                    updateDashboard();
                }
            });
        }
    }).addTo(map);

    // Ajustar zoom si es la primera vez
    if (!window.mapFitDone) {
        map.fitBounds(geojsonLayer.getBounds());
        window.mapFitDone = true;
    }
}

// ==========================================
// 6. GRÁFICOS (Chart.js)
// ==========================================
Chart.defaults.color = COLORS.text;
Chart.defaults.font.family = 'Inter';
Chart.defaults.borderColor = COLORS.grid;

function initCharts() {
    // Top Parishes Bar Chart
    const ctxBar = document.getElementById('barChart').getContext('2d');
    barChart = new Chart(ctxBar, {
        type: 'bar',
        data: { labels: [], datasets: [] },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { grid: { color: COLORS.grid } }, y: { grid: { display: false } } }
        }
    });

    // Evolution Line Chart
    const ctxLine = document.getElementById('lineChart').getContext('2d');
    lineChart = new Chart(ctxLine, {
        type: 'line',
        data: { labels: [2010, 2022, 2025, 2030, 2035], datasets: [] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top' } },
            scales: { y: { beginAtZero: false, grid: { color: COLORS.grid } }, x: { grid: { color: COLORS.grid } } }
        }
    });

    // Pyramid Chart
    const ctxPyr = document.getElementById('pyramidChart').getContext('2d');
    pyramidChart = new Chart(ctxPyr, {
        type: 'bar',
        data: { labels: DATA_V1.ageGroups, datasets: [] },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { stacked: true, grid: { color: COLORS.grid }, ticks: { callback: v => Math.abs(v) } },
                y: { stacked: true, reverse: true, grid: { display: false } }
            },
            plugins: {
                tooltip: {
                    callbacks: { label: (ctx) => `${ctx.dataset.label}: ${Math.abs(ctx.raw).toLocaleString()}` }
                }
            }
        }
    });
}

function updateBarChart() {
    const parishes = getFilteredParishes();
    
    // Sort by current variable
    parishes.sort((a, b) => {
        if (currentVar === 'population') {
            return getParishPop(b.pid, currentYear) - getParishPop(a.pid, currentYear);
        } else {
            return b.tcac - a.tcac;
        }
    });

    const top10 = parishes.slice(0, 10);
    const labels = top10.map(p => p.name);
    
    let data, bgColors;
    if (currentVar === 'population') {
        data = top10.map(p => getParishPop(p.pid, currentYear));
        bgColors = top10.map(() => COLORS.accent);
    } else {
        data = top10.map(p => p.tcac);
        bgColors = top10.map(p => p.tcac >= 0 ? COLORS.positive : COLORS.negative);
    }

    barChart.data.labels = labels;
    barChart.data.datasets = [{
        label: currentVar === 'population' ? 'Población' : 'TCAC (%)',
        data: data,
        backgroundColor: bgColors,
        borderRadius: 4
    }];
    barChart.update();
}

function updateLineChart() {
    let data;
    let label;
    const years = [2010, 2022, 2025, 2030, 2035];

    if (selectedParish) {
        const p = DATA.parishes[selectedParish];
        data = years.map(y => getParishPop(selectedParish, y));
        label = p.name;
    } else {
        const pids = getFilteredParishIDs();
        data = years.map(y => pids.reduce((sum, pid) => sum + getParishPop(pid, y), 0));
        label = currentType === 'all' ? 'Total DMQ' : `Total ${currentType}`;
    }

    lineChart.data.datasets = [{
        label: label,
        data: data,
        borderColor: COLORS.accent,
        backgroundColor: COLORS.accent + '33',
        fill: true,
        tension: 0.3,
        pointBackgroundColor: COLORS.bg,
        pointBorderColor: COLORS.accent,
        pointBorderWidth: 2,
        pointRadius: 4
    }];
    lineChart.update();
}

function updatePyramidChart() {
    let males = [];
    let females = [];
    let title = 'Pirámide Poblacional - ';
    const ageGroups = DATA_V1.ageGroups;

    const getGroupData = (pid, age, sex) => {
        const p = DATA.parishes[pid];
        if (p.pyramid[currentYear]) {
            const row = p.pyramid[currentYear].find(d => d.age === age);
            return row ? row[sex] : 0;
        } else {
            const baseYear = "2022";
            const row = p.pyramid[baseYear].find(d => d.age === age);
            if (!row) return 0;
            return Math.round(row[sex] * Math.pow(1 + (p.tcac / 100), currentYear - 2022));
        }
    };

    if (selectedParish) {
        const p = DATA.parishes[selectedParish];
        males = ageGroups.map(ag => -getGroupData(selectedParish, ag, 'male'));
        females = ageGroups.map(ag => getGroupData(selectedParish, ag, 'female'));
        title += p.name;
    } else {
        // Aggregate
        const pids = getFilteredParishIDs();
        ageGroups.forEach(ag => {
            let m = 0, f = 0;
            pids.forEach(pid => {
                m += getGroupData(pid, ag, 'male');
                f += getGroupData(pid, ag, 'female');
            });
            males.push(-m);
            females.push(f);
        });
        title += currentType === 'all' ? 'Total DMQ' : `Total ${currentType}`;
    }

    document.getElementById('pyramid-title').textContent = title + ` (${currentYear})`;

    pyramidChart.data.datasets = [
        { label: 'Hombres', data: males, backgroundColor: COLORS.male, borderRadius: 2 },
        { label: 'Mujeres', data: females, backgroundColor: COLORS.female, borderRadius: 2 }
    ];
    pyramidChart.update();
}

// ==========================================
// 7. TABLA
// ==========================================
let currentSort = { key: 'p2022', asc: false };

function sortDataAndRenderTable(key) {
    if (currentSort.key === key) {
        currentSort.asc = !currentSort.asc;
    } else {
        currentSort.key = key;
        currentSort.asc = false; // default desc for numbers
    }
    renderTable();
}

function renderTable(searchTerm = '') {
    const tbody = document.getElementById('table-body');
    let parishes = getFilteredParishes();

    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        parishes = parishes.filter(p => p.name.toLowerCase().includes(term));
    }

    // Sort
    parishes.sort((a, b) => {
        let valA, valB;
        if (currentSort.key === 'name' || currentSort.key === 'type') {
            valA = a[currentSort.key];
            valB = b[currentSort.key];
            return currentSort.asc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        } else if (currentSort.key === 'tcac') {
            valA = a.tcac;
            valB = b.tcac;
        } else {
            // p2010, p2022, etc.
            const year = currentSort.key.substring(1);
            valA = getParishPop(a.pid, parseInt(year));
            valB = getParishPop(b.pid, parseInt(year));
        }
        return currentSort.asc ? valA - valB : valB - valA;
    });

    tbody.innerHTML = '';
    parishes.forEach(p => {
        const tr = document.createElement('tr');
        
        // Formatter helpers
        const num = (v) => v.toLocaleString();
        const pct = (v) => {
            const cls = v > 0 ? 'pos-val' : (v < 0 ? 'neg-val' : '');
            const sign = v > 0 ? '+' : '';
            return `<span class="${cls}">${sign}${v}%</span>`;
        };

        tr.innerHTML = `
            <td><strong>${p.name}</strong></td>
            <td>${p.type}</td>
            <td>${num(p.totals['2010'].total)}</td>
            <td>${num(p.totals['2022'].total)}</td>
            <td>${pct(p.tcac)}</td>
            <td>${num(getParishPop(p.pid, 2025))}</td>
            <td>${num(getParishPop(p.pid, 2030))}</td>
            <td>${num(getParishPop(p.pid, 2035))}</td>
        `;
        
        // Add click to select on map
        tr.style.cursor = 'pointer';
        tr.addEventListener('click', () => {
            // Find code by name
            const code = Object.keys(DATA.parishes).find(k => DATA.parishes[k].name === p.name);
            if (code) {
                selectedParish = parseInt(code);
                updateDashboard();
                // Scroll to top to see charts/map
                window.scrollTo({top: 0, behavior: 'smooth'});
            }
        });

        if (selectedParish && DATA.parishes[selectedParish].name === p.name) {
            tr.style.backgroundColor = COLORS.grid;
        }

        tbody.appendChild(tr);
    });
}
