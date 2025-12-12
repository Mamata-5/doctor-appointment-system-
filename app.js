/* app.js - Doctor Booking System (frontend demo)
   - Single-page app
   - Persists to localStorage
   - Prevents double-booking of slots
*/
(function () {
  // ---------- Data layer ----------
  const STORAGE_KEY = 'doctor_booking_demo_v1';
  const defaultState = {
    doctors: [
      { id: 'D001', name: 'Dr. Asha Mehta', speciality: 'General Physician', room: '101' },
      { id: 'D002', name: 'Dr. Rajesh Singh', speciality: 'Cardiologist', room: '201' }
    ],
    // slots are available appointment slots for doctors
    // each slot: { id, doctorId, date (YYYY-MM-DD), time (HH:MM) }
    slots: [
      { id: 'S1', doctorId: 'D001', date: todayISO(0), time: '09:00' },
      { id: 'S2', doctorId: 'D001', date: todayISO(0), time: '09:30' },
      { id: 'S3', doctorId: 'D002', date: todayISO(0), time: '10:00' }
    ],
    // appointments link to a slot; if a slot has an appointment it's booked
    // appointment: { id, slotId, patientName, patientPhone, reason, status, createdAt }
    appointments: [
      // initially none or sample
    ],
    settings: { theme: 'dark' }
  };

  // date helper
  function todayISO(offsetDays = 0){
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().slice(0,10);
  }

  function loadState(){
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return deepCopy(defaultState);
      const parsed = JSON.parse(raw);
      return Object.assign(deepCopy(defaultState), parsed);
    } catch(e){
      console.error('loadState error', e);
      return deepCopy(defaultState);
    }
  }
  function saveState(){
    try{
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }catch(e){
      console.error('saveState error', e);
    }
  }
  function deepCopy(v){ return JSON.parse(JSON.stringify(v)); }

  const state = loadState();

  // ---------- Utilities ----------
  function byId(id){ return document.getElementById(id); }
  function el(tag, attrs = {}, ...children){
    const node = document.createElement(tag);
    for(const k in attrs){
      if(k === 'class') node.className = attrs[k];
      else if(k === 'html') node.innerHTML = attrs[k];
      else if(k.startsWith('on') && typeof attrs[k] === 'function') node.addEventListener(k.slice(2), attrs[k]);
      else node.setAttribute(k, attrs[k]);
    }
    children.flat().forEach(c=>{
      if(c === null || c === undefined) return;
      if(typeof c === 'string' || typeof c === 'number') node.appendChild(document.createTextNode(String(c)));
      else node.appendChild(c);
    });
    return node;
  }
  function uid(prefix='id'){ return prefix + Math.random().toString(36).slice(2,9); }

  // ---------- UI wiring ----------
  const content = byId('content');
  const sidebarItems = document.querySelectorAll('.sidebar li');
  const modal = byId('modal');
  const modalBody = byId('modalBody');
  const modalClose = byId('modalClose');
  const globalSearch = byId('globalSearch');
  const themeToggle = byId('themeToggle');

  sidebarItems.forEach(item => {
    item.addEventListener('click', ()=> {
      sidebarItems.forEach(i=>i.classList.remove('active'));
      item.classList.add('active');
      navigateTo(item.dataset.view);
    });
  });

  function openModal(node){
    modalBody.innerHTML = '';
    if(typeof node === 'string') modalBody.innerHTML = node;
    else modalBody.appendChild(node);
    modal.setAttribute('aria-hidden','false');
  }
  function closeModal(){ modal.setAttribute('aria-hidden','true'); modalBody.innerHTML = ''; }
  modalClose && modalClose.addEventListener('click', closeModal);
  modal.addEventListener('click', (e)=> { if(e.target === modal) closeModal(); });

  function applyTheme(){ 
    if(state.settings.theme === 'light'){
      document.documentElement.style.setProperty('--bg','#f7fbff');
      document.documentElement.style.setProperty('--card','#ffffff');
      document.documentElement.style.setProperty('--text','#04202b');
      document.documentElement.style.setProperty('--muted','#567077');
      document.documentElement.style.setProperty('--accent','#0ea5a4');
      themeToggle.textContent = '🌞';
    }else{
      document.documentElement.style.removeProperty('--bg');
      document.documentElement.style.removeProperty('--card');
      document.documentElement.style.removeProperty('--text');
      document.documentElement.style.removeProperty('--muted');
      themeToggle.textContent = '🌙';
    }
  }
  themeToggle && themeToggle.addEventListener('click', ()=>{
    state.settings.theme = state.settings.theme === 'light' ? 'dark' : 'light';
    applyTheme(); saveState();
  });

  globalSearch && globalSearch.addEventListener('input', (e)=> {
    const q = e.target.value.trim().toLowerCase();
    if(!q){ renderCurrentView(); return; }
    const doctors = state.doctors.filter(d => (d.id + d.name + d.speciality + d.room).toLowerCase().includes(q));
    const appointments = state.appointments.filter(a => (a.id + a.patientName + a.patientPhone + a.reason).toLowerCase().includes(q));
    const slots = state.slots.filter(s => (s.id + s.date + s.time).toLowerCase().includes(q));
    renderSearchResults({doctors, slots, appointments, query: q});
  });

  function renderSearchResults({doctors, slots, appointments, query}){
    content.innerHTML = '';
    const view = el('div',{class:'view'});
    view.appendChild(el('div',{class:'header-row'}, el('div',{class:'h-title'}, `Search results for "${query}"`)));
    const grid = el('div',{class:'grid cols-3'});
    grid.appendChild(renderDoctorsCard(doctors, true));
    grid.appendChild(renderSlotsCard(slots, true));
    grid.appendChild(renderAppointmentsCard(appointments, true));
    view.appendChild(grid);
    content.appendChild(view);
  }

  // ---------- Views ----------
  let currentView = 'dashboard';
  function navigateTo(view){ currentView = view; renderCurrentView(); }
  function renderCurrentView(){
    switch(currentView){
      case 'dashboard': renderDashboard(); break;
      case 'doctors': renderDoctors(); break;
      case 'slots': renderSlots(); break;
      case 'appointments': renderAppointments(); break;
      case 'settings': renderSettings(); break;
      default: renderDashboard();
    }
  }

  // small helpers
  function actionBar(text, onClick){ return el('div',{}, el('button',{class:'btn', onClick}, text)); }
  function statBlock(title, value){ return el('div',{}, el('div',{style:'font-size:20px; font-weight:700'}, String(value)), el('div',{class:'small'}, title)); }
  function isSlotBooked(slotId){ return state.appointments.some(a=>a.slotId === slotId); }
  function getAppointmentForSlot(slotId){ return state.appointments.find(a=>a.slotId === slotId); }

  // DASHBOARD
  function renderDashboard(){
    content.innerHTML = '';
    const view = el('div',{class:'view'});
    const statsCard = el('div',{class:'card header-row'});
    const stats = el('div',{style:'display:flex; gap:18px; align-items:center'});
    stats.appendChild(statBlock('Doctors', state.doctors.length));
    stats.appendChild(statBlock('Slots', state.slots.length));
    stats.appendChild(statBlock('Appointments', state.appointments.length));
    statsCard.appendChild(el('div',{class:'h-title'}, 'Overview'));
    statsCard.appendChild(stats);

    const todaySlots = state.slots.filter(s => s.date === todayISO(0)).sort((a,b)=> a.time.localeCompare(b.time));
    const slotsCard = el('div',{class:'card'});
    slotsCard.appendChild(el('div',{class:'header-row'}, el('div',{class:'h-title'}, 'Today\'s Slots'), el('div',{}, el('button',{class:'btn', onClick:()=> openCreateSlotModal()}, 'Create slot'))));
    slotsCard.appendChild(renderSlotTable(todaySlots));

    const grid = el('div',{class:'grid cols-2'});
    grid.appendChild(renderDoctorsCard(state.doctors));
    grid.appendChild(renderAppointmentsCard(state.appointments));

    view.appendChild(statsCard);
    view.appendChild(el('div',{style:'height:16px'}));
    view.appendChild(slotsCard);
    view.appendChild(el('div',{style:'height:16px'}));
    view.appendChild(grid);
    content.appendChild(view);
  }

  // DOCTORS
  function renderDoctors(){
    content.innerHTML = '';
    const view = el('div',{class:'view'});
    view.appendChild(el('div',{class:'header-row'}, el('div',{class:'h-title'}, 'Doctors'), el('div',{}, el('button',{class:'btn', onClick:()=> openCreateDoctorModal()}, 'Add doctor'))));
    view.appendChild(renderDoctorTable(state.doctors));
    content.appendChild(view);
  }

  function renderDoctorsCard(doctors, compact=false){
    const c = el('div',{class:'card'});
    c.appendChild(el('div',{class:'header-row'}, el('div',{class:'h-title'}, 'Doctors'), !compact && el('div',{}, el('button',{class:'btn', onClick:()=> openCreateDoctorModal()}, 'Add doctor'))));
    c.appendChild(compact ? renderDoctorListCompact(doctors) : renderDoctorTable(doctors));
    return c;
  }

  function renderDoctorListCompact(doctors){
    const wrap = el('div');
    doctors.forEach(d=>{
      wrap.appendChild(el('div',{style:'display:flex;justify-content:space-between;align-items:center;padding:8px 0'},
        el('div',{}, el('div',{style:'font-weight:700'}, `${d.name}`), el('div',{class:'small'}, `${d.speciality} • Room ${d.room}`)),
        el('div',{}, el('button',{class:'icon-btn', onClick:()=> openEditDoctorModal(d.id)}, '✏️'), el('button',{class:'icon-btn', onClick:()=> deleteDoctor(d.id)}, '🗑️'))
      ));
    });
    return wrap;
  }

  function renderDoctorTable(doctors){
    const wrap = el('div');
    const table = el('table',{class:'table'});
    table.appendChild(el('thead',{}, el('tr',{}, el('th',{},'ID'), el('th',{},'Name'), el('th',{},'Speciality'), el('th',{},'Room'), el('th',{},'Actions'))));
    const body = el('tbody');
    doctors.forEach(d=>{
      body.appendChild(el('tr',{},
        el('td',{}, d.id),
        el('td',{}, d.name),
        el('td',{}, d.speciality),
        el('td',{}, d.room),
        el('td',{}, el('button',{class:'btn secondary', onClick:()=> openEditDoctorModal(d.id)}, 'Edit'), ' ', el('button',{class:'btn', onClick:()=> openCreateSlotModal({ doctorId: d.id })}, 'New slot'))
      ));
    });
    table.appendChild(body);
    wrap.appendChild(table);
    return wrap;
  }

  // SLOTS
  function renderSlots(){
    content.innerHTML = '';
    const view = el('div',{class:'view'});
    view.appendChild(el('div',{class:'header-row'}, el('div',{class:'h-title'}, 'Slots'), el('div',{}, el('button',{class:'btn', onClick:()=> openCreateSlotModal()}, 'Create slot'))));
    view.appendChild(renderSlotTable(state.slots));
    content.appendChild(view);
  }

  function renderSlotsCard(slots, compact=false){
    const c = el('div',{class:'card'});
    c.appendChild(el('div',{class:'header-row'}, el('div',{class:'h-title'}, 'Slots'), !compact && el('div',{}, el('button',{class:'btn', onClick:()=> openCreateSlotModal()}, 'Create slot'))));
    c.appendChild(compact ? renderSlotListCompact(slots) : renderSlotTable(slots));
    return c;
  }

  function renderSlotListCompact(slots){
    const wrap = el('div');
    slots.forEach(s=>{
      const doc = state.doctors.find(d=>d.id===s.doctorId) || {};
      const booked = isSlotBooked(s.id);
      wrap.appendChild(el('div',{style:'display:flex;justify-content:space-between;align-items:center;padding:8px 0'},
        el('div',{}, el('div',{style:'font-weight:700'}, `${s.date} • ${s.time}`), el('div',{class:'small'}, `${doc.name || s.doctorId}`)),
        el('div',{}, booked ? el('span',{class:'badge red'}, 'Booked') : el('button',{class:'btn', onClick:()=> openBookingModalForSlot(s.id)}, 'Book'))
      ));
    });
    return wrap;
  }

  function renderSlotTable(slots){
    // sort by date & time for display
    const sorted = slots.slice().sort((a,b) => (a.date + a.time).localeCompare(b.date + b.time));
    const table = el('table',{class:'table'});
    table.appendChild(el('thead',{}, el('tr',{}, el('th',{},'Slot ID'), el('th',{},'Doctor'), el('th',{},'Date'), el('th',{},'Time'), el('th',{},'Status'), el('th',{},'Actions'))));
    const body = el('tbody');
    sorted.forEach(s=>{
      const doc = state.doctors.find(d=>d.id===s.doctorId) || {};
      const appointment = getAppointmentForSlot(s.id);
      const statusNode = appointment ? el('span',{class:'badge red'}, 'Booked') : el('span',{class:'badge green'}, 'Available');
      body.appendChild(el('tr',{},
        el('td',{}, s.id),
        el('td',{}, `${doc.name || s.doctorId} • ${doc.speciality || ''}`),
        el('td',{}, s.date),
        el('td',{}, s.time),
        el('td',{}, statusNode),
        el('td',{}, appointment ? el('button',{class:'btn secondary', onClick:()=> viewAppointment(appointment.id)}, 'View') : el('button',{class:'btn', onClick:()=> openBookingModalForSlot(s.id)}, 'Book'), ' ', el('button',{class:'btn secondary', onClick:()=> openEditSlotModal(s.id)}, 'Edit'))
      ));
    });
    table.appendChild(body);
    return table;
  }

  // APPOINTMENTS
  function renderAppointments(){
    content.innerHTML = '';
    const view = el('div',{class:'view'});
    view.appendChild(el('div',{class:'header-row'}, el('div',{class:'h-title'}, 'Appointments'), el('div',{}, el('button',{class:'btn', onClick:()=> openBookingModal()}, 'New appointment'))));
    view.appendChild(renderAppointmentTable(state.appointments));
    content.appendChild(view);
  }

  function renderAppointmentsCard(appointments, compact=false){
    const c = el('div',{class:'card'});
    c.appendChild(el('div',{class:'header-row'}, el('div',{class:'h-title'}, 'Appointments'), !compact && el('div',{}, el('button',{class:'btn', onClick:()=> openBookingModal()}, 'New appointment'))));
    c.appendChild(compact ? renderAppointmentListCompact(appointments) : renderAppointmentTable(appointments));
    return c;
  }

  function renderAppointmentListCompact(appointments){
    const wrap = el('div');
    appointments.forEach(a=>{
      const slot = state.slots.find(s=>s.id===a.slotId) || {};
      const doc = state.doctors.find(d=>d.id===slot.doctorId) || {};
      wrap.appendChild(el('div',{style:'display:flex;justify-content:space-between;align-items:center;padding:8px 0'},
        el('div',{}, el('div',{style:'font-weight:700'}, `${a.patientName}`), el('div',{class:'small'}, `${doc.name || ''} • ${slot.date} ${slot.time}`)),
        el('div',{}, el('button',{class:'icon-btn', onClick:()=> viewAppointment(a.id)}, '👁️'), el('button',{class:'icon-btn', onClick:()=> cancelAppointment(a.id)}, '❌'))
      ));
    });
    return wrap;
  }

  function renderAppointmentTable(appointments){
    const table = el('table',{class:'table'});
    table.appendChild(el('thead',{}, el('tr',{}, el('th',{},'ID'), el('th',{},'Patient'), el('th',{},'Doctor'), el('th',{},'Date'), el('th',{},'Time'), el('th',{},'Reason'), el('th',{},'Actions'))));
    const body = el('tbody');
    appointments.slice().forEach(a=>{
      const slot = state.slots.find(s=>s.id===a.slotId) || {};
      const doc = state.doctors.find(d=>d.id===slot.doctorId) || {};
      body.appendChild(el('tr',{},
        el('td',{}, a.id),
        el('td',{}, `${a.patientName} ${a.patientPhone ? '• ' + a.patientPhone : ''}`),
        el('td',{}, doc.name || slot.doctorId),
        el('td',{}, slot.date || ''),
        el('td',{}, slot.time || ''),
        el('td',{}, a.reason || ''),
        el('td',{}, el('button',{class:'btn secondary', onClick:()=> viewAppointment(a.id)}, 'View'), ' ', el('button',{class:'btn', onClick:()=> cancelAppointment(a.id)}, 'Cancel'))
      ));
    });
    table.appendChild(body);
    return table;
  }

  // SETTINGS
  function renderSettings(){
    content.innerHTML = '';
    const view = el('div',{class:'view'});
    const card = el('div',{class:'card'});
    card.appendChild(el('div',{class:'header-row'}, el('div',{class:'h-title'}, 'Settings')));
    const f = el('div');
    const themeLabel = el('label',{}, 'Theme:');
    const themeSelect = el('select', {id:'themeSelect'}, el('option',{value:'dark'}, 'Dark'), el('option',{value:'light'}, 'Light'));
    themeSelect.value = state.settings.theme || 'dark';
    themeSelect.addEventListener('change', (e)=> { state.settings.theme = e.target.value; applyTheme(); saveState(); });
    f.appendChild(themeLabel); f.appendChild(themeSelect);
    f.appendChild(el('div',{style:'height:12px'}));
    f.appendChild(el('button',{class:'btn', onClick:()=> { localStorage.removeItem(STORAGE_KEY); location.reload(); }}, 'Reset demo data'));
    card.appendChild(f);
    view.appendChild(card);
    content.appendChild(view);
  }

  // ---------- Actions: Doctors ----------
  function openCreateDoctorModal(){ openModal(renderDoctorForm()); }
  function openEditDoctorModal(doctorId){
    const d = state.doctors.find(x=>x.id===doctorId);
    if(!d) return alert('Doctor not found');
    openModal(renderDoctorForm(d));
  }

  function renderDoctorForm(doctor){
    const id = doctor ? doctor.id : '';
    const form = el('div',{},
      el('h3',{id:'modalTitle'}, doctor ? 'Edit Doctor' : 'Add Doctor'),
      el('div',{class:'form-row'},
        el('div',{class:'field'}, el('label',{}, 'Doctor ID'), el('input',{type:'text', id:'docId', value:id, disabled:!!doctor})),
        el('div',{class:'field'}, el('label',{}, 'Name'), el('input',{type:'text', id:'docName', value: doctor?doctor.name:''})),
        el('div',{class:'field'}, el('label',{}, 'Speciality'), el('input',{type:'text', id:'docSpec', value: doctor?doctor.speciality:''})),
        el('div',{class:'field'}, el('label',{}, 'Room'), el('input',{type:'text', id:'docRoom', value: doctor?doctor.room:''}))
      ),
      el('div',{style:'height:12px'}),
      el('div',{}, el('button',{class:'btn', onClick:()=> {
        const idv = byId('docId').value.trim();
        const name = byId('docName').value.trim();
        const spec = byId('docSpec').value.trim();
        const room = byId('docRoom').value.trim();
        if(!idv || !name) return alert('ID and name required');
        if(doctor){
          const existing = state.doctors.find(x=>x.id === idv);
          Object.assign(existing, { name, speciality: spec, room });
        } else {
          if(state.doctors.find(x=>x.id === idv)) return alert('Doctor ID already exists');
          state.doctors.push({ id: idv, name, speciality: spec, room });
        }
        saveState(); closeModal(); renderCurrentView();
      }}, 'Save'), ' ', el('button',{class:'btn secondary', onClick:closeModal}, 'Cancel'))
    );
    return form;
  }

  function deleteDoctor(doctorId){
    if(!confirm('Delete this doctor? This will also remove slots for this doctor and appointments attached to those slots.')) return;
    // remove slots and appointments associated
    const remainingSlots = state.slots.filter(s => s.doctorId !== doctorId);
    const remainingAppointments = state.appointments.filter(a => remainingSlots.find(s => s.id === a.slotId));
    state.slots = remainingSlots;
    state.appointments = remainingAppointments;
    state.doctors = state.doctors.filter(d => d.id !== doctorId);
    saveState(); renderCurrentView();
  }

  // ---------- Actions: Slots ----------
  function openCreateSlotModal(prefill = {}){ openModal(renderSlotForm(prefill)); }
  function openEditSlotModal(slotId){
    const s = state.slots.find(x=>x.id===slotId);
    if(!s) return alert('Slot not found');
    openModal(renderSlotForm(s));
  }

  function renderSlotForm(data = {}){
    const form = el('div',{},
      el('h3',{id:'modalTitle'}, data.id ? 'Edit Slot' : 'Create Slot'),
      el('div',{class:'form-row'},
        el('div',{class:'field'}, el('label',{}, 'Doctor'), renderDoctorSelect(data.doctorId)),
        el('div',{class:'field'}, el('label',{}, 'Date'), el('input',{type:'date', id:'slotDate', value: data.date || todayISO(0)})),
        el('div',{class:'field'}, el('label',{}, 'Time'), el('input',{type:'time', id:'slotTime', value: data.time || '09:00'}))
      ),
      el('div',{style:'height:12px'}),
      el('div',{}, el('button',{class:'btn', onClick:()=> {
        const doctorId = byId('slotDoctor').value;
        const date = byId('slotDate').value;
        const time = byId('slotTime').value;
        if(!doctorId || !date || !time) return alert('Doctor, date and time are required');
        if(data.id){
          const s = state.slots.find(x=>x.id===data.id);
          Object.assign(s, { doctorId, date, time });
        } else {
          const id = uid('SL');
          state.slots.push({ id, doctorId, date, time });
        }
        saveState(); closeModal(); renderCurrentView();
      }}, 'Save slot'), ' ', el('button',{class:'btn secondary', onClick:closeModal}, 'Cancel'))
    );
    return form;
  }

  function renderDoctorSelect(selectedId){
    const sel = el('select',{id:'slotDoctor'});
    state.doctors.forEach(d => {
      const opt = el('option',{value:d.id}, `${d.name} • ${d.speciality}`);
      if(d.id === selectedId) opt.selected = true;
      sel.appendChild(opt);
    });
    return sel;
  }

  // ---------- Actions: Appointments (booking) ----------
  function openBookingModal(){ openModal(renderBookingForm()); }
  function openBookingModalForSlot(slotId){ openModal(renderBookingForm({ slotId })); }

  function renderBookingForm(prefill = {}){
    // only show slots that are not booked
    const availableSlots = state.slots.filter(s => !isSlotBooked(s.id)).slice().sort((a,b)=> (a.date + a.time).localeCompare(b.date + b.time));
    if(prefill.slotId && !isSlotBooked(prefill.slotId)){
      // ensure selected slot is in list and appears first
      const idx = availableSlots.findIndex(s=>s.id===prefill.slotId);
      if(idx >= 0){
        const s = availableSlots.splice(idx,1)[0];
        availableSlots.unshift(s);
      } else {
        // if slot isn't available (booked) show an alert and fall back to normal list
        if(isSlotBooked(prefill.slotId)) { alert('Selected slot already booked. Choose another slot.'); }
      }
    }

    const sel = el('select',{id:'bookingSlot'});
    if(availableSlots.length === 0){
      sel.appendChild(el('option',{value:''}, 'No available slots — create new slots first'));
      sel.disabled = true;
    } else {
      availableSlots.forEach(s => {
        const d = state.doctors.find(dd=>dd.id===s.doctorId) || {};
        sel.appendChild(el('option',{value:s.id}, `${s.date} ${s.time} • ${d.name || s.doctorId} (${d.speciality||''})`));
      });
    }

    const form = el('div',{},
      el('h3',{id:'modalTitle'}, 'New Appointment'),
      el('div',{class:'form-row'},
        el('div',{class:'field'}, el('label',{}, 'Select slot'), sel),
        el('div',{class:'field'}, el('label',{}, 'Patient name'), el('input',{type:'text', id:'patientName', value: prefill.patientName || ''}))
      ),
      el('div',{class:'form-row'},
        el('div',{class:'field'}, el('label',{}, 'Phone'), el('input',{type:'text', id:'patientPhone', value: prefill.patientPhone || ''})),
        el('div',{class:'field'}, el('label',{}, 'Reason'), el('input',{type:'text', id:'reason', value: prefill.reason || ''}))
      ),
      el('div',{style:'height:12px'}),
      el('div',{}, el('button',{class:'btn', onClick:()=> {
        const slotId = byId('bookingSlot').value;
        const patientName = byId('patientName').value.trim();
        const patientPhone = byId('patientPhone').value.trim();
        const reason = byId('reason').value.trim();
        if(!slotId) return alert('Select a slot');
        if(!patientName) return alert('Enter patient name');
        if(isSlotBooked(slotId)) return alert('Sorry — that slot is already booked');
        const id = uid('AP');
        const appointment = { id, slotId, patientName, patientPhone, reason, status: 'Confirmed', createdAt: new Date().toISOString() };
        state.appointments.push(appointment);
        saveState(); closeModal(); renderCurrentView();
        alert('Appointment confirmed ✅');
      }}, 'Confirm Appointment'), ' ', el('button',{class:'btn secondary', onClick:closeModal}, 'Cancel'))
    );
    return form;
  }

  function viewAppointment(appointmentId){
    const ap = state.appointments.find(a=>a.id===appointmentId);
    if(!ap) return alert('Appointment not found');
    const slot = state.slots.find(s=>s.id===ap.slotId) || {};
    const doc = state.doctors.find(d=>d.id===slot.doctorId) || {};
    openModal(el('div',{}, el('h3',{id:'modalTitle'}, `Appointment ${ap.id}`),
      el('div',{class:'small'}, `Patient: ${ap.patientName}`),
      el('div',{class:'small'}, `Phone: ${ap.patientPhone || '—'}`),
      el('div',{class:'small'}, `Doctor: ${doc.name || slot.doctorId} (${doc.speciality || ''})`),
      el('div',{class:'small'}, `Slot: ${slot.date || ''} ${slot.time || ''}`),
      el('div',{class:'small'}, `Reason: ${ap.reason || '—'}`),
      el('div',{style:'height:12px'}),
      el('div',{}, el('button',{class:'btn', onClick:()=> { navigator.clipboard?.writeText(JSON.stringify(ap)); alert('Appointment copied to clipboard'); }}, 'Copy JSON'), ' ', el('button',{class:'btn secondary', onClick:closeModal}, 'Close'))
    ));
  }

  function cancelAppointment(appointmentId){
    if(!confirm('Cancel this appointment?')) return;
    state.appointments = state.appointments.filter(a=>a.id !== appointmentId);
    saveState(); renderCurrentView();
  }

  // ---------- Init ----------
  function init(){
    applyTheme();
    renderCurrentView();
  }
  init();

  // expose for debugging
  window.DBS = { state, saveState, loadState };

})();
