# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## 1.0.0 (2025-08-20)

### Özellikler
- Kayıt Sistemi
  - Kayıt kanalı ve yeni üye rolü ayarları, kayıtlı rol atama
  - İnceleme kanalı ve yetkili rollere görünürlük/izin otomasyonu
  - Modal içerik yönetimi: alan ekle/sil/listele, sırala, zorunluluk, kısa/paragraf alanları
  - Başvuruları onayla/ret et, onayda rollerin otomatik güncellenmesi ve DM bilgilendirme
- Destek/Ticket Sistemi
  - Panel butonuyla ticket açma, SSS menüsü ile hızlı yanıtlar
  - "Anlaşıldı mı?" akışı, gerekirse canlı destek çağırma (rol ping)
  - Kapanışta sohbet dökümü (transcript) ve özetin log kanalına gönderimi, otomatik kanal kapatma
- Uyarı Yönetimi
  - Uyarı log kanalı ve uyarı atabilecek rollerin yönetimi
  - Uyarı ekleme/silme/listeleme akışı; silmede hedef kullanıcıya DM, log kaydı
- Sahip (Owner) Komutları: `owner-send`, `owner-restart`, `owner-activity`
- Genel Komutlar: `ping`, `hello`
- Otomasyonlar ve Yardımcılar
  - Bot açılışında veritabanı şema kontrolü ve tüm slash komutlarının otomatik dağıtımı
  - Zengin embed/komponent UI yardımcıları, izin uygulama yardımcıları, akış/loglama yardımcıları

### Geliştirmeler
- Hata durumlarında kullanıcıya ephemeral yanıtlar ve ayrıntılı konsol logları
- Komut yükleme sırasında isim/açıklama doğrulaması ve durumsal bildirimler

### Kırıcı Değişiklikler
- 1.0.0 ile ilk kararlı sürüm. Önceki 0.x serisine göre yapı ve komut isimlerinde düzenlemeler içerir.

### 1.0.0 (2025-08-20)
