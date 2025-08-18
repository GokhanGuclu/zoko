import ping from './ping';
import hello from './hello';
import destekOlustur from './destek-olustur';
import destekSoruOlustur from './destek-soru-olustur';
import destekSoruDuzenle from './destek-soru-duzenle';
import destekSoruSil from './destek-soru-sil';
import destekSil from './destek-sil';
import ticketKapa from './ticket-kapa';
import kayitAyarRoller from './kayit-ayar-roller';
import kayitYonetim from './kayit-yonetim';
import ownerSend from './owner-send';
import ownerRestart from './owner-restart';
import ownerActivity from './owner-activity';
import uyariYonetim from './uyari-yonetim';
import uyariVer from './uyari-ver';
import uyariSil from './uyari-sil';
import uyariListe from './uyari-liste';
import profil from './profil';
import avatar from './avatar';
import sunucuBilgi from './sunucu-bilgi';
import askOlcer from './ask-olcer';
import wordle from './wordle';

export const commands = [
    ping,
    hello,
    destekOlustur,
    destekSoruOlustur,
    destekSoruDuzenle,
    destekSoruSil,
    destekSil,
    ticketKapa,
    kayitAyarRoller,
    kayitYonetim,
    ownerSend,
    ownerRestart,
    ownerActivity,
    uyariYonetim,
    uyariVer,
    uyariSil,
    uyariListe,
    profil,
    avatar,
    sunucuBilgi,
    askOlcer,
    wordle,
];

export type Command = typeof commands[number];


