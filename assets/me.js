/* 个人主页 · 我的文章与收藏 */
(function () {
  'use strict';

  var page = document.getElementById('page');
  var state = {
    posts: [],
    bookmarks: [],
    profile: null,
    tab: 'published',
    editing: false
  };

  function profileOf() {
    var p = state.profile || {};
    return {
      name: (p.display_name && p.display_name.trim()) || SY.displayName(),
      bio: (p.bio && p.bio.trim()) || ''
    };
  }

  function publishedCount() {
    return state.posts.filter(function (p) { return p.status === 'published'; }).length;
  }
  function draftCount() {
    return state.posts.filter(function (p) { return p.status === 'draft'; }).length;
  }

  function renderShell() {
    var p = profileOf();
    page.innerHTML =
      '<section class="profile-head">' +
        SY.avatarHtml({ name: p.name, avatarUrl: SY.user.avatarUrl }, 'avatar-lg') +
        '<div style="min-width:0">' +
          '<h1 class="p-name">' + SY.esc(p.name) + '</h1>' +
          '<p class="p-bio" id="bio-text">' + (p.bio ? SY.esc(p.bio) : '还没有自我介绍。写一句，让别人知道你在写什么。') + '</p>' +
        '</div>' +
        '<div class="p-actions">' +
          '<button class="btn btn-sm" id="btn-edit-profile">编辑资料</button>' +
          '<button class="btn btn-sm btn-ghost" id="btn-signout">退出登录</button>' +
        '</div>' +
      '</section>' +

      '<section id="profile-form-slot"></section>' +

      '<div class="stat-strip">' +
        '<div class="stat"><div class="n">' + publishedCount() + '</div><div class="l">已发布</div></div>' +
        '<div class="stat"><div class="n">' + draftCount() + '</div><div class="l">草稿</div></div>' +
        '<div class="stat"><div class="n">' + state.bookmarks.length + '</div><div class="l">收藏</div></div>' +
      '</div>' +

      '<div class="tabs">' +
        '<button class="tab" data-tab="published">已发布<span class="n">' + publishedCount() + '</span></button>' +
        '<button class="tab" data-tab="draft">草稿<span class="n">' + draftCount() + '</span></button>' +
        '<button class="tab" data-tab="saved">收藏<span class="n">' + state.bookmarks.length + '</span></button>' +
      '</div>' +

      '<div id="tab-panel"></div>';

    document.getElementById('btn-edit-profile').addEventListener('click', toggleProfileForm);
    document.getElementById('btn-signout').addEventListener('click', async function () {
      await SY.signOut();
      location.href = 'index.html';
    });
    page.querySelector('.tabs').addEventListener('click', function (e) {
      var tab = e.target.closest('[data-tab]');
      if (!tab) return;
      state.tab = tab.getAttribute('data-tab');
      paintTabs();
      renderPanel();
    });
    paintTabs();
    renderPanel();
  }

  function paintTabs() {
    page.querySelectorAll('.tab').forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-tab') === state.tab);
    });
  }

  function toggleProfileForm() {
    var slot = document.getElementById('profile-form-slot');
    if (state.editing) {
      slot.innerHTML = '';
      state.editing = false;
      return;
    }
    state.editing = true;
    var p = profileOf();
    slot.innerHTML =
      '<div style="border:1px solid var(--line);border-radius:4px;padding:24px;margin-bottom:34px;background:rgba(255,255,255,.5)">' +
        '<div style="display:grid;grid-template-columns:1fr 2fr;gap:22px;margin-bottom:18px">' +
          '<div class="field" style="margin:0"><label>昵称</label>' +
            '<input id="pf-name" type="text" maxlength="24" value="' + SY.esc(p.name) + '" placeholder="显示的名字"></div>' +
          '<div class="field" style="margin:0"><label>一句话介绍</label>' +
            '<input id="pf-bio" type="text" maxlength="80" value="' + SY.esc(p.bio) + '" placeholder="比如：写产品、写人、写城市"></div>' +
        '</div>' +
        '<div style="display:flex;gap:10px">' +
          '<button class="btn btn-sm btn-primary" id="pf-save">保存</button>' +
          '<button class="btn btn-sm btn-ghost" id="pf-cancel">取消</button>' +
        '</div>' +
      '</div>';

    document.getElementById('pf-cancel').addEventListener('click', function () {
      slot.innerHTML = '';
      state.editing = false;
    });
    document.getElementById('pf-save').addEventListener('click', async function () {
      var name = document.getElementById('pf-name').value.trim();
      var bio = document.getElementById('pf-bio').value.trim();
      if (!name) { SY.toast('昵称不能为空', 'err'); return; }
      this.disabled = true;
      try {
        var saved = await SY.db.saveProfile({
          owner_id: SY.user.id,
          display_name: name,
          bio: bio || null,
          updated_at: new Date().toISOString()
        });
        state.profile = saved || { display_name: name, bio: bio };
        SY.toast('资料已保存');
        renderShell();
      } catch (err) {
        SY.toast(err.message || '保存失败', 'err');
        this.disabled = false;
      }
    });
  }

  function postRow(post, opts) {
    var isPublished = post.status === 'published';
    var href = isPublished ? 'post.html?id=' + post.id : 'write.html?id=' + post.id;
    return '<div class="manage-row" data-id="' + post.id + '">' +
      '<div class="m-main">' +
        '<a class="m-title" href="' + href + '">' + SY.esc(post.title) + '</a>' +
        '<div class="m-sub">' +
          (opts.showStatus ? '<span class="pill-status ' + (post.status === 'draft' ? 'draft' : '') + '">' + (isPublished ? '已发布' : '草稿') + '</span>' : '') +
          '<span>' + SY.esc(SY.timeAgo(post.updated_at || post.created_at)) + '</span>' +
          '<span>' + post.word_count + ' 字</span>' +
          (post.tags && post.tags.length ? '<span>' + post.tags.map(function (t) { return '#' + SY.esc(t); }).join(' ') + '</span>' : '') +
        '</div>' +
      '</div>' +
      '<div class="m-ops">' +
        '<a class="btn btn-sm btn-ghost" href="' + href + '">' + (isPublished ? '阅读' : '继续写') + '</a>' +
        '<a class="btn btn-sm btn-ghost" href="write.html?id=' + post.id + '">编辑</a>' +
        '<button class="btn btn-sm btn-ghost js-del" data-id="' + post.id + '" data-title="' + SY.esc(post.title) + '">删除</button>' +
      '</div>' +
    '</div>';
  }

  function renderPanel() {
    var panel = document.getElementById('tab-panel');
    var items;
    if (state.tab === 'saved') {
      if (!state.bookmarks.length) {
        panel.innerHTML = emptyBlock('还没有收藏', '读文章时点一下书签，就会存到这里。', 'index.html', '去读文章');
        return;
      }
      panel.innerHTML = state.bookmarks.map(function (post) {
        return '<div class="manage-row" data-id="' + post.id + '">' +
          '<div class="m-main">' +
            '<a class="m-title" href="post.html?id=' + post.id + '">' + SY.esc(post.title) + '</a>' +
            '<div class="m-sub"><span>' + SY.esc(post.owner_name || '佚名') + '</span><span>' + SY.readMinutes(post.word_count) + ' 分钟</span></div>' +
          '</div>' +
          '<div class="m-ops"><button class="btn btn-sm btn-ghost js-unbm" data-id="' + post.id + '">取消收藏</button></div>' +
        '</div>';
      }).join('');
      panel.querySelectorAll('.js-unbm').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          var id = this.getAttribute('data-id');
          this.disabled = true;
          try {
            await SY.db.toggleBookmark(Number(id), false);
            state.bookmarks = state.bookmarks.filter(function (p) { return String(p.id) !== id; });
            SY.toast('已取消收藏');
            renderShell();
          } catch (err) {
            this.disabled = false;
            SY.toast(err.message || '操作失败', 'err');
          }
        });
      });
      return;
    }

    items = state.posts.filter(function (p) { return p.status === state.tab; });
    if (!items.length) {
      panel.innerHTML = state.tab === 'draft'
        ? emptyBlock('没有草稿', '还没写完的东西会被存在这里。', 'write.html', '写一篇')
        : emptyBlock('还没有发布文章', '第一篇文章，往往只需要一个开头。', 'write.html', '开始写作');
      return;
    }
    panel.innerHTML = items.map(function (p) { return postRow(p, { showStatus: state.tab === 'draft' }); }).join('');

    panel.querySelectorAll('.js-del').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var id = this.getAttribute('data-id');
        var title = this.getAttribute('data-title');
        if (!window.confirm('删除《' + title + '》？删除后无法恢复。')) return;
        try {
          var removed = await SY.db.deletePost(Number(id));
          if (!removed.length) throw new Error('没有权限删除这篇文章');
          state.posts = state.posts.filter(function (p) { return String(p.id) !== String(id); });
          SY.toast('已删除');
          renderShell();
        } catch (err) {
          SY.toast(err.message || '删除失败', 'err');
        }
      });
    });
  }

  function emptyBlock(title, text, href, cta) {
    return '<div class="empty"><h3>' + title + '</h3><p>' + text + '</p><a class="btn btn-primary" href="' + href + '">' + cta + '</a></div>';
  }

  async function init() {
    await SY.boot();

    if (!SY.cloud) {
      page.innerHTML = '<div class="empty"><h3>暂时无法连接服务</h3><p>请检查网络后刷新页面。</p></div>';
      return;
    }
    if (!SY.requireUser()) return;

    try {
      var results = await Promise.all([
        SY.db.listMine(null),
        SY.db.getProfile(SY.user.id),
        SY.db.myBookmarks(50)
      ]);
      state.posts = results[0] || [];
      state.profile = results[1] || null;
      var bmRows = results[2] || [];
      if (bmRows.length) {
        var ids = bmRows.map(function (r) { return r.post_id; });
        var posts = await SY.db.postsByIds(ids);
        var map = {};
        posts.forEach(function (p) { map[p.id] = p; });
        state.bookmarks = ids.map(function (id) { return map[id]; }).filter(Boolean);
      } else {
        state.bookmarks = [];
      }
      renderShell();
    } catch (err) {
      page.innerHTML = '<div class="empty"><h3>加载失败</h3><p>' + SY.esc(err.message || '') + '</p></div>';
    }
  }

  init();
})();
