<script lang="ts">
  import { t, locale, type TranslationKey } from '$lib/i18n';
  import { modalDialog } from '$lib/utils/modalDialog';
  import { currentProject, removeCustomMaterial, saveCustomMaterial } from '$lib/stores/project';
  import { materialLibraryRequest } from '$lib/stores/materialLibrary';
  import type { CustomMaterial, CustomMaterialCategory, CustomMaterialPriceUnit, CustomMaterialUse } from '$lib/models/types';
  import {
    CATEGORY_DEFAULT_SIZE, MATERIAL_CATEGORIES, MATERIAL_USES, PRICE_UNITS, MAX_CUSTOM_MATERIALS,
    prepareMaterialPhoto, productHost, safeProductUrl, validateCustomMaterial,
  } from '$lib/utils/customMaterials';

  const uid = () => (crypto.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`).replace(/-/g, '').slice(0, 16);

  let request = $derived($materialLibraryRequest);
  let materials = $derived($currentProject?.customMaterials ?? []);
  let editing = $state<string | null>(null); // material id, 'new' or null (list)
  let confirmRemove = $state<string | null>(null);

  // Form fields
  let name = $state('');
  let manufacturer = $state('');
  let link = $state('');
  let category = $state<CustomMaterialCategory>('panel');
  let use = $state<CustomMaterialUse>('wall');
  let photo = $state<string | undefined>(undefined);
  let color = $state('#cccccc');
  let tileWidth = $state<number | null>(60);
  let tileHeight = $state<number | null>(120);
  let priceAmount = $state<number | null>(null);
  let priceUnit = $state<CustomMaterialPriceUnit>('m2');
  let coverage = $state<number | null>(null);
  let notes = $state('');
  let busy = $state(false);
  let error = $state('');
  let fileInput = $state<HTMLInputElement>();

  // Opened from a surface picker: go straight to the form.
  let lastRequest: unknown = null;
  $effect(() => {
    if (request !== lastRequest) { lastRequest = request; if (request?.onAdded) startNew(); }
  });

  const linkValid = $derived(!link.trim() || safeProductUrl(link) !== null);
  const sizeValid = $derived([tileWidth, tileHeight].every(v => typeof v === 'number' && v >= 1 && v <= 1000));
  const formValid = $derived(!!name.trim() && linkValid && sizeValid && (priceAmount === null || priceAmount >= 0));

  function startNew() {
    editing = 'new'; error = '';
    name = ''; manufacturer = ''; link = ''; notes = ''; photo = undefined; color = '#cccccc';
    category = request?.surface === 'floor' ? 'flooring' : 'panel';
    use = request?.surface ?? 'wall';
    [tileWidth, tileHeight] = CATEGORY_DEFAULT_SIZE[category];
    priceAmount = null; priceUnit = 'm2'; coverage = null;
  }

  function startEdit(m: CustomMaterial) {
    editing = m.id; error = '';
    name = m.name; manufacturer = m.manufacturer ?? ''; link = m.productUrl ?? ''; notes = m.notes ?? '';
    category = m.category; use = m.use; photo = m.textureDataUrl; color = m.color;
    tileWidth = m.tileWidth; tileHeight = m.tileHeight;
    priceAmount = m.price?.amount ?? null; priceUnit = m.price?.unit ?? 'm2'; coverage = m.coverage ?? null;
  }

  function changeCategory(next: CustomMaterialCategory) {
    const wasDefault = [tileWidth, tileHeight].join() === CATEGORY_DEFAULT_SIZE[category].join();
    category = next;
    if (wasDefault) [tileWidth, tileHeight] = CATEGORY_DEFAULT_SIZE[next];
    if (next === 'flooring' && use === 'wall') use = 'floor';
    if (next === 'paint') { priceUnit = 'litre'; use = 'wall'; }
  }

  async function choosePhoto(event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    (event.currentTarget as HTMLInputElement).value = '';
    if (!file) return;
    busy = true; error = '';
    try {
      const prepared = await prepareMaterialPhoto(file);
      photo = prepared.dataUrl; color = prepared.color;
    } catch { error = $t('materials.photoFailed'); }
    finally { busy = false; }
  }

  function save() {
    if (!formValid) return;
    const material: CustomMaterial = {
      id: editing && editing !== 'new' ? editing : uid(),
      name: name.trim(), category, use, color,
      tileWidth: tileWidth!, tileHeight: tileHeight!,
      ...(manufacturer.trim() ? { manufacturer: manufacturer.trim() } : {}),
      ...(safeProductUrl(link) ? { productUrl: safeProductUrl(link)! } : {}),
      ...(photo && category !== 'paint' ? { textureDataUrl: photo } : {}),
      ...(priceAmount !== null ? { price: { amount: priceAmount, unit: priceUnit } } : {}),
      ...(coverage ? { coverage } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };
    try { validateCustomMaterial(material); } catch { error = $t('materials.invalid'); return; }
    const isNew = editing === 'new';
    saveCustomMaterial(material);
    editing = null;
    if (isNew && request?.onAdded) { request.onAdded(material); close(); }
  }

  function close() { editing = null; confirmRemove = null; error = ''; materialLibraryRequest.set(null); }

  const priceText = (m: CustomMaterial) => m.price
    ? `${new Intl.NumberFormat($locale === 'pl' ? 'pl-PL' : $locale === 'pt' ? 'pt-BR' : 'en-GB', { maximumFractionDigits: 2 }).format(m.price.amount)} zł / ${$t(`materials.unit.${m.price.unit}` as TranslationKey)}`
    : '';
</script>

{#if request}
  <dialog use:modalDialog class="modal-overlay fixed inset-0 bg-black/50 z-50 flex items-center justify-center" aria-label={$t('materials.title')}
    onclick={(e) => { if (e.target === e.currentTarget) close(); }} oncancel={(e) => { e.preventDefault(); if (editing) editing = null; else close(); }}>
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-[520px] max-w-[calc(100vw-1rem)] max-h-[90vh] overflow-y-auto p-5 space-y-4 text-gray-700 dark:text-gray-200">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h2 id="materials-title" class="text-lg font-bold text-gray-800 dark:text-gray-100">{editing === 'new' ? $t('materials.addTitle') : editing ? $t('materials.editTitle') : $t('materials.title')}</h2>
          <p class="text-xs text-gray-500 dark:text-gray-400">{$t('materials.help')}</p>
        </div>
        <button onclick={close} aria-label={$t('planImport.close')} class="rounded px-2 py-1 text-gray-500 hover:bg-gray-100">✕</button>
      </div>

      {#if !editing}
        {#if materials.length}
          <ul class="divide-y divide-gray-100 rounded-lg border border-gray-200" aria-label={$t('materials.list')}>
            {#each materials as m (m.id)}
              <li class="flex items-center gap-3 p-2">
                <div class="h-12 w-12 shrink-0 rounded border border-gray-200" style={m.textureDataUrl ? `background: url(${m.textureDataUrl}) center/cover` : `background-color: ${m.color}`} aria-hidden="true"></div>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium">{m.name}</p>
                  <p class="truncate text-xs text-gray-500">
                    {[m.manufacturer, `${m.tileWidth}×${m.tileHeight} cm`, priceText(m)].filter(Boolean).join(' · ')}
                  </p>
                  {#if m.productUrl}<a href={m.productUrl} target="_blank" rel="noopener noreferrer nofollow" class="text-xs text-blue-700 underline">{$t('materials.openLink', { host: productHost(m.productUrl) ?? '' })}</a>{/if}
                </div>
                {#if confirmRemove === m.id}
                  <button onclick={() => { removeCustomMaterial(m.id); confirmRemove = null; }} class="rounded bg-red-600 px-2 py-1 text-xs text-white">{$t('materials.confirmRemove')}</button>
                  <button onclick={() => confirmRemove = null} class="rounded px-2 py-1 text-xs">{$t('planImport.cancel')}</button>
                {:else}
                  <button onclick={() => startEdit(m)} aria-label={$t('materials.editNamed', { name: m.name })} class="rounded px-2 py-1 text-xs text-blue-700 hover:bg-blue-50">{$t('materials.edit')}</button>
                  <button onclick={() => confirmRemove = m.id} aria-label={$t('materials.removeNamed', { name: m.name })} class="rounded px-2 py-1 text-xs text-red-700 hover:bg-red-50">{$t('materials.remove')}</button>
                {/if}
              </li>
            {/each}
          </ul>
        {:else}
          <p class="rounded-lg bg-slate-50 p-3 text-sm text-gray-600">{$t('materials.empty')}</p>
        {/if}
        <p class="text-xs text-gray-500">{$t('materials.chatTip')}</p>
        <div class="flex justify-end">
          <button onclick={startNew} disabled={materials.length >= MAX_CUSTOM_MATERIALS} class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">+ {$t('materials.add')}</button>
        </div>
      {:else}
        <form novalidate class="grid grid-cols-2 gap-3" onsubmit={(e) => { e.preventDefault(); save(); }}>
          <label class="col-span-2 block text-sm">{$t('materials.name')}
            <input type="text" bind:value={name} required maxlength="120" placeholder={$t('materials.namePlaceholder')} class="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm" />
          </label>
          <label class="block text-sm">{$t('materials.manufacturer')}
            <input type="text" bind:value={manufacturer} maxlength="120" class="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm" />
          </label>
          <label class="block text-sm">{$t('materials.link')}
            <input type="text" inputmode="url" autocomplete="off" bind:value={link} maxlength="1000" placeholder="https://" class="mt-1 w-full rounded border px-2 py-1.5 text-sm {linkValid ? 'border-gray-300' : 'border-red-400'}" />
          </label>
          {#if !linkValid}<p role="alert" class="col-span-2 -mt-2 text-xs text-red-600">{$t('materials.badLink')}</p>{/if}
          <label class="block text-sm">{$t('materials.category')}
            <select value={category} onchange={(e) => changeCategory(e.currentTarget.value as CustomMaterialCategory)} class="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm">
              {#each MATERIAL_CATEGORIES as c}<option value={c}>{$t(`materials.category.${c}` as TranslationKey)}</option>{/each}
            </select>
          </label>
          <label class="block text-sm">{$t('materials.use')}
            <select bind:value={use} class="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm">
              {#each MATERIAL_USES as u}<option value={u}>{$t(`materials.use.${u}` as TranslationKey)}</option>{/each}
            </select>
          </label>

          {#if category === 'paint'}
            <label class="col-span-2 flex items-center gap-2 text-sm">{$t('materials.paintColor')}
              <input type="color" bind:value={color} class="h-8 w-12 rounded border border-gray-200" />
            </label>
          {:else}
            <div class="col-span-2 flex items-center gap-3">
              <div class="h-16 w-16 shrink-0 rounded border border-gray-200" style={photo ? `background: url(${photo}) center/cover` : `background-color: ${color}`} aria-hidden="true"></div>
              <div class="space-y-1">
                <input bind:this={fileInput} type="file" accept="image/jpeg,image/png,image/webp" class="hidden" aria-label={$t('materials.photo')} onchange={choosePhoto} />
                <button type="button" onclick={() => fileInput?.click()} disabled={busy} class="rounded border border-blue-300 px-3 py-1.5 text-sm text-blue-700 disabled:opacity-50">{photo ? $t('materials.changePhoto') : $t('materials.photo')}</button>
                <p class="text-xs text-gray-500">{$t('materials.photoHelp')}</p>
              </div>
            </div>
            <label class="block text-sm">{$t('materials.tileWidth')}
              <input type="number" bind:value={tileWidth} min="1" max="1000" step="0.1" class="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm" />
            </label>
            <label class="block text-sm">{$t('materials.tileHeight')}
              <input type="number" bind:value={tileHeight} min="1" max="1000" step="0.1" class="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm" />
            </label>
          {/if}

          <label class="block text-sm">{$t('materials.price')}
            <input type="number" bind:value={priceAmount} min="0" step="0.01" class="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm" />
          </label>
          <label class="block text-sm">{$t('materials.priceUnit')}
            <select bind:value={priceUnit} class="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm">
              {#each PRICE_UNITS as u}<option value={u}>{$t(`materials.unit.${u}` as TranslationKey)}</option>{/each}
            </select>
          </label>
          {#if priceUnit === 'package' || priceUnit === 'litre'}
            <label class="col-span-2 block text-sm">{priceUnit === 'litre' ? $t('materials.coverageLitre') : $t('materials.coveragePackage')}
              <input type="number" bind:value={coverage} min="0.01" step="0.01" class="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm" />
            </label>
          {/if}
          <label class="col-span-2 block text-sm">{$t('materials.notes')}
            <textarea bind:value={notes} rows="2" maxlength="2000" class="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"></textarea>
          </label>
          {#if error}<p role="alert" class="col-span-2 text-sm text-red-600">{error}</p>{/if}
          <div class="col-span-2 flex justify-end gap-2">
            <button type="button" onclick={() => editing = null} class="rounded-lg px-3 py-2 text-sm hover:bg-gray-100">{$t('planImport.cancel')}</button>
            <button type="submit" disabled={!formValid || busy} class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{$t('materials.save')}</button>
          </div>
        </form>
      {/if}
    </div>
  </dialog>
{/if}
