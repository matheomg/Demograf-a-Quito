// Element References
const selYear = document.getElementById('year-select');
const selSex = document.getElementById('sex-filter');
const selParish = document.getElementById('parish-select');
const selTcac = document.getElementById('tcac-slider');
const txtTcac = document.getElementById('tcac-val');
const tcacGroup = document.getElementById('tcac-adjust-group');

const kpiPop = document.getElementById('kpi-population');
const kpiChange = document.getElementById('kpi-annual-change');
const kpiTcac = document.getElementById('kpi-tcac');
const kpiAging = document.getElementById('kpi-aging');
const btnExport = document.getElementById('btn-export');
const titlePyramid = document.getElementById('pyramid-title');

// Global State
let map;
let geoJsonLayer;
let lineChart;
let pyramidChart;
let barChart;
let currentData = {};
let currentSort = { key: 'p2022', asc: false };

// Initialization
function init() {
    populateParishSelect();
    initMap();
    initCharts();
    updateDashboard();

    // Event Listeners
    selYear.addEventListener('change', updateDashboard);
    selSex.addEventListener('change', updateDashboard);
    selParish.addEventListener('change', () => {
        if (selParish.value === 'all') {
            tcacGroup.style.display = 'none';
        } else {
            tcacGroup.style.display = 'flex';
            selTcac.value = DATA.parishes[selParish.value].tcac;
            txtTcac.textContent = selTcac.value;
        }
        updateDashboard();
    });
    selTcac.addEventListener('input', (e) => {
        txtTcac.textContent = parseFloat(e.target.value).toFixed(1);
        updateDashboard();
    });
    btnExport.addEventListener('click', exportToCSV);

    document.getElementById('table-search').addEventListener('input', () => renderTable());
    document.querySelectorAll('th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const key = th.dataset.sort;
            if (currentSort.key === key) {
                currentSort.asc = !currentSort.asc;
            } else {
                currentSort.key = key;
                currentSort.asc = false;
            }
            renderTable();
        });
    });
}

function populateParishSelect() {
    const sorted = Object.entries(DATA.parishes).sort((a, b) => a[1].name.localeCompare(b[1].name));
    for (const [id, info] of sorted) {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = info.name;
        selParish.appendChild(opt);
    }
}

function calculateProjection(basePop, tcac, years) {
    if (years <= 0) return basePop;
    return Math.round(basePop * Math.pow(1 + (tcac / 100), years));
}

function getParishData(id, year, sex, customTcac) {
    const p = DATA.parishes[id];
    let val = 0;
    
    // Original data for 2010 and 2022
    if (year == 2010 || year == 2022) {
        val = p.totals[year][sex];
    } else {
        // Projecting from 2022
        const base = p.totals["2022"][sex];
        const tcacToUse = customTcac !== null ? customTcac : p.tcac;
        val = calculateProjection(base, tcacToUse, year - 2022);
    }
    return val;
}

function updateDashboard() {
    const year = parseInt(selYear.value);
    const sex = selSex.value;
    const parishId = selParish.value;
    const isCustom = parishId !== 'all';
    const customTcac = isCustom ? parseFloat(selTcac.value) : null;

    // Update KPIs
    let totalPop = 0;
    let base2022 = 0;
    
    if (isCustom) {
        totalPop = getParishData(parishId, year, sex, customTcac);
        base2022 = DATA.parishes[parishId].totals["2022"][sex];
        kpiTcac.textContent = (customTcac).toFixed(2) + '%';
    } else {
        let tcacSum = 0;
        let c = 0;
        for (const pid in DATA.parishes) {
            totalPop += getParishData(pid, year, sex, null);
            base2022 += DATA.parishes[pid].totals["2022"][sex];
            tcacSum += DATA.parishes[pid].tcac;
            c++;
        }
        kpiTcac.textContent = (tcacSum / c).toFixed(2) + '% (Promedio)';
    }

    kpiPop.textContent = totalPop.toLocaleString('es-EC');
    
    if (year > 2022) {
        const annualChange = Math.round((totalPop - base2022) / (year - 2022));
        kpiChange.textContent = (annualChange > 0 ? '+' : '') + annualChange.toLocaleString('es-EC');
    } else if (year == 2022) {
        let b2010 = isCustom ? DATA.parishes[parishId].totals["2010"][sex] : Object.values(DATA.parishes).reduce((s, p) => s + p.totals["2010"][sex], 0);
        const annualChange = Math.round((totalPop - b2010) / 12);
        kpiChange.textContent = (annualChange > 0 ? '+' : '') + annualChange.toLocaleString('es-EC');
    } else {
        kpiChange.textContent = "N/A";
    }

    // Calculate Dependency Ratio (Evolución del Envejecimiento)
    // (Pop 0-14 + Pop 65+) / Pop 15-64 * 100
    let depTotal = 0;
    let actTotal = 0;
    const baseYear = year >= 2022 ? "2022" : "2010";
    
    // We determine the ratio based on the pyramid
    const calcDep = (pid, customTcac) => {
        let d = 0, a = 0;
        const pyr = DATA.parishes[pid].pyramid[baseYear];
        const tcac = customTcac !== null ? customTcac : DATA.parishes[pid].tcac;
        
        pyr.forEach(g => {
            let pBase = g.male + g.female;
            if (sex === 'male') pBase = g.male;
            if (sex === 'female') pBase = g.female;
            
            let pProj = calculateProjection(pBase, tcac, year - parseInt(baseYear));
            
            // 0-14 or 65+
            if (['0-4', '5-9', '10-14', '65-69', '70-74', '75+'].includes(g.age)) {
                d += pProj;
            } else {
                a += pProj;
            }
        });
        return {d, a};
    };

    if (isCustom) {
        let res = calcDep(parishId, customTcac);
        depTotal = res.d; actTotal = res.a;
    } else {
        for (const pid in DATA.parishes) {
            let res = calcDep(pid, null);
            depTotal += res.d; actTotal += res.a;
        }
    }
    
    if (actTotal > 0) {
        kpiAging.textContent = ((depTotal / actTotal) * 100).toFixed(1);
    } else {
        kpiAging.textContent = "-";
    }

    titlePyramid.textContent = `Pirámide Poblacional (${year})`;

    updateMap(year, sex, customTcac);
    updateBarChart(year, sex, customTcac);
    updateLineChart(parishId, sex, customTcac);
    updatePyramidChart(parishId, year, sex, customTcac);
    renderTable();
}

// Map Functions
function initMap() {
    map = L.map('map', {
        zoomControl: true,
        scrollWheelZoom: false
    }).setView([-0.1806, -78.4678], 9);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://carto.com/">CARTO</a>'
    }).addTo(map);

    geoJsonLayer = L.geoJSON(GEO_DATA, {
        style: styleFeature,
        onEachFeature: onEachFeature
    }).addTo(map);

    const legend = L.control({position: 'bottomright'});
    legend.onAdd = function (map) {
        const div = L.DomUtil.create('div', 'info legend');
        div.innerHTML = '<div id="legend-content"></div>';
        return div;
    };
    legend.addTo(map);
}

function getColor(d) {
    return d > 100000 ? '#08519c' :
           d > 50000  ? '#3182bd' :
           d > 25000  ? '#6baed6' :
           d > 10000  ? '#9ecae1' :
           d > 5000   ? '#c6dbef' :
                        '#eff3ff';
}

function updateMap(year, sex, customTcac) {
    const valuesObj = {};
    
    for (const pid in DATA.parishes) {
        // Map doesn't apply specific parish custom TCAC to ALL map, map shows context.
        // If a custom TCAC is set for a specific parish, we apply it only to that parish in the map.
        const cTcac = (selParish.value === pid && customTcac !== null) ? customTcac : null;
        const val = getParishData(pid, year, sex, cTcac);
        valuesObj[pid] = val;
    }

    geoJsonLayer.eachLayer(function(layer) {
        const pid = layer.feature.properties.code.toString();
        const val = valuesObj[pid] || 0;
        const isSelected = selParish.value === pid;
        layer.setStyle({
            fillColor: getColor(val),
            weight: isSelected ? 3 : 1,
            opacity: 1,
            color: isSelected ? '#06b6d4' : '#475569',
            fillOpacity: isSelected ? 0.9 : 0.7
        });
        
        let pname = DATA.parishes[pid] ? DATA.parishes[pid].name : "Desconocido";
        layer.bindTooltip(`<b>${pname}</b><br>Pob: ${val.toLocaleString('es-EC')}`, {direction:"center"});
    });

    // Update legend
    const legendContent = document.getElementById('legend-content');
    if (legendContent) {
        let labels = [];
        let breaks = [0, 5000, 10000, 25000, 50000, 100000];
        for (let i = 0; i < breaks.length; i++) {
            labels.unshift(
                '<i style="background:' + getColor(breaks[i] + 1) + '"></i> ' +
                Math.round(breaks[i]).toLocaleString('es-EC') + (breaks[i + 1] ? '&ndash;' + Math.round(breaks[i + 1]).toLocaleString('es-EC') : '+')
            );
        }
        legendContent.innerHTML = labels.join('<br>');
    }
}

function styleFeature(feature) {
    return {
        fillColor: '#eff3ff',
        weight: 1.5,
        opacity: 1,
        color: '#475569',
        fillOpacity: 0.7
    };
}

function onEachFeature(feature, layer) {
    layer.on({
        mouseover: (e) => {
            const layer = e.target;
            layer.setStyle({ weight: 2, color: '#f8fafc', fillOpacity: 0.9 });
            layer.bringToFront();
        },
        mouseout: (e) => {
            geoJsonLayer.resetStyle(e.target);
        },
        click: (e) => {
            const pid = feature.properties.code.toString();
            if(DATA.parishes[pid]) {
                selParish.value = pid;
                selParish.dispatchEvent(new Event('change'));
            }
        }
    });
}

// Charts Functions
function initCharts() {
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.font.family = 'Inter';

    const ctxBar = document.getElementById('barChart').getContext('2d');
    barChart = new Chart(ctxBar, {
        type: 'bar',
        data: { labels: [], datasets: [] },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { grid: { color: 'rgba(255,255,255,0.05)' } }, y: { grid: { display: false } } }
        }
    });

    const ctxLine = document.getElementById('lineChart').getContext('2d');
    lineChart = new Chart(ctxLine, {
        type: 'line',
        data: { labels: ['2010', '2022', '2025', '2030', '2035'], datasets: [] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } },
                x: { grid: { display: false } }
            }
        }
    });

    const ctxPyr = document.getElementById('pyramidChart').getContext('2d');
    pyramidChart = new Chart(ctxPyr, {
        type: 'bar',
        data: { labels: [], datasets: [] },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            stacked: true,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: (c) => `${c.dataset.label}: ${Math.abs(c.raw).toLocaleString('es-EC')}`
                    }
                }
            },
            scales: {
                x: {
                    stacked: true,
                    ticks: { callback: (v) => Math.abs(v).toLocaleString('es-EC') },
                    grid: { color: 'rgba(255,255,255,0.05)' }
                },
                y: { stacked: true, reverse: true, grid: { display: false } }
            }
        }
    });
}

function updateBarChart(year, sex, customTcac) {
    let list = [];
    for (const pid in DATA.parishes) {
        const cTcac = (selParish.value === pid && customTcac !== null) ? customTcac : null;
        list.push({
            name: DATA.parishes[pid].name,
            pop: getParishData(pid, year, sex, cTcac)
        });
    }
    list.sort((a, b) => b.pop - a.pop);
    const top10 = list.slice(0, 10);

    barChart.data.labels = top10.map(i => i.name);
    barChart.data.datasets = [{
        label: 'Población',
        data: top10.map(i => i.pop),
        backgroundColor: '#38bdf8',
        borderRadius: 4
    }];
    barChart.update();
}

function updateLineChart(parishId, sex, customTcac) {
    const years = [2010, 2022, 2025, 2030, 2035];
    const data = years.map(y => {
        if(parishId === 'all') {
            return Object.keys(DATA.parishes).reduce((s, pid) => s + getParishData(pid, y, sex, null), 0);
        } else {
            return getParishData(parishId, y, sex, customTcac);
        }
    });

    lineChart.data.datasets = [{
        label: 'Población',
        data: data,
        borderColor: '#38bdf8',
        backgroundColor: 'rgba(56, 189, 248, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4
    }];
    lineChart.update();
}

function updatePyramidChart(parishId, year, sex, customTcac) {
    // If year > 2022, we approximate the pyramid by applying the TCAC equally to all cohorts
    // This is a simplified projection for the visualization.
    const baseYear = year >= 2022 ? "2022" : "2010";
    let labels = [];
    let males = [];
    let females = [];

    if (parishId === 'all') {
        const aggs = {};
        for (const pid in DATA.parishes) {
            const pyr = DATA.parishes[pid].pyramid[baseYear];
            pyr.forEach(g => {
                if(!aggs[g.age]) aggs[g.age] = {m:0, f:0};
                aggs[g.age].m += g.male;
                aggs[g.age].f += g.female;
            });
        }
        labels = Object.keys(aggs);
        
        let avgTcac = 0, c = 0;
        for(let pid in DATA.parishes) { avgTcac += DATA.parishes[pid].tcac; c++; }
        avgTcac /= c;
        
        males = labels.map(a => -calculateProjection(aggs[a].m, avgTcac, year - parseInt(baseYear)));
        females = labels.map(a => calculateProjection(aggs[a].f, avgTcac, year - parseInt(baseYear)));
    } else {
        const p = DATA.parishes[parishId];
        const tcac = customTcac !== null ? customTcac : p.tcac;
        const pyr = p.pyramid[baseYear];
        labels = pyr.map(g => g.age);
        males = pyr.map(g => -calculateProjection(g.male, tcac, year - parseInt(baseYear)));
        females = pyr.map(g => calculateProjection(g.female, tcac, year - parseInt(baseYear)));
    }

    const datasets = [];
    if (sex === 'total' || sex === 'male') {
        datasets.push({
            label: 'Hombres',
            data: males,
            backgroundColor: '#60a5fa',
            borderRadius: 4
        });
    }
    if (sex === 'total' || sex === 'female') {
        datasets.push({
            label: 'Mujeres',
            data: females,
            backgroundColor: '#f472b6',
            borderRadius: 4
        });
    }

    pyramidChart.data.labels = labels;
    pyramidChart.data.datasets = datasets;
    pyramidChart.update();
}

function exportToCSV() {
    const years = [2010, 2022, 2025, 2030, 2035];
    let csv = "Parroquia,Sexo,TCAC," + years.map(y => `Pob_${y}`).join(",") + "\n";
    
    const sexFilter = selSex.value;
    const sexes = sexFilter === 'total' ? ['total', 'male', 'female'] : [sexFilter];

    for (const pid in DATA.parishes) {
        const p = DATA.parishes[pid];
        sexes.forEach(s => {
            const row = [
                `"${p.name}"`,
                s === 'total' ? 'Ambos' : s === 'male' ? 'Hombres' : 'Mujeres',
                p.tcac + "%"
            ];
            years.forEach(y => {
                row.push(getParishData(pid, y, s, p.tcac));
            });
            csv += row.join(",") + "\n";
        });
    }

    const blob = new Blob(["\ufeff", csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Proyecciones_DMQ_${sexFilter}.csv`;
    a.click();
}

function renderTable() {
    const tbody = document.getElementById('table-body');
    const term = document.getElementById('table-search').value.toLowerCase();
    const sex = selSex.value;

    let list = [];
    for (const pid in DATA.parishes) {
        const p = DATA.parishes[pid];
        if (!p.name.toLowerCase().includes(term)) continue;

        const isCustom = (selParish.value === pid);
        const tcacToUse = isCustom ? parseFloat(selTcac.value) : p.tcac;
        
        list.push({
            pid: pid,
            name: p.name,
            tcac: tcacToUse,
            p2010: getParishData(pid, 2010, sex, tcacToUse),
            p2022: getParishData(pid, 2022, sex, tcacToUse),
            p2025: getParishData(pid, 2025, sex, tcacToUse),
            p2030: getParishData(pid, 2030, sex, tcacToUse),
            p2035: getParishData(pid, 2035, sex, tcacToUse)
        });
    }

    list.sort((a, b) => {
        let vA = a[currentSort.key];
        let vB = b[currentSort.key];
        if (typeof vA === 'string') {
            return currentSort.asc ? vA.localeCompare(vB) : vB.localeCompare(vA);
        }
        return currentSort.asc ? vA - vB : vB - vA;
    });

    tbody.innerHTML = '';
    list.forEach(item => {
        const tr = document.createElement('tr');
        
        const formatPct = (v) => {
            const cls = v > 0 ? 'pos-val' : (v < 0 ? 'neg-val' : '');
            const sign = v > 0 ? '+' : '';
            return `<span class="${cls}">${sign}${v.toFixed(2)}%</span>`;
        };

        tr.innerHTML = `
            <td><strong>${item.name}</strong></td>
            <td>${item.p2010.toLocaleString('es-EC')}</td>
            <td>${item.p2022.toLocaleString('es-EC')}</td>
            <td>${formatPct(item.tcac)}</td>
            <td>${item.p2025.toLocaleString('es-EC')}</td>
            <td>${item.p2030.toLocaleString('es-EC')}</td>
            <td>${item.p2035.toLocaleString('es-EC')}</td>
        `;
        
        tr.style.cursor = 'pointer';
        tr.addEventListener('click', () => {
            selParish.value = item.pid;
            selParish.dispatchEvent(new Event('change'));
            window.scrollTo({top: 0, behavior: 'smooth'});
        });

        if (selParish.value === item.pid) {
            tr.style.background = 'rgba(255, 255, 255, 0.1)';
        }

        tbody.appendChild(tr);
    });
}

// Start
document.addEventListener('DOMContentLoaded', init);
