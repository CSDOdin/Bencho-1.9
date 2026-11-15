
const LEGAL_PAGES = ['privacidad','cookies','terminos','eliminar-datos'];
function fillLegalEditor() {
  LEGAL_PAGES.forEach(key => {
    const page = config?.legalPages?.[key] || {};
    const title = document.querySelector(`[data-legal-title="${key}"]`);
    const body = document.querySelector(`[data-legal-body="${key}"]`);
    if(title)title.value = page.title || '';
    if(body)body.value = page.body || '';
  });
}
function readLegalEditor() {
  config.legalPages ||= {};
  LEGAL_PAGES.forEach(key => {
    const title = document.querySelector(`[data-legal-title="${key}"]`);
    const body = document.querySelector(`[data-legal-body="${key}"]`);
    if(title && body)config.legalPages[key] = { title: title.value.trim(), body: body.value.trim() };
    if(!config.legalPages[key]?.title || !config.legalPages[key]?.body) throw new Error('Completa el título y el contenido de todas las páginas legales.');
  });
}
document.querySelector('[data-admin-pane="legal"]')?.addEventListener('click', async e => {
  const btn = e.target.closest('[data-legal-reset]');
  if (!btn) return;
  if (!confirm('¿Restaurar el texto de esta página? Guarda los cambios para aplicarlos.')) return;
  const key = btn.dataset.legalReset;
  const defaults = window.PXR_LEGAL_DEFAULTS || {};
  if (!defaults[key]) return;
  document.querySelector(`[data-legal-title="${key}"]`).value = defaults[key].title;
  document.querySelector(`[data-legal-body="${key}"]`).value = defaults[key].body;
  if (typeof markAdminDirty === 'function') markAdminDirty();
});
let config = null;
const $ = id => document.getElementById(id);


let activeAdminTab = 'restaurant';
let productSearchTerm = '';
let productCategoryFilter = '';

const DEFAULT_SCHEDULE = {
  openingTime: '00:00',
  closingTime: '00:00',
  secondOpeningTime: '18:00',
  secondClosingTime: '23:00',
  secondShiftEnabled: false
};

function normalizeTimeValue(value, fallback) {
  const text = String(value ?? '').trim();
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(text) ? text : fallback;
}

function minutesFromTime(value) {
  const normalized = normalizeTimeValue(value, '00:00');
  const [hour, minute] = normalized.split(':').map(Number);
  return hour * 60 + minute;
}

function formatTime12(value) {
  const normalized = normalizeTimeValue(value, '00:00');
  const [hour, minute] = normalized.split(':').map(Number);
  const suffix = hour >= 12 ? 'pm' : 'am';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2,'0')} ${suffix}`;
}

function buildHoursText(schedule) {
  const s = {...DEFAULT_SCHEDULE, ...(schedule || {})};
  const first = `${formatTime12(s.openingTime)} - ${formatTime12(s.closingTime)}`;
  if (s.secondShiftEnabled === false) return `Todos los días: ${first}`;
  const second = `${formatTime12(s.secondOpeningTime)} - ${formatTime12(s.secondClosingTime)}`;
  return `Todos los días: ${first} y ${second}`;
}

function normalizeSchedule(schedule) {
  const s = {...DEFAULT_SCHEDULE, ...(schedule || {})};
  return {
    openingTime: normalizeTimeValue(s.openingTime, DEFAULT_SCHEDULE.openingTime),
    closingTime: normalizeTimeValue(s.closingTime, DEFAULT_SCHEDULE.closingTime),
    secondOpeningTime: normalizeTimeValue(s.secondOpeningTime, DEFAULT_SCHEDULE.secondOpeningTime),
    secondClosingTime: normalizeTimeValue(s.secondClosingTime, DEFAULT_SCHEDULE.secondClosingTime),
    secondShiftEnabled: s.secondShiftEnabled !== false
  };
}

function syncSchedulePreview() {
  const schedule = readScheduleFromInputs();
  const text = buildHoursText(schedule);
  if ($('hoursText')) $('hoursText').value = text;
  if ($('schedulePreview')) $('schedulePreview').textContent = `Horario: ${text}`;
}

function readScheduleFromInputs() {
  return normalizeSchedule({
    openingTime: $('openingTime')?.value,
    closingTime: $('closingTime')?.value,
    secondOpeningTime: $('secondOpeningTime')?.value,
    secondClosingTime: $('secondClosingTime')?.value,
    secondShiftEnabled: $('secondShiftEnabled')?.checked
  });
}

function fillSchedule() {
  const schedule = normalizeSchedule(config.schedule);
  if ($('openingTime')) $('openingTime').value = schedule.openingTime;
  if ($('closingTime')) $('closingTime').value = schedule.closingTime;
  if ($('secondOpeningTime')) $('secondOpeningTime').value = schedule.secondOpeningTime;
  if ($('secondClosingTime')) $('secondClosingTime').value = schedule.secondClosingTime;
  if ($('secondShiftEnabled')) $('secondShiftEnabled').checked = schedule.secondShiftEnabled;
  if ($('hoursText')) $('hoursText').value = config.hoursText || buildHoursText(schedule);
  syncSchedulePreview();
}
const ADMIN_TAB_META={restaurant:['Restaurante','Información, identidad visual básica y datos de contacto.'],design:['Diseño y horario','Colores, horario de atención y reseñas.'],delivery:['Delivery','Tarifa de respaldo y zonas configurables.'],payments:['Pagos y tasas','Divisores independientes y métodos de pago configurables.'],menu:['Menú','Busca y edita productos sin recorrer todo el catálogo.'],legal:['Textos legales','Privacidad, cookies, condiciones y datos.']};
function setupAdminTabs(){const nav=document.querySelector('.admin-nav');if(!nav||nav.dataset.bound==='1')return;nav.dataset.bound='1';nav.addEventListener('click',e=>{const b=e.target.closest('[data-admin-tab]');if(!b)return;setAdminTab(b.dataset.adminTab,true)});const initial=localStorage.getItem('bencho19-admin-tab');setAdminTab(ADMIN_TAB_META[initial]?initial:'restaurant',false)}
function setAdminTab(tab,persist=true){if(!ADMIN_TAB_META[tab])tab='restaurant';activeAdminTab=tab;if(persist)localStorage.setItem('bencho19-admin-tab',tab);document.querySelectorAll('[data-admin-tab]').forEach(btn=>{const active=btn.dataset.adminTab===tab;btn.classList.toggle('active',active);btn.setAttribute('aria-selected',active?'true':'false')});document.querySelectorAll('[data-admin-pane]').forEach(p=>p.classList.toggle('active',p.dataset.adminPane===tab));const meta=ADMIN_TAB_META[tab];if($('adminCurrentTitle'))$('adminCurrentTitle').textContent=meta[0];if($('adminCurrentSubtitle'))$('adminCurrentSubtitle').textContent=meta[1];if(tab==='menu'){renderMenuCategoryFilters();applyProductFilter()}}
function renderMenuCategoryFilters(){const box=$('menuCategoryFilters');if(!box)return;const cats=(config?.menuData||[]).map(c=>String(c?.category||'').trim()).filter(Boolean);box.innerHTML=[`<button type="button" class="menu-filter-chip ${productCategoryFilter===''?'active':''}" data-menu-filter="">Todas</button>`,...cats.map(c=>`<button type="button" class="menu-filter-chip ${productCategoryFilter===c?'active':''}" data-menu-filter="${esc(c)}">${esc(c)}</button>`)].join('')}
function updateProductSearchUi(){const input=$('productSearch'),clear=$('clearProductSearch');if(input&&input.value!==productSearchTerm)input.value=productSearchTerm;if(clear)clear.hidden=!productSearchTerm}
function applyProductFilter(){const term=String(productSearchTerm||'').trim().toLowerCase();const categoryFilter=String(productCategoryFilter||'').trim().toLowerCase();let visibleCount=0,categoryCount=0;document.querySelectorAll('.admin-category-editor').forEach(category=>{const categoryName=String(category.dataset.categoryName||'').toLowerCase();const categoryMatches=!categoryFilter||categoryName===categoryFilter;let visibleInCategory=0;category.querySelectorAll('.admin-product-row').forEach(row=>{const haystack=String(row.dataset.searchText||'').toLowerCase();const visible=categoryMatches&&(!term||haystack.includes(term));row.classList.toggle('admin-hidden',!visible);if(visible){visibleCount++;visibleInCategory++}});const showCategoryByName=!!term&&categoryName.includes(term);const categoryVisible=categoryMatches&&(visibleInCategory>0||showCategoryByName);category.classList.toggle('admin-hidden',!categoryVisible);if(categoryVisible)categoryCount++;if(showCategoryByName&&visibleInCategory===0){const rows=category.querySelectorAll('.admin-product-row');rows.forEach(r=>r.classList.remove('admin-hidden'));visibleCount+=rows.length}});updateProductSearchUi();const count=$('productSearchCount');if(count)count.textContent=`${visibleCount.toLocaleString('es-CO')} ${visibleCount===1?'producto encontrado':'productos encontrados'}`;const menu=$('menu');let empty=$('adminSearchEmpty');if(!empty&&menu){empty=document.createElement('div');empty.id='adminSearchEmpty';empty.className='admin-search-empty';empty.textContent='No encontramos productos con esa búsqueda.';menu.appendChild(empty)}if(empty)empty.style.display=visibleCount||!term&&!categoryFilter||categoryCount?'none':'block'}
function setupProductSearch(){const input=$('productSearch'),clear=$('clearProductSearch'),filters=$('menuCategoryFilters');if(input&&input.dataset.bound!=='1'){input.dataset.bound='1';input.addEventListener('input',()=>{productSearchTerm=input.value;applyProductFilter()})}if(clear&&clear.dataset.bound!=='1'){clear.dataset.bound='1';clear.addEventListener('click',()=>{productSearchTerm='';if(input)input.value='';applyProductFilter();input?.focus()})}if(filters&&filters.dataset.bound!=='1'){filters.dataset.bound='1';filters.addEventListener('click',e=>{const b=e.target.closest('[data-menu-filter]');if(!b)return;productCategoryFilter=b.dataset.menuFilter||'';renderMenuCategoryFilters();applyProductFilter()})}}

let csrfToken = "";
async function api(path, options = {}) {
  const response = await fetch('/api' + path, {
    credentials: 'include',
    ...options,
    headers: {
      ...(!(options.body instanceof FormData) ? { 'content-type': 'application/json' } : {}),
      ...(csrfToken ? {'x-csrf-token':csrfToken} : {}),
      ...(options.method && options.method !== 'GET' && path.startsWith('/admin/') && config?._revision ? {'x-config-revision':config._revision} : {}),
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  csrfToken = response.headers.get('x-csrf-token') || data.csrfToken || csrfToken;
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

function esc(value) { return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
function showStatus(message, cls = 'muted') { $('status').innerHTML = `<p class="${cls}">${esc(message)}</p>`; }

async function load() {
  try {
    config = await api('/admin/config');
    fill();
    document.body.classList.add('admin-authenticated');
    $('login').style.display = 'none';
    $('panel').style.display = 'block';
    $('logout').style.display = 'inline-block';
    showStatus('Configuración cargada.', 'ok');

  } catch (error) {
    document.body.classList.remove('admin-authenticated');
    $('login').style.display = 'block';
    $('panel').style.display = 'none';
    $('logout').style.display = 'none';
  }
}

function renderPaymentMethodsAdmin() {
  const container = $('paymentMethodsAdmin');
  if (!container) return;
  const methods = BenchoMoney.paymentMethods(config);
  container.innerHTML = methods.map((method, index) => `
    <div class="payment-method-row">
      <span class="payment-method-number">${String(index + 1).padStart(2, '0')}</span>
      <div><label for="method-name-${index}">Nombre del método</label><input id="method-name-${index}" data-method-name="${index}" value="${esc(method.name)}" maxlength="60" autocomplete="off"/></div>
      <button type="button" class="danger" data-remove-method="${index}" ${methods.length <= 1 ? 'disabled title="Debe quedar un método"' : ''}>Quitar</button>
    </div>`).join('');
}
function readDivisorInput(id, label) {
  const raw = $(id)?.value.trim();
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0.000001 || value > 1e9) throw new Error(`El divisor de ${label} debe ser positivo y estar dentro del rango.`);
  return value;
}
function updateRatesPreview() {
  const el = $('ratesPreview');
  if (!el) return;
  const usd = BenchoMoney.divider($('usdDivisor')?.value);
  const bs = BenchoMoney.divider($('bsDivisor')?.value);
  el.textContent = `Ejemplo para 40.000 COP: ${BenchoMoney.estimatesText(40000, { exchangeDivisors: { usd, bs } }) || 'sin equivalencias configuradas'}.`;
}
function collectPaymentMethods() {
  const methods = BenchoMoney.paymentMethods(config).map((method, index) => ({
    id: method.id,
    name: document.querySelector(`[data-method-name="${index}"]`)?.value.trim() || ''
  }));
  if (methods.some(m => !m.name || m.name.length > 60)) throw new Error('Cada método debe tener un nombre de 1 a 60 caracteres.');
  if (new Set(methods.map(m=>m.name.toLocaleLowerCase('es'))).size !== methods.length) throw new Error('No puede haber métodos de pago repetidos.');
  config.paymentMethods = methods;
}

function fill() {
  const r = config.restaurant || {}, t = config.theme || {}, gr = config.googleReviews || {};
  $('name').value = r.name || '';
  $('subtitle').value = r.subtitle || '';
  if ($('slogan')) $('slogan').value = r.slogan || '';
  $('fullName').value = r.fullName || '';
  $('description').value = r.description || '';
  $('whatsapp').value = r.whatsapp || '';
  $('instagram').value = r.instagram || '';
  $('tiktok').value = r.tiktok || '';
  $('location').value = r.location || '';
  $('logo').value = r.logo || '';
  $('watermark').value = r.watermark || '';
  if ($('cover')) $('cover').value = r.cover || '';
  $('delivery').value = config.deliveryCost ?? 0;
  const divisors = config.exchangeDivisors || BenchoMoney.legacyDivisors(config.payments);
  if ($('usdDivisor')) $('usdDivisor').value = BenchoMoney.divider(divisors.usd) ?? '';
  if ($('bsDivisor')) $('bsDivisor').value = BenchoMoney.divider(divisors.bs) ?? '';
  config.paymentMethods = BenchoMoney.paymentMethods(config);
  fillLegalEditor();
  renderPaymentMethodsAdmin();
  updateRatesPreview();
  renderDeliveryZones();
  $('primary').value = t.primary || '#25d366';
  $('primaryHover').value = t.primaryHover || '#1ebd56';
  $('accent').value = t.accent || '#ffb703';
  $('accentHover').value = t.accentHover || '#e5a400';
  $('hoursText').value = config.hoursText || '';
  fillSchedule();
  $('forceClose').checked = !!config.storeStatus?.forceClose;
  if ($('rating')) $('rating').value = gr.rating ?? 4.2;
  if ($('reviewCount')) $('reviewCount').value = gr.totalReviews ?? 0;
  if ($('reviewUrl')) $('reviewUrl').value = gr.url || '';
  renderMenu();
  setupAdminTabs();
  setupProductSearch();
  renderMenuCategoryFilters();
  applyProductFilter();
}

function previewHtml(item) {
  if (!item.image) return '<div class="image-empty">Sin imagen</div>';
  return `<img class="image-preview" src="${esc(item.image)}" alt="${esc(item.name || 'Producto')}">`;
}

function renderDeliveryZones() {
  const container = $('deliveryZones');
  if (!container) return;
  if (!Array.isArray(config.deliveryZones)) config.deliveryZones = [];
  if (!config.deliveryZones.length) {
    container.innerHTML = '<div class="muted" style="padding:8px 0">No hay zonas configuradas. Se usará el costo de delivery de respaldo.</div>';
    return;
  }
  container.innerHTML = config.deliveryZones.map((zone, i) => `
    <div class="item" style="padding:10px;margin-top:8px">
      <div class="mini-grid">
        <div><label>Nombre de zona</label><input data-zone-name="${i}" value="${esc(zone.name || '')}" placeholder="Ej. Centro"></div>
        <div><label>Precio (COP)</label><input type="number" min="0" data-zone-price="${i}" value="${Number(zone.price)||0}"></div>
      </div>
      <button type="button" class="danger" data-del-zone="${i}" style="margin-top:8px">Eliminar zona</button>
    </div>`).join('');
}

function renderProteinEditor(item, ci, ii) {
  const proteins = Array.isArray(item.proteinSelector)
    ? item.proteinSelector.map(value => String(value || '').trim()).filter(Boolean)
    : [];
  const enabled = proteins.length > 0;

  const rows = proteins.map((protein, pi) => `
    <div class="protein-option-row">
      <input type="text" maxlength="60" class="protein-option" data-protein-option data-ci="${ci}" data-ii="${ii}" value="${esc(protein)}" placeholder="Ej. Pollo Asado">
      <button type="button" class="danger" data-remove-protein="${ci}:${ii}:${pi}">Eliminar</button>
    </div>
  `).join('');

  return `
    <div class="protein-editor" data-protein-editor="${ci}:${ii}">
      <div class="protein-editor-head">
        <label style="margin:0">Seleccionador de proteínas</label>
        <button type="button" class="secondary" data-add-protein="${ci}:${ii}">${enabled ? '+ Agregar proteína' : '+ Activar seleccionador'}</button>
      </div>
      <small>El cliente verá un menú para elegir una proteína antes de agregar el producto.</small>
      <div class="protein-options-list" data-protein-options="${ci}:${ii}">
        ${rows || '<div class="muted protein-empty">El producto no tiene seleccionador de proteínas.</div>'}
      </div>
    </div>
  `;
}

function renderMenu() {
  $('menu').innerHTML='';
  (config.menuData||[]).forEach((cat,ci)=>{
    const categoryName=String(cat.category||'Categoría');
    const box=document.createElement('div');box.className='item menu-category-editor admin-category-editor';box.dataset.categoryName=categoryName;
    box.innerHTML=`<div class="toolbar"><h4 style="margin:0">Categoría</h4><button class="danger" data-del-cat="${ci}">Eliminar categoría</button></div><input data-cat="${ci}" maxlength="80" value="${esc(cat.category||'')}" style="margin-top:8px"><label style="display:block;margin-top:8px"><input type="checkbox" data-cat-hidden="${ci}" ${cat.isHidden?'checked':''}> Ocultar categoría en el menú público</label>`;
    const list=document.createElement('div');
    (cat.items||[]).forEach((item,ii)=>{
      const row=document.createElement('div');row.className='item admin-product-row';row.dataset.searchText=`${item.name||''} ${item.id||''} ${categoryName}`;
      row.innerHTML=`<div class="toolbar"><strong>Producto</strong><button class="danger" data-del-item="${ci}:${ii}">Eliminar</button></div><div class="mini-grid"><div><label>Nombre</label><input maxlength="120" data-field="name" data-ci="${ci}" data-ii="${ii}" value="${esc(item.name)}"><label>Precio</label><input type="number" min="0" step="0.01" data-field="price" data-ci="${ci}" data-ii="${ii}" value="${Number(item.price)||0}"><label>Descripción</label><textarea maxlength="1000" data-field="description" data-ci="${ci}" data-ii="${ii}" rows="3">${esc(item.description||'')}</textarea><label>Imagen del producto</label><div class="image-tools"><div id="preview-${ci}-${ii}">${previewHtml(item)}</div><div><div class="upload-row"><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" data-file-ci="${ci}" data-file-ii="${ii}"><button type="button" class="secondary" data-upload-image="${ci}:${ii}">Subir imagen</button><button type="button" class="danger" data-delete-image="${ci}:${ii}" ${item.image?'':'disabled'}>Eliminar imagen</button></div><input data-field="image" data-ci="${ci}" data-ii="${ii}" value="${esc(item.image||'')}" style="margin-top:8px" placeholder="URL o ruta opcional"><small>Puedes pegar una URL/ruta o subir una imagen. Límite: 5 MB.</small></div></div></div><div>${renderProteinEditor(item,ci,ii)}<label>Día de promoción (0 = ninguno)</label><input type="number" min="0" max="6" data-field="promoDay" data-ci="${ci}" data-ii="${ii}" value="${Number(item.promoDay)||0}"><label><input type="checkbox" data-field="outOfStock" data-ci="${ci}" data-ii="${ii}" ${item.outOfStock?'checked':''}> Agotado</label><label><input type="checkbox" data-field="isFeatured" data-ci="${ci}" data-ii="${ii}" ${item.isFeatured?'checked':''}> Destacado</label><label><input type="checkbox" data-field="allowAddons" data-ci="${ci}" data-ii="${ii}" ${item.allowAddons?'checked':''}> Permitir adicionales</label><label><input type="checkbox" data-field="isAutoApplied" data-ci="${ci}" data-ii="${ii}" ${item.isAutoApplied?'checked':''}> Promo auto-aplicada</label></div></div>`;
      list.appendChild(row);
    });
    const add=document.createElement('button');add.textContent='+ Producto';add.dataset.addItem=ci;list.appendChild(add);box.appendChild(list);$('menu').appendChild(box);
  });
  const empty=document.createElement('div');empty.id='adminSearchEmpty';empty.className='admin-search-empty';empty.textContent='No encontramos productos con esa búsqueda.';empty.style.display='none';$('menu').appendChild(empty);renderMenuCategoryFilters();setupProductSearch();applyProductFilter();
}
function readForm() {
  readLegalEditor();
  const r = config.restaurant || {};
  config.restaurant = {
    ...r,
    name: $('name').value.trim(),
    subtitle: $('subtitle').value.trim(),
    ...( $('slogan') ? { slogan: $('slogan').value.trim() } : {} ),
    fullName: $('fullName').value.trim(),
    description: $('description').value.trim(),
    whatsapp: $('whatsapp').value.trim(),
    instagram: $('instagram').value.trim(),
    tiktok: $('tiktok').value.trim(),
    location: $('location').value.trim(),
    logo: $('logo').value.trim(),
    watermark: $('watermark').value.trim(),
    ...( $('cover') ? { cover: $('cover').value.trim() } : {} )
  };
  config.deliveryCost = Number($('delivery').value) || 0;
  config.exchangeDivisors = {
    usd: readDivisorInput('usdDivisor', 'USD'),
    bs: readDivisorInput('bsDivisor', 'Bs')
  };
  collectPaymentMethods();
  delete config.payments; // Evita volver a mezclar el modelo antiguo con el nuevo.
  config.theme = { ...(config.theme || {}), primary:$('primary').value, primaryHover:$('primaryHover').value, accent:$('accent').value, accentHover:$('accentHover').value };
  config.schedule = readScheduleFromInputs();
  config.hoursText = buildHoursText(config.schedule);
  if ($('hoursText')) $('hoursText').value = config.hoursText;
  config.storeStatus = { ...(config.storeStatus || {}), forceClose:$('forceClose').checked };
  if ($('rating')) config.googleReviews = { ...(config.googleReviews || {}), rating:Number($('rating').value)||0, totalReviews:Number($('reviewCount').value)||0, url:$('reviewUrl').value.trim() };
  config.deliveryZones = Array.from(document.querySelectorAll('[data-zone-name]')).map(input => {
    const i = Number(input.dataset.zoneName);
    const priceInput = document.querySelector(`[data-zone-price="${i}"]`);
    return { name: input.value.trim(), price: Math.max(0, Number(priceInput?.value) || 0) };
  }).filter(zone => zone.name);
  document.querySelectorAll('[data-cat]').forEach(input => { const ci=Number(input.dataset.cat); if(config.menuData[ci]) config.menuData[ci].category=input.value.trim(); });
  document.querySelectorAll('[data-cat-hidden]').forEach(input => { const ci=Number(input.dataset.catHidden); if(config.menuData[ci]) config.menuData[ci].isHidden=input.checked; });
  document.querySelectorAll('[data-field]').forEach(input => {
    const ci=Number(input.dataset.ci), ii=Number(input.dataset.ii), item=config.menuData[ci]?.items?.[ii]; if(!item) return;
    const field=input.dataset.field;
    if(input.type==='checkbox') item[field]=input.checked;
    else if(field==='price') item[field]=Number(input.value)||0;
    else if(field==='promoDay'){ const day=Number(input.value)||0; if(day>=1&&day<=6)item[field]=day;else delete item[field]; }
    else if(field==='proteinSelector'){ const values=input.value.split(',').map(s=>s.trim()).filter(Boolean); if(values.length)item[field]=values; else delete item[field]; }
    else item[field]=input.value;
  });
}

async function saveConfig(show=true) {
  readForm();
  const result = await api('/admin/config', { method:'PUT', body:JSON.stringify(config) });
  config = result.config || config;
  if (show) showStatus('Cambios guardados correctamente.', 'ok');
}

async function uploadImage(target, file, categoryIndex=null, itemIndex=null) {
  if (!file) throw new Error('Selecciona una imagen primero.');
  await saveConfig(false);
  const form = new FormData();
  form.append('file', file);
  form.append('target', target);
  if (categoryIndex !== null) form.append('categoryIndex', String(categoryIndex));
  if (itemIndex !== null) form.append('itemIndex', String(itemIndex));
  const result = await api('/admin/upload-image', { method:'POST', body:form });
  config = result.config || config;
  fill();
  showStatus('Imagen subida correctamente.', 'ok');
}

async function deleteImage(target, categoryIndex=null, itemIndex=null) {
  await saveConfig(false);
  const body = { target };
  if (categoryIndex !== null) body.categoryIndex = categoryIndex;
  if (itemIndex !== null) body.itemIndex = itemIndex;
  const result = await api('/admin/delete-image', { method:'POST', body:JSON.stringify(body) });
  config = result.config || config;
  fill();
  showStatus('Imagen eliminada correctamente.', 'ok');
}

$('loginBtn').onclick = async () => {
  $('loginMsg').textContent='Entrando...';
  try { await api('/login',{method:'POST',body:JSON.stringify({user:$('user').value,password:$('pass').value})}); await load(); }
  catch(e){ $('loginMsg').textContent=e.message; }
};
$('logout').onclick=async()=>{await api('/logout',{method:'POST'});location.reload();};
$('refreshBtn').onclick=load;
$('saveBtn').onclick=async()=>{try{await saveConfig(true);}catch(e){showStatus(e.message,'err');}};
$('addPaymentMethod')?.addEventListener('click', () => {
  try {
    collectPaymentMethods();
    if (config.paymentMethods.length >= 20) throw new Error('Máximo 20 métodos de pago.');
    const newId = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() :
      Array.from(crypto.getRandomValues(new Uint8Array(16)), value => value.toString(16).padStart(2, '0')).join('');
    const nextName = `Nuevo método ${config.paymentMethods.length + 1}`;
    config.paymentMethods.push({ id: `metodo-${newId}`, name: nextName });
    renderPaymentMethodsAdmin();
    Array.from($('paymentMethodsAdmin')?.querySelectorAll('[data-method-name]') || []).at(-1)?.focus();
  } catch (error) { showStatus(error.message,'err'); }
});
$('paymentMethodsAdmin')?.addEventListener('click', event => {
  const button = event.target.closest('[data-remove-method]');
  if (!button) return;
  try {
    collectPaymentMethods();
    if (config.paymentMethods.length <= 1) throw new Error('Debe quedar al menos un método.');
    config.paymentMethods.splice(Number(button.dataset.removeMethod), 1);
    renderPaymentMethodsAdmin();
  } catch (error) { showStatus(error.message,'err'); }
});
['usdDivisor','bsDivisor'].forEach(id=>$(id)?.addEventListener('input',updateRatesPreview));
$('addCat').onclick=()=>{config.menuData.push({category:'Nueva categoría',items:[]});renderMenu();};
$('addZone')?.addEventListener('click',()=>{if(!Array.isArray(config.deliveryZones))config.deliveryZones=[];config.deliveryZones.push({name:'Nueva zona',price:Number(config.deliveryCost)||0});renderDeliveryZones();});
$('deliveryZones')?.addEventListener('click',e=>{const i=e.target.dataset.delZone;if(i!==undefined){config.deliveryZones.splice(Number(i),1);renderDeliveryZones();}});
$('uploadLogo')?.addEventListener('click', async e => { const btn=e.currentTarget; try{btn.disabled=true; await uploadImage('logo',$('logoFile').files[0]); $('logoFile').value='';}catch(err){showStatus(err.message,'err');}finally{btn.disabled=false;} });
$('uploadWatermark')?.addEventListener('click', async e => { const btn=e.currentTarget; try{btn.disabled=true; await uploadImage('watermark',$('watermarkFile').files[0]); $('watermarkFile').value='';}catch(err){showStatus(err.message,'err');}finally{btn.disabled=false;} });
$('uploadCover')?.addEventListener('click', async e => { const btn=e.currentTarget; try{btn.disabled=true; await uploadImage('cover',$('coverFile').files[0]); $('coverFile').value='';}catch(err){showStatus(err.message,'err');}finally{btn.disabled=false;} });
$('deleteLogo')?.addEventListener('click', async e => { if(!config?.restaurant?.logo) return showStatus('No hay logo para eliminar.','err'); if(!confirm('¿Eliminar el logo actual?')) return; const btn=e.currentTarget; try{btn.disabled=true; await deleteImage('logo');}catch(err){showStatus(err.message,'err');}finally{btn.disabled=false;} });
$('deleteWatermark')?.addEventListener('click', async e => { if(!config?.restaurant?.watermark) return showStatus('No hay marca de agua para eliminar.','err'); if(!confirm('¿Eliminar la marca de agua actual?')) return; const btn=e.currentTarget; try{btn.disabled=true; await deleteImage('watermark');}catch(err){showStatus(err.message,'err');}finally{btn.disabled=false;} });
$('deleteCover')?.addEventListener('click', async e => { if(!config?.restaurant?.cover) return showStatus('No hay portada para eliminar.','err'); if(!confirm('¿Eliminar la imagen de portada actual?')) return; const btn=e.currentTarget; try{btn.disabled=true; await deleteImage('cover');}catch(err){showStatus(err.message,'err');}finally{btn.disabled=false;} });
$('menu').addEventListener('click', async e => {
  const d=e.target.dataset;

  if (d.addProtein) {
    const [ci, ii] = d.addProtein.split(':').map(Number);
    const item = config.menuData[ci]?.items?.[ii];
    if (!item) return;
    if (!Array.isArray(item.proteinSelector)) item.proteinSelector = [];
    if (item.proteinSelector.length >= 20) return showStatus('Un producto puede tener hasta 20 opciones de proteína.', 'err');
    item.proteinSelector.push('Nueva proteína');
    renderMenu();
    return;
  }

  if (d.removeProtein) {
    const [ci, ii, pi] = d.removeProtein.split(':').map(Number);
    const item = config.menuData[ci]?.items?.[ii];
    if (!item || !Array.isArray(item.proteinSelector)) return;
    item.proteinSelector.splice(pi, 1);
    if (!item.proteinSelector.length) delete item.proteinSelector;
    renderMenu();
    return;
  }
  if(d.delCat!==undefined){config.menuData.splice(Number(d.delCat),1);renderMenu();return;}
  if(d.delItem){const [ci,ii]=d.delItem.split(':').map(Number);config.menuData[ci]?.items?.splice(ii,1);renderMenu();return;}
  if(d.addItem!==undefined){config.menuData[Number(d.addItem)].items.push({name:'Nuevo producto',price:0,description:'',outOfStock:false,isFeatured:false,allowAddons:false});renderMenu();return;}
  if(d.deleteImage){
    const [ci,ii]=d.deleteImage.split(':').map(Number);
    const item=config.menuData[ci]?.items?.[ii];
    if(!item?.image) return showStatus('Este producto no tiene imagen.','err');
    if(!confirm(`¿Eliminar la imagen de '${item.name || 'este producto'}'?`)) return;
    const btn=e.target;
    try{btn.disabled=true;btn.textContent='Eliminando...';await deleteImage('product',ci,ii);}catch(err){showStatus(err.message,'err');}finally{btn.disabled=false;btn.textContent='Eliminar imagen';}
    return;
  }
  if(d.uploadImage){
    const [ci,ii]=d.uploadImage.split(':').map(Number);
    const input=document.querySelector(`[data-file-ci="${ci}"][data-file-ii="${ii}"]`);
    const btn=e.target;
    try{btn.disabled=true;btn.textContent='Subiendo...';await uploadImage('product',input?.files?.[0],ci,ii);}catch(err){showStatus(err.message,'err');}finally{btn.disabled=false;btn.textContent='Subir imagen';}
  }
});

function formatCOP(value) {
  return `${Math.round(Number(value) || 0).toLocaleString('es-CO')} COP`;
}

$('menu').addEventListener('input', e => {
  if (!e.target.matches('[data-protein-option]')) return;
  const ci = Number(e.target.dataset.ci);
  const ii = Number(e.target.dataset.ii);
  const item = config.menuData[ci]?.items?.[ii];
  if (!item) return;
  const optionInputs = document.querySelectorAll(`[data-protein-option][data-ci="${ci}"][data-ii="${ii}"]`);
  item.proteinSelector = Array.from(optionInputs).map(input => input.value.trim()).filter(Boolean);
  if (!item.proteinSelector.length) delete item.proteinSelector;
});


['openingTime','closingTime','secondOpeningTime','secondClosingTime'].forEach(id=>$(id)?.addEventListener('input',syncSchedulePreview));
$('secondShiftEnabled')?.addEventListener('change',()=>{syncSchedulePreview();});

load();

