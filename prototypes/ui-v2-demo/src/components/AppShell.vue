<template>
  <div class="app-shell app-surface">
    <Sidebar />
    <div class="app-main">
      <Topbar />
      <main class="app-content">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup>
import Sidebar from './Sidebar.vue'
import Topbar from './Topbar.vue'
</script>

<style scoped>
.app-shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 228px minmax(0, 1fr);
}

.app-main {
  min-width: 0;
  display: grid;
  grid-template-rows: auto 1fr;
}

.app-content {
  min-width: 0;
  padding: 18px 22px 28px;
}
</style>
