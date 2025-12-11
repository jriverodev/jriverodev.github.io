(function(){
  // Modal reusable (overlay) - depends on that HTML with id "genericModal" exists in the page
  const modalEl = document.getElementById('genericModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');
  const modalClose = document.getElementById('modalClose');
  const modalCancel = document.getElementById('modalCancel');
  const modalConfirm = document.getElementById('modalConfirm');
  let modalResolve = null;

  function openModal({title='', bodyHtml='', confirmText='Guardar', cancelText='Cancelar'}){
    modalTitle.textContent = title;
    modalBody.innerHTML = bodyHtml;
    modalConfirm.textContent = confirmText;
    modalCancel.textContent = cancelText;
    modalEl.style.display = 'flex';
    modalEl.setAttribute('aria-hidden','false');
    setTimeout(()=>{ const f = modalBody.querySelector('input,select,textarea,button'); if (f) f.focus(); },50);
    return new Promise((res)=>{ modalResolve = res; });
  }
  function closeModal(result){
    modalEl.style.display = 'none';
    modalEl.setAttribute('aria-hidden','true');
    if (modalResolve) modalResolve(result);
    modalResolve = null;
  }
  modalClose.addEventListener('click', ()=>closeModal(null));
  modalCancel.addEventListener('click', ()=>closeModal(null));
  modalConfirm.addEventListener('click', ()=>closeModal({ok:true}));
  window.addEventListener('keydown', (e)=>{ if (e.key==='Escape' && modalEl.style.display!=='none') closeModal(null); });

  async function showConfirm(message){
    const body = `<p>${escapeHtml(message)}</p>`;
    const promise = openModal({title:'Confirmar', bodyHtml:body, confirmText:'Sí', cancelText:'No'});
    const r = await promise;
    return !!(r && r.ok);
  }

  async function showEditUserModal(user){
    const id = user ? user.id : '';
    const nombre = user ? user.nombre : '';
    const email = user ? user.email : '';
    const rol = user ? user.rol : '';
    const body = `
      <form id="modalUserForm">
        <input type="hidden" id="modalUserId" value="${id}">
        <div><label>Nombre</label><input id="modalUserName" value="${escapeHtml(nombre)}" required></div>
        <div><label>Email</label><input id="modalUserEmail" value="${escapeHtml(email)}" required></div>
        <div><label>Rol</label><input id="modalUserRole" value="${escapeHtml(rol)}"></div>
      </form>`;
    const res = await openModal({title: id ? 'Editar Usuario' : 'Nuevo Usuario', bodyHtml: body, confirmText: 'Guardar', cancelText: 'Cancelar'});
    if (res && res.ok){
      const nid = document.getElementById('modalUserId').value;
      const nNombre = document.getElementById('modalUserName').value.trim();
      const nEmail = document.getElementById('modalUserEmail').value.trim();
      const nRol = document.getElementById('modalUserRole').value.trim();
      if (!nNombre || !nEmail){ alert('Nombre y email obligatorios'); return; }
      if (nid){ await updateUserInSQLite(parseInt(nid,10), {nombre:nNombre,email:nEmail,rol:nRol}); }
      else { await addUserToSQLite({nombre:nNombre,email:nEmail,rol:nRol}); }
    }
  }

  async function showEditEquipoModal(e){
    const id = e ? e.id : '';
    const nombre = e ? e.nombre : '';
    const tipo = e ? e.tipo : '';
    const serial = e ? e.serial : '';
    const notas = e ? e.notas : '';
    const body = `
      <form id="modalEquipoForm">
        <input type="hidden" id="modalEquipoId" value="${id}">
        <div><label>Nombre</label><input id="modalEquipoNombre" value="${escapeHtml(nombre)}" required></div>
        <div><label>Tipo</label><input id="modalEquipoTipo" value="${escapeHtml(tipo)}"></div>
        <div><label>Serial</label><input id="modalEquipoSerial" value="${escapeHtml(serial)}"></div>
        <div><label>Notas</label><textarea id="modalEquipoNotas">${escapeHtml(notas)}</textarea></div>
      </form>`;
    const res = await openModal({title: id ? 'Editar Equipo' : 'Nuevo Equipo', bodyHtml: body, confirmText:'Guardar'});
    if (res && res.ok){
      const nid = document.getElementById('modalEquipoId').value;
      const nombreN = document.getElementById('modalEquipoNombre').value.trim();
      const tipoN = document.getElementById('modalEquipoTipo').value.trim();
      const serialN = document.getElementById('modalEquipoSerial').value.trim();
      const notasN = document.getElementById('modalEquipoNotas').value.trim();
      if (!nombreN) { alert('Nombre es obligatorio'); return; }
      if (nid) await updateEquipoInSQLite(parseInt(nid,10), {nombre:nombreN,tipo:tipoN,serial:serialN,notas:notasN});
      else await addEquipoToSQLite({nombre:nombreN,tipo:tipoN,serial:serialN,notas:notasN});
    }
  }

  async function showEditAsignModal(a){
    const id = a ? a.id : '';
    populateSelects();
    const equipos = getAllEquiposFromSQLite();
    const usuarios = getAllUsersFromSQLite();
    const body = `
      <form id="modalAsignForm">
        <input type="hidden" id="modalAsignId" value="${id}">
        <div><label>Equipo</label>
          <select id="modalAsignEquipo">${equipos.map(e=>`<option value="${e.id}" ${a && a.equipo_id==e.id? 'selected': ''}>${escapeHtml(e.nombre)}</option>`).join('')}</select>
        </div>
        <div><label>Usuario</label>
          <select id="modalAsignUsuario">${usuarios.map(u=>`<option value="${u.id}" ${a && a.usuario_id==u.id? 'selected': ''}>${escapeHtml(u.nombre)}</option>`).join('')}</select>
        </div>
        <div><label>Fecha</label><input type="date" id="modalAsignFecha" value="${a && a.fecha? a.fecha : ''}"></div>
        <div><label>Observaciones</label><input id="modalAsignObs" value="${escapeHtml(a && a.observaciones? a.observaciones : '')}"></div>
      </form>`;
    const res = await openModal({title: id ? 'Editar Asignación' : 'Nueva Asignación', bodyHtml: body, confirmText:'Guardar'});
    if (res && res.ok){
      const nid = document.getElementById('modalAsignId').value;
      const equipo_id = document.getElementById('modalAsignEquipo').value || null;
      const usuario_id = document.getElementById('modalAsignUsuario').value || null;
      const fecha = document.getElementById('modalAsignFecha').value || '';
      const observaciones = document.getElementById('modalAsignObs').value || '';
      if (!equipo_id || !usuario_id) { alert('Equipo y Usuario son obligatorios'); return; }
      if (nid) await updateAsignacionInSQLite(parseInt(nid,10), {equipo_id,usuario_id,fecha,observaciones});
      else await addAsignacionToSQLite({equipo_id,usuario_id,fecha,observaciones});
    }
  }

  // export helpers to global scope
  window.openModal = openModal;
  window.closeModal = closeModal;
  window.showConfirm = showConfirm;
  window.showEditUserModal = showEditUserModal;
  window.showEditEquipoModal = showEditEquipoModal;
  window.showEditAsignModal = showEditAsignModal;

  // legacy helpers
  window.editUser = function(id){ const users = getAllUsersFromSQLite(); const u = users.find(x=>x.id===id); if (!u) return alert('Usuario no encontrado'); showEditUserModal(u); };
  window.delUser = async function(id){ const ok = await showConfirm('¿Borrar usuario?'); if (!ok) return; deleteUserInSQLite(id); };
  window.editEquipo = function(id){ const equipos = getAllEquiposFromSQLite(); const e = equipos.find(x=>x.id===id); if (!e) return alert('Equipo no encontrado'); showEditEquipoModal(e); };
  window.delEquipo = async function(id){ const ok = await showConfirm('¿Borrar equipo?'); if (!ok) return; deleteEquipoInSQLite(id); };
  window.editAsign = function(id){ const asigns = getAllAsignacionesFromSQLite(); const a = asigns.find(x=>x.id===id); if (!a) return alert('Asignación no encontrada'); showEditAsignModal(a); };
  window.delAsign = async function(id){ const ok = await showConfirm('¿Borrar asignación?'); if (!ok) return; deleteAsignacionInSQLite(id); };
})();
