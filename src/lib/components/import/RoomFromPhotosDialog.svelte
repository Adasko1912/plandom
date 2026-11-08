<script lang="ts">
  import { get } from 'svelte/store';
  import { locale, t } from '$lib/i18n';
  import { itemDetailLabels } from '$lib/i18n/itemDetailLabels';
  import { modalDialog } from '$lib/utils/modalDialog';
  import { canvasCamX, canvasCamY, commitItemDetails, currentProject, activeFloor, selectedRoomId } from '$lib/stores/project';
  import { projectSettings, WALL_PRESETS, WALL_PRESET_THICKNESS, newWallSize, type WallPreset } from '$lib/stores/settings';
  import { openAISettings } from '$lib/stores/aiKeys';
  import { getSnapshots } from '$lib/stores/versionHistory';
  import { attachItemPhoto, checkPhotoStorage, prepareItemPhoto, type PreparedPhoto } from '$lib/services/itemPhotos';
  import { ROOM_TYPES } from '$lib/utils/itemDetails';
  import { validateOpenAIConfig } from '$lib/utils/openaiClient';
  import { addRoomFromDimensions, validRoomDimensions, ROOM_MAX_HEIGHT, ROOM_MAX_SIDE, ROOM_MIN_HEIGHT, ROOM_MIN_SIDE } from '$lib/utils/roomFromDimensions';
  import { estimateRoomFromPhotos, MAX_ANALYSIS_PHOTOS, type RoomEstimate } from '$lib/utils/roomPhotoAnalysis';
  import type { TranslationKey } from '$lib/i18n';

  let { open = $bindable(false), onOpenSettings }: { open: boolean; onOpenSettings?: () => void } = $props();

  const wallPresetLabels: Record<WallPreset, TranslationKey> = {
    exterior: 'wallPreset.exterior', loadBearing: 'wallPreset.loadBearing', partition: 'wallPreset.partition',
  };

  let mode = $state<'manual' | 'ai'>('manual');
  let name = $state('');
  let roomType = $state('');
  let length = $state<number | null>(null);
  let width = $state<number | null>(null);
  let height = $state<number | null>(null);
  let wallPreset = $state<WallPreset>('partition');
  let photos = $state<PreparedPhoto[]>([]);
  let hint = $state('');
  let estimate = $state<RoomEstimate | null>(null);
  let busy = $state(false);
  let analysing = $state(false);
  let error = $state('');
  let input = $state<HTMLInputElement>();
  let controller: AbortController | null = null;

  $effect(() => {
    if (open) {
      const settings = get(projectSettings);
      height = newWallSize(settings).height;
      wallPreset = settings.wallPreset ?? 'partition';
    }
  });

  const dims = $derived({ length: length ?? NaN, width: width ?? NaN, height: height ?? NaN });
  const valid = $derived(validRoomDimensions(dims));
  const area = $derived(valid ? (dims.length * dims.width / 10000).toFixed(2).replace('.', $locale === 'en' ? '.' : ',') : null);
  const providerReady = $derived.by(() => {
    try { validateOpenAIConfig($openAISettings); return true; } catch { return false; }
  });

  function reset() {
    controller?.abort(); controller = null;
    mode = 'manual'; name = ''; roomType = ''; length = width = null; photos = []; hint = ''; estimate = null; error = '';
    busy = analysing = false;
  }
  function close() { reset(); open = false; }

  const photoUrl = (p: PreparedPhoto) => `data:${/\.png$/i.test(p.name) ? 'image/png' : 'image/jpeg'};base64,${p.data}`;

  async function addPhotos(event: Event) {
    const files = [...((event.currentTarget as HTMLInputElement).files ?? [])];
    (event.currentTarget as HTMLInputElement).value = '';
    if (!files.length) return;
    busy = true; error = '';
    try {
      for (const file of files.slice(0, Math.max(0, 12 - photos.length))) photos = [...photos, await prepareItemPhoto(file)];
    } catch {
      error = $t('roomFromPhotos.photoFailed');
    } finally { busy = false; }
  }

  async function analyse() {
    if (!photos.length) { error = $t('roomFromPhotos.needPhoto'); return; }
    analysing = true; error = ''; estimate = null;
    controller = new AbortController();
    try {
      const result = await estimateRoomFromPhotos(get(openAISettings), photos.slice(0, MAX_ANALYSIS_PHOTOS).map(photoUrl), get(locale), hint, fetch, controller.signal);
      estimate = result;
      if (result.name && !name.trim()) name = result.name;
      if (result.roomType && !roomType) roomType = result.roomType;
      if (result.length !== null) length = result.length;
      if (result.width !== null) width = result.width;
      if (result.height !== null) height = result.height;
    } catch (e) {
      error = `${$t('roomFromPhotos.aiFailed')} ${e instanceof Error ? e.message : ''}`.trim();
    } finally { analysing = false; controller = null; }
  }

  async function create() {
    if (!valid || busy) return;
    busy = true; error = '';
    try {
      const id = addRoomFromDimensions({
        center: { x: get(canvasCamX), y: get(canvasCamY) }, name: name.trim() || $t('roomFromPhotos.defaultName'),
        roomType: roomType || null, thickness: WALL_PRESET_THICKNESS[wallPreset], ...dims,
      });
      if (!id) { error = $t('roomFromPhotos.notEnclosed'); return; }
      const floorId = get(activeFloor)?.id;
      if (floorId && photos.length) {
        const target = { floorId, kind: 'rooms' as const, id };
        try {
          for (const photo of photos) {
            const project = get(currentProject)!;
            const next = attachItemPhoto(project, target, photo);
            checkPhotoStorage(project, next, await getSnapshots(project.id), await navigator.storage?.estimate?.().catch(() => undefined));
            commitItemDetails(project, next, 'Added room photo');
          }
        } catch {
          error = $t('roomFromPhotos.photosNotAttached');
          return;
        }
      }
      selectedRoomId.set(id);
      close();
    } finally { busy = false; }
  }
</script>

{#if open}
  <dialog use:modalDialog class="modal-overlay fixed inset-0 bg-black/50 z-50 flex items-center justify-center" aria-labelledby="room-photos-title"
    onclick={(e) => { if (e.target === e.currentTarget) close(); }} oncancel={(e) => { e.preventDefault(); close(); }}>
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-[480px] max-w-[calc(100vw-1rem)] max-h-[90vh] overflow-y-auto p-5 space-y-4 text-gray-700 dark:text-gray-200">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h2 id="room-photos-title" class="text-lg font-bold text-gray-800 dark:text-gray-100">{$t('roomFromPhotos.title')}</h2>
          <p class="text-xs text-gray-500 dark:text-gray-400">{$t('roomFromPhotos.help')}</p>
        </div>
        <button onclick={close} aria-label={$t('planImport.close')} class="rounded px-2 py-1 text-gray-500 hover:bg-gray-100">✕</button>
      </div>

      <div role="radiogroup" aria-label={$t('roomFromPhotos.mode')} class="grid grid-cols-2 gap-2">
        <button role="radio" aria-checked={mode === 'manual'} onclick={() => mode = 'manual'}
          class="rounded-lg border px-3 py-2 text-left text-sm {mode === 'manual' ? 'border-blue-400 bg-blue-50 text-slate-800' : 'border-gray-200 hover:bg-gray-50'}">
          <span class="block font-medium">✏️ {$t('roomFromPhotos.manual')}</span>
          <span class="block text-xs text-gray-500">{$t('roomFromPhotos.manualHelp')}</span>
        </button>
        <button role="radio" aria-checked={mode === 'ai'} onclick={() => mode = 'ai'}
          class="rounded-lg border px-3 py-2 text-left text-sm {mode === 'ai' ? 'border-blue-400 bg-blue-50 text-slate-800' : 'border-gray-200 hover:bg-gray-50'}">
          <span class="block font-medium">✨ {$t('roomFromPhotos.ai')}</span>
          <span class="block text-xs text-gray-500">{$t('roomFromPhotos.aiHelp')}</span>
        </button>
      </div>

      <section class="space-y-2" aria-label={$t('roomFromPhotos.photos')}>
        <input bind:this={input} type="file" multiple accept="image/jpeg,image/png,.jpg,.jpeg,.png" class="hidden" aria-label={$t('roomFromPhotos.addPhotos')} onchange={addPhotos} />
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-medium">{$t('roomFromPhotos.photosCount', { count: photos.length })}</h3>
          <button onclick={() => input?.click()} disabled={busy} class="rounded border border-blue-300 px-3 py-1.5 text-sm text-blue-700 disabled:opacity-50">{$t('roomFromPhotos.addPhotos')}</button>
        </div>
        {#if photos.length}
          <div class="grid grid-cols-4 gap-2">
            {#each photos as photo, i (photo.name + i)}
              <div class="relative">
                <img src={photoUrl(photo)} alt={$t('itemPhotos.alt', { number: i + 1 })} class="h-16 w-full rounded object-cover" />
                <button onclick={() => photos = photos.filter((_, j) => j !== i)} aria-label={$t('itemPhotos.removeLabel', { number: i + 1 })}
                  class="absolute right-0.5 top-0.5 rounded bg-white/90 px-1 text-xs text-red-700">✕</button>
              </div>
            {/each}
          </div>
        {/if}
        <p class="text-xs text-gray-500">{mode === 'ai' ? $t('roomFromPhotos.aiPhotosHelp') : $t('roomFromPhotos.photosHelp')}</p>
      </section>

      {#if mode === 'ai'}
        <section class="space-y-2 rounded-lg bg-slate-50 p-3 dark:bg-gray-700/50">
          {#if providerReady}
            <label class="block text-sm">{$t('roomFromPhotos.hint')}
              <textarea bind:value={hint} rows="2" maxlength="500" placeholder={$t('roomFromPhotos.hintPlaceholder')} class="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"></textarea>
            </label>
            <button onclick={analyse} disabled={analysing || !photos.length} class="w-full rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
              {analysing ? $t('roomFromPhotos.analysing') : $t('roomFromPhotos.analyse')}
            </button>
            <p class="text-xs text-gray-500">{$t('roomFromPhotos.privacy')}</p>
          {:else}
            <p class="text-sm">{$t('roomFromPhotos.noProvider')}</p>
            {#if onOpenSettings}<button onclick={() => { close(); onOpenSettings?.(); }} class="text-sm text-blue-700 underline">{$t('roomFromPhotos.openSettings')}</button>{/if}
          {/if}
          {#if estimate}
            <div role="status" class="rounded border border-violet-200 bg-white p-2 text-xs dark:bg-gray-800">
              <p class="font-medium">{$t(`roomFromPhotos.confidence.${estimate.confidence}` as TranslationKey)}</p>
              {#if estimate.notes}<p>{estimate.notes}</p>{/if}
              <p class="mt-1 text-gray-500">{$t('roomFromPhotos.checkValues')}</p>
            </div>
          {/if}
        </section>
      {/if}

      <section class="grid grid-cols-2 gap-3">
        <label class="col-span-2 block text-sm">{$t('roomFromPhotos.name')}
          <input type="text" bind:value={name} maxlength="80" placeholder={$t('roomFromPhotos.defaultName')} class="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm" />
        </label>
        <label class="col-span-2 block text-sm">{$t('roomFromPhotos.type')}
          <select bind:value={roomType} class="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm">
            <option value="">{$t('roomFromPhotos.typeNone')}</option>
            {#each ROOM_TYPES as type}<option value={type}>{$t(itemDetailLabels[type])}</option>{/each}
          </select>
        </label>
        <label class="block text-sm">{$t('roomFromPhotos.length')}
          <input type="number" bind:value={length} min={ROOM_MIN_SIDE} max={ROOM_MAX_SIDE} step="1" inputmode="numeric" class="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm" />
        </label>
        <label class="block text-sm">{$t('roomFromPhotos.width')}
          <input type="number" bind:value={width} min={ROOM_MIN_SIDE} max={ROOM_MAX_SIDE} step="1" inputmode="numeric" class="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm" />
        </label>
        <label class="block text-sm">{$t('roomFromPhotos.height')}
          <input type="number" bind:value={height} min={ROOM_MIN_HEIGHT} max={ROOM_MAX_HEIGHT} step="1" inputmode="numeric" class="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm" />
        </label>
        <label class="block text-sm">{$t('roomFromPhotos.walls')}
          <select bind:value={wallPreset} class="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm">
            {#each WALL_PRESETS as preset}<option value={preset}>{$t(wallPresetLabels[preset], { thickness: WALL_PRESET_THICKNESS[preset] })}</option>{/each}
          </select>
        </label>
        <p class="col-span-2 text-xs text-gray-500">{area ? $t('roomFromPhotos.area', { area }) : $t('roomFromPhotos.limits', { min: ROOM_MIN_SIDE, max: ROOM_MAX_SIDE })}</p>
      </section>

      {#if error}<p role="alert" class="text-sm text-red-600">{error}</p>{/if}

      <div class="flex justify-end gap-2">
        <button onclick={close} class="rounded-lg px-3 py-2 text-sm hover:bg-gray-100">{$t('planImport.cancel')}</button>
        <button onclick={create} disabled={!valid || busy} class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{$t('roomFromPhotos.create')}</button>
      </div>
    </div>
  </dialog>
{/if}
