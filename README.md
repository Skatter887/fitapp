# FitApp — Piano di Allenamento Personalizzato

Web app per generare e tracciare piani di allenamento settimanali personalizzati.

## Stack Tecnologico

- **Frontend**: Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Framer Motion · Shadcn/ui
- **Backend**: Express.js · TypeScript · Prisma ORM
- **Database**: PostgreSQL (locale via Docker / produzione via Railway, Render, Supabase)
- **Exercise API**: [Wger](https://wger.de/api/v2/) — open source, no API key required

---

## Avvio Locale (sviluppo)

### Prerequisiti
- Node.js 18+
- Docker Desktop (per PostgreSQL)

### 1. Avvia il database PostgreSQL

```bash
# dalla root del progetto
docker compose up -d
```

### 2. Backend

```bash
cd backend
npm install
npm run db:migrate   # Crea le tabelle su PostgreSQL
npm run dev          # Avvia su http://localhost:4000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev          # Avvia su http://localhost:3000
```

Aprire **http://localhost:3000** nel browser.

---

## Deploy in Produzione

### Frontend → Vercel o Netlify

1. Collega il repo a Vercel/Netlify
2. Imposta `Root Directory` su `frontend`
3. Aggiungi la variabile d'ambiente:
   ```
   NEXT_PUBLIC_API_URL=https://tuo-backend.railway.app
   ```

### Backend → Railway

1. Crea un nuovo progetto su [railway.app](https://railway.app)
2. Aggiungi un servizio **PostgreSQL** dal marketplace → Railway ti dà una `DATABASE_URL` automaticamente
3. Aggiungi un secondo servizio collegando il repo GitHub, con `Root Directory` su `backend`
4. Nella tab "Variables" del servizio backend, aggiungi:
   ```
   DATABASE_URL=<URL copiato dal servizio PostgreSQL di Railway>
   PORT=4000
   ```
5. Nella tab "Settings" imposta il **Start Command**:
   ```
   npm run db:deploy && npm run start
   ```
   Questo applica le migrazioni automaticamente ad ogni deploy e avvia il server.

### Backend → Render

1. Crea un **Web Service** su [render.com](https://render.com), collegando il repo, con `Root Directory` su `backend`
2. Aggiungi un **PostgreSQL** separato da Render dashboard
3. Nelle variabili d'ambiente del Web Service:
   ```
   DATABASE_URL=<Internal Database URL da Render>
   PORT=4000
   ```
4. Start Command: `npm run db:deploy && npm run start`

### Configurazione CORS

Quando il frontend è su Netlify/Vercel, aggiorna l'origine CORS nel backend (`src/index.ts`):

```ts
cors({ origin: 'https://tuo-frontend.netlify.app' })
```

---

## Funzionalità

- **Onboarding**: seleziona giorni/settimana e gruppi muscolari target
- **Piano Settimanale**: visualizza e interagisci con il piano generato (PPL / Full Body / Upper-Lower)
- **Esercizi**: card con immagini reali da Wger, serie/ripetizioni, sostituzione in-place
- **Completamento**: spunta esercizi singoli → sessione si completa automaticamente
- **Calendario**: griglia mensile con i giorni di allenamento completati evidenziati
- **Storico**: lista degli allenamenti completati con data e dettagli
- **Dark/Light Mode**: toggle nel header

---

## Struttura del Progetto

```
Fit/
├── backend/              # Express API (porta 4000)
│   ├── src/
│   │   ├── routes/       # plans, sessions, exercises, calendar
│   │   ├── services/     # wger.service.ts, planGenerator.ts
│   │   └── prisma/       # schema + migrazioni PostgreSQL
│   ├── .env              # variabili locali (non committare)
│   └── .env.example      # template variabili
├── frontend/             # Next.js app (porta 3000)
│   ├── app/              # Pagine: /, /plan, /calendar, /history
│   ├── components/
│   │   ├── onboarding/
│   │   ├── plan/
│   │   ├── calendar/
│   │   ├── layout/
│   │   └── ui/
│   └── context/          # WorkoutContext (state globale)
└── docker-compose.yml    # PostgreSQL 15 per sviluppo locale
```

---

## API Endpoints

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| POST | `/api/plans` | Genera nuovo piano |
| GET | `/api/plans/latest` | Piano più recente |
| GET | `/api/plans/:id` | Piano specifico |
| PATCH | `/api/sessions/:id/complete` | Completa/riapri sessione |
| PATCH | `/api/exercises/:id/complete` | Toggle esercizio completato |
| GET | `/api/exercises/:wgerId/alternatives` | Alternative per un esercizio |
| PUT | `/api/exercises/:id/replace` | Sostituisce esercizio |
| GET | `/api/calendar?year=&month=` | Giorni completati nel mese |
| GET | `/api/calendar/history` | Storico allenamenti |

## Script Utili (backend)

| Script | Uso |
|--------|-----|
| `npm run dev` | Server di sviluppo con hot-reload |
| `npm run build` | Compila TypeScript |
| `npm run start` | Avvia la build compilata (produzione) |
| `npm run db:migrate` | Crea/aggiorna il DB in sviluppo |
| `npm run db:deploy` | Applica migrazioni in produzione (no prompt) |
| `npm run db:generate` | Rigenera il Prisma client |
