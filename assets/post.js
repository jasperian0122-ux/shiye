/* 文章详情 */
(function () {
  'use strict';

  var root = document.getElementById('article-root');
  var progress = document.getElementById('progress');
  var postId = new URLSearchParams(location.search).get('id');
  var post = null;
  var liked = false;
  var bookmarked = false;
  var likeCount = 0;
  var bookmarkCount = 0;

  function goLogin() {
    var next = encodeURIComponent('post.html?id=' + postId);
    location.href = 'login.html?next=' + next;
  }

  function render() {
    var isOwner = SY.user && SY.user.id === post.owner_id;
    var tags = (post.tags || []).map(function (t) { return '<span class="tag">' + SY.esc(t) + '</span>'; }).join('');

    root.innerHTML =
      '<article class="article">' +
        '<header class="article-head">' +
          (post.status === 'draft' ? '<div class="eyebrow" style="color:var(--accent)">草稿 · 仅自己可见</div>' : '') +
          '<h1>' + SY.esc(post.title) + '</h1>' +
          (post.subtitle ? '<p class="subtitle">' + SY.esc(post.subtitle) + '</p>' : '') +
          '<div class="article-meta">' +
            '<span class="author-block">' + SY.avatarHtml({ name: post.owner_name || '佚名' }) +
              '<span class="name">' + SY.esc(post.owner_name || '佚名') + '</span></span>' +
            '<span class="sep" style="width:3px;height:3px;border-radius:50%;background:var(--line-strong);display:inline-block"></span>' +
            '<span>' + SY.esc(SY.fmtDate(post.published_at || post.created_at)) + '</span>' +
            '<span>' + post.word_count + ' 字 · 约 ' + SY.readMinutes(post.word_count) + ' 分钟</span>' +
            (tags ? '<span style="display:flex;gap:6px;margin-left:auto">' + tags + '</span>' : '') +
          '</div>' +
        '</header>' +
        '<div class="prose">' + SY.markdown(post.content) + '</div>' +
        '<div class="article-actions">' +
          '<button class="action-btn" id="btn-like"><span class="ico">♡</span><span id="like-label">点赞</span></button>' +
          '<button class="action-btn" id="btn-bookmark"><span class="ico">⌑</span><span id="bm-label">收藏</span></button>' +
          (isOwner ? '<a class="btn btn-sm" style="margin-left:auto" href="write.html?id=' + post.id + '">编辑这篇</a>' : '') +
        '</div>' +
        '<div class="author-card">' +
          SY.avatarHtml({ name: post.owner_name || '佚名' }, 'avatar-lg') +
          '<div><div class="a-name">' + SY.esc(post.owner_name || '佚名') + '</div>' +
          '<div class="a-bio" id="author-bio">这位作者还没有写下自我介绍。</div></div>' +
        '</div>' +
      '</article>' +
      '<section class="more-posts"><h4>继续读</h4><div class="more-grid" id="more-grid"></div></section>';

    document.title = post.title + ' · 拾页';
    paintCounts();
    bindActions();
    loadAuthorBio();
    loadMore();
  }

  function paintCounts() {
    var likeBtn = document.getElementById('btn-like');
    var bmBtn = document.getElementById('btn-bookmark');
    if (!likeBtn || !bmBtn) return;
    likeBtn.classList.toggle('on', liked);
    bmBtn.classList.toggle('on', bookmarked);
    document.getElementById('like-label').textContent = (liked ? '已赞' : '点赞') + (likeCount ? ' ' + likeCount : '');
    document.getElementById('bm-label').textContent = (bookmarked ? '已收藏' : '收藏') + (bookmarkCount ? ' ' + bookmarkCount : '');
  }

  function bindActions() {
    document.getElementById('btn-like').addEventListener('click', async function () {
      if (!SY.user) { goLogin(); return; }
      var btn = this;
      btn.disabled = true;
      try {
        await SY.db.toggleLike(post.id, !liked);
        liked = !liked;
        likeCount += liked ? 1 : -1;
        if (likeCount < 0) likeCount = 0;
        paintCounts();
        SY.toast(liked ? '已点赞' : '已取消点赞');
      } catch (err) {
        SY.toast(err.message || '操作失败', 'err');
      } finally {
        btn.disabled = false;
      }
    });

    document.getElementById('btn-bookmark').addEventListener('click', async function () {
      if (!SY.user) { goLogin(); return; }
      var btn = this;
      btn.disabled = true;
      try {
        await SY.db.toggleBookmark(post.id, !bookmarked);
        bookmarked = !bookmarked;
        bookmarkCount += bookmarked ? 1 : -1;
        if (bookmarkCount < 0) bookmarkCount = 0;
        paintCounts();
        SY.toast(bookmarked ? '已收藏，可在「我的」里找到' : '已取消收藏');
      } catch (err) {
        SY.toast(err.message || '操作失败', 'err');
      } finally {
        btn.disabled = false;
      }
    });
  }

  async function loadAuthorBio() {
    try {
      var profile = await SY.db.getProfile(post.owner_id);
      var el = document.getElementById('author-bio');
      if (profile && profile.bio && el) el.textContent = profile.bio;
    } catch (e) { /* 简介缺失不影响阅读 */ }
  }

  async function loadMore() {
    var grid = document.getElementById('more-grid');
    try {
      var posts = await SY.db.listPublished(6);
      var others = (posts || []).filter(function (p) { return String(p.id) !== String(post.id); }).slice(0, 3);
      if (!others.length) {
        grid.innerHTML = '<div style="color:var(--muted);font-size:13px">暂时没有别的文章了。</div>';
        return;
      }
      grid.innerHTML = others.map(function (p) {
        return '<a class="more-item" href="post.html?id=' + p.id + '">' +
          '<div class="m-title">' + SY.esc(p.title) + '</div>' +
          '<div class="m-meta">' + SY.esc(p.owner_name || '佚名') + ' · ' + SY.readMinutes(p.word_count) + ' 分钟</div>' +
        '</a>';
      }).join('');
    } catch (e) {
      grid.innerHTML = '';
    }
  }

  async function loadSocial() {
    try {
      var results = await Promise.all([
        SY.db.countLikes(post.id),
        SY.db.countBookmarks(post.id),
        SY.db.isLiked(post.id),
        SY.db.isBookmarked(post.id)
      ]);
      likeCount = results[0];
      bookmarkCount = results[1];
      liked = results[2];
      bookmarked = results[3];
      paintCounts();
    } catch (e) { /* 计数失败不阻断阅读 */ }
  }

  function trackProgress() {
    var scrollable = document.documentElement.scrollHeight - window.innerHeight;
    var pct = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;
    progress.style.width = Math.min(100, Math.max(0, pct)) + '%';
  }

  async function init() {
    await SY.boot();

    if (!SY.cloud) {
      root.innerHTML = '<div class="empty"><h3>暂时无法连接服务</h3><p>请检查网络后刷新页面。</p></div>';
      return;
    }
    if (!postId) {
      root.innerHTML = '<div class="empty"><h3>没有找到这篇文章</h3><p>链接可能不完整。</p><a class="btn" href="index.html">回到首页</a></div>';
      return;
    }

    try {
      post = await SY.db.getPost(postId);
    } catch (err) {
      root.innerHTML = '<div class="empty"><h3>文章没能打开</h3><p>' + SY.esc(err.message || '') + '</p><a class="btn" href="index.html">回到首页</a></div>';
      return;
    }

    if (!post) {
      root.innerHTML = '<div class="empty"><h3>这篇文章不存在</h3><p>它可能已被删除，或仍是别人的草稿。</p><a class="btn" href="index.html">回到首页</a></div>';
      return;
    }

    render();
    loadSocial();
    trackProgress();
  }

  window.addEventListener('scroll', trackProgress, { passive: true });
  init();
})();
