[🇬🇧 English](README.md) · [🇺🇦 Українська](README.uk.md) · 🇵🇱 **Polski**

# QR Router Admin

Jeden statyczny kod QR, który zawsze prowadzi na `<domena>/r/<slug>`. Dokąd
faktycznie przekierowuje — decyduje administrator w panelu, wybierając
aktywny link z listy. Sam kod QR przy tym się nie zmienia.

## Stos technologiczny

Node.js + Express + SQLite (jeden plik, bez osobnego kontenera bazy danych)
+ EJS. Stylizacja — Tailwind CSS przez CDN (bez kroku budowania), ciemny
motyw domyślnie z przełącznikiem na jasny (zapamiętywany w `localStorage`
przeglądarki), responsywny układ. Wszystko działa w kontenerach Docker, bez
zewnętrznych usług chmurowych i bez wynajmowania czegokolwiek dodatkowego.

## Szybki start (po IP / bez domeny)

Potrzebny jest tylko Docker + Docker Compose.

```
cp .env.example .env
docker compose up -d --build
```

Otwórz `http://localhost:3000` (lub `http://<IP-serwera>:3000`) — przy
pierwszym wejściu pojawi się formularz utworzenia konta administratora
(login + hasło, minimum 8 znaków). W kodzie nie ma żadnego domyślnego hasła:
dopóki konto nie zostanie utworzone przez ten formularz, zalogowanie się
jest niemożliwe.

Dalej: utwórz kod → dodaj jeden lub więcej linków → wybierz aktywny →
pobierz kod QR (PNG) przyciskiem i wydrukuj.

## Uruchomienie z własną domeną i HTTPS (Caddy)

Jeśli masz domenę, której rekord DNS A wskazuje na IP serwera, i otwarte są
porty 80/443:

1. W pliku `.env` ustaw:
   ```
   DOMAIN=qr.mojadomena.com
   ```
2. Uruchom razem z Caddy (osobny plik compose; certyfikat HTTPS od Let's
   Encrypt uzyskiwany jest automatycznie):
   ```
   docker compose -f docker-compose.https.yml up -d --build
   ```
3. Otwórz `https://qr.mojadomena.com` — dalej tak samo, przy pierwszym
   wejściu pojawi się formularz utworzenia administratora.

W tym trybie port 3000 nie jest publikowany na zewnątrz — cały ruch idzie
przez Caddy na porcie 443/80.

## Języki

Interfejs dostępny jest w trzech językach: ukraińskim, angielskim, polskim
(`src/locales/*.json`). Język jest wybierany w następujący sposób:

1. Jeśli istnieje ciasteczko `lang` (osoba już wybrała język przełącznikiem
   u góry) — używane jest ono.
2. W przeciwnym razie — używany jest język przeglądarki (nagłówek
   `Accept-Language`).
3. Jeśli język przeglądarki nie znajduje się na liście obsługiwanych —
   domyślnie używany jest angielski.

Przełącznik języków (UK · EN · PL) znajduje się u góry każdej strony, w tym
na ekranie logowania i pierwszej konfiguracji — działa bez zalogowania.

## Testy

Testy automatyczne (`tests/`) przechodzą przez cały cykl: kreator pierwszej
konfiguracji, logowanie, ochronę sekcji administracyjnej, tworzenie kodu,
dodawanie/przełączanie linków, przekierowanie, zmianę hasła, usuwanie;
osobny test współbieżności (setki jednoczesnych skanów podczas
równoległego przełączania aktywnego linku); oraz osobny test
wielojęzyczności (wykrywanie języka przeglądarki, domyślny angielski,
przełącznik, ochrona przed otwartym przekierowaniem przez parametr
`redirect`). Wykorzystują wbudowany `node --test` oraz izolowaną bazę danych
w pamięci — nie dotykają realnych danych (`./data/app.db`).

Bez Dockera (jednorazowo `npm install`):
```
npm install
npm test
```

Albo w kontenerze, bez instalowania Node.js na hoście:
```
docker compose run --rm app npm test
```

## Odzyskiwanie dostępu (zapomniane hasło)

W projekcie nie ma poczty e-mail i nie jest ona planowana — odzyskiwanie
odbywa się przez serwer, do którego administrator i tak ma dostęp
(SSH/Docker), bezpośrednio ustawiając nowe hasło w bazie danych:

```
docker compose exec app npm run reset-admin -- admin nowe_silne_haslo
```

(dla uruchomienia HTTPS: `docker compose -f docker-compose.https.yml exec app ...`)

To nadpisuje konto — poprzednie hasło nie jest potrzebne.

## Dane

Plik SQLite znajduje się w `./data/app.db` na hoście (wolumin Dockera) —
przetrwa restart i przebudowę kontenera. Kopia zapasowa = skopiowanie tego
pliku. Razem z nim przechowywany jest automatycznie wygenerowany sekret
sesji (`./data/.session_secret`) — nie usuwać, inaczej wszystkie sesje
zostaną wylogowane.

## Uwagi dotyczące produkcji

- Logowanie jest chronione prostym limitem prób (10 prób / 15 min na IP).
- Zmiana `BASE_DOMAIN` w sekcji Ustawienia nie wpływa na już wydrukowane
  kody QR — fizyczny kod koduje domenę, która była aktywna w momencie
  wygenerowania pliku PNG.
- Za Caddy automatyczne wykrywanie domeny (przy generowaniu nowych kodów QR)
  działa poprawnie od razu, ponieważ Caddy przekazuje właściwe nagłówki —
  nie trzeba nic dodatkowo konfigurować.
