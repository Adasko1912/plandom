<script lang="ts">
  import { t, locale, type TranslationKey } from '$lib/i18n';
  import { furnitureName } from '$lib/i18n/furnitureNames';
  import { modalDialog } from '$lib/utils/modalDialog';
  import { activeFloor, addProductFurniture, currentProject, saveCustomMaterial, selectedElementId, selectedElementIds } from '$lib/stores/project';
  import type { CustomMaterial, CustomMaterialCategory, CustomMaterialUse } from '$lib/models/types';
  import { CATEGORY_DEFAULT_SIZE, MAX_CUSTOM_MATERIALS, productHost, safeProductUrl, validateCustomMaterial } from '$lib/utils/customMaterials';
  import {
    PRODUCT_KINDS, ProductFileError, loadStoredProductFile, productCatalog, productPosition, readProductFile,
    removeStoredProductFile, storeProductFile, type ProductHit, type ProductKind,
  } from '$lib/utils/productCatalog';

  let { open = $bindable(false) }: { open?: boolean } = $props();

  const PAGE = 100;
  const uid = () => (crypto.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`).replace(/-/g, '').slice(0, 16);

  let query = $state(''), shop = $state(''), kindFilter = $state(''), limit = $state(PAGE);
  let hits = $state<ProductHit[]>([]), more = $state(false);
  let busy = $state(false), fileError = $state(''), restored = false;
  let fileInput = $state<HTMLInputElement>(), widthInput = $state<HTMLInputElement>();

  let name = $state(''), link = $state(''), kind = $state<ProductKind>('imported_object');
  let width = $state<number | null>(null), depth = $state<number | null>(null), height = $state<number | null>(null);
  let done = $state(''), error = $state('');

  const catalog = $derived($productCatalog);
  const isMaterial = $derived(kind.includes(':'));
  const isPaint = $derived(kind === 'wall:paint');
  const inRange = (v: number | null, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= 1 && v <= max;
  const linkValid = $derived(!link.trim() || safeProductUrl(link) !== null);
  const sizeValid = $derived(isPaint || (isMaterial ? inRange(width, 1000) && inRange(depth, 1000) : inRange(width, 100000) && inRange(depth, 100000) && inRange(height, 100000)));
  const materialsFull = $derived(isMaterial && ($currentProject?.customMaterials?.length ?? 0) >= MAX_CUSTOM_MATERIALS);
  const formValid = $derived(!!name.trim() && !!link.trim() && linkValid && sizeValid && !materialsFull);
  const numberText = $derived(new Intl.NumberFormat($locale === 'pl' ? 'pl-PL' : $locale === 'pt' ? 'pt-BR' : 'en-GB'));

  function kindLabel(value: string): string {
    if (value === 'imported_object') return $t('products.kind.generic');
    if (value.includes(':')) return $t(`products.kind.${value.replace(':', '-')}` as TranslationKey);
    return furnitureName(value, $locale);
  }

  async function adopt(file: Blob, remember: boolean) {
    busy = true; fileError = '';
    try {
      productCatalog.set(await readProductFile(file));
      if (remember) await storeProductFile(file).catch(() => {}); // still usable until the page is closed
    } catch (problem) {
      const code = problem instanceof ProductFileError ? problem.problem : 'format';
      fileError = $t(`products.fileError.${code}` as TranslationKey);
    } finally { busy = false; }
  }

  $effect(() => {
    if (!open || restored || $productCatalog) return;
    restored = true;
    loadStoredProductFile().then(file => { if (file) return adopt(file, false); }).catch(() => {});
  });

  $effect(() => {
    const source = catalog, request = { query, shop, kind: kindFilter }, count = limit;
    if (!open || !source) { hits = []; more = false; return; }
    const timer = setTimeout(() => { const result = source.search(request, count); hits = result.hits; more = result.more; }, 120);
    return () => clearTimeout(timer);
  });

  function chooseFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement, file = input.files?.[0];
    input.value = '';
    if (file) void adopt(file, true);
  }

  async function forgetFile() {
    productCatalog.set(null);
    await removeStoredProductFile().catch(() => {});
  }

  function pick(hit: ProductHit) {
    name = hit.name; link = hit.url; kind = hit.kind;
    width = depth = height = null; done = ''; error = '';
    widthInput?.focus();
  }

  function add() {
    if (!formValid) return;
    const url = safeProductUrl(link)!, title = name.trim();
    const note = `${title}\n${url}\n${$t('products.unverified')}`;
    if (isMaterial) {
      const [use, category] = kind.split(':') as [CustomMaterialUse, CustomMaterialCategory];
      const [paintWidth, paintHeight] = CATEGORY_DEFAULT_SIZE.paint;
      const material: CustomMaterial = {
        id: uid(), name: title.slice(0, 120), category, use, color: '#bcb8b0',
        tileWidth: isPaint ? paintWidth : width!, tileHeight: isPaint ? paintHeight : depth!,
        productUrl: url, notes: note.slice(0, 2000),
      };
      try { validateCustomMaterial(material); } catch { error = $t('materials.invalid'); return; }
      saveCustomMaterial(material);
      done = $t('products.addedMaterial', { name: material.name });
    } else {
      const floor = $activeFloor;
      if (!floor) return;
      const id = addProductFurniture(kind, productPosition(floor.walls, floor.furniture.length), { width: width!, depth: depth!, height: height! }, note);
      selectedElementId.set(id);
      selectedElementIds.set(new Set([id]));
      done = $t('products.addedFurniture', { name: title });
    }
    name = ''; link = ''; width = depth = height = null; error = '';
  }

  const resetPaging = () => { limit = PAGE; };
  const close = () => { open = false; };
</script>

{#if open}
  <dialog use:modalDialog class="modal-overlay fixed inset-0 bg-black/50 z-50 flex items-center justify-center" aria-label={$t('products.title')}
    onclick={(e) => { if (e.target === e.currentTarget) close(); }} oncancel={(e) => { e.preventDefault(); close(); }}>
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-[640px] max-w-[calc(100vw-1rem)] max-h-[90vh] overflow-y-auto p-5 space-y-4 text-gray-700 dark:text-gray-200">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h2 class="text-lg font-bold text-gray-800 dark:text-gray-100">{$t('products.title')}</h2>
          <p class="text-xs text-gray-500 dark:text-gray-400">{$t('products.help')}</p>
        </div>
        <button onclick={close} aria-label={$t('planImport.close')} class="rounded px-2 py-1 text-gray-500 hover:bg-gray-100">✕</button>
      </div>

      <input bind:this={fileInput} type="file" accept=".gz,application/gzip" class="hidden" aria-label={$t('products.fileLabel')} onchange={chooseFile} />
      {#if catalog}
        <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
          <span>{$t('products.count', { count: numberText.format(catalog.size) })}</span>
          <span class="flex gap-1">
            <button onclick={() => fileInput?.click()} disabled={busy} class="rounded px-2 py-1 text-blue-700 hover:bg-blue-50 disabled:opacity-50">{$t('products.changeFile')}</button>
            <button onclick={forgetFile} disabled={busy} class="rounded px-2 py-1 text-red-700 hover:bg-red-50 disabled:opacity-50">{$t('products.removeFile')}</button>
          </span>
        </div>

        <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <input type="search" bind:value={query} oninput={resetPaging} aria-label={$t('products.search')} placeholder={$t('products.searchPlaceholder')} class="col-span-2 rounded border border-gray-300 px-2 py-1.5 text-sm" />
          <select bind:value={shop} onchange={resetPaging} aria-label={$t('products.shop')} class="rounded border border-gray-300 px-2 py-1.5 text-sm">
            <option value="">{$t('products.allShops')}</option>
            {#each catalog.shops as s}<option value={s.name}>{s.name}</option>{/each}
          </select>
          <select bind:value={kindFilter} onchange={resetPaging} aria-label={$t('products.kindFilter')} class="rounded border border-gray-300 px-2 py-1.5 text-sm">
            <option value="">{$t('products.allKinds')}</option>
            {#each PRODUCT_KINDS as k}<option value={k}>{kindLabel(k)}</option>{/each}
          </select>
        </div>

        {#if hits.length}
          <ul class="max-h-56 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-200" aria-label={$t('products.results')}>
            {#each hits as hit (hit.index)}
              <li>
                <button onclick={() => pick(hit)} class="block w-full px-2 py-1.5 text-left hover:bg-blue-50">
                  <span class="block truncate text-sm">{hit.name}</span>
                  <span class="block truncate text-xs text-gray-500">{hit.shop} · {kindLabel(hit.kind)}</span>
                </button>
              </li>
            {/each}
          </ul>
          {#if more}<button onclick={() => limit += PAGE} class="text-xs text-blue-700 underline">{$t('products.more')}</button>{/if}
        {:else}
          <p class="rounded-lg bg-slate-50 p-3 text-sm text-gray-600">{$t('products.noResults')}</p>
        {/if}
      {:else}
        <div class="space-y-2 rounded-lg bg-slate-50 p-3 text-sm text-gray-600">
          <p>{$t('products.noFile')}</p>
          <button onclick={() => fileInput?.click()} disabled={busy} class="rounded border border-blue-300 bg-white px-3 py-1.5 text-sm text-blue-700 disabled:opacity-50">{busy ? $t('products.loading') : $t('products.chooseFile')}</button>
        </div>
      {/if}
      {#if fileError}<p role="alert" class="text-sm text-red-600">{fileError}</p>{/if}

      <form novalidate class="grid grid-cols-3 gap-3 border-t border-gray-200 pt-3" onsubmit={(e) => { e.preventDefault(); add(); }}>
        <p class="col-span-3 text-xs text-gray-500">{$t('products.formHelp')}</p>
        <label class="col-span-3 block text-sm">{$t('products.name')}
          <input type="text" bind:value={name} maxlength="200" class="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm" />
        </label>
        <label class="col-span-3 block text-sm">{$t('products.link')}
          <input type="text" inputmode="url" autocomplete="off" bind:value={link} maxlength="1000" placeholder="https://" class="mt-1 w-full rounded border px-2 py-1.5 text-sm {linkValid ? 'border-gray-300' : 'border-red-400'}" />
        </label>
        {#if !linkValid}<p role="alert" class="col-span-3 -mt-2 text-xs text-red-600">{$t('materials.badLink')}</p>{/if}
        {#if link.trim() && linkValid && productHost(safeProductUrl(link) ?? undefined)}
          <a href={safeProductUrl(link)} target="_blank" rel="noopener noreferrer nofollow" class="col-span-3 -mt-2 text-xs text-blue-700 underline">{$t('materials.openLink', { host: productHost(safeProductUrl(link) ?? undefined) ?? '' })}</a>
        {/if}
        <label class="col-span-3 block text-sm">{$t('products.kindLabel')}
          <select bind:value={kind} class="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm">
            {#each PRODUCT_KINDS as k}<option value={k}>{kindLabel(k)}</option>{/each}
          </select>
        </label>
        {#if !isPaint}
          <label class="block text-sm">{isMaterial ? $t('materials.tileWidth') : $t('products.width')}
            <input bind:this={widthInput} type="number" bind:value={width} min="1" step="0.1" class="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm" />
          </label>
          <label class="block text-sm">{isMaterial ? $t('materials.tileHeight') : $t('products.depth')}
            <input type="number" bind:value={depth} min="1" step="0.1" class="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm" />
          </label>
          {#if !isMaterial}
            <label class="block text-sm">{$t('products.height')}
              <input type="number" bind:value={height} min="1" step="0.1" class="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm" />
            </label>
          {/if}
        {/if}
        {#if materialsFull}<p role="alert" class="col-span-3 text-xs text-red-600">{$t('products.materialsFull')}</p>{/if}
        {#if error}<p role="alert" class="col-span-3 text-sm text-red-600">{error}</p>{/if}
        {#if done}<p role="status" class="col-span-3 text-sm text-green-700">{done}</p>{/if}
        <div class="col-span-3 flex justify-end">
          <button type="submit" disabled={!formValid} class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{$t('products.add')}</button>
        </div>
      </form>
      <p class="text-xs text-gray-500">{$t('products.privacy')}</p>
    </div>
  </dialog>
{/if}
