/**
 * 龍龍語言教室語料庫（純前端、離線可用）。
 *
 * 單字統一格式，讓字卡與測驗共用同一套資料：
 *   { id, lang: 'cs' | 'en', term, pron, pos, zh, ex, exZh, tip?, cat }
 *   - pron：拉丁拼讀近似音（捷克語重音永遠在第一音節，字怎麼寫就怎麼唸）
 *   - tip：踩雷提醒／記憶法，可省略
 */

import { CZ_VOCAB } from './vocabCzech';
import { EN_VOCAB } from './vocabEnglish';

export const CZECH_WORDS = [
  // ── 寒暄 ──
  { id: 'cs-ahoj', lang: 'cs', cat: '寒暄', term: 'ahoj', pron: 'A-hoy', pos: '感嘆詞', zh: '嗨／掰掰（非正式）', ex: 'Ahoj, jak se máš?', exZh: '嗨，你好嗎？', tip: '見面和道別都能用。捷克是內陸國，這個字卻來自水手用語。' },
  { id: 'cs-dobry-den', lang: 'cs', cat: '寒暄', term: 'dobrý den', pron: 'DOB-ree den', pos: '片語', zh: '您好（正式，白天通用）', ex: 'Dobrý den, prosím vás, kde je nádraží?', exZh: '您好，請問火車站在哪裡？', tip: '進小店、上公車問路一定先講這句，不打招呼會被當沒禮貌。' },
  { id: 'cs-dobrou-noc', lang: 'cs', cat: '寒暄', term: 'dobrou noc', pron: 'DOB-rou nots', pos: '片語', zh: '晚安（睡前）', ex: 'Dobrou noc, ať se ti dobře spí.', exZh: '晚安，祝你好眠。' },
  { id: 'cs-na-shledanou', lang: 'cs', cat: '寒暄', term: 'na shledanou', pron: 'na SKHLE-da-nou', pos: '片語', zh: '再見（正式）', ex: 'Děkuji, na shledanou!', exZh: '謝謝，再見！', tip: '直譯是「直到再相見」。sh 在這裡唸成「s+ㄏ」。' },
  { id: 'cs-dekuji', lang: 'cs', cat: '寒暄', term: 'děkuji', pron: 'DYE-ku-yi', pos: '動詞', zh: '謝謝', ex: 'Děkuji za pomoc.', exZh: '謝謝你的幫忙。', tip: '口語版是 díky（ㄉㄧ-key），跟朋友用。' },
  { id: 'cs-prosim', lang: 'cs', cat: '寒暄', term: 'prosím', pron: 'PRO-seem', pos: '副詞', zh: '請／不客氣／你說什麼？', ex: 'Ještě jedno pivo, prosím.', exZh: '請再來一杯啤酒。', tip: '捷克萬用字：拜託、不客氣、沒聽清楚、請進都是它。' },
  { id: 'cs-prominte', lang: 'cs', cat: '寒暄', term: 'promiňte', pron: 'PRO-min-tye', pos: '動詞', zh: '不好意思／對不起（對陌生人）', ex: 'Promiňte, mluvíte anglicky?', exZh: '不好意思，您會說英文嗎？' },
  { id: 'cs-neni-zac', lang: 'cs', cat: '寒暄', term: 'není zač', pron: 'NE-nyee zach', pos: '片語', zh: '不客氣', ex: 'Děkuju! – Není zač.', exZh: '謝謝！—— 不客氣。' },
  { id: 'cs-tesi-me', lang: 'cs', cat: '寒暄', term: 'těší mě', pron: 'TYE-shee mnye', pos: '片語', zh: '幸會、很高興認識你', ex: 'Jsem Josh. – Těší mě!', exZh: '我是 Josh。—— 幸會！' },
  { id: 'cs-na-zdravi', lang: 'cs', cat: '寒暄', term: 'na zdraví', pron: 'na ZDRA-vee', pos: '片語', zh: '乾杯！（也用在別人打噴嚏時）', ex: 'Na zdraví!', exZh: '乾杯！', tip: '碰杯時一定要看對方眼睛，不然傳說會倒楣七年。' },
  { id: 'cs-dobrou-chut', lang: 'cs', cat: '寒暄', term: 'dobrou chuť', pron: 'DOB-rou khut', pos: '片語', zh: '用餐愉快', ex: 'Dobrou chuť!', exZh: '請慢用！', tip: '同桌開動前互相說一句，超級日常。' },
  { id: 'cs-jak-se-mas', lang: 'cs', cat: '寒暄', term: 'jak se máš?', pron: 'yak se mash', pos: '片語', zh: '你好嗎？（朋友）', ex: 'Ahoj, jak se máš? – Mám se dobře.', exZh: '嗨，你好嗎？—— 我很好。', tip: '對長輩／老師要用 jak se máte?' },

  // ── 核心動詞 ──
  { id: 'cs-byt', lang: 'cs', cat: '動詞', term: 'být', pron: 'beet', pos: '動詞', zh: '是（jsem 我是／jsi 你是／je 他是）', ex: 'Jsem student z Tchaj-wanu.', exZh: '我是來自台灣的學生。', tip: '注意長短音：být（是）vs byt（公寓），只差一撇。' },
  { id: 'cs-mit', lang: 'cs', cat: '動詞', term: 'mít', pron: 'meet', pos: '動詞', zh: '有（mám／máš／má）', ex: 'Máte tašku?', exZh: '你們有袋子嗎？' },
  { id: 'cs-chtel-bych', lang: 'cs', cat: '動詞', term: 'chtěl bych', pron: 'KHTYEL bikh', pos: '片語', zh: '我想要（禮貌說法）', ex: 'Chtěl bych jednu jízdenku.', exZh: '我想要一張車票。', tip: '女生說 chtěla bych。捷克語條件式／過去式會分性別：男 -l、女 -la。' },
  { id: 'cs-dam-si', lang: 'cs', cat: '動詞', term: 'dám si', pron: 'daam si', pos: '片語', zh: '我要點（餐廳點餐專用）', ex: 'Dám si guláš a pivo.', exZh: '我要一份燉牛肉和一杯啤酒。', tip: '進餐廳只要會這句就活得下去。' },
  { id: 'cs-muzu', lang: 'cs', cat: '動詞', term: 'můžu', pron: 'MOO-zhu', pos: '動詞', zh: '我可以（原形 moct）', ex: 'Můžu platit kartou?', exZh: '我可以刷卡嗎？' },
  { id: 'cs-musim', lang: 'cs', cat: '動詞', term: 'musím', pron: 'MU-seem', pos: '動詞', zh: '我必須（原形 muset）', ex: 'Musím přestoupit?', exZh: '我需要轉車嗎？' },
  { id: 'cs-mluvit', lang: 'cs', cat: '動詞', term: 'mluvit', pron: 'MLU-vit', pos: '動詞', zh: '說（語言）', ex: 'Mluvíte anglicky?', exZh: '您會說英文嗎？', tip: '救命句：Mluvím jen trochu česky.（我只會一點捷克語）' },
  { id: 'cs-rozumet', lang: 'cs', cat: '動詞', term: 'rozumět', pron: 'RO-zu-myet', pos: '動詞', zh: '懂、理解', ex: 'Nerozumím, prosím pomalu.', exZh: '我聽不懂，請說慢一點。', tip: '否定就是前面加 ne-：rozumím → nerozumím。' },
  { id: 'cs-vim', lang: 'cs', cat: '動詞', term: 'vím', pron: 'veem', pos: '動詞', zh: '我知道（原形 vědět）', ex: 'Nevím, promiňte.', exZh: '我不知道，抱歉。' },
  { id: 'cs-umet', lang: 'cs', cat: '動詞', term: 'umět', pron: 'U-myet', pos: '動詞', zh: '會（有能力做某事）', ex: 'Umím trochu česky.', exZh: '我會一點捷克語。' },
  { id: 'cs-platit', lang: 'cs', cat: '動詞', term: 'platit', pron: 'PLA-tit', pos: '動詞', zh: '付錢', ex: 'Zaplatím, prosím.', exZh: '我要結帳，謝謝。', tip: '在餐廳舉手說 Zaplatím! 服務生才會過來，不會自己送帳單。' },
  { id: 'cs-koupit', lang: 'cs', cat: '動詞', term: 'koupit', pron: 'KOU-pit', pos: '動詞', zh: '買', ex: 'Kde můžu koupit jízdenku?', exZh: '我在哪裡可以買車票？' },
  { id: 'cs-jist', lang: 'cs', cat: '動詞', term: 'jíst', pron: 'yeest', pos: '動詞', zh: '吃（jím 我吃）', ex: 'Nejím maso.', exZh: '我不吃肉。' },
  { id: 'cs-pit', lang: 'cs', cat: '動詞', term: 'pít', pron: 'peet', pos: '動詞', zh: '喝（piju 我喝）', ex: 'Piju jenom vodu.', exZh: '我只喝水。' },
  { id: 'cs-bydlet', lang: 'cs', cat: '動詞', term: 'bydlet', pron: 'BID-let', pos: '動詞', zh: '住', ex: 'Bydlím na koleji.', exZh: '我住在學生宿舍。' },
  { id: 'cs-studovat', lang: 'cs', cat: '動詞', term: 'studovat', pron: 'STU-do-vat', pos: '動詞', zh: '就讀、唸書', ex: 'Studuju tady jeden semestr.', exZh: '我在這裡讀一個學期。' },
  { id: 'cs-potrebovat', lang: 'cs', cat: '動詞', term: 'potřebovat', pron: 'PO-trzhe-bo-vat', pos: '動詞', zh: '需要', ex: 'Potřebuju doktora.', exZh: '我需要看醫生。' },
  { id: 'cs-hledat', lang: 'cs', cat: '動詞', term: 'hledat', pron: 'HLE-dat', pos: '動詞', zh: '找、尋找', ex: 'Hledám tuhle adresu.', exZh: '我在找這個地址。' },
  { id: 'cs-libi-se-mi', lang: 'cs', cat: '動詞', term: 'líbí se mi', pron: 'LEE-bee se mi', pos: '片語', zh: '我喜歡（看到、聽到的東西）', ex: 'Líbí se mi Praha.', exZh: '我喜歡布拉格。', tip: '喜歡食物或習慣性的事物要用 mám rád(a)。' },

  // ── 吃喝與購物 ──
  { id: 'cs-voda', lang: 'cs', cat: '飲食', term: 'voda', pron: 'VO-da', pos: '名詞（陰）', zh: '水', ex: 'Neperlivou vodu, prosím.', exZh: '請給我不含氣泡的水。', tip: 'perlivá = 氣泡水，neperlivá = 無氣泡。餐廳的水要錢。' },
  { id: 'cs-pivo', lang: 'cs', cat: '飲食', term: 'pivo', pron: 'PI-vo', pos: '名詞（中）', zh: '啤酒', ex: 'Jedno velké pivo, prosím.', exZh: '請給我一杯大杯啤酒。', tip: '捷克人均啤酒消費世界第一，餐廳裡常比水便宜。' },
  { id: 'cs-kava', lang: 'cs', cat: '飲食', term: 'káva', pron: 'KAA-va', pos: '名詞（陰）', zh: '咖啡', ex: 'Dám si kávu s mlékem.', exZh: '我要一杯加牛奶的咖啡。' },
  { id: 'cs-jidlo', lang: 'cs', cat: '飲食', term: 'jídlo', pron: 'YEED-lo', pos: '名詞（中）', zh: '食物、餐點', ex: 'Jaké jídlo doporučujete?', exZh: '您推薦什麼餐點？' },
  { id: 'cs-obed', lang: 'cs', cat: '飲食', term: 'oběd', pron: 'O-byed', pos: '名詞（陽）', zh: '午餐', ex: 'Dáme si oběd v menze.', exZh: '我們在學生餐廳吃午餐吧。', tip: '很多餐廳中午有 polední menu（午間套餐），超便宜。' },
  { id: 'cs-ucet', lang: 'cs', cat: '飲食', term: 'účet', pron: 'OO-chet', pos: '名詞（陽）', zh: '帳單', ex: 'Účet, prosím.', exZh: '請給我帳單。' },
  { id: 'cs-uctenka', lang: 'cs', cat: '購物', term: 'účtenka', pron: 'OOCH-ten-ka', pos: '名詞（陰）', zh: '收據、發票', ex: 'Účtenku, prosím.', exZh: '請給我收據。' },
  { id: 'cs-penize', lang: 'cs', cat: '購物', term: 'peníze', pron: 'PE-nyee-ze', pos: '名詞（複）', zh: '錢', ex: 'Nemám u sebe peníze.', exZh: '我身上沒帶錢。' },
  { id: 'cs-koruna', lang: 'cs', cat: '購物', term: 'koruna', pron: 'KO-ru-na', pos: '名詞（陰）', zh: '克朗（捷克貨幣 Kč）', ex: 'To stojí sto korun.', exZh: '這個要一百克朗。', tip: '捷克沒用歐元。標價 Kč，觀光區換匯店匯率很坑，用卡最保險。' },
  { id: 'cs-sleva', lang: 'cs', cat: '購物', term: 'sleva', pron: 'SLE-va', pos: '名詞（陰）', zh: '折扣', ex: 'Máte studentskou slevu?', exZh: '有學生折扣嗎？', tip: '帶 ISIC 學生證，交通、博物館都能打折。' },
  { id: 'cs-potraviny', lang: 'cs', cat: '購物', term: 'potraviny', pron: 'PO-tra-vi-ni', pos: '名詞（複）', zh: '食品雜貨（店）', ex: 'Kde jsou tady potraviny?', exZh: '這附近的雜貨店在哪？' },
  { id: 'cs-taska', lang: 'cs', cat: '購物', term: 'taška', pron: 'TASH-ka', pos: '名詞（陰）', zh: '袋子', ex: 'Tašku nepotřebuju, děkuju.', exZh: '我不需要袋子，謝謝。', tip: '超市塑膠袋要另外付錢，自己帶袋子最省。' },
  { id: 'cs-kolik-to-stoji', lang: 'cs', cat: '購物', term: 'Kolik to stojí?', pron: 'KO-lik to STO-yee', pos: '片語', zh: '這個多少錢？', ex: 'Promiňte, kolik to stojí?', exZh: '不好意思，這個多少錢？' },

  // ── 交通 ──
  { id: 'cs-jizdenka', lang: 'cs', cat: '交通', term: 'jízdenka', pron: 'YEEZ-den-ka', pos: '名詞（陰）', zh: '車票', ex: 'Jednu jízdenku na třicet minut, prosím.', exZh: '請給我一張三十分鐘的票。', tip: '上車一定要打票，查票員（revizor）罰款很兇，不認觀光客身分。' },
  { id: 'cs-tramvaj', lang: 'cs', cat: '交通', term: 'tramvaj', pron: 'TRAM-vay', pos: '名詞（陰）', zh: '路面電車', ex: 'Jede tahle tramvaj na Karlovo náměstí?', exZh: '這班電車有到查理廣場嗎？' },
  { id: 'cs-metro', lang: 'cs', cat: '交通', term: 'metro', pron: 'ME-tro', pos: '名詞（中）', zh: '地鐵', ex: 'Metro jezdí do půlnoci.', exZh: '地鐵開到午夜。', tip: '布拉格地鐵只有 A（綠）、B（黃）、C（紅）三條線，很好記。' },
  { id: 'cs-zastavka', lang: 'cs', cat: '交通', term: 'zastávka', pron: 'ZA-staav-ka', pos: '名詞（陰）', zh: '站牌、停靠站', ex: 'Vystupuju na příští zastávce.', exZh: '我下一站下車。' },
  { id: 'cs-nadrazi', lang: 'cs', cat: '交通', term: 'nádraží', pron: 'NAA-dra-zhee', pos: '名詞（中）', zh: '火車站', ex: 'Hlavní nádraží je odsud pěšky.', exZh: '中央車站從這裡走路就到。' },
  { id: 'cs-letiste', lang: 'cs', cat: '交通', term: 'letiště', pron: 'LE-tish-tye', pos: '名詞（中）', zh: '機場', ex: 'Jak se dostanu na letiště?', exZh: '我要怎麼去機場？' },
  { id: 'cs-prestoupit', lang: 'cs', cat: '交通', term: 'přestoupit', pron: 'PRZHE-stou-pit', pos: '動詞', zh: '轉車', ex: 'Kde musím přestoupit?', exZh: '我要在哪裡轉車？' },
  { id: 'cs-odjezd', lang: 'cs', cat: '交通', term: 'odjezd / příjezd', pron: 'OD-yezd / PRZHEE-yezd', pos: '名詞（陽）', zh: '出發 ／ 抵達', ex: 'Odjezd v 8:15 z nástupiště 3.', exZh: '八點十五分從第三月台發車。', tip: '看時刻表就靠這兩個字，nástupiště = 月台。' },
  { id: 'cs-vlak', lang: 'cs', cat: '交通', term: 'vlak', pron: 'vlak', pos: '名詞（陽）', zh: '火車', ex: 'Kdy jede příští vlak do Brna?', exZh: '下一班到布爾諾的火車幾點？' },

  // ── 校園 ──
  { id: 'cs-univerzita', lang: 'cs', cat: '校園', term: 'univerzita', pron: 'U-ni-ver-zi-ta', pos: '名詞（陰）', zh: '大學', ex: 'Studuju na Univerzitě Karlově.', exZh: '我在查理大學讀書。' },
  { id: 'cs-prednaska', lang: 'cs', cat: '校園', term: 'přednáška', pron: 'PRZHED-naash-ka', pos: '名詞（陰）', zh: '大堂講課', ex: 'Přednáška začíná v devět.', exZh: '課九點開始。' },
  { id: 'cs-cviceni', lang: 'cs', cat: '校園', term: 'cvičení', pron: 'TSVI-che-nyee', pos: '名詞（中）', zh: '習題課、實作課', ex: 'Cvičení je povinné.', exZh: '習題課是必修出席的。' },
  { id: 'cs-zkouska', lang: 'cs', cat: '校園', term: 'zkouška', pron: 'ZKOUSH-ka', pos: '名詞（陰）', zh: '期末考試（口試居多）', ex: 'Mám zkoušku v pondělí.', exZh: '我星期一有考試。', tip: '捷克大學很多是口試，可以預約不同日期，被當可再考。' },
  { id: 'cs-zapocet', lang: 'cs', cat: '校園', term: 'zápočet', pron: 'ZAA-po-chet', pos: '名詞（陽）', zh: '平時學分認證', ex: 'Bez zápočtu nemůžu jít na zkoušku.', exZh: '沒拿到平時認證就不能考期末。', tip: '捷克特有制度：先過 zápočet（作業／出席）才有資格考 zkouška。' },
  { id: 'cs-knihovna', lang: 'cs', cat: '校園', term: 'knihovna', pron: 'KNI-hov-na', pos: '名詞（陰）', zh: '圖書館', ex: 'Jdu se učit do knihovny.', exZh: '我要去圖書館唸書。', tip: '龍龍圖書館 = Dračí knihovna（drak 是龍）。' },
  { id: 'cs-kolej', lang: 'cs', cat: '校園', term: 'kolej', pron: 'KO-ley', pos: '名詞（陰）', zh: '學生宿舍', ex: 'Bydlím na koleji Strahov.', exZh: '我住在 Strahov 宿舍。' },
  { id: 'cs-menza', lang: 'cs', cat: '校園', term: 'menza', pron: 'MEN-za', pos: '名詞（陰）', zh: '學生餐廳', ex: 'V menze je oběd za sto korun.', exZh: '學生餐廳午餐一百克朗。' },
  { id: 'cs-spoluzak', lang: 'cs', cat: '校園', term: 'spolužák', pron: 'SPO-lu-zhaak', pos: '名詞（陽）', zh: '同學', ex: 'To je můj spolužák z Německa.', exZh: '這是我來自德國的同學。' },
  { id: 'cs-rozvrh', lang: 'cs', cat: '校園', term: 'rozvrh', pron: 'ROZ-vrh', pos: '名詞（陽）', zh: '課表', ex: 'Ještě nemám hotový rozvrh.', exZh: '我課表還沒排好。' },

  // ── 生活與行政 ──
  { id: 'cs-byt-noun', lang: 'cs', cat: '生活', term: 'byt', pron: 'bit', pos: '名詞（陽）', zh: '公寓、住處', ex: 'Hledám byt na půl roku.', exZh: '我在找半年的房子。', tip: '短音 byt = 公寓，長音 být = 是。唸錯句子會很好笑。' },
  { id: 'cs-klic', lang: 'cs', cat: '生活', term: 'klíč', pron: 'kleech', pos: '名詞（陽）', zh: '鑰匙', ex: 'Ztratil jsem klíč od pokoje.', exZh: '我把房間鑰匙弄丟了。', tip: '女生說 Ztratila jsem…' },
  { id: 'cs-najem', lang: 'cs', cat: '生活', term: 'nájem', pron: 'NAA-yem', pos: '名詞（陽）', zh: '房租', ex: 'Kolik je nájem za měsíc?', exZh: '一個月房租多少？' },
  { id: 'cs-topeni', lang: 'cs', cat: '生活', term: 'topení', pron: 'TO-pe-nyee', pos: '名詞（中）', zh: '暖氣', ex: 'Nefunguje mi topení.', exZh: '我的暖氣壞了。', tip: '布拉格冬天可到 -10°C，這句一定要會。' },
  { id: 'cs-pradelna', lang: 'cs', cat: '生活', term: 'prádelna', pron: 'PRAA-del-na', pos: '名詞（陰）', zh: '洗衣間', ex: 'Kde je tady prádelna?', exZh: '這裡的洗衣間在哪？' },
  { id: 'cs-lekarna', lang: 'cs', cat: '生活', term: 'lékárna', pron: 'LEE-kaar-na', pos: '名詞（陰）', zh: '藥局', ex: 'Nejbližší lékárna je za rohem.', exZh: '最近的藥局就在轉角。', tip: '別跟 drogerie（美妝日用品店）搞混，藥要去 lékárna。' },
  { id: 'cs-nemocnice', lang: 'cs', cat: '生活', term: 'nemocnice', pron: 'NE-mots-nyi-tse', pos: '名詞（陰）', zh: '醫院', ex: 'Potřebuju do nemocnice.', exZh: '我需要去醫院。' },
  { id: 'cs-pojisteni', lang: 'cs', cat: '行政', term: 'pojištění', pron: 'PO-yish-tye-nyee', pos: '名詞（中）', zh: '保險', ex: 'Mám zdravotní pojištění.', exZh: '我有健康保險。' },
  { id: 'cs-pobyt', lang: 'cs', cat: '行政', term: 'pobyt', pron: 'PO-bit', pos: '名詞（陽）', zh: '居留', ex: 'Musím si vyřídit povolení k pobytu.', exZh: '我必須辦居留許可。', tip: '外國人警局叫 cizinecká policie，落地後要在期限內登記。' },
  { id: 'cs-doklad', lang: 'cs', cat: '行政', term: 'doklad', pron: 'DO-klad', pos: '名詞（陽）', zh: '證件', ex: 'Váš doklad, prosím.', exZh: '請出示您的證件。' },
  { id: 'cs-pas', lang: 'cs', cat: '行政', term: 'pas', pron: 'pas', pos: '名詞（陽）', zh: '護照', ex: 'Nechal jsem pas na koleji.', exZh: '我把護照忘在宿舍了。' },
  { id: 'cs-policie', lang: 'cs', cat: '行政', term: 'policie', pron: 'PO-li-tsi-ye', pos: '名詞（陰）', zh: '警察', ex: 'Zavolejte policii, prosím.', exZh: '請幫我叫警察。' },
  { id: 'cs-pomoc', lang: 'cs', cat: '緊急', term: 'pomoc', pron: 'PO-mots', pos: '名詞（陰）', zh: '幫助（喊救命也用它）', ex: 'Pomoc! Potřebuju pomoc.', exZh: '救命！我需要幫助。', tip: '緊急電話 112，警察 158，救護車 155。' },
  { id: 'cs-boli-me', lang: 'cs', cat: '緊急', term: 'bolí mě', pron: 'BO-lee mnye', pos: '片語', zh: '我……痛', ex: 'Bolí mě hlava a v krku.', exZh: '我頭痛而且喉嚨痛。', tip: 'hlava 頭、břicho 肚子、zub 牙齒、záda 背。' },

  // ── 形容詞與副詞 ──
  { id: 'cs-dobry', lang: 'cs', cat: '形容詞', term: 'dobrý', pron: 'DOB-ree', pos: '形容詞', zh: '好的', ex: 'To pivo je moc dobré.', exZh: '這啤酒很好喝。' },
  { id: 'cs-levny', lang: 'cs', cat: '形容詞', term: 'levný / drahý', pron: 'LEV-nee / DRA-hee', pos: '形容詞', zh: '便宜的 ／ 貴的', ex: 'Tohle je moc drahé.', exZh: '這太貴了。' },
  { id: 'cs-velky', lang: 'cs', cat: '形容詞', term: 'velký / malý', pron: 'VEL-kee / MA-lee', pos: '形容詞', zh: '大的 ／ 小的', ex: 'Velké, nebo malé pivo?', exZh: '大杯還是小杯啤酒？' },
  { id: 'cs-hodne', lang: 'cs', cat: '副詞', term: 'hodně / málo', pron: 'HOD-nye / MAA-lo', pos: '副詞', zh: '很多 ／ 很少', ex: 'Mám hodně práce.', exZh: '我有很多事要做。' },
  { id: 'cs-pomalu', lang: 'cs', cat: '副詞', term: 'pomalu', pron: 'PO-ma-lu', pos: '副詞', zh: '慢慢地', ex: 'Můžete mluvit pomalu?', exZh: '您可以說慢一點嗎？', tip: '聽不懂時的救命符，配 prosím 更禮貌。' },
  { id: 'cs-dnes', lang: 'cs', cat: '時間', term: 'dnes / zítra / včera', pron: 'dnes / ZEE-tra / VCHE-ra', pos: '副詞', zh: '今天 ／ 明天 ／ 昨天', ex: 'Zítra mám zkoušku.', exZh: '我明天有考試。' },
  { id: 'cs-bohuzel', lang: 'cs', cat: '副詞', term: 'bohužel', pron: 'BO-hu-zhel', pos: '副詞', zh: '可惜、很遺憾', ex: 'Bohužel to nejde.', exZh: '很可惜這行不通。' },
  { id: 'cs-samozrejme', lang: 'cs', cat: '副詞', term: 'samozřejmě', pron: 'SA-mo-zrzhey-mnye', pos: '副詞', zh: '當然', ex: 'Samozřejmě, není problém.', exZh: '當然，沒問題。' },
  { id: 'cs-pozor', lang: 'cs', cat: '生活', term: 'pozor', pron: 'PO-zor', pos: '感嘆詞', zh: '小心！注意！', ex: 'Pozor, tramvaj!', exZh: '小心，電車！' },
  { id: 'cs-otevreno', lang: 'cs', cat: '生活', term: 'otevřeno / zavřeno', pron: 'O-tev-rzhe-no / ZAV-rzhe-no', pos: '副詞', zh: '營業中 ／ 休息中', ex: 'V neděli mají zavřeno.', exZh: '他們星期天不營業。', tip: '門口貼這兩個字，看錯會白跑一趟。' },
  { id: 'cs-vchod', lang: 'cs', cat: '生活', term: 'vchod / východ', pron: 'vkhod / VEE-khod', pos: '名詞（陽）', zh: '入口 ／ 出口', ex: 'Východ je na druhé straně.', exZh: '出口在另一邊。', tip: '只差一個字母，východ 同時也是「東方」。' },
  { id: 'cs-kde', lang: 'cs', cat: '疑問詞', term: 'kde / kam', pron: 'kde / kam', pos: '疑問詞', zh: '在哪裡 ／ 去哪裡', ex: 'Kde je záchod?', exZh: '廁所在哪裡？', tip: '靜止用 kde，移動方向用 kam。' },
  { id: 'cs-kdy', lang: 'cs', cat: '疑問詞', term: 'kdy', pron: 'kdi', pos: '疑問詞', zh: '什麼時候', ex: 'Kdy to začíná?', exZh: '幾點開始？' },
  { id: 'cs-proc', lang: 'cs', cat: '疑問詞', term: 'proč / protože', pron: 'proch / PRO-to-zhe', pos: '疑問詞／連接詞', zh: '為什麼 ／ 因為', ex: 'Proč? Protože musím.', exZh: '為什麼？因為我必須。' },
  { id: 'cs-jeden', lang: 'cs', cat: '數字', term: 'jeden, dva, tři', pron: 'YE-den, dva, trzhi', pos: '數詞', zh: '一、二、三', ex: 'Tři piva, prosím.', exZh: '請給我三杯啤酒。', tip: '四 čtyři、五 pět、十 deset、一百 sto。' },
  { id: 'cs-tykat', lang: 'cs', cat: '社交', term: 'tykat / vykat', pron: 'TI-kat / VI-kat', pos: '動詞', zh: '互稱「你」 ／ 用敬語「您」', ex: 'Můžeme si tykat?', exZh: '我們可以互相用「你」嗎？', tip: '對老師、店員先用 vykat；由年長或職位高的一方提議改 tykat。' },
];

export const ENGLISH_WORDS = [
  // ── 校園學術 ──
  { id: 'en-syllabus', lang: 'en', cat: '校園', term: 'syllabus', pron: '/ˈsɪləbəs/', pos: 'n.', zh: '課程大綱', ex: 'The syllabus says attendance is 20% of the grade.', exZh: '課程大綱寫出席佔成績的兩成。', tip: '複數是 syllabi 或 syllabuses，兩種都對。' },
  { id: 'en-enroll', lang: 'en', cat: '校園', term: 'enroll in', pron: '/ɪnˈroʊl/', pos: 'v.', zh: '選修、註冊（課程）', ex: 'I need to enroll in two more courses this semester.', exZh: '我這學期還需要選兩門課。' },
  { id: 'en-credit', lang: 'en', cat: '校園', term: 'credits', pron: '/ˈkredɪts/', pos: 'n.', zh: '學分', ex: 'I have to earn 30 ECTS credits this semester.', exZh: '我這學期得修滿 30 個 ECTS 學分。', tip: '歐洲交換用 ECTS 學分制，一學期標準是 30。' },
  { id: 'en-deadline', lang: 'en', cat: '校園', term: 'deadline', pron: '/ˈdedlaɪn/', pos: 'n.', zh: '截止期限', ex: 'Can I get an extension on the deadline?', exZh: '截止日可以延長嗎？', tip: 'extension = 延期，寫信給教授必備字。' },
  { id: 'en-assignment', lang: 'en', cat: '校園', term: 'assignment', pron: '/əˈsaɪnmənt/', pos: 'n.', zh: '作業、指派任務', ex: 'The assignment is due Friday at noon.', exZh: '作業星期五中午截止。' },
  { id: 'en-office-hours', lang: 'en', cat: '校園', term: 'office hours', pron: '/ˈɔːfɪs aʊrz/', pos: 'n.', zh: '教授的接見時間', ex: 'I dropped by his office hours to ask about the exam.', exZh: '我趁他的接見時間去問考試的事。', tip: '歐美教授很吃這套，有問題直接去比寄信有效。' },
  { id: 'en-transcript', lang: 'en', cat: '校園', term: 'transcript', pron: '/ˈtrænskrɪpt/', pos: 'n.', zh: '成績單', ex: 'I need an official transcript for my home university.', exZh: '我需要一份正式成績單給原學校。' },
  { id: 'en-plagiarism', lang: 'en', cat: '校園', term: 'plagiarism', pron: '/ˈpleɪdʒərɪzəm/', pos: 'n.', zh: '抄襲', ex: 'They run every paper through a plagiarism checker.', exZh: '他們每份報告都會跑抄襲比對。' },
  { id: 'en-peer-review', lang: 'en', cat: '校園', term: 'peer review', pron: '/pɪr rɪˈvjuː/', pos: 'n.', zh: '同儕審查、互評', ex: 'We do peer review before the final submission.', exZh: '我們在最終繳交前會互評。' },
  { id: 'en-mandatory', lang: 'en', cat: '校園', term: 'mandatory', pron: '/ˈmændətɔːri/', pos: 'adj.', zh: '強制的、必修的', ex: 'Attendance at the seminar is mandatory.', exZh: '研討課出席是強制的。', tip: '反義 optional／elective（選修）。' },

  // ── 行政與文件 ──
  { id: 'en-residence-permit', lang: 'en', cat: '行政', term: 'residence permit', pron: '/ˈrezɪdəns ˈpɜːrmɪt/', pos: 'n.', zh: '居留許可', ex: 'You must apply for a residence permit within three days of arrival.', exZh: '你必須在抵達後三天內申請居留許可。' },
  { id: 'en-appointment', lang: 'en', cat: '行政', term: 'appointment', pron: '/əˈpɔɪntmənt/', pos: 'n.', zh: '預約', ex: 'I booked an appointment at the foreign police.', exZh: '我在外國人警局預約了。', tip: '歐洲很多單位不預約不受理，先查線上預約系統。' },
  { id: 'en-proof-of', lang: 'en', cat: '行政', term: 'proof of address', pron: '/pruːf əv ˈædres/', pos: 'n.', zh: '地址證明', ex: 'The bank asked for proof of address.', exZh: '銀行要求地址證明。' },
  { id: 'en-deposit', lang: 'en', cat: '行政', term: 'deposit', pron: '/dɪˈpɑːzɪt/', pos: 'n.', zh: '押金', ex: 'The deposit is refundable when you move out.', exZh: '押金在你搬走時會退還。', tip: 'refundable = 可退，non-refundable = 不退。' },
  { id: 'en-utilities', lang: 'en', cat: '行政', term: 'utilities', pron: '/juːˈtɪlətiz/', pos: 'n.', zh: '水電瓦斯等公共費用', ex: 'Is rent with or without utilities?', exZh: '租金含不含水電？' },
  { id: 'en-lease', lang: 'en', cat: '行政', term: 'lease', pron: '/liːs/', pos: 'n./v.', zh: '租約', ex: 'I signed a six-month lease.', exZh: '我簽了六個月的租約。' },
  { id: 'en-reimburse', lang: 'en', cat: '行政', term: 'reimburse', pron: '/ˌriːɪmˈbɜːrs/', pos: 'v.', zh: '核銷、報帳退款', ex: 'Keep the receipts so they can reimburse you.', exZh: '留好收據他們才能幫你核銷。', tip: 'Erasmus 補助、機票報帳都用這個字。' },
  { id: 'en-red-tape', lang: 'en', cat: '行政', term: 'red tape', pron: '/red teɪp/', pos: 'n.', zh: '繁文縟節、官僚流程', ex: 'There is a lot of red tape before you can register.', exZh: '註冊前有一堆官僚流程要跑。', tip: '英國舊時用紅帶綁公文，因此得名。' },
  { id: 'en-sort-out', lang: 'en', cat: '行政', term: 'sort out', pron: '/sɔːrt aʊt/', pos: 'phr. v.', zh: '搞定、處理好', ex: 'I still need to sort out my insurance.', exZh: '我的保險還沒搞定。' },

  // ── 旅行 ──
  { id: 'en-layover', lang: 'en', cat: '旅行', term: 'layover', pron: '/ˈleɪoʊvər/', pos: 'n.', zh: '轉機停留', ex: 'I have a five-hour layover in Doha.', exZh: '我在杜哈轉機停留五小時。', tip: '英式常說 stopover。' },
  { id: 'en-baggage-allowance', lang: 'en', cat: '旅行', term: 'baggage allowance', pron: '/ˈbæɡɪdʒ əˈlaʊəns/', pos: 'n.', zh: '行李額度', ex: 'What is the baggage allowance on this ticket?', exZh: '這張票的行李額度是多少？' },
  { id: 'en-boarding-pass', lang: 'en', cat: '旅行', term: 'boarding pass', pron: '/ˈbɔːrdɪŋ pæs/', pos: 'n.', zh: '登機證', ex: 'Have your boarding pass and passport ready.', exZh: '請備妥登機證和護照。' },
  { id: 'en-jet-lag', lang: 'en', cat: '旅行', term: 'jet lag', pron: '/dʒet læɡ/', pos: 'n.', zh: '時差不適', ex: 'The jet lag hit me hard on day two.', exZh: '第二天時差整個爆發。', tip: '台北到布拉格慢 6-7 小時（夏令時 6 小時）。' },
  { id: 'en-withdraw', lang: 'en', cat: '旅行', term: 'withdraw cash', pron: '/wɪðˈdrɔː/', pos: 'v.', zh: '提領現金', ex: 'Avoid Euronet ATMs when you withdraw cash.', exZh: '領現金時避開 Euronet 提款機。', tip: '布拉格觀光區 ATM 匯率超坑，用當地銀行的機器。' },
  { id: 'en-commute', lang: 'en', cat: '旅行', term: 'commute', pron: '/kəˈmjuːt/', pos: 'n./v.', zh: '通勤', ex: 'My commute to campus is 20 minutes by tram.', exZh: '我搭電車通勤到學校要二十分鐘。' },

  // ── 生活日常 ──
  { id: 'en-settle-in', lang: 'en', cat: '生活', term: 'settle in', pron: '/ˈsetl ɪn/', pos: 'phr. v.', zh: '安頓下來、適應新環境', ex: 'Give yourself two weeks to settle in.', exZh: '給自己兩週時間安頓下來。' },
  { id: 'en-run-errands', lang: 'en', cat: '生活', term: 'run errands', pron: '/rʌn ˈerəndz/', pos: 'phr.', zh: '跑腿辦雜事', ex: 'I spent Saturday running errands.', exZh: '我整個週六都在辦雜事。' },
  { id: 'en-groceries', lang: 'en', cat: '生活', term: 'groceries', pron: '/ˈɡroʊsəriz/', pos: 'n.', zh: '日用食品雜貨', ex: 'I do my groceries at Lidl on Sundays.', exZh: '我星期天去 Lidl 採買。', tip: '注意：捷克許多超市週日縮短營業。' },
  { id: 'en-on-a-budget', lang: 'en', cat: '生活', term: 'on a budget', pron: '/ɑːn ə ˈbʌdʒɪt/', pos: 'phr.', zh: '手頭有限、省著花', ex: 'We are travelling on a budget this month.', exZh: '我們這個月旅行要省著點。' },
  { id: 'en-split-the-bill', lang: 'en', cat: '生活', term: 'split the bill', pron: '/splɪt ðə bɪl/', pos: 'phr.', zh: '各付各的、分攤帳單', ex: 'Shall we split the bill?', exZh: '我們各付各的好嗎？', tip: '捷克餐廳可以直接說 separately，服務生會分開結。' },
  { id: 'en-grab-a-bite', lang: 'en', cat: '生活', term: 'grab a bite', pron: '/ɡræb ə baɪt/', pos: 'phr.', zh: '隨便吃點東西', ex: 'Want to grab a bite after class?', exZh: '下課後要不要去吃點東西？' },
  { id: 'en-laundry', lang: 'en', cat: '生活', term: 'do the laundry', pron: '/ˈlɔːndri/', pos: 'phr.', zh: '洗衣服', ex: 'I have to do the laundry before the dorm closes.', exZh: '我得趁宿舍關門前洗衣服。' },
  { id: 'en-prescription', lang: 'en', cat: '生活', term: 'prescription', pron: '/prɪˈskrɪpʃn/', pos: 'n.', zh: '處方箋', ex: 'You need a prescription for this medicine.', exZh: '這個藥需要處方箋。' },
  { id: 'en-symptom', lang: 'en', cat: '生活', term: 'symptom', pron: '/ˈsɪmptəm/', pos: 'n.', zh: '症狀', ex: 'My symptoms started three days ago.', exZh: '我的症狀三天前開始。' },
  { id: 'en-heads-up', lang: 'en', cat: '生活', term: 'a heads-up', pron: '/ə ˈhedz ʌp/', pos: 'n.', zh: '事先提醒', ex: 'Thanks for the heads-up about the strike.', exZh: '謝謝你先提醒我罷工的事。' },

  // ── 社交口語 ──
  { id: 'en-small-talk', lang: 'en', cat: '社交', term: 'small talk', pron: '/smɔːl tɔːk/', pos: 'n.', zh: '寒暄閒聊', ex: 'Europeans make less small talk than Americans.', exZh: '歐洲人比美國人少寒暄。' },
  { id: 'en-hang-out', lang: 'en', cat: '社交', term: 'hang out', pron: '/hæŋ aʊt/', pos: 'phr. v.', zh: '一起消磨時間、混在一起', ex: 'We hang out at the dorm kitchen most nights.', exZh: '我們多數晚上都窩在宿舍廚房。' },
  { id: 'en-catch-up', lang: 'en', cat: '社交', term: 'catch up', pron: '/kætʃ ʌp/', pos: 'phr. v.', zh: '敘舊、補進度', ex: 'Let us catch up over coffee this weekend.', exZh: '我們週末喝咖啡聊聊吧。' },
  { id: 'en-be-up-for', lang: 'en', cat: '社交', term: 'be up for', pron: '/biː ʌp fɔːr/', pos: 'phr.', zh: '有意願做某事', ex: 'Are you up for a hike on Saturday?', exZh: '你週六想去健行嗎？' },
  { id: 'en-rain-check', lang: 'en', cat: '社交', term: 'take a rain check', pron: '/reɪn tʃek/', pos: 'phr.', zh: '這次先不行、改天再約', ex: 'Can I take a rain check? I have a deadline.', exZh: '這次先跳過好嗎？我有截止日要趕。', tip: '婉拒但保留下次的漂亮說法。' },
  { id: 'en-my-treat', lang: 'en', cat: '社交', term: 'my treat', pron: '/maɪ triːt/', pos: 'phr.', zh: '我請客', ex: 'Put your wallet away, my treat.', exZh: '錢包收起來，我請。' },
  { id: 'en-homesick', lang: 'en', cat: '社交', term: 'homesick', pron: '/ˈhoʊmsɪk/', pos: 'adj.', zh: '想家的', ex: 'I get homesick around the holidays.', exZh: '一到節日我就會想家。' },
  { id: 'en-culture-shock', lang: 'en', cat: '社交', term: 'culture shock', pron: '/ˈkʌltʃər ʃɑːk/', pos: 'n.', zh: '文化衝擊', ex: 'The silence on Czech trams was a culture shock.', exZh: '捷克電車上的安靜讓我文化衝擊。' },
  { id: 'en-get-along', lang: 'en', cat: '社交', term: 'get along with', pron: '/ɡet əˈlɔːŋ/', pos: 'phr. v.', zh: '和某人相處融洽', ex: 'I get along well with my flatmates.', exZh: '我跟室友相處得很好。' },
  { id: 'en-drop-by', lang: 'en', cat: '社交', term: 'drop by', pron: '/drɑːp baɪ/', pos: 'phr. v.', zh: '順道拜訪', ex: 'Drop by my room if you need the charger.', exZh: '需要充電器就來我房間。' },
  { id: 'en-figure-out', lang: 'en', cat: '社交', term: 'figure out', pron: '/ˈfɪɡjər aʊt/', pos: 'phr. v.', zh: '弄懂、想出辦法', ex: 'I finally figured out how the ticket machine works.', exZh: '我終於搞懂售票機怎麼用了。' },
  { id: 'en-look-forward', lang: 'en', cat: '社交', term: 'look forward to', pron: '/lʊk ˈfɔːrwərd tuː/', pos: 'phr.', zh: '期待（後面接名詞或 -ing）', ex: 'I am looking forward to meeting you in Prague.', exZh: '我很期待在布拉格見到你。', tip: '常見錯誤：to 後面不能接原形動詞，要用 -ing。' },
  { id: 'en-run-late', lang: 'en', cat: '社交', term: 'be running late', pron: '/ˈrʌnɪŋ leɪt/', pos: 'phr.', zh: '快遲到了', ex: 'Sorry, I am running late — start without me.', exZh: '抱歉我快遲到了，你們先開始。' },
  { id: 'en-no-worries', lang: 'en', cat: '社交', term: 'no worries', pron: '/noʊ ˈwɜːriz/', pos: 'phr.', zh: '沒關係、別在意', ex: 'No worries, it happens.', exZh: '沒關係，常有的事。' },

  // ── 表達與寫作 ──
  { id: 'en-i-was-wondering', lang: 'en', cat: '書信', term: 'I was wondering if…', pron: '/aɪ wəz ˈwʌndərɪŋ/', pos: 'phr.', zh: '不知道是否可以……（客氣請求）', ex: 'I was wondering if I could join the course late.', exZh: '不知道我是否能晚點加選這門課。', tip: '寫信給教授的萬用開頭，比 Can I 有禮貌。' },
  { id: 'en-follow-up', lang: 'en', cat: '書信', term: 'follow up', pron: '/ˈfɑːloʊ ʌp/', pos: 'phr. v.', zh: '後續追蹤、再確認一次', ex: 'I am following up on my email from last week.', exZh: '我來追蹤上週那封信。' },
  { id: 'en-in-advance', lang: 'en', cat: '書信', term: 'in advance', pron: '/ɪn ədˈvæns/', pos: 'phr.', zh: '事先、預先', ex: 'Thank you in advance for your help.', exZh: '先謝謝您的幫忙。' },
  { id: 'en-attach', lang: 'en', cat: '書信', term: 'attached', pron: '/əˈtætʃt/', pos: 'adj.', zh: '（信件）附件如下', ex: 'Please find the form attached.', exZh: '表格請見附件。' },
  { id: 'en-clarify', lang: 'en', cat: '書信', term: 'clarify', pron: '/ˈklærəfaɪ/', pos: 'v.', zh: '澄清、講清楚', ex: 'Could you clarify what counts as the final grade?', exZh: '可以說明什麼算進期末成績嗎？' },
  { id: 'en-straightforward', lang: 'en', cat: '書信', term: 'straightforward', pron: '/ˌstreɪtˈfɔːrwərd/', pos: 'adj.', zh: '簡單明瞭的、直接的', ex: 'The registration process is pretty straightforward.', exZh: '註冊流程還算單純。' },
  { id: 'en-workaround', lang: 'en', cat: '書信', term: 'workaround', pron: '/ˈwɜːrkəraʊnd/', pos: 'n.', zh: '變通辦法', ex: 'There is a workaround if the portal is down.', exZh: '如果系統掛了有變通辦法。' },
  { id: 'en-bear-with', lang: 'en', cat: '書信', term: 'bear with me', pron: '/ber wɪð miː/', pos: 'phr.', zh: '請稍等一下、包涵一下', ex: 'Bear with me, my Czech is still terrible.', exZh: '請包涵，我的捷克語還很糟。' },
];

export const ALL_WORDS = [...CZECH_WORDS, ...ENGLISH_WORDS];

/** 每日精選字 ＋ 單字大全：收藏、測驗干擾選項都從這裡查 */
export const ALL_TERMS = [...ALL_WORDS, ...CZ_VOCAB, ...EN_VOCAB];
export const TERMS_BY_ID = new Map(ALL_TERMS.map((word) => [word.id, word]));

/**
 * 情境會話包：一句同時給捷克文、英文、中文——
 * 在布拉格英文多半通，但先講捷克文再切英文最吃得開。
 */
export const PHRASE_SCENES = [
  {
    id: 'scene-restaurant',
    icon: '🍽️',
    title: '餐廳點餐',
    subtitle: '從入座到結帳的完整流程',
    lines: [
      { cs: 'Dobrý den, stůl pro dva, prosím.', pron: 'DOB-ree den, stool pro dva', en: 'Hi, a table for two, please.', zh: '您好，兩位。' },
      { cs: 'Máte anglický jídelní lístek?', pron: 'MAA-te AN-glits-kee YEE-del-nyee LEES-tek', en: 'Do you have an English menu?', zh: '有英文菜單嗎？' },
      { cs: 'Dám si tohle a velké pivo.', pron: 'daam si TO-hle a VEL-kee PI-vo', en: 'I will have this and a large beer.', zh: '我要這個和一杯大啤酒。' },
      { cs: 'Jsem vegetarián. / Jsem vegetariánka.', pron: 'ysem ve-ge-ta-ri-AAN', en: 'I am vegetarian.', zh: '我吃素。（女生用 -ka 結尾）' },
      { cs: 'Bylo to výborné, děkuju.', pron: 'BI-lo to VEE-bor-nee', en: 'It was excellent, thank you.', zh: '很好吃，謝謝。' },
      { cs: 'Zaplatím, prosím. Platím kartou.', pron: 'ZA-pla-tyeem, PRO-seem', en: 'The bill, please. I will pay by card.', zh: '我要結帳，我刷卡。' },
      { cs: 'Zvlášť, prosím.', pron: 'zvlaasht', en: 'Separately, please.', zh: '請分開結。' },
    ],
    tip: '服務生不會主動送帳單，要舉手說 Zaplatím！小費約 10%，可直接說要付的總額。',
  },
  {
    id: 'scene-supermarket',
    icon: '🛒',
    title: '超市採買',
    subtitle: 'Lidl／Albert／Billa 生存包',
    lines: [
      { cs: 'Kolik to stojí?', pron: 'KO-lik to STO-yee', en: 'How much is it?', zh: '這多少錢？' },
      { cs: 'Kde najdu rýži?', pron: 'kde NAY-du REE-zhi', en: 'Where can I find rice?', zh: '米放在哪裡？' },
      { cs: 'Tašku nepotřebuju, děkuju.', pron: 'TASH-ku ne-PO-trzhe-bu-yu', en: 'I do not need a bag, thanks.', zh: '不用袋子，謝謝。' },
      { cs: 'Máte to i v menším balení?', pron: 'MAA-te to i v MEN-sheem BA-le-nyee', en: 'Do you have a smaller pack?', zh: '有小包裝嗎？' },
      { cs: 'Účtenku, prosím.', pron: 'OOCH-ten-ku', en: 'Receipt, please.', zh: '請給我收據。' },
      { cs: 'Můžu platit kartou?', pron: 'MOO-zhu PLA-tit KAR-tou', en: 'Can I pay by card?', zh: '可以刷卡嗎？' },
    ],
    tip: '結帳前收銀員常問 Máte kartičku?（有會員卡嗎），答 Ne, děkuju 就好。蔬果要自己秤重貼標。',
  },
  {
    id: 'scene-transport',
    icon: '🚋',
    title: '大眾運輸',
    subtitle: '電車、地鐵、查票',
    lines: [
      { cs: 'Jednu jízdenku na třicet minut, prosím.', pron: 'YED-nu YEEZ-den-ku na TRZHI-tset MI-nut', en: 'One 30-minute ticket, please.', zh: '請給我一張三十分鐘的票。' },
      { cs: 'Jede tahle tramvaj do centra?', pron: 'YE-de TA-hle TRAM-vay do TSEN-tra', en: 'Does this tram go to the centre?', zh: '這班電車到市中心嗎？' },
      { cs: 'Kde musím přestoupit?', pron: 'kde MU-seem PRZHE-stou-pit', en: 'Where do I have to change?', zh: '我要在哪裡轉車？' },
      { cs: 'Vystupujete?', pron: 'VI-stu-pu-ye-te', en: 'Are you getting off?', zh: '您要下車嗎？（想擠出門口時說）' },
      { cs: 'Mám měsíční kupón.', pron: 'maam MYE-seech-nyee KU-poon', en: 'I have a monthly pass.', zh: '我有月票。' },
      { cs: 'Promiňte, nevěděl jsem, že musím označit.', pron: 'ne-VYE-dyel ysem', en: 'Sorry, I did not know I had to validate it.', zh: '抱歉，我不知道要打票。' },
    ],
    tip: '學生（26 歲以下）長期票便宜到不可思議，落地先去 Lítačka 辦卡；上車沒打票被抓罰 1000 Kč 起跳。',
  },
  {
    id: 'scene-campus',
    icon: '🎓',
    title: '校園註冊',
    subtitle: '國際處、選課、找教室',
    lines: [
      { cs: 'Jsem výměnný student z Tchaj-wanu.', pron: 'VEE-myen-nee STU-dent', en: 'I am an exchange student from Taiwan.', zh: '我是來自台灣的交換學生。' },
      { cs: 'Kde je studijní oddělení?', pron: 'STU-diy-nyee OD-dye-le-nyee', en: 'Where is the study department office?', zh: '教務處在哪裡？' },
      { cs: 'Můžu se ještě zapsat na tenhle předmět?', pron: 'ZA-psat na TEN-hle PRZHED-myet', en: 'Can I still register for this course?', zh: '我還能加選這門課嗎？' },
      { cs: 'Kdy je zkouška a kde?', pron: 'kdi ye ZKOUSH-ka', en: 'When and where is the exam?', zh: '考試什麼時候、在哪？' },
      { cs: 'Potřebuju potvrzení o studiu.', pron: 'PO-tvr-ze-nyee o STU-di-yu', en: 'I need a confirmation of study.', zh: '我需要在學證明。' },
      { cs: 'Je ta přednáška v angličtině?', pron: 'v AN-glich-tyi-nye', en: 'Is that lecture in English?', zh: '那堂課是用英文上的嗎？' },
    ],
    tip: '交換生最重要的紙：Confirmation of Study（在學證明）+ Learning Agreement，辦居留、開戶都會用到。',
  },
  {
    id: 'scene-emergency',
    icon: '🚑',
    title: '看醫生與緊急狀況',
    subtitle: '最不想用、但最該先背的一頁',
    lines: [
      { cs: 'Potřebuju doktora.', pron: 'PO-trzhe-bu-yu DOK-to-ra', en: 'I need a doctor.', zh: '我需要看醫生。' },
      { cs: 'Bolí mě břicho už dva dny.', pron: 'BO-lee mnye BRZHI-kho', en: 'My stomach has hurt for two days.', zh: '我肚子痛兩天了。' },
      { cs: 'Jsem alergický na penicilin.', pron: 'A-ler-gits-kee na', en: 'I am allergic to penicillin.', zh: '我對盤尼西林過敏。（女生 alergická）' },
      { cs: 'Máte něco na kašel?', pron: 'MAA-te NYE-tso na KA-shel', en: 'Do you have something for a cough?', zh: '有治咳嗽的藥嗎？' },
      { cs: 'Mluvíte anglicky? Nerozumím dobře česky.', pron: 'MLU-vee-te AN-glits-ki', en: 'Do you speak English? I do not understand Czech well.', zh: '您會英文嗎？我捷克語不太行。' },
      { cs: 'Zavolejte prosím záchranku.', pron: 'ZA-vo-ley-te ZAA-khran-ku', en: 'Please call an ambulance.', zh: '請叫救護車。' },
    ],
    tip: '全歐緊急號碼 112（可講英文）；救護 155、警察 158。隨身帶保險卡與護照影本。',
  },
  {
    id: 'scene-housing',
    icon: '🏠',
    title: '宿舍與租屋',
    subtitle: '報修、押金、室友',
    lines: [
      { cs: 'Nefunguje mi topení.', pron: 'ne-FUN-gu-ye mi TO-pe-nyee', en: 'My heating does not work.', zh: '我的暖氣壞了。' },
      { cs: 'Kde je prádelna a jak se platí?', pron: 'PRAA-del-na', en: 'Where is the laundry room and how do I pay?', zh: '洗衣間在哪、怎麼付費？' },
      { cs: 'Ztratil jsem klíč od pokoje.', pron: 'ZTRA-tyil ysem kleech', en: 'I lost my room key.', zh: '我把房間鑰匙弄丟了。（女生 Ztratila）' },
      { cs: 'Kolik je záloha a kdy ji vrátíte?', pron: 'ZAA-lo-ha', en: 'How much is the deposit and when is it returned?', zh: '押金多少？什麼時候退？' },
      { cs: 'Je nájem včetně energií?', pron: 'VCHET-nye e-ner-GI-yee', en: 'Is rent including utilities?', zh: '房租含水電嗎？' },
      { cs: 'Můžeme se domluvit anglicky?', pron: 'do-MLU-vit', en: 'Can we sort this out in English?', zh: '我們可以用英文溝通嗎？' },
    ],
    tip: '租屋看到 „+ poplatky"（+ 費用）代表水電另計；簽約前一定要拍照存證房況。',
  },
  {
    id: 'scene-smalltalk',
    icon: '🍻',
    title: '交朋友與閒聊',
    subtitle: '第一週宿舍廚房用得到',
    lines: [
      { cs: 'Jak se jmenuješ? Já jsem…', pron: 'yak se YME-nu-yesh', en: 'What is your name? I am…', zh: '你叫什麼名字？我是……' },
      { cs: 'Odkud jsi? Jsem z Tchaj-wanu.', pron: 'OD-kud ysi', en: 'Where are you from? I am from Taiwan.', zh: '你從哪來？我來自台灣。' },
      { cs: 'Co studuješ?', pron: 'tso STU-du-yesh', en: 'What do you study?', zh: '你讀什麼？' },
      { cs: 'Nedáme si pivo?', pron: 'ne-DAA-me si PI-vo', en: 'Shall we grab a beer?', zh: '要不要去喝杯啤酒？' },
      { cs: 'Můžeme si tykat.', pron: 'MOO-zhe-me si TI-kat', en: 'We can use the informal you.', zh: '我們可以互相用「你」。' },
      { cs: 'Máš Instagram? Napíšu ti.', pron: 'NA-pee-shu tyi', en: 'Are you on Instagram? I will message you.', zh: '你有 IG 嗎？我傳訊息給你。' },
    ],
    tip: '捷克人第一次見面可能顯得冷淡，那是禮貌不是討厭；喝過一杯之後常判若兩人。',
  },
  {
    id: 'scene-bank',
    icon: '🏦',
    title: '銀行與行政',
    subtitle: '開戶、居留、電話卡',
    lines: [
      { cs: 'Chtěl bych si založit studentský účet.', pron: 'ZA-lo-zhit', en: 'I would like to open a student account.', zh: '我想開學生帳戶。（女生 Chtěla）' },
      { cs: 'Jaké doklady potřebujete?', pron: 'YA-kee DO-kla-di', en: 'Which documents do you need?', zh: '你們需要哪些文件？' },
      { cs: 'Musím se přihlásit na cizinecké policii.', pron: 'tsi-zi-NETS-kee PO-li-tsi-yi', en: 'I have to register with the foreign police.', zh: '我必須去外國人警局登記。' },
      { cs: 'Potřebuju SIM kartu s daty.', pron: 'S-daty', en: 'I need a SIM card with data.', zh: '我需要有網路的 SIM 卡。' },
      { cs: 'Kde si můžu vyzvednout kartu?', pron: 'VI-zved-nout', en: 'Where can I pick up the card?', zh: '我在哪領卡？' },
      { cs: 'Můžete mi to napsat na papír?', pron: 'NA-psat na PA-peer', en: 'Could you write it down for me?', zh: '可以幫我寫在紙上嗎？' },
    ],
    tip: '非歐盟學生抵達後通常 3 個工作天內要到 cizinecká policie 報到，帶護照、簽證、住宿證明。',
  },
  {
    id: 'scene-directions',
    icon: '🗺️',
    title: '問路與方向',
    subtitle: '手機沒電時的保命包',
    lines: [
      { cs: 'Promiňte, kde je nejbližší metro?', pron: 'NEY-blizh-shee', en: 'Excuse me, where is the nearest metro?', zh: '不好意思，最近的地鐵站在哪？' },
      { cs: 'Jak se dostanu na Staroměstské náměstí?', pron: 'yak se DO-sta-nu', en: 'How do I get to the Old Town Square?', zh: '我要怎麼去舊城廣場？' },
      { cs: 'Je to daleko? Můžu jít pěšky?', pron: 'DA-le-ko / pyesh-ki', en: 'Is it far? Can I walk?', zh: '很遠嗎？可以走路嗎？' },
      { cs: 'Rovně, doleva, doprava.', pron: 'ROV-nye, DO-le-va, DO-pra-va', en: 'Straight, left, right.', zh: '直走、左轉、右轉。' },
      { cs: 'Ztratil jsem se.', pron: 'ZTRA-tyil ysem se', en: 'I am lost.', zh: '我迷路了。' },
      { cs: 'Můžete mi to ukázat na mapě?', pron: 'U-kaa-zat na MA-pye', en: 'Can you show me on the map?', zh: '可以在地圖上指給我看嗎？' },
    ],
    tip: '地址寫法是「街名 + 門牌」，門牌常有兩個號碼（紅色是行政編號、藍色才是找路用的）。',
  },
  {
    id: 'scene-cafe',
    icon: '☕',
    title: '咖啡廳與唸書',
    subtitle: '交換生的第二個家',
    lines: [
      { cs: 'Je tu volno?', pron: 'ye tu VOL-no', en: 'Is this seat free?', zh: '這位子有人嗎？' },
      { cs: 'Dám si malé latte, prosím.', pron: 'MA-lee LA-te', en: 'A small latte, please.', zh: '請給我一杯小拿鐵。' },
      { cs: 'Máte wifi? Jaké je heslo?', pron: 'YA-kee ye HES-lo', en: 'Do you have wifi? What is the password?', zh: '有 wifi 嗎？密碼是什麼？' },
      { cs: 'Můžu si tu nabít notebook?', pron: 'NA-beet', en: 'Can I charge my laptop here?', zh: '我可以在這充筆電嗎？' },
      { cs: 'S sebou, prosím.', pron: 's SE-bou', en: 'To go, please.', zh: '外帶，謝謝。' },
      { cs: 'Ještě jednu, prosím.', pron: 'YESH-tye YED-nu', en: 'One more, please.', zh: '再來一杯，謝謝。' },
    ],
    tip: '「S sebou」是外帶的固定說法，字面是「隨身帶著」。捷克咖啡廳常不趕人，是寫報告聖地。',
  },
  {
    id: 'scene-weather',
    icon: '🧥',
    title: '天氣與季節',
    subtitle: '中歐冬天的心理準備',
    lines: [
      { cs: 'Jaké bude zítra počasí?', pron: 'YA-kee BU-de ZEE-tra PO-cha-see', en: 'What will the weather be like tomorrow?', zh: '明天天氣如何？' },
      { cs: 'Je mi zima.', pron: 'ye mi ZI-ma', en: 'I am cold.', zh: '我很冷。' },
      { cs: 'Venku sněží.', pron: 'VEN-ku SNYE-zhee', en: 'It is snowing outside.', zh: '外面在下雪。' },
      { cs: 'Prší, vezmi si deštník.', pron: 'PR-shee, VEZ-mi si DESHT-nyeek', en: 'It is raining, take an umbrella.', zh: '下雨了，帶把傘。' },
      { cs: 'V zimě je tma už ve čtyři.', pron: 'v ZI-mye ye tma', en: 'In winter it is dark by four.', zh: '冬天四點就天黑了。' },
      { cs: 'Potřebuju teplou bundu.', pron: 'TEP-lou BUN-du', en: 'I need a warm jacket.', zh: '我需要一件保暖外套。' },
    ],
    tip: '十一月到二月天黑得很早，維他命 D 和一件真正防風的外套是留學必備。',
  },
  {
    id: 'scene-travel',
    icon: '✈️',
    title: '週末旅行',
    subtitle: '從布拉格出發的歐洲門票',
    lines: [
      { cs: 'Jednu zpáteční do Vídně, prosím.', pron: 'ZPAA-tech-nyee', en: 'One return ticket to Vienna, please.', zh: '請給我一張到維也納的來回票。' },
      { cs: 'Z kterého nástupiště to jede?', pron: 'NAA-stu-pish-tye', en: 'Which platform does it leave from?', zh: '從第幾月台發車？' },
      { cs: 'Je tohle místo rezervované?', pron: 'RE-zer-vo-va-nee', en: 'Is this seat reserved?', zh: '這個位子有訂位嗎？' },
      { cs: 'Máte úschovnu zavazadel?', pron: 'OOS-khov-nu', en: 'Do you have luggage storage?', zh: '有行李寄放嗎？' },
      { cs: 'V kolik je check-in?', pron: 'v KO-lik', en: 'What time is check-in?', zh: '幾點可以入住？' },
      { cs: 'Přijedeme kolem osmé večer.', pron: 'PRZHI-ye-de-me', en: 'We will arrive around eight in the evening.', zh: '我們大約晚上八點到。' },
    ],
    tip: 'RegioJet／FlixBus 常比火車便宜；布拉格到維也納、德勒斯登、克拉科夫都只要 4 小時左右。',
  },
];

/** 龍龍小知識：每天一則捷克文化／語言冷知識 */
export const DAILY_TIPS = [
  { icon: '🐉', title: 'ř 是捷克的獨門絕活', body: '全世界只有捷克語有 ř 這個音（Dvořák 的那個 ř）。連捷克小孩都要練到六七歲才會，發不出來很正常——舌尖顫音同時加上「日」的摩擦。學會了會被當地人熱烈稱讚。' },
  { icon: '🧭', title: '重音永遠在第一音節', body: '不管單字多長，捷克語重音一律落在第一音節，而且字怎麼寫就怎麼唸，沒有英文那種不規則發音。這是捷克語對外國人最友善的地方。' },
  { icon: '📦', title: '一個名詞有七種變化', body: '捷克語有七個格（pády）。Praha（布拉格）會變成 do Prahy（去布拉格）、v Praze（在布拉格）。看到地名長得不一樣不要慌，那還是同一個城市。' },
  { icon: '🍺', title: '啤酒比水便宜是真的', body: '捷克人均啤酒消費量世界第一（每人每年約 130 公升）。多數餐廳裡 0.5 公升生啤比同樣容量的礦泉水便宜，而且水要另外付錢。' },
  { icon: '🙋', title: 'Prosím 是萬用瑞士刀', body: '「請」、「不客氣」、「你說什麼？」、「請進」、「請便」全都是 prosím。聽不清楚時把語調上揚說 Prosím? 就等於 Sorry?' },
  { icon: '🚪', title: '進店要先打招呼', body: '走進小店、麵包店、診所候診室，先說 Dobrý den；離開說 Na shledanou。不打招呼在捷克算沒禮貌，這是比文法更重要的生存技能。' },
  { icon: '👋', title: 'tykat vs vykat 的地雷', body: '對老師、房東、店員要用敬語 vykat；朋友、同學用 tykat。改用 ty 要由年長或位階高的一方提議：Můžeme si tykat? 自己先跳過去會有點失禮。' },
  { icon: '🏢', title: '一樓不是一樓', body: '捷克（歐陸通則）地面層叫 přízemí（0 樓），1. patro 是台灣人說的二樓。約在「一樓大廳」見面前先確認清楚，不然會兩人各站一層樓。' },
  { icon: '🚫', title: '雙重否定才是對的', body: '捷克語否定要一路否定到底：Nikdo nic neví 字面是「沒有人不知道任何事」，實際意思是「沒有人知道任何事」。用英文邏輯去推會整個翻車。' },
  { icon: '👩', title: '女生的姓要加 -ová', body: 'Novák 先生的太太是 Nováková。連外國人名也常被捷克媒體加上去，Taylor Swift 會變成 Taylor Swiftová。看到 -ová 就知道是女性。' },
  { icon: '🎫', title: '查票員是真的會出現', body: 'Revizor（查票員）穿便服，亮證件就開罰，觀光客身分完全不管用。上車第一件事是打票；買了長期票也要隨身帶學生證備查。' },
  { icon: '🥖', title: 'lékárna 不是 drogerie', body: '藥要去 lékárna（藥局），drogerie（如 dm、Rossmann）只賣洗髮精、衛生用品。感冒時走錯門會浪費半小時。' },
  { icon: '📅', title: '週日大部分店家關門', body: '捷克法律限制大型超市在部分國定假日營業，週日許多店提早關。週五採買是留學生的肌肉記憶。' },
  { icon: '🗣️', title: '「Ahoj」是水手用語', body: '捷克是內陸國，卻用航海招呼語 ahoj。一說是二十世紀初划船運動的年輕人帶進來的，之後就變成全國最日常的招呼。' },
  { icon: '🧊', title: '長音符號會改變意思', body: 'byt（公寓）vs být（是）、dráha（軌道）vs drahá（昂貴的）。那一撇不是裝飾，是要把母音拉長，唸錯句子意思就換了。' },
  { icon: '🍽️', title: '帳單不會自己來', body: '在捷克餐廳，你不開口服務生就不會送帳單——那是趕客人的意思。舉手說 Zaplatím, prosím! 小費約 10%，可以直接報你要付的整數。' },
  { icon: '🎓', title: 'zápočet 先過才有資格考試', body: '捷克大學把課程分成兩關：zápočet（平時作業／出席認證）和 zkouška（期末，多半口試）。沒拿到前者就不能考後者，交換生最常在這裡踩雷。' },
  { icon: '🗓️', title: '名字日 svátek 比生日還熱鬧', body: '每個日期都對應一個名字，輪到你的名字那天叫 svátek（名字日），同事朋友會祝你 Všechno nejlepší。捷克月曆上都印著。' },
  { icon: '💬', title: '「Ne」不是在兇你', body: '捷克人講話直接、表情少，服務業也不太微笑。那是文化風格不是針對你；熟了之後的熱情程度會讓你嚇一跳。' },
  { icon: '🎄', title: '聖誕節是鯉魚不是火雞', body: '捷克聖誕大餐是炸鯉魚配馬鈴薯沙拉，十二月街頭會出現裝滿活鯉魚的大水桶。禮物由 Ježíšek（小耶穌）在 24 日晚上送。' },
  { icon: '🚰', title: '自來水可以直接喝', body: '捷克自來水品質嚴格管制，全國都能生飲，帶水壺出門一年可以省下不少錢；但餐廳仍會賣你瓶裝水。' },
  { icon: '🎭', title: '你會需要「s sebou」', body: '外帶的說法是 s sebou（字面：隨身帶著）。咖啡、湯、午餐都用它。發音像「斯 sebou」，講完店員就懂。' },
  { icon: '🧾', title: '收據要收好', body: '捷克商家有電子登錄制度，退貨、報帳、跟房東請款都要 účtenka。Erasmus 補助核銷也吃這張紙。' },
  { icon: '🌍', title: '英文夠用，捷克語加分', body: '布拉格年輕人與大學圈英文普遍不錯，但公家機關、郵局、醫院常常只講捷克語。會五十個關鍵字的人，生活品質差很多。' },
];

/** 每日勉勵（打卡後顯示） */
export const STREAK_CHEERS = [
  '龍龍幫你把今天的單字收進書櫃了 📚',
  '再一天，你的捷克語就多長一片鱗片 🐉',
  '出發前每一天都算數，繼續走！',
  '今天的 ř 練得比昨天好一點了對吧？',
  '布拉格的電車正在等你唸出站名 🚋',
  '學一個字，未來就少一次比手畫腳。',
  '龍龍記錄下來了，這是你們的共同進度 ✍️',
];
