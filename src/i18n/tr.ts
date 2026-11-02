/**
 * Türkçe arayüz metinleri. Eksik anahtarlar İngilizceye düşer (useT, en
 * sözlüğünü bunun altına birleştirir), bu yüzden sözlük kısmi olabilir.
 */
export const tr = {
  // AI model nodes on the canvas
  "ai.node.provider": "Sağlayıcı",
  "ai.node.model": "Model",
  "ai.node.modelDefault": (model: string) =>
    model ? `varsayılan: ${model}` : "sunucu varsayılanı",
  "ai.node.via": "Yol",
  "ai.node.api": "API",
  "ai.node.cli": "CLI",
  "ai.node.noCli": (name: string) => `${name} için CLI yok; API'yi kullan`,
  "ai.node.rolePlaceholder":
    "Rol, ör. katı kod inceleyici; maddeler hâlinde cevap ver",
  "ai.node.keySaved": (hint: string) => `anahtar ${hint}`,
  "ai.node.keyEnv": (name: string) => `anahtar ${name} değişkeninden`,
  "ai.node.local": "yerel sunucu",
  "ai.node.noKey": "API anahtarı yok",
  "ai.node.cliReady": (version: string) => `CLI ${version}`,
  "ai.node.cliMissing": "CLI kurulu değil",
  "ai.node.cliCheck": "CLI'ı kontrol et",
  "ai.node.wired": (names: string) => `Bağlı: ${names}`,
  "ai.node.wiredCount": (count: number) => `${count} agent'a bağlı`,
  "ai.node.cliDefault": "CLI'ın varsayılan modeli",
  "ai.node.notWired": "Bağlı değil: bir agent'ın portundan buraya sürükle",
  "ai.node.remove": "AI düğümünü kaldır",
  "ai.node.openHub": (name: string) => `${name} ayarlarını AI Merkezi'nde aç`,
  "ai.node.test": "Test",
  "ai.node.testTitle": "Bu düğümün ayarlarıyla kısa bir test sorusu gönder",
  "ai.node.testPrompt":
    "Tek kısa cümleyle cevap ver: kimsin ve hangi modelde çalışıyorsun?",
  "ai.node.thinking": "düşünüyor…",
  "ai.node.lastAnswer": "Son cevap",
  "ai.node.lastError": "Son hata",

  // Terminal title-bar menu: orchestrator and pipelines
  "terminal.menu.connectOrchestrator": (suffix: string) =>
    `Orkestratöre bağla${suffix}`,
  "terminal.menu.disconnectOrchestrator": (suffix: string) =>
    `Orkestratörden ayır${suffix}`,
  "terminal.menu.makeOrchestrator": "Orkestratör yap",
  "terminal.menu.removeOrchestrator": "Orkestratör rolünü kaldır",
  "terminal.menu.pipeTo": "Pipeline bağla",
  "terminal.menu.unpipe": "Pipeline'ı kes",
  "terminal.menu.brief": "Kime bağlı olduğunu söyle",

  // Badges under wired tiles
  "canvas.badge.orchestrator": "ORKESTRATÖR",
  "canvas.badge.summary": (agents: number, models: number, sources: number) =>
    [
      `${agents} agent`,
      ...(models > 0 ? [`${models} model`] : []),
      `${sources} kaynak`,
    ].join(" · "),
  "canvas.badge.pipelineTitle": (names: string) =>
    `Pipeline: ${names} ile konuşabilir`,

  // Canvas right-click menu
  "canvas.menu.new": (label: string) => `Yeni ${label}`,
  "canvas.menu.newOrchestrator": "Yeni Orkestratör",
  "canvas.menu.addAi": "AI Modeli Ekle",
  "canvas.menu.addSource": "Kaynak Ekle",
  "canvas.menu.aiHint.both": "API · CLI",
  "canvas.menu.aiHint.local": "yerel",
  "canvas.menu.source.sheet": "Google Sheet",
  "canvas.menu.source.n8n": "n8n Webhook",
  "canvas.menu.source.api": "HTTP API",
  "canvas.menu.source.file": "Yerel Dosya",
  "canvas.menu.source.note": "Not",
  "canvas.menu.templates": "Şablonlar",
  "canvas.menu.template.trio": "Claude ⇄ Gemini ⇄ Codex",
  "canvas.menu.template.trioHint": "3 agent, hepsi birbirine bağlı",
  "canvas.menu.template.council": "Model konseyi",
  "canvas.menu.template.councilHint": "orkestratör + Claude, Gemini, ChatGPT",

  // Command palette: AI
  "palette.ai.hub": "AI Merkezi'ni aç",
  "palette.ai.council": "AI Merkezi: birden çok AI'a aynı anda sor (konsey)",
  "palette.ai.feed": "AI Merkezi: AI'ların birbirine söylediklerini göster",
  "palette.ai.trio": "Yeni Claude ⇄ Gemini ⇄ Codex (birbirine bağlı)",
  "palette.ai.councilTemplate": "Yeni model konseyi (orkestratör + 3 model)",
  "palette.ai.add": (name: string) => `AI modeli ekle: ${name}`,

  // AI Hub
  shortcut_toggle_ai_hub: "AI Merkezi",
  "ai.hub.toolbar": (shortcut: string) =>
    `AI Merkezi: anahtarlar, konsey, canlı akış (${shortcut})`,
  "ai.hub.toolbarUnread": (count: number) =>
    `AI'ların arasında ${count} yeni mesaj`,
  "ai.hub.title": "AI Merkezi",
  "ai.hub.subtitle":
    "Canvas'ın konuşabildiği tüm AI'lar: anahtarlar ve CLI'lar, konsey ve canlı akış",
  "ai.hub.tab.connectors": "Bağlayıcılar",
  "ai.hub.connectorsIntro":
    "Her AI'ı bir kez bağla, sonra canvas'a ekle ya da agent'larına kabloyla bağla. API anahtarları işletim sisteminin anahtar zinciriyle şifrelenir ve uygulamadan hiç çıkmaz. Anahtarın yok mu? CLI'ı kullan: Claude Code, Gemini CLI ve Codex aboneliğinle giriş yaparak çalışır.",
  "ai.hub.moreProviders": "Diğer sağlayıcılar",
  "ai.hub.keySaved": (hint: string) => `anahtar kayıtlı ${hint}`,
  "ai.hub.keyEnv": (name: string) => `anahtar $${name} değişkeninden`,
  "ai.hub.noKeyNeeded": "anahtar gerekmez",
  "ai.hub.needsUrl": "sunucu adresini gir",
  "ai.hub.noKey": "API anahtarı yok",
  "ai.hub.replaceKey": "Değiştirmek için yeni anahtarı yapıştır",
  "ai.hub.apiKeyFor": (name: string) => `${name} API anahtarı`,
  "ai.hub.removeKey": "Kayıtlı anahtarı sil",
  "ai.hub.getKey": "Anahtar al",
  "ai.hub.cliChecking": "kontrol ediliyor…",
  "ai.hub.cliUnknown": "henüz kontrol edilmedi",
  "ai.hub.cliReady": (label: string, version: string) =>
    `${label}${version ? ` · ${version}` : ""}`,
  "ai.hub.cliMissing": (install: string) => `kurulu değil: ${install}`,
  "ai.hub.cliCheck": "CLI'ı tekrar kontrol et",
  "ai.hub.serverUrl": "Sunucu adresi",
  "ai.hub.serverDefault": "sunucu varsayılanı",
  "ai.hub.defaultModel": "Varsayılan model",
  "ai.hub.fetchModels": "Sağlayıcının model listesini getir",
  "ai.hub.modelsFound": (count: number) =>
    `${count} model var: yukarıdaki alandan seç`,
  "ai.hub.testApi": "API'yi test et",
  "ai.hub.testCli": "CLI'ı test et",
  "ai.hub.addToCanvas": "Canvas'a ekle",
  "ai.hub.tab.council": "Konsey",
  "ai.hub.copy": "Cevabı kopyala",
  "ai.hub.council.intro":
    "Aynı soruyu birden çok AI'a aynı anda sor, cevaplarını yan yana karşılaştır. Sonra birine hepsinin özetini yazdır.",
  "ai.hub.council.who": "Sor",
  "ai.hub.council.noneReady":
    "Henüz hazır bir AI yok: Bağlayıcılar'da anahtar ekle ya da bir CLI kur.",
  "ai.hub.council.switchTransport": "API ile CLI arasında geçiş yap",
  "ai.hub.council.placeholder": "Sorun… (göndermek için ⌘/Ctrl + Enter)",
  "ai.hub.council.ask": (count: number) => `${count} AI'a sor`,
  "ai.hub.council.synthesize": (name: string) => `${name} ile özetle`,
  "ai.hub.council.synthesisTitle": "Özet",
  "ai.hub.council.synthesisPrompt":
    "Birkaç AI modeli aynı soruyu cevapladı. Kısa bir özet yaz: nerede hemfikirler, nerede ayrışıyorlar ve en iyi birleşik cevap ne. Sorunun dilini kullan.",
  "ai.hub.tab.feed": "Akış",
  "ai.hub.tab.feedUnread": (count: number) => `Akış (${count})`,
  "ai.feed.filter": "Süzgeç",
  "ai.feed.filter.all": "Tümü",
  "ai.feed.filter.agents": "Agent'lar ⇄",
  "ai.feed.filter.models": "Modeller",
  "ai.feed.filter.sources": "Kaynaklar",
  "ai.feed.filter.errors": "Hatalar",
  "ai.feed.search": "Mesajlarda ara",
  "ai.feed.clear": "Temizle",
  "ai.feed.expand": "Tamamını göstermek için tıkla",
  "ai.feed.kind.message": "mesaj",
  "ai.feed.kind.reply": "cevap",
  "ai.feed.kind.ask": "soru",
  "ai.feed.kind.answer": "yanıt",
  "ai.feed.kind.error": "hata",
  "ai.feed.kind.read": "okuma",
  "ai.feed.kind.trigger": "tetik",
  "ai.feed.kind.brief": "bilgi",
  "ai.feed.emptyTitle": "Henüz mesaj yok",
  "ai.feed.emptyBody":
    "İki agent'ı bir pipeline ile bağla (ya da Şablonlar ▸ Claude ⇄ Gemini ⇄ Codex) ve birinden diğeriyle konuşmasını iste. Her mesaj, cevap ve model çağrısı burada canlı görünür.",
  "ai.feed.noMatch": "Bu süzgece uyan mesaj yok",
  "ai.hub.insecure":
    "Bu sistemde anahtar zinciri yok; anahtar şifrelenmeden, sadece senin kullanıcının okuyabildiği bir dosyada saklanıyor.",
} as const;
