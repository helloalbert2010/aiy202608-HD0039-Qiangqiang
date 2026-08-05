const root = document.getElementById('home-root');

root.outerHTML = `
  <div class="app-shell">
    <aside class="sidebar" id="sidebar"></aside>
    <div class="content">
      <header class="topbar" id="topbar"></header>
      <main class="main home-main">
        <article class="home-page">
          <section class="home-hero" aria-labelledby="home-title">
            <div class="home-hero-copy">
              <div class="home-kicker"><i data-lucide="sparkles"></i><span>MYARCHIVE · PERSONAL MEMORY</span></div>
              <h1 id="home-title"><span class="home-title-line">把今天的经历，</span><span class="home-title-line">留给未来的自己。</span></h1>
              <p>今天留下的每一道轨迹，都会在未来重新照亮你。</p>
              <dl class="home-stats" aria-label="经历统计">
                <div><dt>记录总数</dt><dd data-stat="total">0</dd></div>
                <div><dt>陪伴天数</dt><dd data-stat="days">1</dd></div>
              </dl>
            </div>

            <div class="home-planet-wrap" aria-label="可拖拽旋转的事件星球">
              <div class="home-planet-stage" id="home-atlas-stage" data-atlas-context="home">
                <div class="atlas-loading home-atlas-loading" id="home-atlas-loading">正在生成时间星球…</div>
                <div class="atlas-empty home-atlas-empty" id="home-atlas-empty" hidden>
                  <div class="atlas-empty-mark">○</div>
                  <h2>等待第一段经历</h2>
                  <p>此刻，会从第一条记录开始生长。</p>
                </div>
                <nav class="sr-only" id="home-atlas-record-links" aria-label="事件星球记录列表"></nav>
              </div>
            </div>

            <nav class="home-actions" aria-label="主要功能">
              <a class="home-action primary" href="/record">
                <span class="home-action-icon"><i data-lucide="pen-line"></i></span>
                <span class="home-action-copy"><strong>开始记录</strong><small>语音 / 文字 / 上传</small></span>
                <i data-lucide="arrow-right" class="home-action-arrow"></i>
              </a>
              <a class="home-action" href="/chat">
                <span class="home-action-icon"><i data-lucide="message-circle"></i></span>
                <span class="home-action-copy"><strong>与 AI 对话</strong><small>聊想法 / 找经历 / 写文书</small></span>
                <i data-lucide="arrow-right" class="home-action-arrow"></i>
              </a>
              <a class="home-action" href="/library">
                <span class="home-action-icon"><i data-lucide="library-big"></i></span>
                <span class="home-action-copy"><strong>我的记录</strong><small>浏览 / 筛选 / 回看</small></span>
                <i data-lucide="arrow-right" class="home-action-arrow"></i>
              </a>
            </nav>
          </section>

          <section class="home-tool-grid" aria-label="首页工具">
            <section class="home-tool jot-tool">
              <header class="home-tool-title"><i data-lucide="notebook-pen"></i><h2>今日随手记</h2></header>
              <div class="home-tool-panel jot-panel">
                <div class="jot-prompt"><i data-lucide="sparkles"></i><div><strong>此刻，最想留下什么？</strong><p>一句感受、一个念头，也可以成为经历的起点。</p></div></div>
                <form class="jot-form" id="home-note-form">
                  <textarea class="jot-input" id="home-note-input" rows="3" maxlength="2000" placeholder="记下此刻的想法…" aria-label="随手记正文"></textarea>
                  <div class="jot-actions">
                    <button class="jot-voice" id="home-note-voice" type="button" title="语音转文字" aria-label="语音转文字"><i data-lucide="mic"></i></button>
                    <span class="jot-status" id="home-note-voice-status" aria-live="polite"></span>
                    <button class="jot-save" type="submit"><i data-lucide="save"></i><span>保存</span></button>
                  </div>
                </form>
              </div>
            </section>

            <section class="home-tool calendar-tool">
              <header class="home-tool-title"><i data-lucide="calendar-days"></i><h2>日历视图</h2></header>
              <div class="home-tool-panel calendar-panel">
                <div id="home-calendar"></div>
                <a class="home-panel-link" href="/calendar">查看完整日历<i data-lucide="arrow-right"></i></a>
              </div>
            </section>

            <section class="home-tool ai-tool">
              <header class="home-tool-title"><i data-lucide="brain-circuit"></i><h2>AI 助手能帮你</h2></header>
              <div class="home-tool-panel ai-panel">
                <div class="ai-capability"><span class="capability-icon amber"><i data-lucide="message-circle"></i></span><div><strong>对话梳理</strong><p>聊聊近况，理清问题与下一步</p></div></div>
                <div class="ai-capability"><span class="capability-icon mint"><i data-lucide="file-search"></i></span><div><strong>经历检索</strong><p>按主题、能力和场景找到相关记录</p></div></div>
                <div class="ai-capability"><span class="capability-icon violet"><i data-lucide="wand-sparkles"></i></span><div><strong>素材准备</strong><p>为申请文书、简历和复盘推荐经历</p></div></div>
                <a class="home-panel-link" href="/chat">开始对话<i data-lucide="arrow-right"></i></a>
              </div>
            </section>
          </section>

          <section class="recent-section">
            <div class="section-head">
              <div><span class="section-accent"></span><h2 class="section-title">最近记录</h2></div>
              <a class="small-link" href="/library">查看全部 <i data-lucide="arrow-right"></i></a>
            </div>
            <div class="record-list" id="recent-records"></div>
          </section>
        </article>
      </main>
    </div>
  </div>
  <div id="global-modals"></div><div class="toast" id="toast"></div>
`;

await Promise.all([import('./app.js'), import('./memory-atlas.js')]);
