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
import botBilgi from './bot-bilgi';
import seviyeYonetim from './seviye-yonetim';
import seviye from './seviye';
import seviyeLiderlik from './seviye-liderlik';
import yardim from './yardim';
import mute from './mute';
import unmute from './unmute';
import kick from './kick';
import ban from './ban';
import clear from './clear';
import blackjack from './blackjack';
import xox from './xox';
import tkm from './tkm';
import guncelleme from './guncelleme';
import guncellemeNotuOlustur from './guncelleme-notu-olustur';

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
    botBilgi,
    seviyeYonetim,
    seviye,
    seviyeLiderlik,
    yardim,
    mute,
    unmute,
    kick,
    ban,
    clear,
    blackjack,
    xox,
    tkm,
    guncelleme,
    guncellemeNotuOlustur,
];

export type Command = typeof commands[number];


