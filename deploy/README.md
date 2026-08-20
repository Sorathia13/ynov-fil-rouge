# Déploiement de SmartBooking (gratuit et permanent, Oracle Cloud Always Free)

Ce guide met SmartBooking en ligne sur une VM gratuite, avec HTTPS automatique. La pile
(`db` + `api` + `web` + `caddy`) tourne via `docker-compose.prod.yml`.

## Ce dont tu as besoin
- Un compte **Oracle Cloud** (l'inscription demande une carte pour vérification ; les
  ressources « Always Free » ne sont pas débitées).
- Un **domaine** gratuit qui pointera vers la VM : le plus simple est un sous-domaine
  **DuckDNS** (https://www.duckdns.org).
- Ta **clé SSH publique** (pour te connecter à la VM).

## 1. Créer la VM (Always Free)
1. Console Oracle → *Compute* → *Instances* → *Create instance*.
2. **Image** : Ubuntu 22.04. **Shape** : `VM.Standard.A1.Flex` (ARM Ampere, Always Free —
   mets 1 OCPU et 6 Go de RAM, largement suffisant). Si « out of capacity », réessaie plus
   tard, change de *Availability Domain*, ou prends `VM.Standard.E2.1.Micro` (x86, 1 Go —
   plus juste ; dans ce cas ne lance pas le monitoring).
3. Colle ta clé SSH publique.
4. Crée l'instance et note son **adresse IP publique**.

## 2. Ouvrir les ports 80 et 443
Deux niveaux de pare-feu, il faut les deux :

**a) Réseau (VCN)** : *Networking* → ta VCN → *Security Lists* → *Default* → *Add Ingress
Rules* : source `0.0.0.0/0`, TCP, ports **80** puis **443**.

**b) Sur la VM** (les images Oracle bloquent tout sauf SSH par iptables) :
```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

## 3. Pointer le domaine
Sur DuckDNS : crée un sous-domaine (ex. `smartbooking`) et mets l'**IP publique de la VM**
comme adresse. Ton domaine sera `smartbooking.duckdns.org`.

## 4. Installer Docker
```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && exit   # reconnecte-toi ensuite en SSH
```

## 5. Récupérer le projet et configurer
```bash
git clone https://github.com/Sorathia13/ynov-fil-rouge.git
cd ynov-fil-rouge/deploy
cp .env.prod.example .env
nano .env   # renseigne DOMAIN, ACME_EMAIL, POSTGRES_PASSWORD, les 2 secrets JWT
```
Génère chaque secret avec : `openssl rand -hex 32`

## 6. Lancer
```bash
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```
Au démarrage, l'API applique les migrations, et Caddy obtient automatiquement le certificat
HTTPS pour ton domaine (patiente ~1 min la première fois). Ouvre ensuite :
**https://ton-domaine** 🎉

Vérifier : `docker compose -f docker-compose.prod.yml ps` et
`docker compose -f docker-compose.prod.yml logs -f caddy`.

## 7. Données de démonstration (optionnel)
Les tables sont créées vides. Deux façons de peupler :
- **Simple** : inscris-toi via l'interface, crée un compte PRO, ajoute prestations et
  horaires — l'appli est pleinement fonctionnelle.
- **Jeu de démo complet** : lance le seed avec l'image de build (qui contient `tsx`) :
  ```bash
  docker compose -f docker-compose.prod.yml run --rm --build \
    -e DATABASE_URL="postgresql://smartbooking:$POSTGRES_PASSWORD@db:5432/smartbooking?schema=public" \
    api sh -c "npx tsx prisma/seed.ts"
  ```
  Comptes créés : `client@` / `pro@` / `admin@smartbooking.dev` (mot de passe `Password123!`).

## Mettre à jour l'application
```bash
git pull
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```

## Supervision (optionnel)
Ne publie pas Prometheus/Grafana sur Internet. Pour les consulter, ouvre un tunnel SSH
depuis ton poste puis lance le profil monitoring sur la VM :
```bash
# sur la VM
docker compose --profile monitoring up -d prometheus alertmanager grafana
# depuis ton poste
ssh -L 3001:localhost:3001 -L 9090:localhost:9090 ubuntu@IP_DE_LA_VM
```
Grafana devient accessible sur http://localhost:3001 de ton poste, sans exposition publique.
