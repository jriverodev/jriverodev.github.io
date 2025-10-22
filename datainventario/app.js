let data = [];
let filteredData = [];
let isDarkMode = false;

// Elementos DOM
const tableBody = document.getElementById('tableBody');
const searchInput = document.getElementById('searchInput');
const filterSector = document.getElementById('filterSector');
const filterStatus = document.getElementById('filterStatus');
const themeBtn = document.getElementById('themeBtn');

// Eventos
document.getElementById('loadBtn').addEventListener('click', loadData);
document.getElementById('saveBtn').addEventListener('click', saveData);
document.getElementById('exportBtn').addEventListener('click', exportToCSV);
document.getElementById('addRowBtn').addEventListener('click', addRow);
searchInput.addEventListener('input', applyFilters);
filterSector.addEventListener('change', applyFilters);
filterStatus.addEventListener('change', applyFilters);
themeBtn.addEventListener('click', toggleTheme);

async function loadData() {
  try {
    const response = await fetch('inventario.json');
    data = await response.json();
    filteredData = [...data];
    populateFilters();
    renderTable();
    renderChart();
  } catch (error) {
    console.error('Error cargando datos:', error);
    const stored = localStorage.getItem('inventarioData');
    if (stored) {
      data = JSON.parse(stored);
      filteredData = [...data];
      populateFilters();
      renderTable();
      renderChart();
    } else {
      alert('No se pudieron cargar los datos. Verifica el archivo JSON.');
    }
  }
}

function populateFilters() {
  const sectors = [...new Set(data.map(item => item.sector))];
  filterSector.innerHTML = '<option value="">Filtrar por Sector</option>';
  sectors.forEach(sector => {
    const option = document.createElement('option');
    option.value = sector;
    option.textContent = sector;
    filterSector.appendChild(option);
  });
}

function applyFilters() {
  const searchTerm = searchInput.value.toLowerCase();
  const sectorFilter = filterSector.value;
  const statusFilter = filterStatus.value;

  filteredData = data.filter(item => {
    const matchesSearch = Object.values(item).some(val => 
      typeof val === 'string' && val.toLowerCase().includes(searchTerm)
    );
    const matchesSector = !sectorFilter || item.sector === sectorFilter;
    const matchesStatus = !statusFilter || item.statusGeneral === statusFilter;
    return matchesSearch && matchesSector && matchesStatus;
  });
  renderTable();
}

function renderTable() {
  tableBody.innerHTML = '';
  filteredData.forEach((item, index) => {
    const row = document.createElement('tr');
    row.classList.add(getStatusClass(item.statusGeneral));
    row.innerHTML = `
      <td contenteditable="true" data-field="responsable">${item.responsable}</td>
      <td contenteditable="true" data-field="cedula">${item.cedula}</td>
      <td contenteditable="true" data-field="cargo">${item.cargo}</td>
      <td contenteditable="true" data-field="sector">${item.sector}</td>
      <td contenteditable="true" data-field="statusGeneral">${item.statusGeneral}</td>
      <td contenteditable="true" data-field="laptop">${formatEquipo(item.equipo1?.laptop || {})}</td>
      <td contenteditable="true" data-field="escritorio">${formatEquipo(item.equipo2?.escritorio || {})}</td>
      <td contenteditable="true" data-field="obsGenerales">${item.obsGenerales}</td>
      <td><button class="btn btn-danger btn-sm" onclick="deleteRow(${index})">Eliminar</button></td>
    `;
    tableBody.appendChild(row);
  });
}

function getStatusClass(status) {
  if (status === 'OPERATIVO') return 'status-operativo';
  if (status === 'INOPERATIVO' || status === 'ROBADO') return 'status-inoperativo';
  return 'status-roba';
}

function formatEquipo(equipo) {
  return `${equipo.marca || 'N/A'}/${equipo.modelo || 'N/A'}/${equipo.serial || 'N/A'}/${equipo.etiqueta || 'N/A'}/${equipo.status || 'N/A'}/${equipo.obs || '-'}`;
}

function saveData() {
  const rows = tableBody.querySelectorAll('tr');
  rows.forEach((row, index) => {
    const originalIndex = data.findIndex(item => item.responsable === row.cells[0].textContent);
    if (originalIndex !== -1) {
      data[originalIndex] = {
        responsable: row.cells[0].textContent,
        cedula: row.cells[1].textContent,
        cargo: row.cells[2].textContent,
        sector: row.cells[3].textContent,
        statusGeneral: row.cells[4].textContent,
        equipo1: { laptop: parseEquipo(row.cells[5].textContent) },
        equipo2: { escritorio: parseEquipo(row.cells[6].textContent) },
        obsGenerales: row.cells[7].textContent
      };
    }
  });
  localStorage.setItem('inventarioData', JSON.stringify(data));
  alert('Cambios guardados localmente. Descarga el JSON para actualizar el repo.');
}

function parseEquipo(str) {
  const parts = str.split('/');
  return {
    marca: parts[0] || 'N/A',
    modelo: parts[1] || 'N/A',
    serial: parts[2] || 'N/A',
    etiqueta: parts[3] || 'N/A',
    status: parts[4] || 'N/A',
    obs: parts[5] || '-'
  };
}

function addRow() {
  data.push({
    responsable: 'Nuevo Responsable',
    cedula: 'SIN INFORMACION',
    cargo: 'SIN INFORMACION',
    sector: 'SIN INFORMACION',
    statusGeneral: 'OPERATIVO',
    equipo1: { laptop: {} },
    equipo2: { escritorio: {} },
    obsGenerales: '-'
  });
  filteredData = [...data];
  renderTable();
}

function deleteRow(index) {
  if (confirm('¿Eliminar esta fila?')) {
    data.splice(index, 1);
    filteredData = [...data];
    renderTable();
  }
}

function exportToCSV() {
  let csv = 'Responsable,Cédula,Cargo,Sector,Status General,Laptop,Escritorio,Obs Generales\n';
  data.forEach(item => {
    csv += `${item.responsable},${item.cedula},${item.cargo},${item.sector},${item.statusGeneral},${formatEquipo(item.equipo1?.laptop || {})},${formatEquipo(item.equipo2?.escritorio || {})},${item.obsGenerales}\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'inventario.csv';
  a.click();
}

function renderChart() {
  const ctx = document.getElementById('statsChart').getContext('2d');
  const statusCounts = data.reduce((acc, item) => {
    acc[item.statusGeneral] = (acc[item.statusGeneral] || 0) + 1;
    return acc;
  }, {});
  new Chart(ctx, {
    type: 'pie',
    data: {
      labels: Object.keys(statusCounts),
      datasets: [{
        data: Object.values(statusCounts),
        backgroundColor: ['#28a745', '#dc3545', '#ffc107', '#6c757d']
      }]
    }
  });
}

function toggleTheme() {
  isDarkMode = !isDarkMode;
  document.body.classList.toggle('dark-mode');
  themeBtn.textContent = isDarkMode ? 'Tema Claro' : 'Tema Oscuro';
}

window.onload = loadData;
