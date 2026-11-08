<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { t } from '$lib/i18n';
  import CloudPage from '$lib/components/share/CloudPage.svelte';
  import { cloudConfigured } from '$lib/cloud/config';
  import { authReady, initAuth, isAdmin, MIN_PASSWORD_LENGTH, passwordRecovery, session, signOut, updatePassword } from '$lib/cloud/auth';
  import { cloudErrorMessage } from '$lib/cloud/errors';

  const configured = cloudConfigured();
  let resetRequested = $state(false);
  let changing = $state(false);
  let password = $state('');
  let busy = $state(false);
  let error = $state('');
  let notice = $state('');

  onMount(() => {
    resetRequested = new URL(location.href).searchParams.get('reset') === '1';
    if (configured) initAuth().catch(e => { error = $t(cloudErrorMessage(e)); });
  });

  let showPasswordForm = $derived(changing || resetRequested || $passwordRecovery);

  async function savePassword(event: SubmitEvent) {
    event.preventDefault();
    busy = true; error = ''; notice = '';
    try {
      await updatePassword(password);
      password = '';
      changing = false;
      resetRequested = false;
      history.replaceState(history.state, '', `${base}/konto`);
      notice = $t('auth.passwordChanged');
    } catch (e) { error = $t(cloudErrorMessage(e)); }
    finally { busy = false; }
  }

  async function logout() {
    busy = true; error = '';
    try { await signOut(); await goto(`${base}/logowanie`); }
    catch (e) { error = $t(cloudErrorMessage(e)); }
    finally { busy = false; }
  }
</script>

<CloudPage title={$t('auth.account')}>
  {#if !configured}
    <p class="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{$t('cloud.error.notConfigured')}</p>
  {:else if !$authReady}
    <p class="text-sm text-gray-500" role="status">{$t('share.loading')}</p>
  {:else if !$session}
    <p class="text-sm">{resetRequested ? $t('auth.resetLinkInvalid') : $t('auth.signedOut')}</p>
    <a href="{base}/logowanie" class="inline-block rounded bg-blue-600 px-4 py-2 text-sm text-white">{$t('auth.signIn')}</a>
  {:else}
    <dl class="space-y-1 text-sm">
      <div class="flex gap-2"><dt class="text-gray-500">{$t('auth.email')}:</dt><dd class="font-medium">{$session.user.email}</dd></div>
      <div class="flex gap-2"><dt class="text-gray-500">{$t('auth.role')}:</dt><dd>{$isAdmin ? $t('auth.roleAdmin') : $t('auth.roleUser')}</dd></div>
    </dl>
    {#if showPasswordForm}
      <form class="space-y-2 rounded-lg border border-gray-200 p-3" onsubmit={savePassword} novalidate>
        <label class="block text-sm">{$t('auth.newPassword')}
          <input type="password" autocomplete="new-password" minlength={MIN_PASSWORD_LENGTH} bind:value={password} class="mt-1 w-full rounded border border-gray-300 px-3 py-2 dark:bg-gray-700" />
        </label>
        <p class="text-xs text-gray-500">{$t('auth.passwordRule', { n: MIN_PASSWORD_LENGTH })}</p>
        <button type="submit" disabled={busy || !password} class="rounded bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-50">{$t('auth.savePassword')}</button>
      </form>
    {/if}
    <div class="flex flex-wrap gap-2">
      <a href="{base}/" class="rounded bg-blue-600 px-3 py-1.5 text-sm text-white">{$t('auth.myProjects')}</a>
      {#if $isAdmin}<a href="{base}/admin" class="rounded border border-gray-300 px-3 py-1.5 text-sm">{$t('admin.title')}</a>{/if}
      {#if !showPasswordForm}<button onclick={() => changing = true} class="rounded border border-gray-300 px-3 py-1.5 text-sm">{$t('auth.changePassword')}</button>{/if}
      <button onclick={logout} disabled={busy} class="rounded px-3 py-1.5 text-sm text-red-700 hover:bg-red-50">{$t('auth.signOut')}</button>
    </div>
    <p class="text-xs text-gray-500">{$t('auth.accountHelp')}</p>
  {/if}
  {#if notice}<p role="status" class="text-sm text-green-700">{notice}</p>{/if}
  {#if error}<p role="alert" class="text-sm text-red-700">{error}</p>{/if}
</CloudPage>
