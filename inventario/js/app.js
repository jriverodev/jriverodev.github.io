/* app.js - frontend logic para CRUD con el WebApp de Apps Script */
(() => {
  const cfg = window.INVENTORY_CONFIG || {};
  const WEBAPP = cfg.WEBAPP_URL;
  const API_KEY = cfg.API_KEY || '';

  // DOM elements
  const tableHead = document.getElementById('tableHead');
  const tbody = document.getElementById('inventoryTableBody');
  const totalCount = document.getElementById('totalCount');
  const operativoCount = document.getElementById('operativoCount');
  const inoperativoCount = document.getElementById('inoperativoCount');
  const searchInput = document.getElementById('searchInput');
  const deptoFilter = document.getElementById('deptoFilter');
  const statusFilter = document.getElementById('statusFilter');
  const addNewBtn = document.getElementById('addNewBtn');
  const exportBtn = document.getElementById('exportBtn');
  const refreshBtn = document.getElementById('refreshBtn');

  // Modal
  const modal = document.getElementById('entryModal');
  const modalTitle = document.getElementById('modalTitle');
  const formFields = document.getElementById('formFields');
  const entryForm = document.getElementById('entryForm');

  let headers = [];
  let rows = [];

  // Fetch rows
  async function fetchRows() {
    try {
      const r = await fetch(WEBAPP);
      const j = await r.json();
      if (!j.success) throw new Error(j.error || 'Error al obtener datos');
      headers = j.headers || [];
      rows = j.rows || [];
      renderTable();
      populateFilters();
      renderStats();
    } catch (err) {
      console.error(err);
      alert('Error al cargar datos: ' + err.message);
    }
  }

  function renderTable() {
    // Head
    tableHead.innerHTML = '';
    const tr = document.createElement('tr');
    headers.forEach(h => {
      const th = document.createElement('th');
      th.textContent = h;
      tr.appendChild(th);
    });
    const thAcc = document.createElement('th'); thAcc.textContent = 'ACCIONES'; tr.appendChild(thAcc);
    tableHead.appendChild(tr);

    // Body
    tbody.innerHTML = '';
    const q = searchInput.value.trim().toLowerCase();
    const deptoVal = deptoFilter.value;
    const statusVal = statusFilter.value;
    rows
      .filter(r => {
        // filters
        if (deptoVal && String(r.SECTOR || '') !== deptoVal) return false;
        if (statusVal && String(r.STATUS || '') !== statusVal) return false;
        if (!q) return true;
        return headers.some(h => String(r[h] || '').toLowerCase().includes(q));
      })
      .forEach(row => {
        const tr = document.createElement('tr');
        headers.forEach(h => {
          const td = document.createElement('td');
          td.textContent = row[h] || '';
          tr.appendChild(td);
        });
        const tdAcc = document.createElement('td');
        const btnEdit = document.createElement('button');
        btnEdit.textContent = 'Editar';
        btnEdit.onclick = () => openEditModal(row);
        const btnDel = document.createElement('button');
        btnDel.textContent = 'Eliminar';
        btnDel.onclick = () => confirmDelete(row);
        tdAcc.appendChild(btnEdit);
        tdAcc.appendChild(btnDel);
        tr.appendChild(tdAcc);
        tbody.appendChild(tr);
      });
  }

  function populateFilters() {
    // depto and status sets
    const deptos = new Set();
    const statuses = new Set();
    rows.forEach(r => { if (r.SECTOR) deptos.add(r.SECTOR); if (r.STATUS) statuses.add(r.STATUS); });

    // depto
    deptoFilter.innerHTML = '<option value="">Todos los departamentos</option>';
    Array.from(deptos).sort().forEach(d => {
      const opt = document.createElement('option'); opt.value = d; opt.textContent = d; deptoFilter.appendChild(opt);
    });

    // status
    statusFilter.innerHTML = '<option value="">Todos los estados</option>';
    Array.from(statuses).sort().forEach(s => {
      const opt = document.createElement('option'); opt.value = s; opt.textContent = s; statusFilter.appendChild(opt);
    });
  }

  function renderStats() {
    const total = rows.length;
    const operativos = rows.filter(r => String(r.STATUS || '').toUpperCase() === 'OPERATIVO').length;
    const inoper = rows.filter(r => String(r.STATUS || '').toUpperCase() === 'INOPERATIVO').length;
    totalCount.textContent = total;
    operativoCount.textContent = operativos;
    inoperativoCount.textContent = inoper;
  }

  // Modal utilities
  function openAddModal() {
    modalTitle.textContent = 'Agregar Equipo';
    buildFormFields({});
    showModal();
  }

  function openEditModal(row) {
    modalTitle.textContent = 'Editar Equipo — ID ' + (row['N°'] || row[0] || '');
    buildFormFields(row);
    showModal();
  }

  function buildFormFields(values) {
    formFields.innerHTML = '';
    headers.forEach(h => {
      // Skip ID field from editing (but include hidden)
      const wrapper = document.createElement('div');
      wrapper.className = 'form-group';
      if (h === 'N°') {
        const label = document.createElement('label'); label.textContent = h;
        const input = document.createElement('input'); input.type = 'text'; input.name = h; input.value = values[h] || ''; input.readOnly = true;
        wrapper.appendChild(label); wrapper.appendChild(input);
        formFields.appendChild(wrapper);
        return;
      }
      const label = document.createElement('label'); label.textContent = h + (h === 'DESCRIPCION' || h === 'SECTOR' ? ' *' : '');
      const input = (h === 'OBSERVACIONES') ? document.createElement('textarea') : document.createElement('input');
      input.name = h; input.value = values[h] || '';
      wrapper.appendChild(label); wrapper.appendChild(input);
      formFields.appendChild(wrapper);
    });
  }

  function showModal() {
    modal.setAttribute('aria-hidden', 'false');
    modal.style.display = 'block';
  }
  function closeModal() {
    modal.setAttribute('aria-hidden', 'true');
    modal.style.display = 'none';
  }

  // CRUD calls via WebApp
  async function addItem(data) {
    return postAction('add', { newItem: data });
  }
  async function updateItem(itemId, updates) {
    return postAction('update', { itemId, updates });
  }
  async function deleteItem(itemId) {
    return postAction('delete', { itemId });
  }
  async function postAction(action, payload = {}) {
    try {
      const body = Object.assign({ apiKey: API_KEY, action }, payload);
      const r = await fetch(WEBAPP, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const j = await r.json();
      if (!j.success) throw new Error(j.error || 'Operación fallida');
      // Re-fetch data after any mutation
      await fetchRows();
      return j;
    } catch (err) {
      console.error(err);
      alert('Error en la operación: ' + err.message);
      throw err;
    }
  }

  // Confirm delete
  function confirmDelete(row) {
    const id = row['N°'];
    if (!id) return alert('No se pudo identificar el registro a eliminar.');
    if (!confirm(`Eliminar registro N° ${id}? Esta operación no se puede deshacer.`)) return;
    deleteItem(id);
  }

  // Form submit
  entryForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const formData = new FormData(entryForm);
    const obj = {};
    formData.forEach((v, k) => obj[k] = v);
    const itemId = obj['N°'] || '';
    // Remove empty id for add
    if (!itemId) {
      // Remove N° if present
      delete obj['N°'];
      await addItem(obj);
    } else {
      // Build updates: only include fields that are present (all included here)
      const updates = Object.assign({}, obj);
      await updateItem(itemId, updates);
    }
    closeModal();
  });

  // UI events
  addNewBtn.addEventListener('click', openAddModal);
  refreshBtn.addEventListener('click', fetchRows);
  searchInput.addEventListener('input', renderTable);
  deptoFilter.addEventListener('change', renderTable);
  statusFilter.addEventListener('change', renderTable);

  // modal buttons
  document.querySelectorAll('.btn-cancel').forEach(b => b.addEventListener('click', closeModal));
  document.querySelectorAll('.modal-close').forEach(b => b.addEventListener('click', closeModal));

  // export
  exportBtn.addEventListener('click', () => {
    // convert rows to 2D array
    if (!rows || rows.length === 0) return alert('No hay datos para exportar.');
    window.exportToExcel(rows, 'inventario.xlsx');
  });

  // init
  fetchRows();
})();
