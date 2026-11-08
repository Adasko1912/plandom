<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { t } from '$lib/i18n';
  import CloudPage from '$lib/components/share/CloudPage.svelte';
  import { cloudConfigured } from '$lib/cloud/config';
  import { initAuth, MIN_PASSWORD_LENGTH, requestPasswordReset, session, signIn, signUp } from '$lib/cloud/auth';
  import { cloudErrorMessage } from '$lib/cloud/errors';
  import { safeNext } from '$lib/cloud/navigation';

  const configured = cloudConfigured();
  let mode = $state<'signin' | 'signup' | 'reset'>('signin');
  let email = $state('');
  let password = $state('');
  let busy = $state(false);
  let error = $state('');
  let notice = $state('');
  let next = $state('/konto');

  onMount(() => {
    next = safeNext(new URL(location.href).searchParams.get('next'));
    if (configured) initAuth().catch(e => { error = $t(cloudErrorMessage(e)); });
  });

  const titles = { signin: 'auth.signInTitle', signup: 'auth.signUpTitle', reset: 'auth.resetTitle' } as const;

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    error = ''; notice = '';
    busy = true;
    try {
      if (mode === 'signin') {
        await signIn(email, password);
        password = '';
        await goto(`${base}${next}`);
      } else if (mode === 'signup') {
        const confirm = await signUp(email, password);
        password = '';
        if (confirm) notice = $t('auth.checkEmail', { email: email.trim() });
        else await goto(`${base}${next}`);
      } else {
        await requestPasswordReset(email);
        notice = $t('auth.resetSent', { email: email.trim() });
      }
    } catch (e) { error = $t(cloudErrorMessage(e)); }
    finally { busy = false; }
  }

  function switchTo(next: typeof mode) { mode = next; error = ''; notice = ''; }
</script>

<CloudPage title={$t(titles[mode])}>
  {#if !configured}
    <p class="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{$t('cloud.error.notConfigured')}</p>
  {:else if $session && mode !== 'reset'}
    <p class="text-sm">{$t('auth.alreadySignedIn', { email: $session.user.email ?? '' })}</p>
    <a href="{base}/konto" class="inline-block rounded bg-blue-600 px-4 py-2 text-sm text-white">{$t('auth.account')}</a>
  {:else}
    <form class="space-y-3" onsubmit={submit} novalidate>
      <label class="block text-sm">{$t('auth.email')}
        <input type="email" required autocomplete="email" bind:value={email} class="mt-1 w-full rounded border border-gray-300 px-3 py-2 dark:bg-gray-700" />
      </label>
      {#if mode !== 'reset'}
        <label class="block text-sm">{$t('auth.password')}
          <input type="password" required minlength={MIN_PASSWORD_LENGTH} autocomplete={mode === 'signup' ? 'new-password' : 'current-password'} bind:value={password} class="mt-1 w-full rounded border border-gray-300 px-3 py-2 dark:bg-gray-700" />
        </label>
        {#if mode === 'signup'}<p class="text-xs text-gray-500">{$t('auth.passwordRule', { n: MIN_PASSWORD_LENGTH })}</p>{/if}
      {/if}
      <button type="submit" disabled={busy || !email.trim() || (mode !== 'reset' && !password)} class="w-full rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
        {mode === 'signin' ? $t('auth.signIn') : mode === 'signup' ? $t('auth.signUp') : $t('auth.sendReset')}
      </button>
    </form>
    {#if notice}<p role="status" class="text-sm text-green-700">{notice}</p>{/if}
    {#if error}<p role="alert" class="text-sm text-red-700">{error}</p>{/if}
    <div class="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      {#if mode !== 'signin'}<button class="text-blue-700 underline" onclick={() => switchTo('signin')}>{$t('auth.haveAccount')}</button>{/if}
      {#if mode !== 'signup'}<button class="text-blue-700 underline" onclick={() => switchTo('signup')}>{$t('auth.noAccount')}</button>{/if}
      {#if mode !== 'reset'}<button class="text-blue-700 underline" onclick={() => switchTo('reset')}>{$t('auth.forgot')}</button>{/if}
    </div>
    <p class="text-xs text-gray-500">{$t('auth.whyAccount')}</p>
  {/if}
</CloudPage>
