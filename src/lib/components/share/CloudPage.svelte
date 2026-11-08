<script lang="ts">
  import type { Snippet } from 'svelte';
  import { base } from '$app/paths';
  import { t } from '$lib/i18n';

  let { title, wide = false, children }: { title: string; wide?: boolean; children: Snippet } = $props();
</script>

<svelte:head><title>{title} · PlanDom</title></svelte:head>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900">
  <header class="bg-gradient-to-r from-slate-800 to-slate-700 shadow-sm">
    <div class="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
      <a href={base || '/'} class="text-sm font-semibold text-white">PlanDom</a>
      <a href={base || '/'} class="text-sm text-white/70 hover:text-white">{$t('auth.backToProjects')}</a>
    </div>
  </header>
  <main class="mx-auto px-4 py-8 {wide ? 'max-w-5xl' : 'max-w-md'}">
    <div class="space-y-4 rounded-xl bg-white p-6 shadow-sm dark:bg-gray-800 text-gray-700 dark:text-gray-200">
      <h1 class="text-xl font-bold text-gray-800 dark:text-gray-100">{title}</h1>
      {@render children()}
    </div>
  </main>
</div>
