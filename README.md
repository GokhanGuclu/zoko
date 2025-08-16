## ZoKo Discord Botu

TypeScript + discord.js v14 tabanlı, kayıt ve destek akışlarıyla zenginleştirilmiş çok amaçlı Discord botu.

### Özellikler
- Slash komut altyapısı (otomatik dağıtım desteği)
- Kayıt sistemi (modal alan yönetimi, inceleme kanalı, rol atama)
- Destek (ticket) sistemi (SSS menüsü, akış kaydı, kapanış özeti, transcript)
- Uyarı (warn) sistemi (uyarı ver/sil/liste, system-log, DM bilgilendirme, opsiyonel görsel)
- Sahip komutları (aktivite/durum güncelleme, yeniden başlat vb.)

### Gereksinimler
- Node.js 18+
- Bir Discord Bot uygulaması (token ve client id)
- (Opsiyonel) MariaDB/MySQL erişimi

### Kurulum
1) Bağımlılıklar
```bash
npm install
```

2) Ortam değişkenleri (`.env`)
```env
DISCORD_TOKEN=...
DISCORD_CLIENT_ID=...
# Hızlı tek sunucu dağıtımı için (opsiyonel)
DISCORD_GUILD_ID=...

# Destek sistemi (opsiyonel)
SUPPORT_ROLE_ID=...
TICKET_CATEGORY_ID=...

# Kayıt sistemi (opsiyonel)
GUILD_MEMBERS_INTENT=true
MESSAGE_CONTENT_INTENT=true

# Uyarı logları için (opsiyonel, komutla da ayarlanabilir)
# system-log kanalını komutla seçebilirsiniz

# MariaDB/MySQL (opsiyonel; kayıt/uyarı/sss vb.)
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASS=
DB_NAME=zoko
```

3) Geliştirme
```bash
npm run dev
```

4) Derleme ve çalıştırma
```bash
npm run build
npm start
```

5) Slash komutları dağıtımı
```bash
npm run deploy:commands
```
- `DISCORD_GUILD_ID` tanımlıysa ilgili sunucuya hızlı dağıtım yapar. Aksi halde global dağıtım yapılır.

### Komutlar (Özet)
- Kayıt: `/kayit-yonetim`, `/modal-icerik-ekle`, `/modal-icerik-liste`, `/modal-icerik-sil`
- Destek: `/destek-olustur`, `/ticket-kapa` vb.
- Uyarı: `/uyari-yonetim`, `/uyari-ver`, `/uyari-sil`, `/uyari-liste`
- Diğer: `/ping`, `/hello`, sahip komutları

### Uyarı Sistemi Akışı
- Yönetim paneli: `/uyari-yonetim`
  - System-log kanalı seçimi
  - Uyarı atabilecek rollerin seçimi
  - Tüm uyarıları temizleme
- Uyarı verme: `/uyari-ver kisi:@kullanici sebep:"..." resim:(ops.)`
  - DB’ye kayıt, kullanıcıya DM, system-log’a embed
- Uyarı silme: `/uyari-sil kisi:@kullanici` → seçim menüsünden sil
  - Silinen kullanıcıya DM, system-log’a embed (silen kişi bilgisiyle)
- Uyarı liste: `/uyari-liste [kisi]`
  - Yönetici/izinli: herkes için; normal kullanıcı: kendisi için

### Git ve GitHub’a Bağlama
1) Yerelde repo başlatın
```bash
git init
git add .
git commit -m "chore: initialize project"
```

2) GitHub’da boş bir repo oluşturun (ör. `username/zoko`), sonra uzaktan bağlayın
```bash
git remote add origin https://github.com/<username>/<repo>.git
git branch -M main
git push -u origin main
```

3) Sonraki değişiklikler
```bash
git add .
git commit -m "feat: ..."
git push
```

### Notlar
- `node_modules/`, derleme çıktıları ve ortam dosyaları `.gitignore` ile hariç tutulmuştur.
- MariaDB yoksa bot DB fonksiyonlarını opsiyonel kullanır; bazı özellikler (ör. kayıt/uyarı) devre dışı kalabilir.


