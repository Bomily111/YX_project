<template>
  <div class="admin-layout">
    <aside class="admin-sidebar">
      <div class="sidebar-header">
        <h2>管理后台</h2>
        <router-link to="/" class="back-link">← 返回主界面</router-link>
      </div>
      <nav class="sidebar-nav">
        <router-link to="/admin/worksites" class="nav-item" active-class="active">工点管理</router-link>
        <router-link to="/admin/models"    class="nav-item" active-class="active">地质模型</router-link>
        <router-link to="/admin/alerts"    class="nav-item" active-class="active">告警管理</router-link>
      </nav>
    </aside>
    <main class="admin-main">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.admin-layout { display: flex; height: 100vh; background: #0a0f1a; color: #c8d8f0; font-family: "Microsoft YaHei", sans-serif; }
.admin-sidebar { width: 220px; background: #0d1322; border-right: 1px solid #1a2a44; display: flex; flex-direction: column; }
.sidebar-header { padding: 20px 16px; border-bottom: 1px solid #1a2a44; }
.sidebar-header h2 { color: #00c8ff; font-size: 18px; margin: 0 0 8px; }
.back-link { color: #5a7a9a; font-size: 12px; text-decoration: none; }
.back-link:hover { color: #00c8ff; }
.sidebar-nav { padding: 12px 0; flex: 1; }
.nav-item { display: block; padding: 12px 20px; color: #7a9aba; text-decoration: none; font-size: 14px; transition: all 0.2s; border-left: 3px solid transparent; }
.nav-item:hover { background: #111c30; color: #b0d0f0; }
.nav-item.active { background: #0f1d35; color: #00c8ff; border-left-color: #00c8ff; }
.admin-main { flex: 1; padding: 24px; overflow-y: auto; }
</style>
