# TRItonas reitingas

Web app oficialiam TRItono klubo triatlono reitingui.

## Taškų formulė

```
taškai = ROUND(lyderio_laikas / dalyvio_laikas × bazė)
```

Bazė: Sprint **900**, Olimpinė **1000**, Half **1100**.

Bendras reitingas rikiuojamas pagal **3 geriausių varžybų taškų sumą**.

## Kas įtraukiamas

- Klubas su `TRItonas` (bet koks registras)
- Mišrus klubas (pvz. `Lietuvos kariuomenė / TRItonas`) — tik jei dalyvis jau narių sąraše
- Gryni TRItonas dalyviai automatiškai tampa nariais

## Paleidimas

```bash
npm install
npm run seed
npx tsx scripts/import-sample-races.ts   # optional: Druskininkai OD/SD
npm run dev
```

Atidarykite [http://localhost:3000](http://localhost:3000).

## Testai

```bash
npm test
```
