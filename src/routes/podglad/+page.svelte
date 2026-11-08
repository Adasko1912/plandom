<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import { base } from '$app/paths';
  import { t, locale, intlLocale } from '$lib/i18n';
  import type { Point } from '$lib/models/types';
  import { currentProject, loadProject, setActiveFloor, viewMode, selectedElementId, selectedRoomId } from '$lib/stores/project';
  import { reviewMode, reviewPins, type ReviewPin } from '$lib/stores/review';
  import { orderedFloors } from '$lib/utils/floors';
  import { cloudConfigured } from '$lib/cloud/config';
  import { cloudErrorMessage } from '$lib/cloud/errors';
  import {
    addSharedComment, COMMENT_AUTHOR_LIMIT, COMMENT_BODY_LIMIT, loadSharedProject, sharedComments, tokenFromHash, validComment,
    type ShareComment, type SharedProject,
  } from '$lib/cloud/shares';
  import FloorPlanCanvas from '$lib/components/editor/FloorPlanCanvas.svelte';

  const NAME_KEY = 'plandom-reviewer-name';
  const configured = cloudConfigured();

  let token = $state<string | null>(null);
  let shared = $state<SharedProject | null>(null);
  let comments = $state<ShareComment[]>([]);
  let phase = $state<'loading' | 'ready' | 'missing' | 'error'>('loading');
  let error = $state('');
  let mode = $state<'2d' | '3d'>('2d');

  let author = $state('');
  let body = $state('');
  let point = $state<{ x: number; y: number; floorId: string | null } | null>(null);
  let picking = $state(false);
  let sending = $state(false);
  let formError = $state('');
  let sent = $state(false);

  let ThreeViewer: any = $state(null);
  $effect(() => {
    if (mode === '3d' && !ThreeViewer) {
      import('$lib/components/viewer3d/ThreeViewer.svelte').then(m => { ThreeViewer = m.default; }).catch(() => { mode = '2d'; });
    }
  });
  $effect(() => {
    viewMode.set(mode);
    selectedElementId.set(null);
    selectedRoomId.set(null);
  });

  let floors = $derived($currentProject ? orderedFloors($currentProject.floors).map(entry => entry.floor) : []);
  let floorName = (id: string | null) => floors.find(f => f.id === id)?.name ?? '';
  const date = (value: string) => new Date(value).toLocaleString(intlLocale($locale), { dateStyle: 'medium', timeStyle: 'short' });

  // Only the canvas can arm a pick; keep the store in step with this page.
  $effect(() => {
    reviewMode.set({ armed: picking && mode === '2d', onPick });
  });
  $effect(() => {
    const pins: ReviewPin[] = [];
    comments.forEach((c, i) => { if (c.x != null && c.y != null) pins.push({ id: c.id, floorId: c.floor_id, x: c.x, y: c.y, label: String(i + 1), resolved: c.resolved }); });
    if (point) pins.push({ id: 'new', floorId: point.floorId, x: point.x, y: point.y, label: '+', active: true });
    reviewPins.set(pins);
  });

  function onPick(p: Point, floorId: string | null) {
    point = { x: p.x, y: p.y, floorId };
    picking = false;
  }

  async function load() {
    phase = 'loading'; error = '';
    token = tokenFromHash(location.hash);
    if (!configured) { phase = 'error'; error = $t('cloud.error.notConfigured'); return; }
    if (!token) { phase = 'missing'; return; }
    try {
      const result = await loadSharedProject(token);
      if (!result) { phase = 'missing'; return; }
      // In memory only: this page never starts autosave, so nothing reaches the owner's files.
      loadProject(result.project);
      shared = result;
      comments = await sharedComments(token);
      phase = 'ready';
      await tick();
    } catch (e) {
      phase = 'error';
      error = $t(cloudErrorMessage(e));
    }
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!token || !shared) return;
    formError = ''; sent = false;
    const comment = { author, body, floorId: point?.floorId ?? null, x: point?.x ?? null, y: point?.y ?? null };
    if (!validComment(comment)) { formError = $t('review.fillIn'); return; }
    sending = true;
    try {
      await addSharedComment(token, comment);
      try { localStorage.setItem(NAME_KEY, author.trim()); } catch {}
      body = ''; point = null; sent = true;
      comments = await sharedComments(token);
    } catch (e) { formError = $t(cloudErrorMessage(e)); }
    finally { sending = false; }
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && picking) { picking = false; e.preventDefault(); }
  }

  function showComment(c: ShareComment) {
    if (c.floor_id && c.floor_id !== $currentProject?.activeFloorId) setActiveFloor(c.floor_id);
    mode = '2d';
  }

  onMount(() => {
    try { author = localStorage.getItem(NAME_KEY) ?? ''; } catch {}
    void load();
    const onHash = () => void load();
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  });
  onDestroy(() => { reviewMode.set(null); reviewPins.set([]); });
</script>

<svelte:head><title>{shared ? `${shared.name} · ` : ''}{$t('review.title')} · PlanDom</title></svelte:head>
<svelte:window onkeydown={onKeydown} />

{#if phase !== 'ready'}
  <div class="flex min-h-screen items-center justify-center bg-gray-50 p-4">
    <div class="max-w-md space-y-3 rounded-xl bg-white p-6 text-center shadow-sm">
      <h1 class="text-lg font-bold text-gray-800">{$t('review.title')}</h1>
      {#if phase === 'loading'}<p role="status" class="text-sm text-gray-500">{$t('review.loading')}</p>
      {:else if phase === 'missing'}<p role="alert" class="text-sm text-gray-700">{$t('review.missing')}</p>
      {:else}<p role="alert" class="text-sm text-red-700">{error}</p>
        <button onclick={load} class="rounded bg-blue-600 px-3 py-1.5 text-sm text-white">{$t('review.retry')}</button>{/if}
      <a href={base || '/'} class="block text-sm text-blue-700 underline">{$t('review.toApp')}</a>
    </div>
  </div>
{:else if shared}
  <div class="flex h-screen flex-col overflow-hidden">
    <header class="flex h-12 shrink-0 items-center gap-2 bg-gradient-to-r from-slate-800 to-slate-700 px-3 text-white">
      <span class="text-sm font-semibold max-sm:hidden">PlanDom</span>
      <span class="h-5 w-px bg-white/20 max-sm:hidden"></span>
      <h1 class="min-w-0 truncate text-sm font-semibold">{shared.name}</h1>
      {#if shared.label}<span class="hidden truncate rounded bg-white/15 px-2 py-0.5 text-xs sm:inline">{shared.label}</span>{/if}
      <span class="shrink-0 whitespace-nowrap rounded bg-amber-400/90 px-2 py-0.5 text-xs font-semibold text-slate-900">{$t('review.readOnly')}</span>
      <div class="ml-auto flex items-center gap-2">
        {#if floors.length > 1}
          <select aria-label={$t('floorControls.current')} value={$currentProject?.activeFloorId} onchange={(e) => setActiveFloor(e.currentTarget.value)} class="rounded bg-slate-700 px-2 py-1 text-xs">
            {#each floors as floor}<option value={floor.id}>{floor.name}</option>{/each}
          </select>
        {/if}
        <div class="flex rounded-full bg-white/15 p-0.5">
          <button onclick={() => mode = '2d'} aria-pressed={mode === '2d'} class="rounded-full px-3 py-1 text-xs font-semibold {mode === '2d' ? 'bg-white text-slate-800' : 'text-white/80'}">2D</button>
          <button onclick={() => mode = '3d'} aria-pressed={mode === '3d'} class="rounded-full px-3 py-1 text-xs font-semibold {mode === '3d' ? 'bg-white text-slate-800' : 'text-white/80'}">3D</button>
        </div>
      </div>
    </header>

    <div class="flex min-h-0 flex-1 max-md:flex-col">
      <div class="relative min-h-0 min-w-0 flex-1 isolate">
        {#if mode === '2d'}
          <FloorPlanCanvas />
          {#if picking}
            <p class="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full bg-slate-900/85 px-3 py-1.5 text-xs text-white" role="status">{$t('review.pickHint')}</p>
          {/if}
        {:else if ThreeViewer}
          <ThreeViewer />
        {:else}
          <div class="flex h-full items-center justify-center text-slate-400">{$t('shortcuts.loading3d')}</div>
        {/if}
      </div>

      <aside class="flex w-80 shrink-0 flex-col border-l border-gray-200 bg-white text-gray-700 max-md:h-[45vh] max-md:w-full max-md:border-l-0 max-md:border-t dark:bg-gray-800 dark:text-gray-200" aria-label={$t('review.panel')}>
        <div class="min-h-0 flex-1 overflow-y-auto p-3">
          <h2 class="mb-2 text-sm font-semibold">{$t('review.comments', { n: comments.length })}</h2>
          {#if !comments.length}<p class="text-xs text-gray-500">{$t('review.noComments')}</p>{/if}
          <ol class="space-y-2" aria-label={$t('share.commentList')}>
            {#each comments as c, i (c.id)}
              <li class="rounded-lg border p-2 text-sm {c.resolved ? 'border-green-200 bg-green-50/60' : 'border-gray-200'}">
                <p class="text-xs text-gray-500"><span class="font-semibold text-gray-700 dark:text-gray-200">{i + 1}. {c.author_name}</span> · {date(c.created_at)}{#if c.resolved} · <span class="text-green-700">{$t('share.resolved')}</span>{/if}</p>
                <p class="mt-1 whitespace-pre-wrap break-words">{c.body}</p>
                {#if c.x != null}
                  <button onclick={() => showComment(c)} class="mt-1 text-xs text-blue-700 underline">{$t('review.onPlan', { floor: floorName(c.floor_id) })}</button>
                {/if}
              </li>
            {/each}
          </ol>
        </div>

        {#if shared.allowComments}
          <form class="space-y-2 border-t border-gray-200 p-3" onsubmit={submit} novalidate aria-label={$t('review.addComment')}>
            <label class="block text-xs">{$t('review.name')}
              <input bind:value={author} maxlength={COMMENT_AUTHOR_LIMIT} autocomplete="name" class="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm dark:bg-gray-700" />
            </label>
            <label class="block text-xs">{$t('review.comment')}
              <textarea bind:value={body} maxlength={COMMENT_BODY_LIMIT} rows="3" class="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm dark:bg-gray-700"></textarea>
            </label>
            <div class="flex flex-wrap items-center gap-2 text-xs">
              {#if point}
                <span class="text-green-700">{$t('review.pointChosen', { floor: floorName(point.floorId) })}</span>
                <button type="button" onclick={() => point = null} class="text-red-700 underline">{$t('review.removePoint')}</button>
              {:else}
                <button type="button" onclick={() => { mode = '2d'; picking = !picking; }} aria-pressed={picking} class="rounded border px-2 py-1 {picking ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-gray-300'}">
                  {picking ? $t('review.cancelPick') : $t('review.pickPoint')}
                </button>
              {/if}
            </div>
            <button type="submit" disabled={sending} class="w-full rounded bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">{$t('review.send')}</button>
            {#if sent}<p role="status" class="text-xs text-green-700">{$t('review.sent')}</p>{/if}
            {#if formError}<p role="alert" class="text-xs text-red-700">{formError}</p>{/if}
            <p class="text-[11px] text-gray-500">{$t('review.privacy')}</p>
          </form>
        {:else}
          <p class="border-t border-gray-200 p-3 text-xs text-gray-500">{$t('review.commentsOff')}</p>
        {/if}
      </aside>
    </div>
  </div>
{/if}
