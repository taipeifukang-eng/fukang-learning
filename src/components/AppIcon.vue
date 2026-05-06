<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    name: string
    size?: number
    strokeWidth?: number
  }>(),
  {
    size: 18,
    strokeWidth: 1.8,
  },
)

const paths: Record<string, string[]> = {
  menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  grid: ['M3 13h8V3H3z', 'M13 21h8V11h-8z', 'M13 3v6h8V3z', 'M3 21h8v-6H3z'],
  users: ['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M23 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
  shield: ['M12 2l7 4v6c0 5-3.5 9.74-7 10-3.5-.26-7-5-7-10V6l7-4z', 'M9 12l2 2 4-4'],
  video: ['M23 7l-7 5 7 5V7z', 'M1 5h15v14H1z'],
  book: ['M4 19.5A2.5 2.5 0 0 1 6.5 17H20', 'M6.5 2H20v20H6.5A2.5 2.5 0 0 0 4 24V4a2 2 0 0 1 2-2z'],
  building: ['M3 22h18', 'M5 22V6l7-4 7 4v16', 'M9 9h.01', 'M15 9h.01', 'M9 13h.01', 'M15 13h.01', 'M9 17h.01', 'M15 17h.01'],
  sun: ['M12 4V2', 'M12 22v-2', 'M4.93 4.93 3.52 3.52', 'M20.48 20.48l-1.41-1.41', 'M4 12H2', 'M22 12h-2', 'M4.93 19.07l-1.41 1.41', 'M20.48 3.52l-1.41 1.41', 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z'],
  moon: ['M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z'],
  palette: ['M12 2a10 10 0 1 0 0 20c1.1 0 2-.9 2-2v-1a2 2 0 0 1 2-2h2a4 4 0 0 0 4-4 10 10 0 0 0-10-11Z'],
  logout: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5', 'M21 12H9'],
  chevronDown: ['M6 9l6 6 6-6'],
  line: ['M19 3H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h3v4l5-4h6a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z'],
  play: ['M5 3l14 9-14 9V3z'],
  check: ['M20 6 9 17l-5-5'],
}

const iconPaths = computed(() => paths[props.name] ?? paths.grid)
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    :stroke-width="strokeWidth"
    aria-hidden="true"
  >
    <path v-for="path in iconPaths" :key="path" :d="path" />
  </svg>
</template>