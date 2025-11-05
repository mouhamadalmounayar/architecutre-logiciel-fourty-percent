# Architecture Cloud - Système de Surveillance de Santé

## Vue d'ensemble

Ce document décrit l'architecture cloud du système de surveillance de santé, qui repose sur une approche microservices orchestrée par Docker Compose. Le système est conçu pour recevoir des alertes de santé provenant de dispositifs IoT, les valider, les enrichir avec des informations contextuelles provenant d'une base de données, puis notifier automatiquement le personnel médical concerné par email.

L'architecture adopte un modèle événementiel (event-driven) utilisant Apache Kafka comme bus de messages central. Cette approche permet un découplage fort entre les différents composants, facilitant ainsi l'évolutivité et la maintenance du système. Les trois microservices principaux communiquent de manière asynchrone via des topics Kafka, ce qui garantit la résilience et la capacité à traiter un grand volume d'alertes simultanément.

## Architecture Générale

Le système est composé de six composants principaux qui interagissent ensemble pour traiter le flux d'alertes de santé. Le point d'entrée du système est le microservice validator, qui expose une API REST pour recevoir les alertes. Une fois validées, ces alertes sont publiées dans Kafka, puis consommées séquentiellement par le service d'enrichissement et le service de notification. Cette architecture en pipeline garantit que chaque alerte passe par toutes les étapes de traitement nécessaires avant d'atteindre les destinataires finaux.

## Composants du Système

### 1. Validator Microservice

Le microservice validator constitue la porte d'entrée du système cloud. Il s'agit d'une application Node.js développée avec Express et TypeScript qui expose une API REST sécurisée pour recevoir les alertes de santé. Ce service joue un rôle critique dans la sécurité et l'intégrité des données en validant à la fois l'authentification des sources et la structure des données reçues.

**Technologie**: Node.js avec Express et TypeScript, déployé sur le port 3000.

**Responsabilités principales**: Le validator assure trois fonctions essentielles. Premièrement, il gère l'authentification des dispositifs IoT via des tokens JWT, garantissant que seules les sources autorisées peuvent envoyer des alertes. Deuxièmement, il valide rigoureusement la structure des payloads JSON reçus en utilisant la bibliothèque Joi, vérifiant notamment que les timestamps sont cohérents, que les messages d'alerte sont présents et que les métriques sont dans des formats valides. Troisièmement, il assure la sanitisation des données pour prévenir les injections et autres attaques. Enfin, une fois les données validées, le service publie les alertes dans le topic Kafka `alert-events` pour traitement ultérieur.

**Endpoints REST**:
- `POST /auth` : Génère un token JWT pour un `house_id` donné, permettant aux dispositifs IoT de s'authentifier auprès du système
- `POST /alert` : Reçoit les alertes de santé (nécessite un token JWT valide dans l'en-tête Authorization)
- `GET /status` : Endpoint de health check pour surveiller l'état du service

**Schéma de validation**: Le validator utilise Joi pour définir un schéma strict. Le timestamp doit être un tableau de trois entiers représentant le jour, le mois et l'année. Le message d'alerte est obligatoire et doit contenir entre 1 et 500 caractères. Les métriques optionnelles doivent être un objet dont les clés sont des chaînes et les valeurs des nombres.

**Sécurité**: L'authentification repose sur JWT avec un secret configurable via la variable d'environnement `JWT_SECRET`. Chaque requête vers l'endpoint `/alert` doit inclure un token valide qui contient le `house_id` du dispositif émetteur. Le middleware `authenticateToken` vérifie automatiquement la validité du token avant de traiter la requête.

### 2. Alert Enrichment Microservice

Le microservice d'enrichissement est développé avec Quarkus, un framework Java optimisé pour le cloud et les architectures microservices. Ce service constitue le cœur de la logique métier, car il transforme des alertes brutes en notifications enrichies contenant toutes les informations contextuelles nécessaires pour une intervention médicale appropriée.

**Technologie**: Quarkus 3.28.4 avec Java 17, Hibernate ORM Panache, et SmallRye Reactive Messaging pour l'intégration Kafka.

**Fonctionnement**: Le service consomme continuellement les messages du topic `alert-events`. Pour chaque alerte reçue, il extrait le `house_id` et interroge la base de données PostgreSQL pour récupérer les informations du patient associé à cette maison. Si un patient est trouvé, le service récupère également les informations de son médecin traitant et de l'infirmière assignée, y compris leurs adresses email. Le service construit ensuite un message enrichi contenant le titre de l'alerte, une description détaillée, la liste des destinataires, un niveau de sévérité, et des métadonnées supplémentaires. Cette alerte enrichie est finalement publiée dans le topic `enriched-alerts-events`.

**Modèle de données**: Le service interagit avec quatre entités principales. L'entité `Patient` contient les informations démographiques du patient ainsi que des références vers son médecin et son infirmier via des relations ManyToOne. Les entités `Doctor` et `Nurse` stockent les coordonnées du personnel médical, notamment leurs adresses email. L'entité `RawAlertEvent` représente l'alerte brute reçue de Kafka, tandis que `EnrichedAlert` représente l'alerte enrichie qui sera envoyée.

**Logique de sévérité**: Le service implémente une logique intelligente de mapping des alertes vers des niveaux de sévérité. Les alertes `bpm_very_high` (rythme cardiaque très élevé) et `bp_critical` (pression artérielle critique) sont classées comme critiques. L'alerte `bpm_high` (rythme cardiaque élevé) est considérée comme un avertissement. Toutes les autres alertes sont classées comme informatives. Cette classification permet au système de notification de prioriser les alertes les plus urgentes.

**Gestion des cas d'erreur**: Si aucun patient n'est trouvé pour un `house_id` donné, ou si le patient n'a pas de médecin ou d'infirmière assigné, le service utilise un destinataire par défaut configurable via la propriété `alert.enrichment.fallbackRecipients`. Cela garantit qu'aucune alerte n'est perdue, même en cas de données incomplètes.

**Configuration**: Le service se connecte à PostgreSQL via des variables d'environnement (`DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`). Il utilise également Kafka via la variable `KAFKA_BOOTSTRAP_SERVERS` et active des logs détaillés pour faciliter le débogage avec `quarkus.hibernate-orm.log.sql=true`.

### 3. Notification Service

Le service de notification est une application Node.js spécialisée dans l'envoi d'emails. Il représente le point final de la chaîne de traitement des alertes, transformant les messages enrichis en notifications tangibles pour le personnel médical. Ce service est conçu pour être robuste et résilient face aux défaillances temporaires du serveur SMTP.

**Technologie**: Node.js avec KafkaJS pour la consommation de messages et Nodemailer pour l'envoi d'emails via SMTP.

**Processus de notification**: Le service consomme continuellement les messages du topic `enriched-alerts-events`. Pour chaque alerte enrichie reçue, il extrait la liste des destinataires, génère un email HTML formaté de manière professionnelle, puis envoie l'email à tous les destinataires simultanément en utilisant `Promise.allSettled`. Cette approche permet de continuer l'envoi même si certains emails échouent, garantissant ainsi une livraison maximale.

**Templates d'email**: Les emails sont générés avec un template HTML responsive qui inclut un en-tête coloré, un corps principal contenant le message d'alerte, et un pied de page avec l'identité du système. Le template est conçu pour être lisible sur tous les clients email, des applications desktop aux mobiles. Chaque email inclut le titre de l'alerte, le message détaillé, et des métadonnées supplémentaires extraites du champ `meta`.

**Configuration SMTP**: Le service se connecte à un serveur SMTP configurable via les variables d'environnement `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, et `SMTP_PASS`. Par défaut, il est configuré pour Gmail sur le port 587 avec TLS. Le service effectue une vérification de la connexion SMTP au démarrage pour détecter rapidement les problèmes de configuration.

**Résilience**: Le consumer Kafka est configuré avec des timeouts généreux (`sessionTimeout: 30000ms`, `heartbeatInterval: 3000ms`, `rebalanceTimeout: 60000ms`) pour accommoder les opérations SMTP potentiellement lentes. Le service enregistre également tous les succès et échecs d'envoi avec des logs colorés et détaillés, facilitant ainsi le monitoring et le débogage.

### 4. Apache Kafka

Apache Kafka sert de colonne vertébrale de communication pour l'ensemble du système. Il s'agit d'une plateforme de streaming événementiel distribuée qui garantit la livraison fiable des messages entre les différents microservices, même en cas de défaillance temporaire d'un composant.

**Configuration**: Le système utilise Kafka 4.1.0 déployé en mode KRaft (sans Zookeeper) avec un seul nœud agissant à la fois comme broker et contrôleur. Cette configuration est simplifiée pour le développement mais peut être étendue pour la production. Kafka expose trois listeners: `CONTROLLER` sur le port 9091 pour la gestion interne, `HOST` sur le port 9092 pour les connexions depuis l'hôte, et `DOCKER` sur le port 9093 pour les communications inter-conteneurs.

**Topics Kafka**: Le système utilise deux topics principaux. Le topic `alert-events` contient les alertes brutes validées par le validator, avec 3 partitions et un facteur de réplication de 1. Le topic `enriched-alerts-events` contient les alertes enrichies produites par le service d'enrichissement, également avec 3 partitions. Les topics sont créés automatiquement au démarrage du validator via l'API d'administration de Kafka avec une stratégie de retry pour gérer les démarrages concurrents.

**Garanties de livraison**: Kafka garantit la livraison au moins une fois (at-least-once delivery) des messages. Les consumers sont configurés avec `auto.offset.reset=earliest` pour s'assurer qu'aucun message n'est perdu lors des redémarrages. Chaque microservice appartient à son propre groupe de consommateurs, permettant ainsi à plusieurs instances de consommer les mêmes messages en parallèle pour la scalabilité.

**Interface de monitoring**: Le système inclut Kafka UI (kafbat/kafka-ui) accessible sur le port 8080, offrant une interface web pour visualiser les topics, les messages, les groupes de consommateurs, et surveiller l'état général du cluster Kafka.

### 5. PostgreSQL Database

La base de données PostgreSQL 16 stocke toutes les informations persistantes nécessaires au fonctionnement du système. Elle contient les données des patients, du personnel médical, et des contacts d'urgence, qui sont utilisées pour enrichir les alertes.

**Schéma de base de données**: Le schéma est composé de quatre tables principales interconnectées. La table `patients` contient les informations démographiques complètes des patients (nom, prénom, date de naissance, genre, adresse, téléphone, email), ainsi qu'un `house_id` unique qui lie le patient à son dispositif IoT. Elle contient également des clés étrangères vers les tables `doctors` et `nurses`, établissant ainsi les relations de soins. La table `doctors` stocke les informations des médecins, incluant nom, prénom, email et téléphone. La table `nurses` a une structure similaire pour les infirmières. Enfin, la table `emergency_contacts` contient les contacts d'urgence pour chaque patient, avec une relation de clé étrangère vers `patients`.

**Initialisation**: La base de données est initialisée automatiquement au premier démarrage via des scripts SQL situés dans le répertoire `init/`. Le script `01-schema.sql` crée toutes les tables avec leurs contraintes et index, tandis que `02-seed.sql` insère des données de test incluant un médecin, une infirmière, et cinq patients avec leurs contacts d'urgence. Cette initialisation automatique facilite grandement le déploiement et les tests.

**Health check**: Le conteneur PostgreSQL est configuré avec un health check qui vérifie régulièrement la disponibilité de la base de données en utilisant `pg_isready`. Les autres services dépendent de ce health check pour s'assurer que la base de données est prête avant de démarrer, évitant ainsi les erreurs de connexion au démarrage.

**Sécurité et accès**: Les credentials de la base de données sont configurés via des variables d'environnement (`DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`) qui doivent être définies dans un fichier `.env`. La base de données expose le port 5432 mappé sur 5434 de l'hôte pour permettre l'accès direct depuis les outils de développement.

### 6. Docker Compose Orchestration

Docker Compose orchestre l'ensemble du système, définissant les services, leurs dépendances, et leur configuration réseau. Le fichier `docker-compose.yaml` agit comme la définition d'infrastructure complète du système.

**Architecture réseau**: Tous les services sont connectés à un réseau externe nommé `shared`, permettant ainsi une communication inter-conteneurs via les noms de service DNS. Ce réseau externe peut être partagé avec d'autres composants du système si nécessaire.

**Gestion des dépendances**: Les services sont démarrés dans un ordre spécifique grâce aux directives `depends_on`. Le service `alert-enrichment` attend que Kafka soit démarré et que PostgreSQL soit en bonne santé avant de lancer. Cette orchestration garantit que tous les services trouvent leurs dépendances disponibles au démarrage.

**Variables d'environnement**: Le système utilise abondamment les variables d'environnement pour la configuration, permettant une personnalisation facile sans modification du code. Les variables critiques incluent les credentials de base de données, les paramètres SMTP, et les adresses des services. Un fichier `.env` à la racine du projet doit définir toutes ces variables.

**Volumes et persistance**: La base de données PostgreSQL peut être configurée avec un volume Docker pour persister les données entre les redémarrages. Les logs des différents services sont affichés dans la console Docker Compose, facilitant le débogage.

## Flux de Données

Le flux de traitement d'une alerte traverse le système en plusieurs étapes bien définies, chacune ajoutant de la valeur et transformant les données.

**Étape 1 - Réception**: Un dispositif IoT installé dans la maison d'un patient détecte une anomalie de santé (par exemple, un rythme cardiaque anormalement élevé). Le dispositif envoie une requête HTTP POST à l'endpoint `/alert` du validator avec un payload JSON contenant le timestamp, le type d'alerte, et les métriques mesurées. La requête inclut un token JWT dans l'en-tête Authorization pour authentifier le dispositif.

**Étape 2 - Validation**: Le validator vérifie d'abord la validité du token JWT et extrait le `house_id` correspondant. Ensuite, il valide la structure du payload JSON en utilisant le schéma Joi défini. Si la validation échoue, une erreur 400 est retournée immédiatement au client avec des détails sur les problèmes détectés. Si la validation réussit, le validator affiche un log spectaculaire montrant les détails de l'alerte reçue.

**Étape 3 - Publication Kafka (alert-events)**: Le validator crée un objet `AlertPayload` complet en combinant les données validées avec le `house_id` extrait du token. Cet objet est sérialisé en JSON et publié dans le topic Kafka `alert-events`. Le validator affiche ensuite un log de confirmation de publication et retourne une réponse 201 au client. À ce stade, l'alerte est persistée de manière durable dans Kafka et sera traitée même si le validator redémarre.

**Étape 4 - Enrichissement**: Le service alert-enrichment, qui consomme continuellement le topic `alert-events`, reçoit le message. Il extrait le `house_id` et lance une requête transactionnelle vers PostgreSQL pour récupérer le patient correspondant. Si un patient est trouvé, le service charge également les entités `doctor` et `nurse` associées grâce aux relations JPA. Le service détermine le niveau de sévérité basé sur le type d'alerte, construit un titre et un message explicites, et crée une liste de destinataires incluant l'email du docteur et de l'infirmière. Si des informations manquent, des destinataires fallback sont utilisés pour garantir qu'au moins quelqu'un sera notifié.

**Étape 5 - Publication Kafka (enriched-alerts-events)**: Le service d'enrichissement crée un objet `EnrichedAlert` complet contenant toutes les informations nécessaires pour la notification, puis le sérialise et le publie dans le topic `enriched-alerts-events`. Des logs détaillés sont générés montrant le nombre de destinataires trouvés et les informations du patient.

**Étape 6 - Notification**: Le service de notification consomme le message du topic `enriched-alerts-events`. Il extrait la liste des destinataires et, pour chacun, génère un email HTML personnalisé contenant le titre de l'alerte, le message détaillé, et les métadonnées. Le service utilise `Promise.allSettled` pour envoyer tous les emails en parallèle via SMTP. Chaque email envoyé avec succès déclenche l'affichage d'une bannière spectaculaire montrant le destinataire et l'heure d'envoi. Le service compile ensuite un résumé indiquant combien d'emails ont été envoyés avec succès et combien ont échoué.

**Étape 7 - Réception**: Le médecin et l'infirmière reçoivent l'email dans leur boîte de réception. L'email contient toutes les informations contextuelles nécessaires pour évaluer la situation et prendre une décision d'intervention. Le format HTML professionnel garantit une lecture facile sur tous les appareils.

## Patterns Architecturaux

Le système implémente plusieurs patterns architecturaux reconnus qui contribuent à sa robustesse et sa maintenabilité.

**Event-Driven Architecture (EDA)**: L'architecture événementielle constitue le pattern fondamental du système. Chaque service communique en publiant et consommant des événements via Kafka, plutôt qu'en invoquant directement d'autres services. Ce découplage offre plusieurs avantages majeurs: les services peuvent évoluer indépendamment, de nouvelles fonctionnalités peuvent être ajoutées en créant simplement de nouveaux consumers, et le système reste résilient même si un service est temporairement indisponible car Kafka conserve les événements jusqu'à leur traitement.

**Microservices Pattern**: Le système est décomposé en services indépendants, chacun avec une responsabilité clairement définie. Le validator gère l'API et la validation, l'enrichment gère la logique métier et l'accès aux données, et le notification service gère l'envoi d'emails. Chaque service peut être développé, déployé et scalé indépendamment, utilisant la technologie la plus appropriée pour sa fonction (Java pour la logique métier complexe, Node.js pour l'I/O intensif).

**Saga Pattern (Implicite)**: Bien que non explicitement implémenté comme un saga transactionnel complet, le flux de traitement des alertes suit le pattern saga. Chaque étape (validation, enrichissement, notification) est autonome et publie des événements pour déclencher l'étape suivante. Si une étape échoue, les autres continuent à traiter les messages qu'elles peuvent gérer, et des mécanismes de retry au niveau de Kafka garantissent qu'aucun message n'est perdu.

**Repository Pattern**: Le service d'enrichissement utilise le pattern repository via Hibernate ORM Panache. La classe `PatientRepository` encapsule toute la logique d'accès aux données pour l'entité Patient, isolant ainsi la logique métier des détails de persistance. Cette abstraction facilite les tests et permet de changer l'implémentation de la base de données sans affecter la logique métier.

**Circuit Breaker (Implicite)**: Bien que non explicitement implémenté, Kafka agit naturellement comme un circuit breaker. Si le service d'enrichissement devient temporairement indisponible, les messages s'accumulent dans Kafka sans être perdus. Lorsque le service redémarre, il reprend le traitement là où il s'était arrêté. De même, si le serveur SMTP est indisponible, le service de notification peut être configuré pour réessayer ou enregistrer les échecs pour un traitement ultérieur.

**Producer-Consumer Pattern**: Ce pattern classique est implémenté à deux niveaux dans le système. Le validator produit des alertes brutes que l'enrichment consomme, puis l'enrichment produit des alertes enrichies que le notification service consomme. Kafka gère automatiquement l'équilibrage de charge entre plusieurs instances de consumers grâce aux groupes de consommateurs et au partitionnement des topics.

## Sécurité

La sécurité est intégrée à plusieurs niveaux du système pour protéger les données sensibles de santé.

**Authentification JWT**: Tous les dispositifs IoT doivent s'authentifier auprès du validator en obtenant d'abord un token JWT via l'endpoint `/auth`. Ce token contient le `house_id` chiffré et signé, empêchant ainsi la falsification. Chaque requête ultérieure doit inclure ce token dans l'en-tête Authorization. Le middleware `authenticateToken` vérifie la signature du token et extrait le `house_id` avant d'autoriser le traitement de la requête. Le secret JWT est configurable via la variable d'environnement `JWT_SECRET` et doit être changé en production.

**Validation des données**: Le validator implémente une validation stricte de tous les inputs en utilisant Joi. Cette validation protège contre les injections, les données malformées, et autres attaques. Tous les champs de type string sont trimés pour éliminer les espaces superflus, et les limites de taille sont appliquées pour prévenir les attaques par déni de service.

**Isolation réseau**: Les services communiquent via un réseau Docker privé, empêchant l'accès direct depuis l'extérieur sauf pour les ports explicitement exposés. Seuls le validator (port 3000), l'alert-enrichment (port 8081 pour l'API de santé), Kafka UI (port 8080), et PostgreSQL (port 5434) sont accessibles depuis l'hôte. Les communications inter-services utilisent les noms DNS internes et ne sont jamais exposées.

**Secrets management**: Toutes les informations sensibles (credentials de base de données, credentials SMTP, secrets JWT) sont gérées via des variables d'environnement définies dans un fichier `.env` qui ne doit jamais être commité dans le contrôle de version. Le fichier `.gitignore` est configuré pour exclure automatiquement les fichiers `.env`.

**HTTPS/TLS**: Bien que non configuré dans cette version de développement, le système devrait utiliser HTTPS pour toutes les communications externes en production. Les communications avec le serveur SMTP utilisent déjà TLS avec `requireTLS: true` dans la configuration de Nodemailer.

**Données de santé**: Le système traite des données de santé sensibles conformément aux bonnes pratiques RGPD. Les logs sont configurés pour afficher suffisamment d'informations pour le débogage sans exposer de données personnelles sensibles. En production, des logs structurés devraient être utilisés avec une redaction appropriée des champs sensibles.

## Scalabilité et Performance

Le système est conçu avec la scalabilité à l'esprit, permettant de gérer un volume croissant d'alertes.

**Partitionnement Kafka**: Les topics sont configurés avec 3 partitions, permettant à jusqu'à 3 instances de chaque consumer de traiter les messages en parallèle. Si le volume d'alertes augmente, le nombre de partitions peut être augmenté et davantage d'instances de services peuvent être déployées. Kafka distribue automatiquement les messages entre les partitions de manière équilibrée.

**Stateless services**: Tous les microservices sont stateless, ce qui signifie qu'ils ne maintiennent aucun état en mémoire entre les requêtes. Cela permet de lancer facilement plusieurs instances de chaque service derrière un load balancer. L'état du système est entièrement persisté dans Kafka (pour les événements) et PostgreSQL (pour les données maîtresses).

**Connection pooling**: Le service d'enrichissement utilise HikariCP (via Quarkus) pour le pooling des connexions à la base de données, réduisant ainsi la latence et permettant une utilisation efficace des ressources. La taille du pool peut être configurée en fonction de la charge.

**Optimisation des requêtes**: Les entités JPA utilisent `FetchType.EAGER` pour les relations vers Doctor et Nurse, garantissant que toutes les données nécessaires sont chargées en une seule requête (N+1 problem évité). Des index sont créés sur les colonnes fréquemment requêtées comme `house_id`, `doctor_id`, et `nurse_id`.

**Backpressure handling**: Kafka gère naturellement le backpressure. Si les consumers ne peuvent pas suivre le rythme de production des messages, ceux-ci s'accumulent dans Kafka jusqu'à ce que les consumers puissent les traiter. Les topics sont configurés avec une rétention suffisante pour absorber les pics de charge temporaires.

**Async processing**: Le service de notification envoie tous les emails en parallèle en utilisant `Promise.allSettled`, réduisant ainsi considérablement le temps total de traitement par rapport à un envoi séquentiel. Les timeouts Kafka sont configurés généreusement pour accommoder les opérations SMTP potentiellement lentes.

## Observabilité et Monitoring

Le système inclut plusieurs mécanismes pour surveiller son bon fonctionnement et diagnostiquer les problèmes.

**Logging structuré**: Tous les services implémentent des logs détaillés avec des niveaux appropriés. Le validator et le notification service incluent des logs spectaculaires avec des bannières colorées pour faciliter le suivi visuel pendant les démonstrations et les tests. Le service d'enrichissement utilise le logger JBoss avec différents niveaux (INFO, DEBUG, ERROR) configurables via `application.properties`.

**Health checks**: Le validator expose un endpoint `/status` qui retourne l'état du service. Le service d'enrichissement inclut automatiquement les endpoints Quarkus SmallRye Health (`/q/health/live`, `/q/health/ready`) qui vérifient la disponibilité de Kafka et PostgreSQL. PostgreSQL lui-même est configuré avec un health check Docker qui vérifie régulièrement la disponibilité via `pg_isready`.

**Kafka UI**: L'interface Kafka UI (accessible sur localhost:8080) fournit une visibilité complète sur l'état du cluster Kafka, incluant la liste des topics, le nombre de messages dans chaque partition, les groupes de consommateurs avec leur lag, et la possibilité d'inspecter individuellement les messages. Cet outil est invaluable pour le débogage et le monitoring.

**OpenAPI/Swagger**: Le service d'enrichissement expose une documentation OpenAPI accessible via `/q/openapi` et une interface Swagger UI sur `/q/swagger-ui`. Bien que ce service n'expose pas d'API REST publique pour le moment, cette documentation facilite la compréhension de sa structure interne.

**Métriques**: Bien que non configuré dans cette version, Quarkus supporte nativement Micrometer et Prometheus pour l'export de métriques. En production, des métriques comme le throughput de messages, les latences de traitement, les taux d'erreur, et l'utilisation des ressources devraient être collectées et visualisées dans un tableau de bord Grafana.

**Tracing distribué**: Pour une observabilité complète en production, un système de tracing distribué comme Jaeger ou Zipkin devrait être intégré. Quarkus et Node.js supportent tous deux OpenTelemetry, permettant de tracer une alerte à travers tous les services du système.

## Déploiement

Le déploiement du système est simplifié grâce à Docker Compose.

**Prérequis**: Docker et Docker Compose doivent être installés sur la machine hôte. Un fichier `.env` doit être créé à la racine du projet avec toutes les variables d'environnement nécessaires, notamment les credentials de base de données et SMTP.

**Commandes de déploiement**: Pour démarrer l'ensemble du système, il suffit d'exécuter `docker-compose up` depuis le répertoire `cloud/`. Docker Compose construit automatiquement les images pour les services qui nécessitent une compilation (validator, alert-enrichment, notification-service), pull les images des services tiers (Kafka, PostgreSQL), puis démarre tous les conteneurs dans l'ordre approprié en respectant les dépendances. L'option `-d` peut être ajoutée pour exécuter en arrière-plan.

**Ordre de démarrage**: Docker Compose garantit que Kafka et PostgreSQL démarrent en premier. Une fois PostgreSQL healthy, alert-enrichment démarre et initialise sa connexion à la base de données. Le validator démarre en parallèle et crée automatiquement les topics Kafka nécessaires avec une stratégie de retry. Le notification-service démarre en dernier et commence à consommer les messages enrichis.

**Arrêt et nettoyage**: La commande `docker-compose down` arrête proprement tous les services et supprime les conteneurs. L'option `-v` peut être ajoutée pour également supprimer les volumes et donc réinitialiser complètement la base de données.

**Configuration environnementale**: Les variables d'environnement suivantes doivent être définies dans le fichier `.env`:
- `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`, `DB_HOST`, `DB_PORT` pour PostgreSQL
- `SMTP_USER`, `SMTP_PASS`, `SMTP_HOST`, `SMTP_PORT` pour l'envoi d'emails
- `JWT_SECRET` pour la sécurité JWT
- `KAFKA_BOOTSTRAP_SERVERS` pour la connexion Kafka (défaut: kafka:9093)

**Réseau externe**: Le système utilise un réseau Docker externe nommé `shared`. Ce réseau doit être créé avant le premier démarrage avec la commande `docker network create shared`. Cette approche permet de connecter facilement d'autres composants du système au même réseau.
