<script lang="ts">
  import { t, locale } from '$lib/i18n';
  import { currentProject } from '$lib/stores/project';
  import { openMaterialLibrary } from '$lib/stores/materialLibrary';
  import type { CustomMaterial } from '$lib/models/types';
  import { customMaterialKey } from '$lib/utils/customMaterialRegistry';
  import { materialQuantity, supportsUse } from '$lib/utils/customMaterials';

  let { surface, selected, area, onPick }: {
    surface: 'wall' | 'floor';
    selected: string | undefined;
    /** Net surface in m², for the purchase estimate. */
    area?: number;
    onPick: (material: CustomMaterial) => void;
  } = $props();

  const materials = $derived(($currentProject?.customMaterials ?? []).filter(m => supportsUse(m, surface)));
  const chosen = $derived(materials.find(m => customMaterialKey(m.id) === selected));
  const estimate = $derived(chosen?.price && area ? materialQuantity(chosen, area) : null);
  const money = (v: number) => new Intl.NumberFormat($locale === 'pl' ? 'pl-PL' : $locale === 'pt' ? 'pt-BR' : 'en-GB', { maximumFractionDigits: 0 }).format(v);
</script>

<div class="space-y-1.5" role="group" aria-label={$t('materials.mine')}>
  <span class="text-xs font-medium text-gray-600 block">{$t('materials.mine')}</span>
  <div class="grid grid-cols-3 gap-1.5">
    {#each materials as m (m.id)}
      <button
        class="rounded-md border-2 text-[10px] text-center h-14 flex flex-col items-center justify-end overflow-hidden {selected === customMaterialKey(m.id) ? 'border-blue-500 ring-1 ring-blue-200' : 'border-gray-200 hover:border-gray-300'}"
        style={m.textureDataUrl ? `background: url(${m.textureDataUrl}) center/cover` : `background-color: ${m.color}`}
        title={[m.name, m.manufacturer].filter(Boolean).join(' — ')}
        aria-pressed={selected === customMaterialKey(m.id)}
        onclick={() => onPick(m)}
      ><span class="bg-white/80 rounded px-1 py-0.5 mb-0.5 text-gray-700 max-w-full truncate">{m.name}</span></button>
    {/each}
    <button
      class="rounded-md border-2 border-dashed border-blue-300 text-[10px] h-14 text-blue-700 hover:bg-blue-50"
      onclick={() => openMaterialLibrary({ surface, onAdded: onPick })}
    >+ {$t('materials.addShort')}</button>
  </div>
  {#if chosen}
    <p class="text-[11px] text-gray-500">
      {chosen.manufacturer ? `${chosen.manufacturer} · ` : ''}{chosen.tileWidth}×{chosen.tileHeight} cm
      {#if chosen.productUrl}· <a href={chosen.productUrl} target="_blank" rel="noopener noreferrer nofollow" class="text-blue-700 underline">{$t('materials.productPage')}</a>{/if}
    </p>
    {#if estimate}
      <p class="text-[11px] text-gray-600" role="status">{$t('materials.estimate', { area: estimate.area.toFixed(1), units: estimate.units ?? '—', cost: estimate.cost === null ? '—' : money(estimate.cost) })}</p>
    {/if}
  {/if}
  <button class="text-[11px] text-blue-700 underline" onclick={() => openMaterialLibrary({ surface })}>{$t('materials.manage')}</button>
</div>
