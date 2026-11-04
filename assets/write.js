/* 写作 / 编辑 */
(function () {
  'use strict';

  var params = new URLSearchParams(location.search);
  var postId = params.get('id');
  var current = null;        // 正在编辑的文章（服务端返回值）
  var dirty = false;
  var saving = false;

  var el = {
    title: document.getElementById('f-title'),
    subtitle: document.getElementById('f-subtitle'),
    tags: document.getElementById('f-tags'),
    cover: document.getElementById('f-cover'),
    body: document.getElementById('f-body'),
    status: document.getElementById('status'),
    preview: document.getElementById('preview'),
    wordCount: document.getElementById('word-count'),
    btnDraft: document.getElementById('btn-draft'),
    btnPublish: document.getElementById('btn-publish'),
    btnDelete: document.getElementById('btn-delete')
  };

  function setStatus(text, strong) {
    el.status.innerHTML = strong ? '<b>' + SY.esc(text) + '</b>' : SY.esc(text);
  }

  function parseTags(raw) {
    return String(raw || '')
      .split(/[,，、\s]+/)
      .map(function (t) { return t.trim().replace(/^#/, ''); })
      .filter(function (t) { return t.length > 0; })
      .slice(0, 5);
  }

  function updatePreview() {
    var text = el.body.value;
    var words = SY.countWords(text);
    el.wordCount.textContent = words + ' 字 · 约 ' + SY.readMinutes(words) + ' 分钟';
    if (!text.trim()) {
      el.preview.innerHTML = '<div style="color:var(--muted)">在左边写点什么，这里会同步显示排版效果。</div>';
      return;
    }
    var head = el.title.value.trim()
      ? '<h2 style="margin-top:0">' + SY.esc(el.title.value.trim()) + '</h2>'
      : '';
    el.preview.innerHTML = head + SY.markdown(text);
  }

  function markDirty() {
    dirty = true;
    if (current) setStatus('有未保存的修改');
    else setStatus('新建文章 · 尚未保存');
  }

  [el.title, el.subtitle, el.tags, el.cover].forEach(function (input) {
    input.addEventListener('input', function () {
      markDirty();
      if (input === el.title) updatePreview();
    });
  });
  el.body.addEventListener('input', function () {
    markDirty();
    updatePreview();
  });

  function collect(status) {
    var body = el.body.value.trim();
    var title = el.title.value.trim();
    if (!title) throw new Error('先给文章起个标题');
    if (!body) throw new Error('正文还是空的');
    var words = SY.countWords(body);
    return {
      title: title,
      subtitle: el.subtitle.value.trim() || null,
      tags: parseTags(el.tags.value),
      cover_url: el.cover.value.trim() || null,
      content: body,
      excerpt: SY.plainText(body, 88),
      word_count: words,
      status: status,
      updated_at: new Date().toISOString(),
      published_at: status === 'published' ? (current && current.published_at) || new Date().toISOString() : null
    };
  }

  async function save(status) {
    if (saving) return;
    var payload;
    try {
      payload = collect(status);
    } catch (err) {
      SY.toast(err.message, 'err');
      return;
    }

    saving = true;
    el.btnDraft.disabled = true;
    el.btnPublish.disabled = true;
    setStatus('正在保存…');

    try {
      if (current) {
        var updated = await SY.db.updatePost(current.id, payload);
        if (!updated) throw new Error('没有权限修改这篇文章');
        current = updated;
      } else {
        var created = await SY.db.createPost(Object.assign({ owner_name: SY.displayName() }, payload));
        if (!created) throw new Error('保存失败，请重试');
        current = created;
        history.replaceState(null, '', 'write.html?id=' + created.id);
      }
      dirty = false;
      el.btnDelete.hidden = false;
      setStatus(status === 'published' ? '已发布于 ' + SY.fmtDate(current.published_at || current.updated_at) : '草稿已保存 · ' + SY.fmtDate(current.updated_at));
      SY.toast(status === 'published' ? '已发布' : '草稿已保存');
      if (status === 'published') {
        setTimeout(function () { location.href = 'post.html?id=' + current.id; }, 420);
      }
    } catch (err) {
      setStatus('保存失败');
      SY.toast(err.message || '保存失败，请重试', 'err');
    } finally {
      saving = false;
      el.btnDraft.disabled = false;
      el.btnPublish.disabled = false;
    }
  }

  el.btnDraft.addEventListener('click', function () { save('draft'); });
  el.btnPublish.addEventListener('click', function () { save('published'); });

  el.btnDelete.addEventListener('click', async function () {
    if (!current) return;
    if (!window.confirm('删除《' + current.title + '》？删除后无法恢复。')) return;
    try {
      var removed = await SY.db.deletePost(current.id);
      if (!removed.length) throw new Error('没有权限删除这篇文章');
      dirty = false;
      SY.toast('已删除');
      setTimeout(function () { location.href = 'me.html'; }, 400);
    } catch (err) {
      SY.toast(err.message || '删除失败', 'err');
    }
  });

  window.addEventListener('beforeunload', function (e) {
    if (!dirty) return;
    e.preventDefault();
    e.returnValue = '';
  });

  async function loadExisting() {
    var post = await SY.db.getPost(postId);
    if (!post) throw new Error('这篇文章不存在');
    if (!SY.user || post.owner_id !== SY.user.id) throw new Error('你只能编辑自己的文章');
    current = post;
    el.title.value = post.title || '';
    el.subtitle.value = post.subtitle || '';
    el.tags.value = (post.tags || []).join(', ');
    el.cover.value = post.cover_url || '';
    el.body.value = post.content || '';
    el.btnDelete.hidden = false;
    el.btnPublish.textContent = post.status === 'published' ? '更新' : '发布';
    document.title = '编辑 · ' + post.title;
    setStatus(post.status === 'published' ? '已发布 · 修改后请点「更新」' : '草稿 · 尚未公开', post.status === 'published');
    updatePreview();
  }

  async function init() {
    await SY.boot();

    if (!SY.cloud) {
      setStatus('服务未连接，暂时无法保存');
      el.btnDraft.disabled = true;
      el.btnPublish.disabled = true;
      return;
    }
    if (!SY.requireUser()) return;

    if (postId) {
      try {
        await loadExisting();
      } catch (err) {
        setStatus(err.message);
        SY.toast(err.message, 'err');
        setTimeout(function () { location.href = 'index.html'; }, 1600);
        return;
      }
    } else {
      document.title = '写一篇 · 拾页';
      el.body.focus();
      updatePreview();
    }
  }

  init();
})();
