# 72 — Testler `pnpm test`'e eklendi

**Ne yaptım:** Bu çalışmanın 12 yeni test dosyası projenin `pnpm test`
listesine eklendi: bağlayıcılar (HTTP, CLI, servis, store), haberleşme
(kayıt, store), pipeline kuralları ve kayıt, köprü manifesti ve şablonlar,
pipeline korumaları, ekrandan cevap okuma, köprü betiği uçtan uca ve kablo
kuralları.

**Sonuç:** 607 testten 605'i geçiyor. Kalan 2'si `tests/pty-manager.test.ts`
içinde ve bu değişiklikten bağımsız: o testler node-pty'nin derlenmiş yerel
modülünü istiyor (`pnpm install` kurulum betikleriyle çalışınca derlenir);
değişiklikler geri alınınca da aynı şekilde başarısız oluyorlar.

**Dosyalar:** `package.json`
