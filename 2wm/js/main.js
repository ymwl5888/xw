document.addEventListener('DOMContentLoaded', function () {
  const files = [
    { name: '微信收款码.png', size: '112.60K', time: '2025-9-28 10:38:35', href: 'pic/wechat.png' },
    { name: '支付宝收款码.png', size: '119.43K', time: '2025-9-28 10:35:26', href: 'pic/alipay.png' }
  ];

  const tbody = document.getElementById('files');
  files.forEach(f => {
    const tr = document.createElement('tr');
    const tdName = document.createElement('td');
    const a = document.createElement('a');
    a.href = '#';
    a.className = 'file-link';
    a.setAttribute('data-src', f.href);
    a.textContent = f.name; // safe: use textContent to avoid HTML injection
    tdName.appendChild(a);

    const tdSize = document.createElement('td');
    tdSize.textContent = f.size;
    const tdTime = document.createElement('td');
    tdTime.textContent = f.time;

    tr.appendChild(tdName);
    tr.appendChild(tdSize);
    tr.appendChild(tdTime);
    tbody.appendChild(tr);
  });

  // Modal handling
  const modal = document.getElementById('modal');
  const modalImg = document.getElementById('modal-img');
  const closeBtn = document.querySelector('.modal-close');

  let currentObjectURL = null;
  let lastTrigger = null;

  function showModal() {
    modal.setAttribute('aria-hidden', 'false');
    if (closeBtn) closeBtn.focus();
  }

  function hideModal() {
    if (currentObjectURL) {
      try { URL.revokeObjectURL(currentObjectURL); } catch (e) {}
      currentObjectURL = null;
    }
    modalImg.src = '';
    // Move focus outside the modal before hiding so aria-hidden won't
    // cover a focused descendant (avoids the aria-hidden focus warning).
    if (lastTrigger && document.contains(lastTrigger)) {
      lastTrigger.focus();
    } else if (document.activeElement && modal.contains(document.activeElement)) {
      document.activeElement.blur();
    }
    modal.setAttribute('aria-hidden', 'true');
  }

  function isSafePath(url) {
    if (!url || typeof url !== 'string') return false;
    const lower = url.toLowerCase();
    if (lower.startsWith('http:') || lower.startsWith('https:') || lower.startsWith('//')) return false;
    if (lower.startsWith('data:') || lower.startsWith('javascript:')) return false;
    // disallow path traversal
    if (url.indexOf('..') !== -1) return false;
    // allow only paths that contain /pic/ or start with pic/
    return /(^|\/)pic\//.test(url);
  }

  async function openModalWithPNG(url) {
    if (!isSafePath(url)) {
      modalImg.alt = '不支持的图片路径';
      modal.setAttribute('aria-hidden', 'false');
      return;
    }
    // revoke previous object URL if any
    if (currentObjectURL) {
      try { URL.revokeObjectURL(currentObjectURL); } catch (e) {}
      currentObjectURL = null;
    }

    try {
      // Try fetching the PNG directly
      const resp = await fetch(url, { method: 'GET' });
      if (resp.ok) {
        // If resource is PNG or raster, display directly using object URL
        const blob = await resp.blob();
        if (blob.type && blob.type.indexOf('image') === 0 && blob.type !== 'image/svg+xml') {
          try {
            const objURL = URL.createObjectURL(blob);
            currentObjectURL = objURL;
            modalImg.src = objURL;
            modalImg.alt = (url && url.split('/').pop()) || '';
    showModal();
            return;
          } catch (e) {
            // fallback to data URL
            const reader = new FileReader();
            reader.onload = function() {
              modalImg.src = reader.result;
      showModal();
            };
            reader.readAsDataURL(blob);
            return;
          }
        }
      }
    } catch (e) {
      // ignore and fallback to svg
    }

    // Fallback: try same path with .svg extension
    const svgPath = url.replace(/\.png$/i, '.svg');
    try {
      const r2 = await fetch(svgPath);
      if (r2.ok) {
        const svgText = await r2.text();
        const svg = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
        const img = new Image();
        img.onload = () => {
          const maxDim = 1600;
          const w = img.width || 800;
          const h = img.height || (w);
          const ratio = Math.min(1, maxDim / Math.max(w, h));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.floor(w * ratio));
          canvas.height = Math.max(1, Math.floor(h * ratio));
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          try {
            const pngData = canvas.toDataURL('image/png');
            modalImg.src = pngData;
    showModal();
          } catch (err) {
            modalImg.alt = '图片处理失败';
    showModal();
          }
        };
        img.onerror = () => {
          modalImg.alt = '无法加载图片';
  showModal();
        };
        img.src = svg;
        return;
      }
    } catch (e) {
      // final failure
    }

    modalImg.alt = '无法加载图片';
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeModal() {
    hideModal();
  }

  document.body.addEventListener('click', function (e) {
    const a = e.target.closest('.file-link');
    if (!a) return;
    e.preventDefault();
    lastTrigger = a;
    const src = a.getAttribute('data-src') || a.getAttribute('href');
    if (!src) return;
    openModalWithPNG(src);
  });

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', function (e) {
    if (e.target.classList.contains('modal-backdrop')) closeModal();
  });

  // Escape to close
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') closeModal();
  });
});
