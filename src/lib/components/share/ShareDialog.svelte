<script lang="ts">
  import { get } from 'svelte/store';
  import { base } from '$app/paths';
  import { t, locale, intlLocale, type TranslationKey } from '$lib/i18n';
  import { modalDialog } from '$lib/utils/modalDialog';
  import { currentProject, setActiveFloor } from '$lib/stores/project';
  import { reviewPins } from '$lib/stores/review';
  import { cloudConfigured } from '$lib/cloud/config';
  import { authReady, initAuth, session } from '$lib/cloud/auth';
  import { cloudErrorMessage } from '$lib/cloud/errors';
  import {
    cloudProject, createShare, deleteComment, listShares, ownerComments, publishProject, revokeShare,
    setCommentResolved, setShareComments, shareUrl, SHARE_LABEL_LIMIT, type DroppedPart, type ShareComment, type ShareLink,
  } from '$lib/cloud/shares';

  let { open = $bindable(false) }: { open?: boolean } = $props();

  const configured = cloudConfigured();
  let projectRowId = $state<string | null>(null);
  let updatedAt = $state<string | null>(null);
  let links = $state<ShareLink[]>([]);
  let comments = $state<ShareComment[]>([]);
  let loading = $state(false);
  let busy = $state(false);
  let error = $state('');
  let notice = $state('');
  let dropped = $state<DroppedPart[]>([]);
  let copied = $state<string | null>(null);

  let label = $state('');
  let allowComments = $state(true);
  let expiry = $state<'0' | '7' | '30'>('0');

  const date = (value: string | null) => value ? new Date(value).toLocaleString(intlLocale($locale), { dateStyle: 'medium', timeStyle: 'short' }) : '';
  const active = (link: ShareLink) => !link.revoked_at && (!link.expires_at || new Date(link.expires_at) > new Date());
  let openComments = $derived(comments.filter(c => !c.resolved).length);

  $effect(() => { if (open) void refresh(); });

  async function refresh() {
    error = ''; notice = '';
    if (!configured) return;
    loading = true;
    try {
      await initAuth();
      const project = get(currentProject);
      if (!get(session) || !project) return;
      const row = await cloudProject(project.id);
      projectRowId = row?.id ?? null;
      updatedAt = row?.updated_at ?? null;
      if (projectRowId) [links, comments] = await Promise.all([listShares(projectRowId), ownerComments(projectRowId)]);
      else { links = []; comments = []; }
    } catch (e) { error = $t(cloudErrorMessage(e)); }
    finally { loading = false; }
  }

  async function publish(): Promise<string> {
    const project = get(currentProject);
    if (!project) throw new Error('no project');
    const result = await publishProject(project);
    projectRowId = result.id;
    dropped = result.dropped;
    updatedAt = new Date().toISOString();
    return result.id;
  }

  async function create() {
    busy = true; error = ''; notice = '';
    try {
      const id = await publish();
      const link = await createShare(id, { label, allowComments, expiresInDays: Number(expiry) || null });
      links = [link, ...links];
      label = '';
      await copy(link.token);
    } catch (e) { error = $t(cloudErrorMessage(e)); }
    finally { busy = false; }
  }

  async function update() {
    busy = true; error = ''; notice = '';
    try { await publish(); notice = $t('share.updated'); }
    catch (e) { error = $t(cloudErrorMessage(e)); }
    finally { busy = false; }
  }

  async function copy(token: string) {
    try { await navigator.clipboard.writeText(shareUrl(token)); copied = token; setTimeout(() => { if (copied === token) copied = null; }, 2500); }
    catch { copied = null; }
  }

  async function revoke(link: ShareLink) {
    busy = true; error = '';
    try { await revokeShare(link.token); links = links.map(l => l.token === link.token ? { ...l, revoked_at: new Date().toISOString() } : l); }
    catch (e) { error = $t(cloudErrorMessage(e)); }
    finally { busy = false; }
  }

  async function toggleComments(link: ShareLink) {
    busy = true; error = '';
    try { await setShareComments(link.token, !link.allow_comments); links = links.map(l => l.token === link.token ? { ...l, allow_comments: !l.allow_comments } : l); }
    catch (e) { error = $t(cloudErrorMessage(e)); }
    finally { busy = false; }
  }

  async function resolve(comment: ShareComment) {
    error = '';
    try { await setCommentResolved(comment.id, !comment.resolved); comments = comments.map(c => c.id === comment.id ? { ...c, resolved: !c.resolved } : c); showPins(); }
    catch (e) { error = $t(cloudErrorMessage(e)); }
  }

  async function remove(comment: ShareComment) {
    error = '';
    try { await deleteComment(comment.id); comments = comments.filter(c => c.id !== comment.id); showPins(); }
    catch (e) { error = $t(cloudErrorMessage(e)); }
  }

  let pinsShown = $state(false);
  function showPins(activeId?: string) {
    if (!pinsShown && !activeId) return;
    pinsShown = true;
    let n = 0;
    reviewPins.set(comments.flatMap(c => (n++, c.x != null && c.y != null ? [{ id: c.id, floorId: c.floor_id, x: c.x, y: c.y, label: String(n), resolved: c.resolved, active: c.id === activeId }] : [])));
  }
  function hidePins() { pinsShown = false; reviewPins.set([]); }

  function showOnPlan(comment: ShareComment) {
    if (comment.floor_id) setActiveFloor(comment.floor_id);
    showPins(comment.id);
    close();
  }

  function close() { open = false; }
  let loginHref = $derived(`${base}/logowanie?next=${encodeURIComponent(`/editor?id=${$currentProject?.id ?? ''}`)}`);
</script>

{#if open}
  <dialog use:modalDialog class="modal-overlay fixed inset-0 bg-black/50 z-50 flex items-center justify-center" aria-label={$t('share.title')}
    onclick={(e) => { if (e.target === e.currentTarget) close(); }} oncancel={(e) => { e.preventDefault(); close(); }}>
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-[560px] max-w-[calc(100vw-1rem)] max-h-[90vh] overflow-y-auto p-5 space-y-4 text-gray-700 dark:text-gray-200">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h2 class="text-lg font-bold text-gray-800 dark:text-gray-100">{$t('share.title')}</h2>
          <p class="text-xs text-gray-500 dark:text-gray-400">{$t('share.help')}</p>
        </div>
        <button onclick={close} aria-label={$t('planImport.close')} class="rounded px-2 py-1 text-gray-500 hover:bg-gray-100">✕</button>
      </div>

      {#if !configured}
        <p class="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{$t('cloud.error.notConfigured')}</p>
      {:else if loading || !$authReady}
        <p class="text-sm text-gray-500" role="status">{$t('share.loading')}</p>
      {:else if !$session}
        <div class="rounded-lg bg-blue-50 p-3 text-sm text-blue-900 space-y-2">
          <p>{$t('share.signInFirst')}</p>
          <a href={loginHref} class="inline-block rounded bg-blue-600 px-3 py-1.5 text-white">{$t('auth.signIn')}</a>
        </div>
      {:else}
        <section class="space-y-2 rounded-lg border border-gray-200 p-3" aria-labelledby="share-new">
          <h3 id="share-new" class="text-sm font-semibold">{$t('share.newLink')}</h3>
          <label class="block text-xs">{$t('share.label')}
            <input bind:value={label} maxlength={SHARE_LABEL_LIMIT} placeholder={$t('share.labelPlaceholder')} class="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm dark:bg-gray-700" />
          </label>
          <div class="flex flex-wrap items-center gap-4 text-xs">
            <label class="flex items-center gap-1.5"><input type="checkbox" bind:checked={allowComments} /> {$t('share.allowComments')}</label>
            <label class="flex items-center gap-1.5">{$t('share.expires')}
              <select bind:value={expiry} class="rounded border border-gray-300 px-1 py-0.5 dark:bg-gray-700">
                <option value="0">{$t('share.never')}</option>
                <option value="7">{$t('share.days', { n: 7 })}</option>
                <option value="30">{$t('share.days', { n: 30 })}</option>
              </select>
            </label>
          </div>
          <div class="flex flex-wrap gap-2">
            <button onclick={create} disabled={busy} class="rounded bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-50">{$t('share.create')}</button>
            {#if projectRowId}
              <button onclick={update} disabled={busy} class="rounded border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50">{$t('share.update')}</button>
            {/if}
          </div>
          <p class="text-xs text-gray-500">{updatedAt ? $t('share.sharedVersion', { date: date(updatedAt) }) : $t('share.notShared')}</p>
          {#if dropped.length}
            <p class="text-xs text-amber-800">{$t('share.dropped', { parts: dropped.map(p => $t(`share.dropped.${p}` as TranslationKey)).join(', ') })}</p>
          {/if}
        </section>

        {#if links.length}
          <section aria-labelledby="share-links" class="space-y-2">
            <h3 id="share-links" class="text-sm font-semibold">{$t('share.links')}</h3>
            <ul class="divide-y divide-gray-100 rounded-lg border border-gray-200" aria-label={$t('share.links')}>
              {#each links as link (link.token)}
                <li class="flex flex-wrap items-center gap-2 p-2 text-sm">
                  <div class="min-w-0 flex-1">
                    <p class="truncate font-medium">{link.label || $t('share.unnamed')}</p>
                    <p class="text-xs text-gray-500">
                      {date(link.created_at)} ·
                      {#if link.revoked_at}{$t('share.revoked')}{:else if !active(link)}{$t('share.expired')}{:else if link.expires_at}{$t('share.until', { date: date(link.expires_at) })}{:else}{$t('share.active')}{/if}
                      {#if active(link)} · {link.allow_comments ? $t('share.commentsOn') : $t('share.commentsOff')}{/if}
                    </p>
                  </div>
                  {#if active(link)}
                    <button onclick={() => copy(link.token)} class="rounded border border-gray-300 px-2 py-1 text-xs">{copied === link.token ? $t('share.copied') : $t('share.copy')}</button>
                    <a href={shareUrl(link.token)} target="_blank" rel="noopener noreferrer" class="rounded border border-gray-300 px-2 py-1 text-xs">{$t('share.open')}</a>
                    <button onclick={() => toggleComments(link)} disabled={busy} class="rounded border border-gray-300 px-2 py-1 text-xs">{link.allow_comments ? $t('share.disableComments') : $t('share.enableComments')}</button>
                    <button onclick={() => revoke(link)} disabled={busy} class="rounded px-2 py-1 text-xs text-red-700 hover:bg-red-50">{$t('share.revoke')}</button>
                  {/if}
                </li>
              {/each}
            </ul>
          </section>
        {/if}

        <section aria-labelledby="share-comments" class="space-y-2">
          <div class="flex items-center justify-between gap-2">
            <h3 id="share-comments" class="text-sm font-semibold">{$t('share.comments', { n: openComments })}</h3>
            {#if comments.some(c => c.x != null)}
              {#if pinsShown}
                <button onclick={hidePins} class="text-xs text-blue-700 underline">{$t('share.hidePins')}</button>
              {:else}
                <button onclick={() => { pinsShown = true; showPins(); close(); }} class="text-xs text-blue-700 underline">{$t('share.showPins')}</button>
              {/if}
            {/if}
          </div>
          {#if !comments.length}
            <p class="text-xs text-gray-500">{$t('share.noComments')}</p>
          {:else}
            <ol class="space-y-2" aria-label={$t('share.commentList')}>
              {#each comments as comment, i (comment.id)}
                <li class="rounded-lg border p-2 text-sm {comment.resolved ? 'border-green-200 bg-green-50/50 opacity-70' : 'border-gray-200'}">
                  <p class="text-xs text-gray-500"><span class="font-semibold text-gray-700 dark:text-gray-200">{i + 1}. {comment.author_name}</span> · {date(comment.created_at)}</p>
                  <p class="mt-1 whitespace-pre-wrap break-words">{comment.body}</p>
                  <div class="mt-1 flex flex-wrap gap-3 text-xs">
                    {#if comment.x != null}<button onclick={() => showOnPlan(comment)} class="text-blue-700 underline">{$t('share.showOnPlan')}</button>{/if}
                    <label class="flex items-center gap-1"><input type="checkbox" checked={comment.resolved} onchange={() => resolve(comment)} /> {$t('share.resolved')}</label>
                    <button onclick={() => remove(comment)} class="text-red-700 underline">{$t('share.deleteComment')}</button>
                  </div>
                </li>
              {/each}
            </ol>
          {/if}
        </section>
        <p class="text-xs text-gray-500">{$t('share.signedInAs', { email: $session.user.email ?? '' })} · <a href="{base}/konto" class="underline">{$t('auth.account')}</a></p>
      {/if}

      {#if notice}<p role="status" class="text-sm text-green-700">{notice}</p>{/if}
      {#if error}<p role="alert" class="text-sm text-red-700">{error}</p>{/if}
    </div>
  </dialog>
{/if}
