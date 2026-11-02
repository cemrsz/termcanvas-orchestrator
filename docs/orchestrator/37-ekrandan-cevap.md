# 37 — Ekrandan cevap okuma (Gemini CLI)

**Ne yaptım:** Claude ve Codex'in cevabı oturum kaydından okunuyor; Gemini
CLI'ın TermCanvas'ın okuyabildiği bir kaydı yok, sadece ekranı var. Bunun için
iki saf fonksiyon:

- `extractScreenReply(ekran, gönderilenMetin)` — gönderdiğimiz mesajı
  ekranda bulur (kutu içinde çizildiyse kutunun altından başlar), alttaki
  "Type your message" giriş kutusunu ve durum satırını keser, Gemini'nin ✦
  işaretiyle başlayan cevabını alır, boş satırları toparlar. Mesaj
  bulunamazsa giriş kutusunun üstündeki son kısmı döndürür.
- `detectApprovalPrompt(ekran)` — ekranın altında "Allow execution",
  "Apply this change?", "Yes, allow once", "(y/n)" gibi bir onay sorusu var
  mı?

**Dosyalar:** `electron/screen-reply.ts`, `tests/screen-reply.test.ts`
