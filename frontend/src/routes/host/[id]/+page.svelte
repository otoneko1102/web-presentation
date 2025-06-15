<script>
  import { page } from "$app/stores";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { socket } from "$lib/socket";
  import { PUBLIC_BACKEND_URL } from "$env/static/public";
  import { slide } from "svelte/transition";

  const presentationId = $page.params.id;
  const hostKey = $page.url.searchParams.get("key");
  const pdfUrl = `${PUBLIC_BACKEND_URL}/public/presentations/${presentationId}.pdf`;
  const viewerUrl = `${$page.url.origin}/present/${presentationId}`;

  let canvasElement;
  let pdfDoc = null;
  let currentPage = 1;
  let pageCount = 0;
  let isLoading = true;
  let error = "";
  let qrCodeDataUrl = "";
  let isQrModalVisible = false;
  let isSharePanelOpen = true;

  onMount(() => {
    if (!hostKey) {
      error = "アクセスキーがありません。正しいURLからアクセスしてください。";
      isLoading = false;
      return;
    }

    if (!socket.connected) socket.connect();

    const fpPromise = FingerprintJS.load();
    fpPromise
      .then((fp) => fp.get())
      .then((result) => {
        const visitorId = result.visitorId;
        socket.emit("join", {
          room: presentationId,
          isHost: true,
          hostKey,
          fingerprint: visitorId,
        });
      });

    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js`;

    const loadingTask = pdfjsLib.getDocument(pdfUrl);
    loadingTask.promise
      .then((pdf) => {
        pdfDoc = pdf;
        pageCount = pdf.numPages;
        isLoading = false;
        renderPage(currentPage);
        generateQrCode();
      })
      .catch((err) => {
        error = "PDFファイルの読み込みに失敗しました。";
        isLoading = false;
      });

    socket.on("auth_error", (data) => {
      error = data.message;
      isLoading = false;
    });

    socket.on("presentation_terminated", () => {
      error =
        "プレゼンテーションは終了、または無効になりました。ページをリロードしたか、長時間経過した可能性があります。";
      isLoading = false;
    });
  });

  async function generateQrCode() {
    try {
      qrCodeDataUrl = await QRCode.toDataURL(viewerUrl, {
        width: 512,
        margin: 2,
        errorCorrectionLevel: "H",
      });
    } catch (err) {
      console.error("QRコードの生成に失敗しました", err);
    }
  }

  async function renderPage(num) {
    if (!pdfDoc || isLoading || error) return;
    const page = await pdfDoc.getPage(num);
    const viewport = page.getViewport({ scale: 1.2 });
    const context = canvasElement.getContext("2d");
    canvasElement.height = viewport.height;
    canvasElement.width = viewport.width;
    await page.render({ canvasContext: context, viewport: viewport }).promise;
  }

  function changePage(newPage) {
    if (newPage < 1 || newPage > pageCount) return;
    currentPage = newPage;
    renderPage(currentPage);
    socket.emit("change_page", { room: presentationId, page: currentPage });
  }

  function copyUrl() {
    navigator.clipboard
      .writeText(viewerUrl)
      .then(() => alert("視聴者用URLをコピーしました！"));
  }

  function terminatePresentation() {
    if (confirm("本当にこのプレゼンテーションを終了しますか？")) {
      socket.emit("terminate_presentation", { room: presentationId });
      alert("プレゼンテーションを終了しました。");
      goto("/");
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="modal-overlay"
  class:visible={isQrModalVisible}
  on:click={() => (isQrModalVisible = false)}
>
  <div class="modal-content" on:click|stopPropagation>
    <img src={qrCodeDataUrl} alt="参加者用URLのQRコード" />
  </div>
</div>

<div class="host-container">
  <header>
    <h1>ホストコントロール</h1>
    <button
      class="terminate-btn"
      on:click={terminatePresentation}
      disabled={isLoading || !!error}>プレゼンを終了</button
    >
  </header>

  <main class="main-content">
    {#if isLoading}
      <p class="loading-text">接続中...</p>
    {:else if error}
      <p class="error-text">{error}</p>
    {:else}
      <div class="top-overlay-panel">
        <div class="collapsible-panel">
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="panel-header"
            on:click={() => (isSharePanelOpen = !isSharePanelOpen)}
          >
            <strong>参加者情報</strong>
            <div class="arrow" class:rotated={!isSharePanelOpen}>▼</div>
          </div>
          {#if isSharePanelOpen}
            <div class="panel-content" transition:slide={{ duration: 200 }}>
              <div class="url-input-container">
                <input
                  type="text"
                  readonly
                  value={viewerUrl}
                  on:click={(e) => e.target.select()}
                />
                <button on:click={copyUrl}>コピー</button>
              </div>
              <button
                class="qr-btn"
                on:click={() => (isQrModalVisible = true)}
                disabled={!qrCodeDataUrl}
              >
                参加用QRコードを表示
              </button>
            </div>
          {/if}
        </div>
      </div>

      <div class="preview-area">
        <canvas bind:this={canvasElement}></canvas>
        <div class="controls-overlay">
          <button
            on:click={() => changePage(currentPage - 1)}
            disabled={currentPage <= 1}>◀</button
          >
          <span>{currentPage} / {pageCount}</span>
          <button
            on:click={() => changePage(currentPage + 1)}
            disabled={currentPage >= pageCount}>▶</button
          >
        </div>
      </div>
    {/if}
  </main>
</div>

<style>
  .host-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    max-height: 100vh;
    background-color: #2c3e50;
    color: #ecf0f1;
    font-family: sans-serif;
  }
  header {
    padding: 0.5rem 1.5rem;
    background-color: #34495e;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
    flex-shrink: 0;
  }
  header h1 {
    font-size: 1.2rem;
    font-weight: 600;
  }
  .terminate-btn {
    padding: 0.4rem 0.8rem;
    font-size: 0.85rem;
  }
  .main-content {
    position: relative;
    flex-grow: 1;
    padding: 0;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .loading-text,
  .error-text {
    margin: auto;
    padding: 2rem;
    text-align: center;
  }
  .top-overlay-panel {
    position: absolute;
    top: 1rem;
    left: 1rem;
    right: 1rem;
    z-index: 10;
    display: flex;
    justify-content: center;
  }
  .collapsible-panel {
    background: rgba(52, 73, 94, 0.9);
    border: 1px solid rgba(0, 0, 0, 0.2);
    backdrop-filter: blur(5px);
    border-radius: 8px;
    flex-shrink: 0;
    width: 100%;
    max-width: 450px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
  }
  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    cursor: pointer;
  }
  .panel-header .arrow {
    transition: transform 0.3s;
  }
  .panel-header .arrow.rotated {
    transform: rotate(-90deg);
  }
  .panel-content {
    padding: 0 1rem 1rem 1rem;
  }
  .preview-area {
    position: relative;
    flex-grow: 1;
    min-height: 0;
    background-color: #2c3e50;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 1rem;
  }
  .preview-area canvas {
    max-width: 100%;
    max-height: 100%;
    height: auto;
    width: auto;
    border-radius: 4px;
  }
  .controls-overlay {
    position: absolute;
    bottom: 1rem;
    left: 50%;
    transform: translateX(-50%);
    background-color: rgba(0, 0, 0, 0.6);
    padding: 0.3rem 0.5rem;
    border-radius: 50px;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    box-shadow: 0 2px 15px rgba(0, 0, 0, 0.5);
    opacity: 0.2;
    transition: opacity 0.3s ease;
    font-size: 0.9rem;
  }
  .preview-area:hover .controls-overlay {
    opacity: 1;
  }
  .controls-overlay button {
    background: transparent;
    padding: 0;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    font-size: 1.1rem;
    display: flex;
    justify-content: center;
    align-items: center;
  }
  .controls-overlay button:hover {
    background: rgba(255, 255, 255, 0.1);
  }
  button {
    background: #3498db;
    color: white;
    border: none;
    padding: 0.8rem 1.5rem;
    border-radius: 5px;
    font-size: 1rem;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  button:disabled {
    background: #555;
    cursor: not-allowed;
    opacity: 0.7;
  }
  .terminate-btn {
    background-color: #e74c3c;
  }
  .terminate-btn:hover {
    background-color: #c0392b;
  }
  .url-input-container {
    display: flex;
    margin-bottom: 0.75rem;
  }
  .panel-content input {
    flex-grow: 1;
    background: #2c3e50;
    border: 1px solid #555;
    color: white;
    padding: 0.6rem;
    border-radius: 5px 0 0 5px;
    font-size: 0.9rem;
    margin-bottom: 0;
    border-right: none;
  }
  .url-input-container button {
    padding: 0.6rem 1rem;
    font-size: 0.9rem;
    border-radius: 0 5px 5px 0;
  }
  .qr-btn {
    width: 100%;
    background-color: #16a085;
    padding: 0.6rem;
    font-size: 0.9rem;
  }
  .qr-btn:hover {
    background-color: #1abc9c;
  }
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.85);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
    cursor: pointer;
    opacity: 0;
    visibility: hidden;
    transition:
      opacity 0.3s,
      visibility 0.3s;
  }
  .modal-overlay.visible {
    opacity: 1;
    visibility: visible;
  }
  .modal-content {
    padding: 1rem;
    background: white;
    border-radius: 8px;
    transform: scale(0.9);
    transition: transform 0.3s;
  }
  .modal-overlay.visible .modal-content {
    transform: scale(1);
  }
  .modal-content img {
    display: block;
    max-width: 90vw;
    max-height: 90vh;
  }
</style>
