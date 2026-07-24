# Référence API — SmartBooking

Cette référence documente l'API HTTP de **SmartBooking**, la plateforme SaaS de prise de rendez-vous intelligente. Elle décrit la base de l'API, l'authentification, la convention d'erreur, l'ensemble des endpoints par ressource, et fournit des exemples de requêtes/réponses réalistes.

> Documentation interactive : une interface **Swagger UI** est disponible sur **`/api/docs`** et la spécification **OpenAPI 3** brute sur **`/api/docs.json`**. Cette page en constitue le complément narratif.

---

## 1. Généralités

| Élément | Valeur |
| --- | --- |
| Préfixe de base | `/api` |
| Format d'échange | JSON (`Content-Type: application/json`) |
| Encodage | UTF-8 |
| Fuseau de référence | `Europe/Paris` (les instants sont échangés en ISO 8601 UTC) |
| Environnement local | API sur `http://localhost:4000`, proxy front `/api` sur `http://localhost:5173` |
| Documentation | Swagger UI `/api/docs`, spec OpenAPI `/api/docs.json` |

Tous les chemins ci-dessous sont relatifs au préfixe `/api`. Par exemple, l'endpoint noté `POST /auth/login` correspond à `POST /api/auth/login`.

---

## 2. Authentification

SmartBooking utilise un schéma à **deux jetons** :

1. **Access token — JWT** de courte durée (**15 minutes**). Transmis à chaque requête protégée via l'en-tête `Authorization`.
2. **Refresh token — jeton opaque rotatif**, stocké **haché en SHA-256** en base et déposé dans un **cookie `httpOnly` / `secure` / `sameSite`**. Il permet de renouveler l'access token sans ré-authentification. À chaque rafraîchissement, le refresh token est **pivoté** (l'ancien est révoqué).

### En-tête d'authentification

```http
Authorization: Bearer <access_token>
```

### Cycle de vie des jetons

```mermaid
sequenceDiagram
    participant C as Client
    participant A as API SmartBooking
    C->>A: POST /auth/login (email, password)
    A-->>C: 200 { accessToken } + Set-Cookie: refreshToken (httpOnly)
    Note over C,A: Requêtes protégées avec Authorization: Bearer
    C->>A: GET /appointments/me (Bearer access)
    A-->>C: 200 [...]
    Note over C,A: Au bout de 15 min, l'access token expire
    C->>A: POST /auth/refresh (cookie refreshToken)
    A-->>C: 200 { accessToken } + nouveau cookie refreshToken (rotation)
    C->>A: POST /auth/logout (cookie refreshToken)
    A-->>C: 204 (refresh révoqué)
```

### Sécurité associée

- **Mots de passe** : hachés avec **bcrypt (coût 12)**.
- **RBAC** : trois rôles — **`CLIENT`**, **`PRO`**, **`ADMIN`** — appliqués par le middleware `requireRole`, complétés par des vérifications de **propriété (ownership)**.
- **Rate limiting** : limiteur global + limiteur strict sur les routes d'authentification.
- **Message de connexion uniforme** et comparaison de hash à temps constant pour prévenir l'énumération de comptes.

---

## 3. Convention d'erreur

Toutes les erreurs renvoient un objet `error` cohérent :

```json
{
  "error": {
    "code": "SLOT_UNAVAILABLE",
    "message": "Le créneau demandé n'est plus disponible.",
    "details": { }
  }
}
```

| Champ | Type | Description |
| --- | --- | --- |
| `error.code` | `string` | Code machine stable (ex. `VALIDATION_ERROR`, `NOT_FOUND`, `SLOT_UNAVAILABLE`). |
| `error.message` | `string` | Message lisible destiné à l'affichage. |
| `error.details` | `object` \| `array` \| `absent` | Informations complémentaires structurées (erreurs de champ, alternatives de créneaux, ids en conflit…). |

### Codes d'erreur applicatifs

| Code | Statut HTTP | Signification |
| --- | --- | --- |
| `VALIDATION_ERROR` | `400` | Corps ou paramètres invalides (validation Zod). `details` liste les champs fautifs. |
| `UNAUTHORIZED` | `401` | Jeton absent, invalide ou expiré. |
| `FORBIDDEN` | `403` | Authentifié mais rôle ou propriété insuffisants. |
| `NOT_FOUND` | `404` | Ressource introuvable. |
| `CONFLICT` | `409` | Conflit d'état générique. |
| `SLOT_UNAVAILABLE` | `409` | Créneau indisponible. `details.alternatives` propose des créneaux de remplacement. |

---

## 4. Codes d'état standard

| Statut | Emploi |
| --- | --- |
| `200 OK` | Requête réussie avec corps de réponse. |
| `201 Created` | Ressource créée (inscription, réservation…). |
| `204 No Content` | Succès sans corps (déconnexion, suppression). |
| `400 Bad Request` | Validation échouée. |
| `401 Unauthorized` | Authentification requise ou invalide. |
| `403 Forbidden` | Accès refusé (rôle / propriété). |
| `404 Not Found` | Ressource inexistante. |
| `409 Conflict` | Conflit métier (dont `SLOT_UNAVAILABLE`). |
| `429 Too Many Requests` | Limite de débit atteinte. |
| `500 Internal Server Error` | Erreur inattendue côté serveur. |

---

## 5. Tableau des endpoints par ressource

Légende de la colonne **Rôle requis** : `—` = public ; `Auth` = tout utilisateur authentifié ; `CLIENT` / `PRO` / `ADMIN` = rôle exigé ; `Owner` = vérification de propriété en complément du rôle.

### 5.1 Authentification — `/auth`

| Méthode | Chemin | Rôle requis | Description |
| --- | --- | --- | --- |
| `POST` | `/auth/register` | — | Inscription d'un nouvel utilisateur. |
| `POST` | `/auth/login` | — | Connexion ; renvoie l'access token et pose le cookie refresh. |
| `POST` | `/auth/refresh` | — (cookie refresh) | Rotation du refresh token et émission d'un nouvel access token. |
| `POST` | `/auth/logout` | Auth | Révoque le refresh token courant et efface le cookie. |

### 5.2 Utilisateurs — `/users`

| Méthode | Chemin | Rôle requis | Description |
| --- | --- | --- | --- |
| `GET` | `/users/me` | Auth | Profil de l'utilisateur courant. |
| `PATCH` | `/users/me` | Auth | Mise à jour du profil courant. |
| `POST` | `/users/me/password` | Auth | Changement de mot de passe. |
| `GET` | `/users` | ADMIN | Liste des utilisateurs. |
| `PATCH` | `/users/:id` | ADMIN | Mise à jour d'un utilisateur (rôle, statut…). |

### 5.3 Professionnels — `/professionals`

| Méthode | Chemin | Rôle requis | Description |
| --- | --- | --- | --- |
| `GET` | `/professionals` | — | Liste des professionnels. |
| `GET` | `/professionals/me` | PRO | Fiche du professionnel connecté. |
| `GET` | `/professionals/:id` | — | Détail d'un professionnel. |
| `POST` | `/professionals` | PRO | Création de la fiche professionnelle. |
| `PATCH` | `/professionals/:id` | PRO + Owner | Mise à jour de la fiche. |
| `PUT` | `/professionals/:id/working-hours` | PRO + Owner | Définition des horaires hebdomadaires. |
| `POST` | `/professionals/:id/time-off` | PRO + Owner | Ajout d'une période d'indisponibilité. |
| `DELETE` | `/professionals/:id/time-off/:timeOffId` | PRO + Owner | Suppression d'une indisponibilité. |
| `GET` | `/professionals/:professionalId/services` | — | Services proposés par un professionnel. |
| `POST` | `/professionals/:professionalId/services` | PRO + Owner | Création d'un service. |

### 5.4 Services — `/services`

| Méthode | Chemin | Rôle requis | Description |
| --- | --- | --- | --- |
| `PATCH` | `/services/:id` | PRO + Owner | Mise à jour d'un service. |
| `DELETE` | `/services/:id` | PRO + Owner | Désactivation logique (soft delete). |

### 5.5 Rendez-vous — `/appointments`

| Méthode | Chemin | Rôle requis | Description |
| --- | --- | --- | --- |
| `GET` | `/appointments/slots` | — | Grille des créneaux disponibles (pas de 15 min). |
| `POST` | `/appointments/availability` | — | Vérifie la disponibilité d'un créneau précis et propose des alternatives. |
| `POST` | `/appointments` | CLIENT | Réservation d'un rendez-vous (anti-double-réservation transactionnel). |
| `GET` | `/appointments/me` | Auth | Rendez-vous de l'utilisateur courant. |
| `GET` | `/appointments/professional/:professionalId` | PRO + Owner | Rendez-vous d'un professionnel. |
| `GET` | `/appointments/:id` | Auth + Owner | Détail d'un rendez-vous. |
| `PATCH` | `/appointments/:id/reschedule` | Auth + Owner | Report vers un nouveau créneau (re-vérification atomique). |
| `PATCH` | `/appointments/:id/status` | PRO + Owner | Changement de statut (confirmer, terminer…). |
| `POST` | `/appointments/:id/cancel` | Auth + Owner | Annulation. |

### 5.6 Santé et métriques

| Méthode | Chemin | Rôle requis | Description |
| --- | --- | --- | --- |
| `GET` | `/health` | — | Liveness (le service répond). |
| `GET` | `/health/ready` | — | Readiness (ping base de données). |
| `GET` | `/metrics` | — | Métriques Prometheus (`prom-client`). |
| `GET` | `/api/docs` | — | Swagger UI. |
| `GET` | `/api/docs.json` | — | Spécification OpenAPI 3. |

---

## 6. Exemples de requêtes / réponses

Les instants sont exprimés en ISO 8601 UTC (`Z`). Les identifiants et jetons sont fictifs.

### 6.1 Inscription — `POST /api/auth/register`

**Requête**

```http
POST /api/auth/register HTTP/1.1
Content-Type: application/json

{
  "email": "camille.durand@example.com",
  "password": "Password123!",
  "firstName": "Camille",
  "lastName": "Durand"
}
```

**Réponse — `201 Created`**

```json
{
  "user": {
    "id": "usr_9f3c1a2b",
    "email": "camille.durand@example.com",
    "firstName": "Camille",
    "lastName": "Durand",
    "role": "CLIENT",
    "createdAt": "2026-07-24T09:12:44.000Z"
  }
}
```

> Le hash du mot de passe n'est jamais renvoyé : la sérialisation passe par `toPublicUser`, qui masque le champ sensible.

### 6.2 Connexion — `POST /api/auth/login`

**Requête**

```http
POST /api/auth/login HTTP/1.1
Content-Type: application/json

{
  "email": "client@smartbooking.dev",
  "password": "Password123!"
}
```

**Réponse — `200 OK`**

```http
HTTP/1.1 200 OK
Content-Type: application/json
Set-Cookie: refreshToken=2f1c...opaque; HttpOnly; Secure; SameSite=Strict; Path=/api/auth
```

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c3JfY2xpZW50Iiwicm9sZSI6IkNMSUVOVCIsImV4cCI6MTc4NDg3NTU2NH0.Kx8m2n...",
  "refreshToken": "2f1c9e7a-4b3d-4a11-9c2e-8ab0f5d61c34",
  "user": {
    "id": "usr_client",
    "email": "client@smartbooking.dev",
    "role": "CLIENT"
  }
}
```

> L'`accessToken` (JWT, 15 min) est à placer dans l'en-tête `Authorization: Bearer`. Le `refreshToken` opaque est également déposé en cookie `httpOnly` ; il est haché en SHA-256 côté serveur et pivoté à chaque `/auth/refresh`.

### 6.3 Créneaux disponibles — `GET /api/appointments/slots`

**Requête**

```http
GET /api/appointments/slots?professionalId=pro_martin&serviceId=svc_coupe&date=2026-07-27 HTTP/1.1
```

**Réponse — `200 OK`**

```json
{
  "professionalId": "pro_martin",
  "serviceId": "svc_coupe",
  "durationMinutes": 30,
  "timezone": "Europe/Paris",
  "slots": [
    { "start": "2026-07-27T08:00:00.000Z", "end": "2026-07-27T08:30:00.000Z" },
    { "start": "2026-07-27T08:15:00.000Z", "end": "2026-07-27T08:45:00.000Z" },
    { "start": "2026-07-27T08:30:00.000Z", "end": "2026-07-27T09:00:00.000Z" },
    { "start": "2026-07-27T13:30:00.000Z", "end": "2026-07-27T14:00:00.000Z" }
  ]
}
```

> La grille est calculée par le **Smart Scheduling Engine** au pas de **15 minutes** : ouvertures hebdomadaires étendues en intervalles UTC (gestion du fuseau `Europe/Paris` et du changement d'heure), moins les rendez-vous occupés et les indisponibilités, en respectant le délai de prévenance.

### 6.4 Vérification de disponibilité — `POST /api/appointments/availability`

Cet endpoint interroge le moteur pour un créneau **précis** et retourne, en cas d'indisponibilité, une raison granulaire et des **alternatives triées par proximité** avec l'heure désirée.

**Requête**

```http
POST /api/appointments/availability HTTP/1.1
Content-Type: application/json

{
  "professionalId": "pro_martin",
  "serviceId": "svc_coupe",
  "start": "2026-07-27T08:00:00.000Z"
}
```

**Réponse — `200 OK` (créneau indisponible pour cause de conflit)**

```json
{
  "available": false,
  "reason": "CONFLICT",
  "conflictingAppointmentIds": ["apt_7c4d9e"],
  "alternatives": [
    { "start": "2026-07-27T08:30:00.000Z", "end": "2026-07-27T09:00:00.000Z" },
    { "start": "2026-07-27T07:30:00.000Z", "end": "2026-07-27T08:00:00.000Z" },
    { "start": "2026-07-27T09:00:00.000Z", "end": "2026-07-27T09:30:00.000Z" }
  ]
}
```

> Raisons possibles renvoyées dans `reason` : `PAST`, `LEAD_TIME`, `OUTSIDE_WORKING_HOURS`, `TIME_OFF`, `CONFLICT`. Lorsque `available` vaut `true`, `reason` et `alternatives` sont absents.

### 6.5 Réservation — `POST /api/appointments`

#### Cas nominal — `201 Created`

**Requête**

```http
POST /api/appointments HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "professionalId": "pro_martin",
  "serviceId": "svc_coupe",
  "start": "2026-07-27T08:30:00.000Z"
}
```

**Réponse — `201 Created`**

```json
{
  "appointment": {
    "id": "apt_a1b2c3",
    "clientId": "usr_client",
    "professionalId": "pro_martin",
    "serviceId": "svc_coupe",
    "start": "2026-07-27T08:30:00.000Z",
    "end": "2026-07-27T09:00:00.000Z",
    "status": "PENDING",
    "createdAt": "2026-07-24T09:20:10.000Z"
  }
}
```

> La création s'exécute via `appointmentRepository.createIfAvailable` dans une **transaction Prisma en isolation `SERIALIZABLE`** : le chevauchement est re-vérifié atomiquement, ce qui garantit l'**anti-double-réservation** même en cas de requêtes concurrentes.

#### Cas conflit — `409 SLOT_UNAVAILABLE`

Si le créneau vient d'être pris (course concurrente ou changement d'état entre-temps), la réservation est refusée et le moteur propose des alternatives.

**Réponse — `409 Conflict`**

```json
{
  "error": {
    "code": "SLOT_UNAVAILABLE",
    "message": "Le créneau demandé n'est plus disponible.",
    "details": {
      "reason": "CONFLICT",
      "alternatives": [
        { "start": "2026-07-27T09:00:00.000Z", "end": "2026-07-27T09:30:00.000Z" },
        { "start": "2026-07-27T09:15:00.000Z", "end": "2026-07-27T09:45:00.000Z" },
        { "start": "2026-07-27T13:30:00.000Z", "end": "2026-07-27T14:00:00.000Z" }
      ]
    }
  }
}
```

> Les alternatives de `details.alternatives` sont ordonnées **des plus proches aux plus éloignées** de l'heure initialement demandée, prêtes à être présentées à l'utilisateur.

### 6.6 Exemple d'erreur de validation — `400 VALIDATION_ERROR`

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Le corps de la requête est invalide.",
    "details": [
      { "path": "start", "message": "Date ISO 8601 attendue." },
      { "path": "serviceId", "message": "Champ requis." }
    ]
  }
}
```

---

## 7. Comptes de démonstration

Le seed idempotent crée trois comptes (mot de passe commun **`Password123!`**) :

| Email | Rôle |
| --- | --- |
| `admin@smartbooking.dev` | ADMIN |
| `pro@smartbooking.dev` | PRO |
| `client@smartbooking.dev` | CLIENT |

---

## 8. Pour aller plus loin

- **Swagger UI** : `/api/docs` — exploration interactive et essais directs des endpoints.
- **OpenAPI 3** : `/api/docs.json` — génération de clients, contrats et tests de conformité.
