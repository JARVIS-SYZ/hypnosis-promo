/* eslint-env browser */
/* global TextEncoder, TextDecoder, crypto */
(() => {
  'use strict';
  const OWNER = 'JARVIS-SYZ';
  const REPO = 'hypnosis-promo';
  const BRANCH = 'main';
  const API = `https://api.github.com/repos/${OWNER}/${REPO}/contents/`;
  const CONFIG_PATH = 'docs/promotion.json';
  const byId = id => document.getElementById(id);
  const tokenField = byId('token');
  const imageField = byId('image');
  const preview = byId('preview');
  const emptyPreview = byId('empty-preview');
  const status = byId('status');
  const popupOn = byId('popupOn');
  const list = byId('items');
  let token = '';
  let state = null;
  let busy = false;
  let previewBlobUrl = null;

  function setStatus(message, error = false) {
    status.textContent = message;
    status.classList.toggle('error', error);
  }

  function pagesBase() {
    if (location.protocol !== 'https:') throw new Error('관리 페이지를 GitHub Pages HTTPS 주소에서 열어 주세요.');
    return new URL('./', location.href);
  }

  function utf8ToBase64(text) {
    return bytesToBase64(new TextEncoder().encode(text));
  }

  function bytesToBase64(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return btoa(binary);
  }

  function base64ToUtf8(value) {
    const binary = atob(value.replace(/\s/g, ''));
    return new TextDecoder().decode(Uint8Array.from(binary, char => char.charCodeAt(0)));
  }

  async function github(path, options = {}) {
    if (!token) throw new Error('먼저 GitHub 토큰을 입력하고 불러와 주세요.');
    const response = await fetch(API + path + (options.method ? '' : `?ref=${encodeURIComponent(BRANCH)}`), {
      method: options.method || 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(options.method ? { 'Content-Type': 'application/json' } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: 'no-store',
    });
    if (response.status === 404 && !options.method) return null;
    if (!response.ok) {
      const reason = response.status === 401 ? '토큰을 확인해 주세요.'
        : response.status === 403 ? '저장소 Contents 권한을 확인해 주세요.'
        : response.status === 409 ? '다른 곳에서 수정되었습니다. 다시 시도해 주세요.'
        : `GitHub 요청 실패 (${response.status})`;
      throw new Error(reason);
    }
    return response.json();
  }

  // 이전 형식(홍보 1개 + enabled)도 목록 형식으로 바꿔 읽음
  function normalize(raw) {
    const data = raw && typeof raw === 'object' ? raw : {};
    if (Array.isArray(data.items)) {
      const items = data.items.filter(item => item && typeof item.id === 'string');
      const activeId = items.some(item => item.id === data.activeId) ? data.activeId : null;
      return { popupOn: data.popupOn === true, activeId, items };
    }
    if (typeof data.id === 'string' && data.title) {
      const { id, title, buttonLabel, linkUrl, imageUrl } = data;
      return { popupOn: data.enabled === true, activeId: id, items: [{ id, title, buttonLabel, linkUrl, imageUrl }] };
    }
    return { popupOn: false, activeId: null, items: [] };
  }

  // 앱은 최상위 enabled/id/title/buttonLabel/linkUrl/imageUrl 만 읽음
  function serialize(next) {
    const active = next.items.find(item => item.id === next.activeId);
    const out = { enabled: !!(next.popupOn && active) };
    if (active) Object.assign(out, {
      id: active.id, title: active.title, buttonLabel: active.buttonLabel,
      linkUrl: active.linkUrl, imageUrl: active.imageUrl,
    });
    return { ...out, popupOn: next.popupOn, activeId: next.activeId, items: next.items };
  }

  // 항상 최신 파일을 읽어 변경을 적용한 뒤 저장 (다른 창의 변경을 덮어쓰지 않음)
  async function commit(mutate, message) {
    const file = await github(CONFIG_PATH);
    const next = normalize(file ? JSON.parse(base64ToUtf8(file.content)) : null);
    mutate(next);
    await github(CONFIG_PATH, { method: 'PUT', body: {
      message,
      content: utf8ToBase64(JSON.stringify(serialize(next), null, 2) + '\n'),
      branch: BRANCH,
      ...(file?.sha ? { sha: file.sha } : {}),
    } });
    state = next;
    render();
  }

  async function run(task, pending) {
    if (busy) return;
    busy = true;
    render();
    setStatus(pending);
    try {
      await task();
    } catch (error) {
      setStatus(error.message || '처리하지 못했습니다.', true);
      render();
    } finally {
      busy = false;
      render();
    }
  }

  function render() {
    const ready = !!state && !busy;
    popupOn.disabled = !ready;
    byId('save').disabled = !ready;
    byId('load').disabled = busy;
    if (!state) return;
    const active = state.items.find(item => item.id === state.activeId);
    popupOn.checked = state.popupOn;
    byId('popupOnLabel').textContent = state.popupOn ? '켜짐' : '꺼짐';
    byId('popupSummary').textContent = !state.popupOn
      ? '팝업이 꺼져 있어 앱에 표시되지 않습니다.'
      : active ? `앱에 "${active.title}" 홍보를 표시합니다.`
      : '팝업은 켜져 있지만 선택된 홍보가 없어 앱에 표시되지 않습니다.';
    list.replaceChildren(...state.items.map(item => renderItem(item, ready)));
    byId('emptyItems').hidden = state.items.length > 0;
  }

  function renderItem(item, ready) {
    const li = document.createElement('li');
    li.className = 'item' + (item.id === state.activeId ? ' active' : '');
    const pick = document.createElement('label');
    pick.className = 'pick';
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'active';
    radio.checked = item.id === state.activeId;
    radio.disabled = !ready;
    radio.setAttribute('aria-label', `${item.title} 선택`);
    radio.addEventListener('change', () => select(item.id));
    const img = document.createElement('img');
    img.src = item.imageUrl;
    img.alt = '';
    const text = document.createElement('span');
    text.className = 'item-text';
    const title = document.createElement('strong');
    title.textContent = item.title;
    const meta = document.createElement('small');
    meta.textContent = `${item.buttonLabel} · ${item.linkUrl}`;
    text.append(title, meta);
    pick.append(radio, img, text);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'danger';
    remove.textContent = '삭제';
    remove.disabled = !ready;
    remove.addEventListener('click', () => removeItem(item));
    li.append(pick, remove);
    return li;
  }

  function showImage(url) {
    if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
    previewBlobUrl = url && url.startsWith('blob:') ? url : null;
    preview.hidden = !url;
    emptyPreview.hidden = !!url;
    if (url) preview.src = url;
    else preview.removeAttribute('src');
  }

  function clearForm() {
    byId('title').value = '';
    byId('buttonLabel').value = '보러가기';
    byId('linkUrl').value = '';
    imageField.value = '';
    showImage('');
  }

  function load() {
    const supplied = tokenField.value.trim();
    if (supplied) {
      token = supplied;
      tokenField.value = '';
    }
    if (!token) return setStatus('GitHub 토큰을 입력해 주세요.', true);
    run(async () => {
      const file = await github(CONFIG_PATH);
      state = normalize(file ? JSON.parse(base64ToUtf8(file.content)) : null);
      setStatus('현재 설정을 불러왔습니다.');
    }, '불러오는 중…');
  }

  function imageType(bytes) {
    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
    if (bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((n, i) => bytes[i] === n)) return 'png';
    if (bytes.length >= 12 && String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP') return 'webp';
    throw new Error('JPG, PNG, WebP 이미지만 등록할 수 있습니다.');
  }

  function save() {
    run(async () => {
      const base = pagesBase();
      const title = byId('title').value.trim();
      const buttonLabel = byId('buttonLabel').value.trim();
      const linkUrl = byId('linkUrl').value.trim();
      const selected = imageField.files[0];
      if (!title || !buttonLabel || title.length > 80 || buttonLabel.length > 24) throw new Error('제목과 버튼 문구를 입력해 주세요.');
      let link;
      try { link = new URL(linkUrl); } catch { throw new Error('올바른 HTTPS 이동 주소를 입력해 주세요.'); }
      if (link.protocol !== 'https:' || link.username || link.password) throw new Error('이동 주소는 HTTPS 주소여야 합니다.');
      if (!selected) throw new Error('대표 이미지를 선택해 주세요.');
      if (selected.size > 3 * 1024 * 1024) throw new Error('이미지는 3MB 이하로 선택해 주세요.');
      const bytes = new Uint8Array(await selected.arrayBuffer());
      const name = `promo-images/${crypto.randomUUID()}.${imageType(bytes)}`;
      await github(`docs/${name}`, { method: 'PUT', body: {
        message: 'Upload promotion image', content: bytesToBase64(bytes), branch: BRANCH,
      } });
      const item = { id: crypto.randomUUID(), title, buttonLabel, linkUrl, imageUrl: new URL(name, base).href };
      await commit(next => {
        next.items.unshift(item);
        if (!next.activeId) next.activeId = item.id;
      }, 'Add promotion');
      clearForm();
      setStatus('저장했습니다. 아래 목록에서 표시할 홍보를 선택하세요.');
    }, '저장 중…');
  }

  function select(id) {
    run(async () => {
      await commit(next => {
        if (!next.items.some(item => item.id === id)) throw new Error('이미 삭제된 홍보입니다. 다시 불러와 주세요.');
        next.activeId = id;
      }, 'Select promotion');
      setStatus('표시할 홍보를 바꿨습니다. 게시 후 앱에 반영됩니다.');
    }, '선택 저장 중…');
  }

  function removeItem(item) {
    if (!confirm(`"${item.title}" 홍보를 삭제할까요?`)) return;
    run(async () => {
      await commit(next => {
        next.items = next.items.filter(other => other.id !== item.id);
        if (next.activeId === item.id) next.activeId = null;
      }, 'Delete promotion');
      setStatus('삭제했습니다.');
    }, '삭제 중…');
  }

  function togglePopup() {
    const on = popupOn.checked;
    run(async () => {
      await commit(next => { next.popupOn = on; }, on ? 'Turn promotion popup on' : 'Turn promotion popup off');
      setStatus(on ? '팝업을 켰습니다. 게시 후 앱에 반영됩니다.' : '팝업을 껐습니다. 게시 후 앱에 반영됩니다.');
    }, on ? '팝업 켜는 중…' : '팝업 끄는 중…');
  }

  imageField.addEventListener('change', () => {
    const file = imageField.files[0];
    showImage(file ? URL.createObjectURL(file) : '');
  });
  byId('load').addEventListener('click', load);
  byId('save').addEventListener('click', save);
  popupOn.addEventListener('change', togglePopup);
})();
