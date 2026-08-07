QSCORER.util = {
  el(id) { return document.getElementById(id); },
  esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '<').replace(/>/g, '>')
      .replace(/"/g, '"').replace(/'/g, '&#39;');
  },
  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(str);
    if (isNaN(d)) return str;
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  },
  number(n) {
    return Number(n || 0).toLocaleString('id-ID');
  },
  option(arr, valueKey, labelKey, selected) {
    return arr.map(x => {
      const v = x[valueKey], l = x[labelKey];
      const sel = String(v) === String(selected) ? ' selected' : '';
      return `<option value="${QSCORER.util.esc(v)}"${sel}>${QSCORER.util.esc(l)}</option>`;
    }).join('');
  }
};

QSCORER.ui = {
  toastWrap: null,
  init() {
    if (!this.toastWrap) {
      this.toastWrap = document.createElement('div');
      this.toastWrap.className = 'toast-wrap';
      document.body.appendChild(this.toastWrap);
    }
  },
  toast(msg, type = 'info') {
    this.init();
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    const ico = type === 'success' ? 'fa-solid fa-circle-check' :
      type === 'error' ? 'fa-solid fa-circle-xmark' : 'fa-solid fa-circle-info';
    t.innerHTML = '<span class="t-icon"><i class="' + ico + '"></i></span><span>' + QSCORER.util.esc(msg) + '</span>';
    this.toastWrap.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .4s'; setTimeout(() => t.remove(), 400); }, 3200);
  },
  loader(text = 'Memuat data...') {
    return '<div class="loader-wrap"><div class="loader lg"></div><div class="loader-txt">' + text + '</div></div>';
  },
  modal(title, bodyHtml, onClose) {
    const ov = document.createElement('div');
    ov.className = 'modal-overlay';
    ov.innerHTML = '<div class="modal"><div class="modal-head"><div class="modal-title">' + title + '</div><button class="modal-close"><i class="fa-solid fa-xmark"></i></button></div><div class="modal-body">' + bodyHtml + '</div></div>';
    const close = () => { ov.remove(); if (onClose) onClose(); };
    ov.querySelector('.modal-close').onclick = close;
    ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
    document.body.appendChild(ov);
    return ov;
  },
  confirm(title, msg, onYes, yesLabel = 'Hapus') {
    const ov = document.createElement('div');
    ov.className = 'modal-overlay';
    ov.innerHTML = '<div class="modal" style="max-width:400px"><div class="modal-head"><div class="modal-title">' + title + '</div><button class="modal-close"><i class="fa-solid fa-xmark"></i></button></div><div class="modal-body"><p style="color:var(--muted);margin-bottom:20px">' + msg + '</p><div style="display:flex;gap:10px;justify-content:flex-end"><button class="btn btn-ghost btn-sm" data-no>Batal</button><button class="btn btn-red btn-sm" data-yes>' + yesLabel + '</button></div></div></div>';
    const close = () => ov.remove();
    ov.querySelector('.modal-close').onclick = close;
    ov.querySelector('[data-no]').onclick = close;
    ov.querySelector('[data-yes]').onclick = () => { close(); onYes(); };
    ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
    document.body.appendChild(ov);
  }
};
