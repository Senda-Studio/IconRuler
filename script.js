(() => {
  "use strict";

  // Tamaños PNG que se generan a partir del logo. El favicon.ico se arma
  // aparte combinando 16/32/48. El manifest se genera como texto.
  const ICON_SPECS = [
    { name: "favicon-16x16.png", size: 16, label: "Pestaña (chica)" },
    { name: "favicon-32x32.png", size: 32, label: "Pestaña / barra" },
    { name: "apple-touch-icon.png", size: 180, label: "iOS · agregar a inicio" },
    { name: "android-chrome-192x192.png", size: 192, label: "Android / manifest" },
    { name: "android-chrome-512x512.png", size: 512, label: "Android / splash" },
  ];
  const ICO_SIZES = [16, 32, 48];

  // ---------- refs ----------
  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("fileInput");
  const browseBtn = document.getElementById("browseBtn");
  const dropzoneBody = document.getElementById("dropzoneBody");
  const dropzonePreview = document.getElementById("dropzonePreview");
  const previewImg = document.getElementById("previewImg");
  const previewFilename = document.getElementById("previewFilename");
  const spinnerOverlay = document.getElementById("spinnerOverlay");
  const spinnerLabel = document.getElementById("spinnerLabel");
  const errorNote = document.getElementById("errorNote");
  const resultsSection = document.getElementById("resultsSection");
  const resultsGrid = document.getElementById("resultsGrid");
  const downloadAllBtn = document.getElementById("downloadAllBtn");
  const copySnippetBtn = document.getElementById("copySnippetBtn");
  const resetBtn = document.getElementById("resetBtn");
  const snippetCode = document.getElementById("snippetCode");
  const specsheet = document.getElementById("specsheet");
  const topbarStatus = document.getElementById("topbarStatus");

  // { filename: Blob } acumulado del último procesamiento, para el zip
  let generatedFiles = {};

  // ---------- specsheet (regla de tamaños en el hero) ----------
  specsheet.innerHTML = ICON_SPECS.map(
    (s) => `<li><span class="spec-name">${s.label}</span><span class="spec-dim">${s.size}×${s.size}</span></li>`
  ).join("") + `<li><span class="spec-name">Legacy</span><span class="spec-dim">favicon.ico</span></li>
                <li><span class="spec-name">Manifest</span><span class="spec-dim">site.webmanifest</span></li>`;

  // ---------- helpers UI ----------
  function showError(msg) {
    errorNote.textContent = msg;
    errorNote.hidden = false;
  }
  function clearError() {
    errorNote.hidden = true;
    errorNote.textContent = "";
  }
  function setStatus(text, ok = true) {
    topbarStatus.innerHTML = `<span class="dot" style="background:${ok ? "#6ee7a3" : "#f2836b"};box-shadow:0 0 8px ${ok ? "#6ee7a3" : "#f2836b"}"></span> ${text}`;
  }
  function setSpinner(visible, label) {
    spinnerOverlay.classList.toggle("is-visible", visible);
    if (label) spinnerLabel.textContent = label;
  }

  // ---------- drag & drop wiring ----------
  ["dragenter", "dragover"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.add("is-dragover");
    })
  );
  ["dragleave", "dragend", "drop"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      if (evt !== "drop") e.preventDefault();
      dropzone.classList.remove("is-dragover");
    })
  );
  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) handleFile(file);
  });
  dropzone.addEventListener("click", (e) => {
    if (e.target === browseBtn) return; // el botón ya abre el input
    fileInput.click();
  });
  dropzone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInput.click();
    }
  });
  browseBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    fileInput.click();
  });
  fileInput.addEventListener("change", () => {
    if (fileInput.files[0]) handleFile(fileInput.files[0]);
  });

  // ---------- pipeline principal ----------
  async function handleFile(file) {
    clearError();

    if (file.type !== "image/png") {
      showError("El archivo tiene que ser un .png. Probá exportando tu logo como PNG.");
      return;
    }

    setSpinner(true, "leyendo imagen…");
    setStatus("procesando", true);

    try {
      const dataUrl = await readAsDataURL(file);
      const img = await loadImage(dataUrl);

      previewImg.src = dataUrl;
      previewFilename.textContent = `${file.name} · ${img.naturalWidth}×${img.naturalHeight}px`;
      dropzoneBody.hidden = true;
      dropzonePreview.hidden = false;

      if (img.naturalWidth < 32 || img.naturalHeight < 32) {
        showError("Ojo: la imagen es muy chica (menos de 32px). Los íconos grandes van a salir borrosos. Lo mejor es partir de 512×512px o más.");
      }

      setSpinner(true, "generando tamaños…");
      const files = await generateAllSizes(img);
      generatedFiles = files;

      setSpinner(true, "armando favicon.ico…");
      renderResults(files);
      buildSnippet();

      setSpinner(false);
      resultsSection.hidden = false;
      resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
      setStatus("listo", true);
    } catch (err) {
      console.error(err);
      setSpinner(false);
      setStatus("error", false);
      showError("Algo falló procesando la imagen. Probá con otro archivo PNG.");
    }
  }

  function readAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  // Centra la imagen sobre un lienzo cuadrado transparente para no
  // deformar logos que no llegan cuadrados.
  function squareSourceCanvas(img) {
    const side = Math.max(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = side;
    canvas.height = side;
    const ctx = canvas.getContext("2d");
    const dx = (side - img.naturalWidth) / 2;
    const dy = (side - img.naturalHeight) / 2;
    ctx.drawImage(img, dx, dy, img.naturalWidth, img.naturalHeight);
    return canvas;
  }

  // Reduce en pasos de mitad para mejor calidad que un único drawImage
  // cuando el salto de tamaño es grande (p. ej. 1024 -> 16).
  function resizeCanvas(sourceCanvas, targetSize) {
    let current = sourceCanvas;
    let currentSize = sourceCanvas.width;

    while (currentSize / 2 > targetSize) {
      const next = document.createElement("canvas");
      const nextSize = Math.round(currentSize / 2);
      next.width = nextSize;
      next.height = nextSize;
      const ctx = next.getContext("2d");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(current, 0, 0, nextSize, nextSize);
      current = next;
      currentSize = nextSize;
    }

    const final = document.createElement("canvas");
    final.width = targetSize;
    final.height = targetSize;
    const ctx = final.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(current, 0, 0, targetSize, targetSize);
    return final;
  }

  function canvasToBlob(canvas) {
    return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  }

  async function generateAllSizes(img) {
    const square = squareSourceCanvas(img);
    const files = {};

    // PNGs declarados en ICON_SPECS
    for (const spec of ICON_SPECS) {
      const canvas = resizeCanvas(square, spec.size);
      files[spec.name] = await canvasToBlob(canvas);
    }

    // Tamaños auxiliares para el .ico (no se listan sueltos)
    const icoCanvases = {};
    for (const size of ICO_SIZES) {
      icoCanvases[size] = resizeCanvas(square, size);
    }
    const icoBlob = await buildIco(icoCanvases);
    files["favicon.ico"] = icoBlob;

    // Manifest
    files["site.webmanifest"] = new Blob([buildManifest()], { type: "application/json" });

    return files;
  }

  // ---------- codificador .ico mínimo (empaqueta PNGs, formato Vista+) ----------
  async function buildIco(canvasesBySize) {
    const sizes = ICO_SIZES;
    const pngBuffers = [];
    for (const size of sizes) {
      const blob = await canvasToBlob(canvasesBySize[size]);
      pngBuffers.push(await blob.arrayBuffer());
    }

    const headerSize = 6 + sizes.length * 16;
    let offset = headerSize;
    const header = new DataView(new ArrayBuffer(headerSize));
    header.setUint16(0, 0, true); // reserved
    header.setUint16(2, 1, true); // type = icon
    header.setUint16(4, sizes.length, true);

    sizes.forEach((size, i) => {
      const entryOffset = 6 + i * 16;
      const dim = size >= 256 ? 0 : size; // 0 = 256px
      header.setUint8(entryOffset + 0, dim); // width
      header.setUint8(entryOffset + 1, dim); // height
      header.setUint8(entryOffset + 2, 0); // color palette
      header.setUint8(entryOffset + 3, 0); // reserved
      header.setUint16(entryOffset + 4, 1, true); // color planes
      header.setUint16(entryOffset + 6, 32, true); // bits per pixel
      header.setUint32(entryOffset + 8, pngBuffers[i].byteLength, true);
      header.setUint32(entryOffset + 12, offset, true);
      offset += pngBuffers[i].byteLength;
    });

    return new Blob([header.buffer, ...pngBuffers], { type: "image/x-icon" });
  }

  function buildManifest() {
    return JSON.stringify(
      {
        name: "",
        short_name: "",
        icons: [
          { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
        ],
        theme_color: "#ffffff",
        background_color: "#ffffff",
        display: "standalone",
      },
      null,
      2
    );
  }

  // ---------- render de resultados ----------
  function renderResults(files) {
    resultsGrid.innerHTML = "";

    const cards = [
      ...ICON_SPECS.map((s) => ({ name: s.name, dim: `${s.size}×${s.size}` })),
      { name: "favicon.ico", dim: "16/32/48 combinado" },
      { name: "site.webmanifest", dim: "texto" },
    ];

    for (const card of cards) {
      const blob = files[card.name];
      const url = URL.createObjectURL(blob);
      const el = document.createElement("div");
      el.className = "icon-card";

      const isImage = card.name.endsWith(".png") || card.name.endsWith(".ico");
      el.innerHTML = `
        ${isImage
          ? `<img src="${url}" alt="${card.name}">`
          : `<div class="icon-card__file-mark" aria-hidden="true" style="font-family:var(--font-mono);font-size:11px;color:var(--ink-400);width:64px;height:64px;display:flex;align-items:center;justify-content:center;border:1px dashed var(--grid-line-strong);border-radius:6px;">{ }</div>`
        }
        <span class="icon-card__name">${card.name}</span>
        <span class="icon-card__dim">${card.dim}</span>
        <a href="${url}" download="${card.name}">descargar</a>
      `;
      resultsGrid.appendChild(el);
    }
  }

  // ---------- snippet <head> ----------
  function buildSnippet() {
    const html = `<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">`;
    snippetCode.textContent = html;
  }

  copySnippetBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(snippetCode.textContent);
      const original = copySnippetBtn.textContent;
      copySnippetBtn.textContent = "¡copiado!";
      setTimeout(() => (copySnippetBtn.textContent = original), 1500);
    } catch {
      showError("No se pudo copiar automáticamente. Seleccioná el texto del snippet manualmente.");
    }
  });

  // ---------- descarga .zip ----------
  downloadAllBtn.addEventListener("click", async () => {
    if (!Object.keys(generatedFiles).length) return;
    downloadAllBtn.disabled = true;
    const originalText = downloadAllBtn.textContent;
    downloadAllBtn.textContent = "comprimiendo…";
    try {
      const zip = new JSZip();
      for (const [name, blob] of Object.entries(generatedFiles)) {
        zip.file(name, blob);
      }
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "iconos.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (err) {
      console.error(err);
      showError("No se pudo generar el .zip. Descargá los íconos uno por uno.");
    } finally {
      downloadAllBtn.disabled = false;
      downloadAllBtn.textContent = originalText;
    }
  });

  // ---------- reset ----------
  resetBtn.addEventListener("click", () => {
    generatedFiles = {};
    resultsSection.hidden = true;
    dropzonePreview.hidden = true;
    dropzoneBody.hidden = false;
    previewImg.src = "";
    fileInput.value = "";
    clearError();
    setStatus("listo", true);
    dropzone.scrollIntoView({ behavior: "smooth", block: "center" });
  });
})();
