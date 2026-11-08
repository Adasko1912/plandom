<script lang="ts">
  import { get } from 'svelte/store';
  import { t } from '$lib/i18n';
  import { modalDialog } from '$lib/utils/modalDialog';
  import { activeFloor, calibrationMode, calibrationPoints, canvasCamX, canvasCamY, setBackgroundImage, selectedTool } from '$lib/stores/project';
  import {
    DRAWING_SCALES, PLAN_FILE_LIMIT, cmPerPixelForDrawing, isPdfFile, openPdfPlan, parseDrawingScale,
    type PdfPlan,
  } from '$lib/utils/planImport';

  let { open = $bindable(false) }: { open: boolean } = $props();

  type ScaleChoice = 'calibrate' | 'custom' | `${(typeof DRAWING_SCALES)[number]}`;
  let fileName = $state('');
  let pdf = $state<PdfPlan | null>(null);
  let imageUrl = $state<string | null>(null);
  let page = $state(1);
  let preview = $state<string | null>(null);
  let scaleChoice = $state<ScaleChoice>('100');
  let customScale = $state('');
  let busy = $state(false);
  let error = $state('');
  let input = $state<HTMLInputElement>();
  let previewToken = 0;

  const floorName = $derived($activeFloor?.name ?? '');
  const customValid = $derived(parseDrawingScale(customScale) !== null);
  const ready = $derived(!busy && (!!pdf || !!imageUrl) && (scaleChoice !== 'custom' || customValid));

  async function reset() {
    previewToken++;
    await pdf?.destroy().catch(() => {});
    pdf = null; imageUrl = null; preview = null; page = 1; fileName = ''; error = '';
  }

  async function close() { await reset(); open = false; }

  async function choose(event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    (event.currentTarget as HTMLInputElement).value = '';
    if (!file) return;
    await reset();
    if (file.size > PLAN_FILE_LIMIT) { error = $t('planImport.tooLarge'); return; }
    busy = true; fileName = file.name;
    try {
      if (isPdfFile(file)) {
        pdf = await openPdfPlan(new Uint8Array(await file.arrayBuffer()));
        scaleChoice = '100';
        await showPage(1);
      } else if (/^image\/(png|jpeg|gif|webp)$/.test(file.type)) {
        imageUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        });
        preview = imageUrl;
        scaleChoice = 'calibrate';
      } else {
        error = $t('planImport.unsupported');
      }
    } catch {
      await reset();
      error = $t('planImport.unreadable');
    } finally { busy = false; }
  }

  async function showPage(n: number) {
    if (!pdf) return;
    const token = ++previewToken;
    page = n; preview = null;
    const url = await pdf.thumbnail(n);
    if (token === previewToken) preview = url;
  }

  /** PNG/JPEG/GIF stay as they are; WebP is re-encoded as PNG like the existing tracing import. */
  async function imageDataUrl(url: string): Promise<string> {
    if (/^data:image\/(?:png|jpeg|gif);base64,/.test(url)) return url;
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, Math.sqrt(16_000_000 / (image.naturalWidth * image.naturalHeight)));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.naturalWidth * scale); canvas.height = Math.round(image.naturalHeight * scale);
    canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  }

  async function place() {
    if (!ready) return;
    busy = true; error = '';
    try {
      const position = { x: get(canvasCamX), y: get(canvasCamY) };
      let dataUrl: string, scale = 1;
      if (pdf) {
        const rendered = await pdf.render(page);
        dataUrl = rendered.dataUrl;
        const ratio = scaleChoice === 'custom' ? parseDrawingScale(customScale)! : scaleChoice === 'calibrate' ? 100 : Number(scaleChoice);
        scale = cmPerPixelForDrawing(ratio, rendered.renderScale);
      } else {
        dataUrl = await imageDataUrl(imageUrl!);
      }
      setBackgroundImage({ dataUrl, position, scale, opacity: 0.5, rotation: 0, locked: false });
      const calibrate = scaleChoice === 'calibrate';
      await close();
      if (calibrate) {
        selectedTool.set('select');
        calibrationPoints.set([]);
        calibrationMode.set(true);
      }
    } catch {
      error = $t('planImport.unreadable');
    } finally { busy = false; }
  }
</script>

{#if open}
  <dialog use:modalDialog class="modal-overlay fixed inset-0 bg-black/50 z-50 flex items-center justify-center" aria-labelledby="plan-import-title"
    onclick={(e) => { if (e.target === e.currentTarget) close(); }} oncancel={(e) => { e.preventDefault(); close(); }}>
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-[460px] max-w-[calc(100vw-1rem)] max-h-[90vh] overflow-y-auto p-5 space-y-4 text-gray-700 dark:text-gray-200">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h2 id="plan-import-title" class="text-lg font-bold text-gray-800 dark:text-gray-100">{$t('planImport.title')}</h2>
          <p class="text-xs text-gray-500 dark:text-gray-400">{$t('planImport.help')}</p>
        </div>
        <button onclick={close} aria-label={$t('planImport.close')} class="rounded px-2 py-1 text-gray-500 hover:bg-gray-100">✕</button>
      </div>

      <input bind:this={input} type="file" accept="application/pdf,.pdf,image/png,image/jpeg,image/gif,image/webp" class="hidden"
        aria-label={$t('planImport.choose')} onchange={choose} />
      <button onclick={() => input?.click()} disabled={busy}
        class="w-full rounded-lg border-2 border-dashed border-blue-300 px-4 py-4 text-sm text-blue-700 hover:bg-blue-50 disabled:opacity-50">
        {fileName ? $t('planImport.chosen', { name: fileName }) : $t('planImport.choose')}
      </button>

      {#if error}<p role="alert" class="text-sm text-red-600">{error}</p>{/if}

      {#if pdf && pdf.pageCount > 1}
        <label class="block text-sm">
          {$t('planImport.page')}
          <select value={page} onchange={(e) => showPage(Number(e.currentTarget.value))} class="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm">
            {#each Array.from({ length: pdf.pageCount }, (_, i) => i + 1) as n}
              <option value={n}>{$t('planImport.pageOf', { page: n, count: pdf.pageCount })}</option>
            {/each}
          </select>
        </label>
      {/if}

      {#if preview}
        <img src={preview} alt={$t('planImport.preview')} class="max-h-56 w-full rounded border border-gray-200 bg-white object-contain" />
      {:else if busy}
        <p role="status" class="text-sm text-gray-500">{$t('planImport.reading')}</p>
      {/if}

      {#if pdf || imageUrl}
        <fieldset class="space-y-1.5">
          <legend class="text-sm font-medium">{$t('planImport.scale')}</legend>
          {#if pdf}
            {#each DRAWING_SCALES as ratio}
              <label class="flex items-center gap-2 text-sm"><input type="radio" bind:group={scaleChoice} value={`${ratio}`} /> 1:{ratio}</label>
            {/each}
            <label class="flex items-center gap-2 text-sm">
              <input type="radio" bind:group={scaleChoice} value="custom" /> {$t('planImport.customScale')}
              <input type="text" inputmode="numeric" bind:value={customScale} onfocus={() => scaleChoice = 'custom'} placeholder="1:75"
                aria-label={$t('planImport.customScale')} class="w-20 rounded border border-gray-300 px-2 py-0.5 text-sm" />
            </label>
            <p class="text-xs text-gray-500">{$t('planImport.scaleHelp')}</p>
          {/if}
          <label class="flex items-center gap-2 text-sm"><input type="radio" bind:group={scaleChoice} value="calibrate" /> {$t('planImport.calibrate')}</label>
          <p class="text-xs text-gray-500">{$t('planImport.calibrateHelp')}</p>
        </fieldset>
        {#if scaleChoice === 'custom' && customScale && !customValid}<p role="alert" class="text-xs text-red-600">{$t('planImport.badScale')}</p>{/if}
        <p class="text-xs text-gray-500">{$t('planImport.floorNote', { floor: floorName })}</p>
      {/if}

      <div class="flex justify-end gap-2 pt-1">
        <button onclick={close} class="rounded-lg px-3 py-2 text-sm hover:bg-gray-100">{$t('planImport.cancel')}</button>
        <button onclick={place} disabled={!ready} class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? $t('planImport.reading') : $t('planImport.place')}</button>
      </div>
    </div>
  </dialog>
{/if}
