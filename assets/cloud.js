/* 拾页 · 运行时
   负责：云服务客户端初始化、会话、公共页头页脚、Markdown 渲染、数据访问助手。 */

(function () {
  'use strict';

  var PUBLIC_CONFIG = {
    endpoint: 'https://shiyeblog.app.workbuddy.host',
    oauthRelayBaseUrl: 'https://www.workbuddy.cn/v2/as/genie-baas/oauth',
    publishableKey: 'wbpk_c9dBMcVrI8gKe4QhCU9Ksy_UTCd5fSx1KYTqSdzs8MXEor0q2Pctli8'
  };

  var sdk = window.WorkBuddyCloud;
  var cloud = null;
  if (sdk && typeof sdk.createWorkBuddyCloud === 'function') {
    cloud = sdk.createWorkBuddyCloud({
      endpoint: PUBLIC_CONFIG.endpoint,
      oauthRelayBaseUrl: PUBLIC_CONFIG.oauthRelayBaseUrl,
      publishableKey: PUBLIC_CONFIG.publishableKey
    });
  }

  var SY = window.SY = {
    config: PUBLIC_CONFIG,
    cloud: cloud,
    session: null,
    user: null,
    ready: false
  };

  /* ---------------- 基础工具 ---------------- */

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function pick(value, fallback) {
    return value == null || value === '' ? fallback : value;
  }

  function fmtDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }

  function fmtShort(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }

  function timeAgo(iso) {
    if (!iso) return '';
    var diff = Date.now() - new Date(iso).getTime();
    if (isNaN(diff)) return '';
    var min = Math.floor(diff / 60000);
    if (min < 1) return '刚刚';
    if (min < 60) return min + ' 分钟前';
    var hour = Math.floor(min / 60);
    if (hour < 24) return hour + ' 小时前';
    var day = Math.floor(hour / 24);
    if (day < 30) return day + ' 天前';
    return fmtDate(iso);
  }

  function countWords(text) {
    var s = String(text || '');
    var cjk = s.match(/[\u3400-\u4dbf\u4e00-\u9fff]/g);
    var latin = s.match(/[A-Za-z0-9]+/g);
    return (cjk ? cjk.length : 0) + (latin ? latin.length : 0);
  }

  function readMinutes(words) {
    return Math.max(1, Math.ceil((words || 0) / 300));
  }

  var PALETTES = [
    ['#8d422b', '#2d1f22'],
    ['#2f5449', '#1d2a2b'],
    ['#3b4a63', '#211f2b'],
    ['#7c5c2e', '#3a2b23'],
    ['#6b3949', '#2a2430']
  ];

  function gradientFor(seed) {
    var s = String(seed || 'shiyepages');
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 9973;
    var p = PALETTES[h % PALETTES.length];
    return 'linear-gradient(140deg, ' + p[0] + ' 0%, ' + p[1] + ' 78%)';
  }

  /* ---------------- Markdown ---------------- */

  function inline(text) {
    var out = text;
    out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
    out = out.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">');
    out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    out = out.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    return out;
  }

  function markdown(src) {
    var lines = String(src || '').replace(/\r\n/g, '\n').split('\n');
    var html = [];
    var i = 0;
    var inCode = false;
    var listType = null;
    var para = [];

    function flushPara() {
      if (para.length) {
        html.push('<p>' + inline(esc(para.join(' '))) + '</p>');
        para = [];
      }
    }
    function closeList() {
      if (listType) {
        html.push('</' + listType + '>');
        listType = null;
      }
    }
    function openList(type) {
      if (listType === type) return;
      closeList();
      html.push('<' + type + '>');
      listType = type;
    }

    while (i < lines.length) {
      var line = lines[i];

      if (/^```/.test(line.trim())) {
        if (!inCode) {
          flushPara(); closeList();
          html.push('<pre><code>');
          inCode = true;
        } else {
          html.push('</code></pre>');
          inCode = false;
        }
        i++;
        continue;
      }
      if (inCode) {
        html.push(esc(line));
        i++;
        continue;
      }

      if (/^\s*$/.test(line)) { flushPara(); closeList(); i++; continue; }
      if (/^\s*(---|\*\*\*)\s*$/.test(line)) { flushPara(); closeList(); html.push('<hr>'); i++; continue; }

      var h = line.match(/^(#{1,4})\s+(.*)$/);
      if (h) {
        flushPara(); closeList();
        var level = Math.min(3, Math.max(2, h[1].length));
        html.push('<h' + level + '>' + inline(esc(h[2])) + '</h' + level + '>');
        i++;
        continue;
      }

      if (/^>\s?/.test(line)) {
        flushPara(); closeList();
        var quote = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) {
          quote.push(lines[i].replace(/^>\s?/, ''));
          i++;
        }
        html.push('<blockquote><p>' + inline(esc(quote.join(' '))) + '</p></blockquote>');
        continue;
      }

      var ul = line.match(/^\s*[-*+]\s+(.*)$/);
      if (ul) {
        flushPara(); openList('ul');
        html.push('<li>' + inline(esc(ul[1])) + '</li>');
        i++;
        continue;
      }
      var ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
      if (ol) {
        flushPara(); openList('ol');
        html.push('<li>' + inline(esc(ol[1])) + '</li>');
        i++;
        continue;
      }

      closeList();
      para.push(line.trim());
      i++;
    }

    flushPara();
    closeList();
    if (inCode) html.push('</code></pre>');
    return html.join('\n');
  }

  function plainText(src, maxLen) {
    var t = String(src || '')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/^#{1,4}\s+/gm, '')
      .replace(/[*_>`#-]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (maxLen && t.length > maxLen) t = t.slice(0, maxLen) + '…';
    return t;
  }

  /* ---------------- 提示 ---------------- */

  function toast(message, kind) {
    var root = document.getElementById('toast-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'toast-root';
      document.body.appendChild(root);
    }
    var el = document.createElement('div');
    el.className = 'toast' + (kind === 'err' ? ' err' : '');
    el.textContent = message;
    root.appendChild(el);
    setTimeout(function () {
      el.style.transition = 'opacity .3s ease, transform .3s ease';
      el.style.opacity = '0';
      el.style.transform = 'translateY(8px)';
      setTimeout(function () { el.remove(); }, 320);
    }, 2600);
  }

  /* ---------------- 会话 ---------------- */

  function rawEmail() {
    var u = SY.user;
    if (!u) return '';
    if (u.email) return u.email;
    if (u.raw && typeof u.raw.email === 'string') return u.raw.email;
    return '';
  }

  function displayName() {
    if (SY.user && SY.user.name) return SY.user.name;
    var email = rawEmail();
    if (email) return email.split('@')[0];
    return '未命名作者';
  }

  function avatarHtml(user, extraClass) {
    var cls = 'avatar' + (extraClass ? ' ' + extraClass : '');
    if (user && user.avatarUrl) {
      return '<span class="' + cls + '"><img src="' + esc(user.avatarUrl) + '" alt=""></span>';
    }
    var initial = displayNameOf(user).slice(0, 1);
    return '<span class="' + cls + '">' + esc(initial) + '</span>';
  }

  function displayNameOf(user) {
    return user && user.name ? user.name : '我';
  }

  async function handleOAuthCallback() {
    var url = new URL(location.href);
    if (!url.searchParams.has('code') && !url.searchParams.has('error')) return null;

    var provider = url.searchParams.get('provider');
    if (provider !== 'workbuddy' && provider !== 'wechat') {
      return { error: '登录回调缺少有效的登录方式，请重新登录。' };
    }
    var handler = provider === 'workbuddy'
      ? cloud.auth.handleWorkBuddyCallback
      : cloud.auth.handleWechatWebCallback;
    if (typeof handler !== 'function') {
      return { error: '当前环境暂不支持该登录方式，请换一种方式登录。' };
    }
    var res = await handler.call(cloud.auth);
    if (res && res.error) return { error: res.error.message || '登录未完成，请重试。' };
    if (res && res.data) {
      ['code', 'state', 'provider'].forEach(function (key) { url.searchParams.delete(key); });
      history.replaceState(null, '', url.pathname + url.search + url.hash);
      return { session: res.data };
    }
    return null;
  }

  async function loadSession() {
    if (!cloud) return null;
    try {
      var res = await cloud.auth.getSession();
      if (res && res.data) {
        SY.session = res.data;
        SY.user = res.data.user || null;
      } else {
        SY.session = null;
        SY.user = null;
      }
    } catch (e) {
      SY.session = null;
      SY.user = null;
    }
    return SY.session;
  }

  SY.isSignedIn = function () { return !!SY.user; };
  SY.avatarHtml = avatarHtml;
  SY.displayName = displayName;

  SY.refreshSession = async function () {
    await loadSession();
    renderAccountArea();
    document.dispatchEvent(new CustomEvent('sy:auth', { detail: { user: SY.user } }));
    return SY.session;
  };

  /* ---------------- 页头 / 页脚 ---------------- */

  var NAV_ITEMS = [
    { key: 'home', label: '发现', href: 'index.html' },
    { key: 'me', label: '我的', href: 'me.html' }
  ];

  function renderChrome() {
    var mount = document.getElementById('topbar');
    var active = document.body.getAttribute('data-nav') || '';
    if (mount) {
      var links = NAV_ITEMS.map(function (item) {
        return '<a href="' + item.href + '" class="' + (active === item.key ? 'active' : '') + '">' + item.label + '</a>';
      }).join('');
      mount.innerHTML =
        '<header class="topbar"><div class="wrap topbar-inner">' +
          '<a class="brand" href="index.html"><span>拾页</span><span class="dot"></span><small>Shiye</small></a>' +
          '<nav class="nav-links">' + links + '</nav>' +
          '<div class="topbar-right">' +
            '<a class="btn btn-sm btn-primary" href="write.html">写文章</a>' +
            '<span id="account-area"></span>' +
          '</div>' +
        '</div></header>';
    }

    var footMount = document.getElementById('footer');
    if (footMount) {
      footMount.innerHTML =
        '<footer class="footer wrap">' +
          '<div class="f-main">' +
            '<div class="f-brand">拾页 · 慢读与慢写</div>' +
            '<div>一个安静的写作与阅读角落 · 内容由作者本人发布</div>' +
          '</div>' +
          '<div class="f-links">' +
            '<a href="index.html#about">关于</a>' +
            '<a href="index.html#principles">原则</a>' +
            '<a href="index.html#method">慢读方法</a>' +
            '<a href="index.html#faq">问答</a>' +
            '<a href="https://jasperian0122-ux.github.io/shiye/" target="_blank" rel="noopener">公开页</a>' +
          '</div>' +
        '</footer>';
    }
  }

  function renderAccountArea() {
    var area = document.getElementById('account-area');
    if (!area) return;
    if (SY.user) {
      area.innerHTML = '<a class="user-chip" href="me.html" title="个人主页">' +
        avatarHtml(SY.user) + '<span>' + esc(displayName()) + '</span></a>';
    } else {
      area.innerHTML = '<a class="btn btn-sm" href="login.html">登录</a>';
    }
  }

  /* ---------------- 启动 ---------------- */

  SY.boot = async function () {
    renderChrome();
    if (!cloud) {
      document.documentElement.setAttribute('data-sdk', 'missing');
      var area = document.getElementById('account-area');
      if (area) area.innerHTML = '<span style="font-size:12px;color:var(--accent)">服务未连接</span>';
      return null;
    }
    var callbackResult = await handleOAuthCallback();
    if (callbackResult && callbackResult.error) {
      SY.authError = callbackResult.error;
    }
    await loadSession();
    renderAccountArea();
    if (SY.user && !SY.user.name) {
      try {
        var profileRes = await cloud.auth.getUser();
        if (profileRes && profileRes.data) {
          SY.user = Object.assign({}, SY.user, profileRes.data);
          SY.session = Object.assign({}, SY.session, { user: SY.user });
          renderAccountArea();
        }
      } catch (e) { /* 拿不到资料时退回匿名称呼 */ }
    }
    SY.ready = true;
    document.dispatchEvent(new CustomEvent('sy:auth', { detail: { user: SY.user } }));
    return SY.session;
  };

  SY.requireUser = function () {
    if (SY.user) return true;
    var next = encodeURIComponent(location.pathname.split('/').pop() + location.search);
    location.replace('login.html?next=' + next);
    return false;
  };

  SY.signOut = async function () {
    if (!cloud) return;
    try {
      await cloud.auth.signOut();
    } catch (e) { /* 忽略：本地会话仍会被清空 */ }
    SY.session = null;
    SY.user = null;
    renderAccountArea();
    toast('已退出登录');
    document.dispatchEvent(new CustomEvent('sy:auth', { detail: { user: null } }));
  };

  /* ---------------- 数据访问 ---------------- */

  function unwrap(res, fallbackMessage) {
    if (res && res.error) {
      var err = new Error(res.error.message || fallbackMessage || '请求失败');
      err.code = res.error.code;
      err.kind = res.error.kind;
      throw err;
    }
    return res ? res.data : null;
  }

  SY.db = {
    listPublished: async function (limit) {
      var res = await cloud.database
        .from('posts')
        .select('id, owner_id, owner_name, title, subtitle, excerpt, cover_url, tags, word_count, published_at, created_at')
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(limit || 30);
      return unwrap(res, '加载文章失败') || [];
    },
    getPost: async function (id) {
      var res = await cloud.database
        .from('posts')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      return unwrap(res, '加载文章失败');
    },
    listMine: async function (status) {
      if (!SY.user) return [];
      var query = cloud.database
        .from('posts')
        .select('*')
        .eq('owner_id', SY.user.id)
        .order('updated_at', { ascending: false });
      if (status) query = query.eq('status', status);
      var res = await query;
      return unwrap(res, '加载我的文章失败') || [];
    },
    createPost: async function (row) {
      var res = await cloud.database.from('posts').insert(row).select();
      return (unwrap(res, '保存失败') || [])[0] || null;
    },
    updatePost: async function (id, patch) {
      var res = await cloud.database.from('posts').update(patch).eq('id', id).select();
      var rows = unwrap(res, '更新失败') || [];
      return rows[0] || null;
    },
    deletePost: async function (id) {
      var res = await cloud.database.from('posts').delete().eq('id', id).select();
      return unwrap(res, '删除失败') || [];
    },
    getProfile: async function (ownerId) {
      var res = await cloud.database.from('profiles').select('*').eq('owner_id', ownerId).maybeSingle();
      return unwrap(res, '加载作者信息失败');
    },
    saveProfile: async function (row) {
      var res = await cloud.database.from('profiles').upsert(row).select();
      return (unwrap(res, '保存资料失败') || [])[0] || null;
    },
    myBookmarks: async function (limit) {
      if (!SY.user) return [];
      var query = cloud.database.from('bookmarks')
        .select('post_id, created_at')
        .eq('owner_id', SY.user.id)
        .order('created_at', { ascending: false })
        .limit(limit || 50);
      var res = await query;
      return unwrap(res, '加载收藏失败') || [];
    },
    countLikes: async function (postId) {
      var res = await cloud.database.from('likes').select('id', { count: 'exact', head: true }).eq('post_id', postId);
      return res && typeof res.count === 'number' ? res.count : 0;
    },
    countBookmarks: async function (postId) {
      var res = await cloud.database.from('bookmarks').select('id', { count: 'exact', head: true }).eq('post_id', postId);
      return res && typeof res.count === 'number' ? res.count : 0;
    },
    isLiked: async function (postId) {
      if (!SY.user) return false;
      var res = await cloud.database.from('likes').select('id').eq('post_id', postId).eq('owner_id', SY.user.id).maybeSingle();
      return !!(res && res.data);
    },
    isBookmarked: async function (postId) {
      if (!SY.user) return false;
      var res = await cloud.database.from('bookmarks').select('id').eq('post_id', postId).eq('owner_id', SY.user.id).maybeSingle();
      return !!(res && res.data);
    },
    toggleLike: async function (postId, on) {
      if (on) {
        var res = await cloud.database.from('likes').insert({ post_id: postId });
        return unwrap(res, '点赞失败');
      }
      var del = await cloud.database.from('likes').delete().eq('post_id', postId).eq('owner_id', SY.user.id);
      return unwrap(del, '取消点赞失败');
    },
    toggleBookmark: async function (postId, on) {
      if (on) {
        var res = await cloud.database.from('bookmarks').insert({ post_id: postId });
        return unwrap(res, '收藏失败');
      }
      var del = await cloud.database.from('bookmarks').delete().eq('post_id', postId).eq('owner_id', SY.user.id);
      return unwrap(del, '取消收藏失败');
    },
    postsByIds: async function (ids) {
      if (!ids.length) return [];
      var res = await cloud.database.from('posts').select('*').in('id', ids);
      return unwrap(res, '加载失败') || [];
    }
  };

  /* ---------------- 导出工具 ---------------- */

  SY.esc = esc;
  SY.pick = pick;
  SY.fmtDate = fmtDate;
  SY.fmtShort = fmtShort;
  SY.timeAgo = timeAgo;
  SY.countWords = countWords;
  SY.readMinutes = readMinutes;
  SY.gradientFor = gradientFor;
  SY.markdown = markdown;
  SY.plainText = plainText;
  SY.toast = toast;

  SY.renderPostRow = function (post, index) {
    var tags = (post.tags || []).map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('');
    return '<a class="post-row" href="post.html?id=' + esc(post.id) + '">' +
      '<div class="idx">' + String(index).padStart(2, '0') + '</div>' +
      '<div>' +
        '<h3 class="title">' + esc(post.title) + '</h3>' +
        '<p class="excerpt">' + esc(post.excerpt || plainText(post.content, 90)) + '</p>' +
        '<div class="tags">' + tags + '</div>' +
      '</div>' +
      '<div class="row-meta">' +
        '<div>' + esc(post.owner_name || '佚名') + '</div>' +
        '<div>' + esc(fmtShort(post.published_at || post.created_at)) + ' · ' + readMinutes(post.word_count) + ' 分钟</div>' +
      '</div>' +
    '</a>';
  };
})();
