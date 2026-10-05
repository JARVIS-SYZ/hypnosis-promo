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
  let token = '';
  let current = null;
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
        : response.status === 409 ? '다른 곳에서 수정되었습니다. 불러온 뒤 다시 저장해 주세요.'
        : `GitHub 요청 실패 (${response.status})`;
      throw new Error(reason);
    }
    return response.json();
  }

  function showImage(url) {
    if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
    previewBlobUrl = url && url.startsWith('blob:') ? url : null;
    preview.hidden = !url;
    emptyPreview.hidden = !!url;
    if (url) preview.src = url;
    else preview.removeAttribute('src');
  }

  async function load() {
    const supplied = tokenField.value.trim();
    if (supplied) {
      token = supplied;
      tokenField.value = '';
    }
    if (!token) return setStatus('GitHub 토큰을 입력해 주세요.', true);
    setStatus('불러오는 중…');
    byId('load').disabled = true;
    try {
      const file = await github(CONFIG_PATH);
      current = file ? JSON.parse(base64ToUtf8(file.content)) : null;
      byId('enabled').checked = !!current?.enabled;
      byId('title').value = current?.title || '';
      byId('buttonLabel').value = current?.buttonLabel || '보러가기';
      byId('linkUrl').value = current?.linkUrl || '';
      imageField.value = '';
      showImage(current?.imageUrl || '');
      setStatus(file ? '현재 홍보 내용을 불러왔습니다.' : '등록된 홍보가 없습니다. 내용을 입력하고 저장해 주세요.');
    } catch (error) {
      setStatus(error.message || '불러오지 못했습니다.', true);
    } finally {
      byId('load').disabled = false;
    }
  }

  function imageType(bytes) {
    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
    if (bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((n, i) => bytes[i] === n)) return 'png';
    if (bytes.length >= 12 && String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP') return 'webp';
    throw new Error('JPG, PNG, WebP 이미지만 등록할 수 있습니다.');
  }

  async function save() {
    if (!token) return setStatus('먼저 GitHub 토큰을 입력하고 불러와 주세요.', true);
    setStatus('저장 중…');
    byId('save').disabled = true;
    try {
      const base = pagesBase();
      const enabled = byId('enabled').checked;
      const title = byId('title').value.trim();
      const buttonLabel = byId('buttonLabel').value.trim();
      const linkUrl = byId('linkUrl').value.trim();
      const selected = imageField.files[0];
      if (title.length > 80 || buttonLabel.length > 24 || (enabled && (!title || !buttonLabel))) throw new Error('제목과 버튼 문구를 입력해 주세요.');
      if (enabled) {
        const link = new URL(linkUrl);
        if (link.protocol !== 'https:' || link.username || link.password) throw new Error('이동 주소는 HTTPS 주소여야 합니다.');
      }
      if (enabled && !selected && !current?.imageUrl) throw new Error('대표 이미지를 선택해 주세요.');
      const previous = await github(CONFIG_PATH);
      let imageUrl = current?.imageUrl || '';
      if (selected) {
        if (selected.size > 3 * 1024 * 1024) throw new Error('이미지는 3MB 이하로 선택해 주세요.');
        const bytes = new Uint8Array(await selected.arrayBuffer());
        const ext = imageType(bytes);
        const name = `promo-images/${crypto.randomUUID()}.${ext}`;
        await github(`docs/${name}`, { method: 'PUT', body: {
          message: 'Upload promotion image', content: bytesToBase64(bytes), branch: BRANCH,
        } });
        imageUrl = new URL(name, base).href;
      }
      const promotion = { enabled, id: crypto.randomUUID(), title, buttonLabel, linkUrl, imageUrl };
      await github(CONFIG_PATH, { method: 'PUT', body: {
        message: enabled ? 'Update promotion' : 'Disable promotion',
        content: utf8ToBase64(JSON.stringify(promotion, null, 2) + '\n'),
        branch: BRANCH,
        ...(previous?.sha ? { sha: previous.sha } : {}),
      } });
      current = promotion;
      imageField.value = '';
      showImage(imageUrl);
      setStatus(enabled ? '저장했습니다. 게시 후 앱의 다음 최면 화면 진입부터 표시됩니다.' : '팝업을 껐습니다. 게시 후 앱에 반영됩니다.');
    } catch (error) {
      setStatus(error instanceof TypeError && byId('enabled').checked ? '올바른 HTTPS 이동 주소를 입력해 주세요.' : error.message || '저장하지 못했습니다.', true);
    } finally {
      byId('save').disabled = false;
    }
  }

  imageField.addEventListener('change', () => {
    const file = imageField.files[0];
    if (file) showImage(URL.createObjectURL(file));
    else showImage(current?.imageUrl || '');
  });
  byId('load').addEventListener('click', load);
  byId('save').addEventListener('click', save);
})();
