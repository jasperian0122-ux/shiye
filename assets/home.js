/* 首页 · 发现 */
(function () {
  'use strict';

  var state = { posts: [], tag: 'all', keyword: '' };

  var featureSlot = document.getElementById('feature-slot');
  var listEl = document.getElementById('post-list');
  var countEl = document.getElementById('post-count');
  var filtersEl = document.getElementById('tag-filters');
  var searchEl = document.getElementById('search-input');

  function renderFeature(post) {
    if (!post) {
      featureSlot.innerHTML = '';
      return;
    }
    var art = post.cover_url
      ? '<div class="cover-art" style="background-image:url(\'' + SY.esc(post.cover_url) + '\');background-size:cover;background-position:center"></div>'
      : '<div class="cover-art" style="background:' + SY.gradientFor(post.title) + '"></div>';
    featureSlot.innerHTML =
      '<a class="feature" href="post.html?id=' + SY.esc(post.id) + '">' +
        '<div class="feature-cover">' + art + '<span class="cover-label">编辑精选</span></div>' +
        '<div class="feature-body">' +
          '<h2>' + SY.esc(post.title) + '</h2>' +
          '<p class="excerpt">' + SY.esc(post.subtitle || post.excerpt || SY.plainText(post.content, 110)) + '</p>' +
          '<div class="meta-row">' +
            '<span class="author">' + SY.esc(post.owner_name || '佚名') + '</span>' +
            '<span class="sep"></span>' +
            '<span>' + SY.esc(SY.fmtDate(post.published_at || post.created_at)) + '</span>' +
            '<span class="sep"></span>' +
            '<span>' + SY.readMinutes(post.word_count) + ' 分钟阅读</span>' +
          '</div>' +
        '</div>' +
      '</a>';
  }

  function renderTags() {
    var tags = {};
    state.posts.forEach(function (p) {
      (p.tags || []).forEach(function (t) { tags[t] = (tags[t] || 0) + 1; });
    });
    var names = Object.keys(tags).sort(function (a, b) { return tags[b] - tags[a]; }).slice(0, 7);
    var html = '<button class="chip' + (state.tag === 'all' ? ' active' : '') + '" data-tag="all">全部</button>';
    html += names.map(function (t) {
      return '<button class="chip' + (state.tag === t ? ' active' : '') + '" data-tag="' + SY.esc(t) + '">' + SY.esc(t) + '</button>';
    }).join('');
    filtersEl.innerHTML = html;
  }

  function currentList() {
    var kw = state.keyword.trim().toLowerCase();
    return state.posts.filter(function (p) {
      var tagOk = state.tag === 'all' || (p.tags || []).indexOf(state.tag) !== -1;
      if (!tagOk) return false;
      if (!kw) return true;
      var hay = (p.title + ' ' + (p.subtitle || '') + ' ' + (p.excerpt || '') + ' ' + (p.tags || []).join(' ')).toLowerCase();
      return hay.indexOf(kw) !== -1;
    });
  }

  function renderList() {
    var items = currentList();
    countEl.textContent = items.length ? items.length + ' 篇' : '';
    if (!items.length) {
      listEl.innerHTML = '<div class="empty">' +
        '<h3>' + (state.posts.length ? '没有匹配的文章' : '这里还很安静') + '</h3>' +
        '<p>' + (state.posts.length ? '换个关键词，或者看看全部标签。' : '成为第一个在这里留下字的人。') + '</p>' +
        '<a class="btn btn-primary" href="write.html">写第一篇</a>' +
      '</div>';
      return;
    }
    listEl.innerHTML = items.map(function (p, i) { return SY.renderPostRow(p, i + 1); }).join('');
  }

  function renderStats() {
    var postEl = document.getElementById('stat-posts');
    var tagEl = document.getElementById('stat-tags');
    var tags = {};
    state.posts.forEach(function (p) {
      (p.tags || []).forEach(function (t) { tags[t] = 1; });
    });
    if (postEl) postEl.textContent = String(state.posts.length).padStart(2, '0');
    if (tagEl) tagEl.textContent = String(Object.keys(tags).length).padStart(2, '0');
  }

  filtersEl.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-tag]');
    if (!btn) return;
    state.tag = btn.getAttribute('data-tag');
    renderTags();
    renderList();
  });

  searchEl.addEventListener('input', function () {
    state.keyword = searchEl.value;
    renderList();
  });

  async function init() {
    await SY.boot();

    if (!SY.cloud) {
      featureSlot.innerHTML = '';
      listEl.innerHTML = '<div class="empty"><h3>暂时无法连接服务</h3><p>请检查网络后刷新页面。</p></div>';
      return;
    }
    if (SY.authError) SY.toast(SY.authError, 'err');

    try {
      var posts = await SY.db.listPublished(40);
      state.posts = posts || [];
      renderFeature(state.posts[0]);
      renderTags();
      renderList();
      renderStats();
    } catch (err) {
      featureSlot.innerHTML = '';
      listEl.innerHTML = '<div class="empty"><h3>文章没能加载出来</h3><p>' + SY.esc(err.message || '请稍后重试') + '</p></div>';
    }
  }

  init();
})();
