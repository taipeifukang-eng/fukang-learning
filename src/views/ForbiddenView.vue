<template>
  <div class="forbidden-screen">
    <div class="panel-card forbidden-card">
      <h1>403</h1>
      <p>你目前的角色沒有權限進入這個功能頁。</p>
      <RouterLink class="table-action" to="/learning">回到學習專區</RouterLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>