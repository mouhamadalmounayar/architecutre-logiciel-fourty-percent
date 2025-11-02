# fourty-percent-french
Depot architecture logicielle

---

## Prérequis

- Docker ≥ 20.x  
- Docker Compose ≥ 2.x  

---

## 1. Réseau Docker `shared`

Le projet utilise un réseau Docker nommé `shared` pour permettre à tous les services (Kafka, PostgreSQL, microservices, Kafka-UI, etc.) de communiquer entre eux.

Créer le réseau si nécessaire :

```docker network create shared```

---

## 2. Variables d’environnement

Définir les variables d'environnement nécessaires dans le terminal :

```
DB_USERNAME=admin
DB_PASSWORD=admin123
DB_NAME=mydb
DB_HOST=postgres
DB_PORT=5432

SMTP_USER=mail@gmail.com
SMTP_PASS=password
```

> Remplace `SMTP_USER` par l'adresse mail qui va être utilisé par le serveur SMTP pour l'envoi des mails
> Remplace `SMTP_PASS` par le mot de passe réel associé à l'adresse mail ci-dessus

---

## 3. Lancer le projet

Le projet est divisé en deux parties : `local` et `cloud`. Il faut lancer Docker Compose dans chacun des dossiers séparément.
Il faut lancer la partie cloud en premier et une fois celle-ci mise en place, il est possible de lancer la partie local.

### 3.1 Dossier cloud

```
cd cloud
docker compose up --build
```

### 3.2 Dossier local

```
cd local
docker compose up --build
```