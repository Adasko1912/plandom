<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { t, locale, intlLocale } from '$lib/i18n';
  import CloudPage from '$lib/components/share/CloudPage.svelte';
  import { cloudConfigured } from '$lib/cloud/config';
  import { authReady, initAuth, isAdmin, session } from '$lib/cloud/auth';
  import { adminOverview, type AdminOverview } from '$lib/cloud/admin';
  import { cloudErrorMessage } from '$lib/cloud/errors';

  const configured = cloudConfigured();
  let overview = $state<AdminOverview | null>(null);
  let loading = $state(false);
  let error = $state('');

  const date = (value: string | null) => value ? new Date(value).toLocaleString(intlLocale($locale), { dateStyle: 'medium', timeStyle: 'short' }) : '—';

  async function load() {
    loading = true; error = '';
    try { overview = await adminOverview(); }
    catch (e) { error = $t(cloudErrorMessage(e)); overview = null; }
    finally { loading = false; }
  }

  onMount(() => {
    if (!configured) return;
    initAuth().then(() => { if ($session) void load(); }).catch(e => { error = $t(cloudErrorMessage(e)); });
  });
</script>

<CloudPage title={$t('admin.title')} wide>
  {#if !configured}
    <p class="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{$t('cloud.error.notConfigured')}</p>
  {:else if !$authReady || (loading && !overview)}
    <p class="text-sm text-gray-500" role="status">{$t('share.loading')}</p>
  {:else if !$session}
    <p class="text-sm">{$t('admin.signIn')}</p>
    <a href="{base}/logowanie?next=%2Fadmin" class="inline-block rounded bg-blue-600 px-4 py-2 text-sm text-white">{$t('auth.signIn')}</a>
  {:else if $isAdmin === false || (error && !overview)}
    <p role="alert" class="rounded-lg bg-red-50 p-3 text-sm text-red-800">{$isAdmin === false ? $t('admin.notAdmin') : error}</p>
  {:else if overview}
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {#each [[$t('admin.users'), overview.users.length], [$t('admin.projects'), overview.projects], [$t('admin.activeShares'), overview.active_shares], [$t('admin.comments'), overview.comments]] as [name, value]}
        <div class="rounded-lg border border-gray-200 p-3"><p class="text-xs text-gray-500">{name}</p><p class="text-2xl font-bold">{value}</p></div>
      {/each}
    </div>

    <section class="space-y-2" aria-labelledby="admin-users">
      <div class="flex items-center justify-between"><h2 id="admin-users" class="font-semibold">{$t('admin.users')}</h2>
        <button onclick={load} disabled={loading} class="rounded border border-gray-300 px-2 py-1 text-xs">{$t('admin.refresh')}</button></div>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="text-xs text-gray-500"><tr>
            <th class="py-1 pr-3">{$t('auth.email')}</th><th class="py-1 pr-3">{$t('admin.created')}</th><th class="py-1 pr-3">{$t('admin.lastSignIn')}</th>
            <th class="py-1 pr-3">{$t('admin.confirmed')}</th><th class="py-1 pr-3">{$t('admin.projects')}</th><th class="py-1">{$t('auth.role')}</th>
          </tr></thead>
          <tbody class="divide-y divide-gray-100">
            {#each overview.users as user}
              <tr>
                <td class="py-1 pr-3 break-all">{user.email}</td><td class="py-1 pr-3">{date(user.created_at)}</td><td class="py-1 pr-3">{date(user.last_sign_in_at)}</td>
                <td class="py-1 pr-3">{user.confirmed ? '✓' : '—'}</td><td class="py-1 pr-3">{user.projects}</td><td class="py-1">{user.admin ? $t('auth.roleAdmin') : $t('auth.roleUser')}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>

    <section class="space-y-2" aria-labelledby="admin-comments">
      <h2 id="admin-comments" class="font-semibold">{$t('admin.recentComments')}</h2>
      {#if !overview.recent_comments.length}<p class="text-sm text-gray-500">{$t('share.noComments')}</p>{/if}
      <ul class="space-y-2">
        {#each overview.recent_comments as comment}
          <li class="rounded border border-gray-200 p-2 text-sm">
            <p class="text-xs text-gray-500"><b>{comment.author_name}</b> · {comment.project} · {date(comment.created_at)}</p>
            <p class="whitespace-pre-wrap break-words">{comment.body}</p>
          </li>
        {/each}
      </ul>
    </section>
    <p class="text-xs text-gray-500">{$t('admin.help')}</p>
  {/if}
</CloudPage>
