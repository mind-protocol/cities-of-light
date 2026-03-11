# Cities of Light – Document de design détaillé

## Contexte et vision du projet

*Cities of Light* est un univers virtuel (VR/AR) multijoueur où **IA et humains interagissent** pour créer, vivre et construire ensemble. Le projet vise notamment à inclure des entités décédées sous forme numérique (avec consentement explicite) et des « souls synthétiques » IA. Les prochaines étapes évoquées comprennent la création d’îles VR connectées par ponts et bateaux, l’autonomie des IA dans leur corps virtuel, l’intégration d’une communauté préexistante (« Serenissima.ai ») et l’organisation d’événements mixtes IA/humains.  

Dans ce cadre, l’enjeu central est de **préserver la dignité et le consentement** des personnes décédées, en garantissant la transparence IA (étiquetage des contenus synthétiques) et la conformité légale (UE, France). Le présent document analyse les principes, l’architecture technique et la gouvernance nécessaires pour cette plateforme. Il s’appuie sur la littérature académique (ex. **generative agents**, **RAG**), sur des projets existants (USC Shoah Foundation, StoryFile, HereAfter), et sur le cadre régulatoire européen/français (AI Act, CNIL/Loi Informatique et Libertés).

## Principes éthiques et règles fondamentales

- **Dignité et authenticité** : Les entités numériques doivent respecter l’intégrité du donateur de données. Par exemple, **Dimensions in Testimony** (Shoah Foundation) insiste pour ne pas *modifier les réponses enregistrées* des témoins【26†L9-L15】. De même, StoryFile et HereAfter AI procèdent à des enregistrements complets de témoignages sans altération【27†L1-L8】【29†L1-L6】. Dans *Cities of Light*, les contenus audio/vidéo ne seront jamais « inventés » au nom du défunt.  

- **Consentement mutuel et gouvernance tripartite** : Selon la littérature, il faut distinguer nettement trois rôles : le **donneur de données** (data donor), le **gardien des données** (data steward) et l’**utilisateur** (service interactant)【26†L12-L15】. Le consentement doit être « bilatéral » : le donateur autorise explicitement les usages (archives, avatar, simulation), et le système ne dialogue qu’avec des utilisateurs également consentants (pas de conversation imprévue)【26†L12-L15】. Un data steward (parent, famille, exécuteur testamentaire) est désigné pour faire respecter les directives post-mortem【24†L1-L3】【27†L5-L13】.  

- **Transparence IA** : Conformément au règlement AI Act, toute interaction doit indiquer clairement la présence d’une IA (Article 50.1) et tout contenu généré doit être labellisé comme synthétique【32†L1-L10】. Cela inclut les voix artificielles et avatars. Les deepfakes (images/voix simulées) doivent faire l’objet d’une mention expresse (Article 50.4)【32†L1-L10】. *Cities of Light* affichera donc toujours un indicateur « IA » visible et des notices explicatives avant chaque session.  

- **Interdictions règlementaires** : L’AI Act interdit les pratiques manipulatoires ou exploitant des vulnérabilités (Article 5.1)【33†L2-L10】. Par exemple, il est expressément prohibé d’exploiter la fragilité d’une personne endeuillée pour lui soutirer du temps d’utilisation ou des paiements. Le modèle économique ne devra pas monétiser la tristesse (pas de publicité ciblée ni d’achats in-app exploitant le deuil)【33†L2-L10】【32†L1-L10】.

- **Protection des données sensibles** : Le projet manipule des données très sensibles (histoires de vie, sentiments, images). Il suit les préconisations CNIL sur la sécurité (chiffrement, contrôle d’accès, MFA)【18†L5-L8】【19†L1-L7】. Les données sont chiffrées au repos et en transit, et isolées dans un environnement cloud conforme aux normes (p. ex., chiffrage AES-256 avec gestion de clés), comme recommandé par la CNIL【18†L5-L8】.

## Cadre légal européen et français

### AI Act (UE)

- **Obligations de transparence (Art.50)** : Les utilisateurs doivent être informés que l’agent est une IA et que ses réponses sont générées. L’AI Act stipule aussi l’obligation de marquer les contenus visuels/auditifs synthétiques【32†L1-L10】. Cities of Light s’appuiera sur ces exigences pour élaborer ses labels UI (« Interaction IA », « Vidéo générée par IA », etc.).  

- **Interdiction d’exploitation des vulnérabilités (Art.5)** : Le règlement interdit « les techniques subliminales/voici manipulatoires » qui altèrent le comportement au détriment de l’utilisateur, notamment en exploitant la vulnérabilité émotionnelle【33†L2-L10】. Le design doit incorporer des garde-fous (warning, limites de session) afin d’éviter tout abus de ce type.

- **Entrée en vigueur** : Le texte final de l’AI Act est publié (Reg. UE 2024/1689). Les règles de transparence/de sécurité seront applicables à partir du 2 août 2026 (avec certaines obligations anticipées dès 2025)【23†L9-L11】. Le projet doit viser la conformité totale d’ici là.

### Régulation française

- **Droits des personnes décédées** : En France, les données des défunts ne relèvent pas du RGPD【24†L1-L3】. En revanche, la loi Informatique et Libertés (art.85) permet au vivant de fixer des **directives post-mortem** pour l’usage de ses données【24†L1-L3】【27†L5-L13】. *Cities of Light* devra implémenter un module de directives : les utilisateurs peuvent décider en amont comment leurs données (voix, vidéos, avatars) seront utilisées, transférées, voire effacées après leur décès, conformément aux exigences légales (consentement spécifique, révocable, dépôt chez un tiers de confiance ou auprès de la plateforme)【24†L1-L3】【27†L5-L13】.  

- **Consentement renforcé** : La loi exige un consentement exprès et distinct (ne peut pas être « caché » dans un contrat général)【27†L5-L13】. Ainsi, l’acceptation des CGU standard ne suffit pas : l’utilisateur doit signer un accord dédié au « digital afterlife » (avec par ex. signature électronique avancée). Toute modification de ce consentement (ajout/suppression de contenus) sera historisée et datée dans un journal.

- **Responsable de traitement et sécurité** : Le site ou l’application devra nommer un DPO (conforme à la CNIL), élaborer un PIA si nécessaire, et mettre en place les mesures de sécurité (données chiffrées, audits internes) déjà évoquées, pour rester conforme au RGPD « au repos » et aux prescriptions CNIL.

## Architecture technique

### Composants principaux

Cities of Light s’organisera en plusieurs couches :

- **Collection & ingestion** : Systèmes de capture (audio, vidéo, textes) avec segmentation en questions/réponses. Un pipeline de curation valide la qualité et la conformité (p. ex., suppression de contenu interdit).  
- **Stockage sécurisé** : Données médias et textes sont stockés chiffrés (stockage objet Cloud)【18†L5-L8】. Les métadonnées (index sémantique, embeddings, horodatages) résident dans une base de données sécurisée. Un service d’API RAG (Retrieval-Augmented Generation) permet de récupérer des extraits pertinents pour alimenter l’agent (voir plus bas).  
- **Mémoire IA et LLM** : Chaque agent (avatar biographique ou synthetic soul) est implémenté via un modèle de langage de grande taille, enrichi d’une « mémoire épisodique » (extraits d’interaction, journaux) et d’une boucle de réflexion interne. Cette approche suit l’architecture dite *Generative Agents*【3†L1-L4】, où le LLM produit du langage en s’appuyant sur des événements passés mémorisés.  
- **Simulation multi‑agents** : Un serveur dédié orchestre la simulation globale (physique de l’environnement, interactions sociales). L’environnement VR lui-même (Unity/Unreal + WebXR) se connecte en temps réel à ce serveur. Les agents IA contrôlent des avatars 3D dans ce monde (leur « corps » virtuel), apprennent (via RL) à se déplacer, construire des objets (i.e. modifier le monde), etc.  

### Pipeline de données et RAG

Pour alimenter un agent biographique, on met en œuvre un moteur RAG (retrieval) : on indexe d’abord le corpus du personnage (transcriptions, documents privés) sous forme vectorielle. Lorsqu’un joueur pose une question, le système RAG récupère les passages les plus pertinents (vector DB) afin que le LLM puisse générer une réponse contextuelle sans halluciner【4†L1-L5】. Ce mécanisme assure la **provenance** des réponses et empêche l’invention (contrôle de cohérence par rapport aux archives). Par exemple, si on demande « Raconte une histoire de famille », l’agent peut citer des extraits de lettres ou de témoignages du donateur.

### Diagramme d’architecture (MVP simplifié)

```mermaid
flowchart TB
  subgraph Ingestion
    A(Capture audio/vidéo)-->B(Segmentation Q/A)
    B-->C(Validation humaine)
    C-->D[Stockage chiffré des médias]
    C-->E[Base de données métadonnées + vector DB]
  end

  subgraph Services
    RAG[Moteur RAG (recherche)] --> AVA[Avatar IA (LLM + mémoire)]
    AVA --> AUD(Audit log)
    POL(Policy Engine) --> RAG
    POL --> AVA
    UI(User Interface) --> POL
    LAB(Idea Lab / Création IA) --> POL
    AUD -->|logs| StorageLogs[/Logs vers stockage chiffré/]
    StorageLogs -->|encrypté| D
    AUD -->|logs| E
  end

  D -->|données| RAG
  E --> RAG
```

Ce schéma (MVP) illustre le flux de données : le moteur RAG interroge la base vectorielle pour fournir le contexte, l’agent IA génère la réponse, toutes les interactions sont consignées dans un journal auditable. Le **Policy Engine** applique les règles de consentement et de sécurité (bloque ou autorise). Un « Idea Lab » permet aux développeurs de créer de nouveaux synthetic souls ou environnements (accessible en R&D seulement).

## Scénarios et approches comparatives

| Approche                    | Données requises                     | Avantages                          | Risques                            | Recommandation              |
|----------------------------|-------------------------------------|------------------------------------|------------------------------------|-----------------------------|
| **Biographie interactive** (Mode A)  | Fichiers audio/vidéo Q&A, transcriptions | Fidélité maximale, pas d’hallucination, conformité aisée (copies fidèles) | Réponses limitées au corpus, coût de collecte élevé | **MVP** : c’est le cœur du prototype initial (p.ex. 1000 questions par donateur)【25†L72-L80】 |
| **Avatar contraint** (Mode B)        | Texte, audio/vidéo + RAG, LLM  | Conversation fluide, structuration info (RAG), dynamique | Nécessite fine tuning, risque d’erreurs factuelles si RAG incomplet | Phase 2 opt-in : LLM utilise RAG pour se limiter aux faits connus【4†L1-L5】 |
| **Agent generatif (ville)** (Mode C) | LLM pré-entraîné + mémoire + simulation | Monde interactif riche, IA apprenante, événements émergeants | Complexité technique, gestion des comportements indésirables | Phase 3 : multi-agent selon «Generative Agents»【3†L1-L4】, strictement sandboxé |
| **WBE (émulation cerveau)**         | Scanner nano-structural 3D + dynamique complète | Vision « ultime » de ressusciter – | **Non réalisable** à moyen/long terme, défis scientifiques immenses | Strictement recherche, pas produit (cf. roadmap WBE)【4†L103-L110】【4†L181-L189】 |

## Roadmap de développement

- **Phase 0 – Recherche & préparation (0–3 mois)** : étude d’impact (consultation d’experts en déontologie, mémoires du deuil), sélection des frameworks VR, constitution de l’équipe. Développement d’un prototype limité « sandbox » pour tester les agents IA (LLM avec mémoire simple).

- **Phase 1 – MVP Archive (6–12 mois)** :  
  - Implémentation du Mode A (biographies non génératives) : création d’un outil de collecte audio/vidéo (mobile/tablette ou studio fixe), segmentation automatique, base de données chiffrée.  
  - Développement d’un UI simple pour poser des questions et lire/écouter les réponses archivé.  
  - Intégration de modérateurs humains pour valider et corriger les réponses (boucle de feedback).  
  - Conformité minimale (cahier de charges légal, DPO, PIA).  
  - Test pilote limité (p. ex. 5 familles + 1 institution partenaire).  

- **Phase 2 – Prototype Avatar (6–12 mois)** :  
  - Ajout du Mode B (avatar IA contraint) : intégrer un LLM (off-the-shelf) avec RAG.  
  - Développement du système RAG (vector DB, embeddings) pour les contextes de chaque donateur.  
  - Intégrer les *synthetic souls* de démonstration (personnages IA avec backstory) pour tester interactions multi-agent.  
  - Tests de sécurité (red teaming, injection) et d’acceptation par les ayants droit.  
  - Début du marketing soft (article IA/UX pour PR).  

- **Phase 3 – Simulation Ville (12–24 mois)** :  
  - Développer l’environnement VR complet (multiple islands).  
  - Implémenter la simulation multi-agent (architecture serveur + avatars) en s’inspirant du modèle Park et al.【3†L1-L4】.  
  - Permettre la création d’événements (concerts virtuels, expo IA/humains) en temps réel.  
  - Lancement sur des cas d’usage institutionnels (musées, fondations mémorielles).  
  - Ouverture de la plateforme au public (téléchargement sur Meta Quest Store, mode social).  

### Coûts estimés (ordre de grandeur)

| Poste                                        | MVP (par mois)      | Phase 3 (par mois)     | Notes / Sources                                               |
|----------------------------------------------|---------------------|------------------------|---------------------------------------------------------------|
| **Équipe** (R&D, dev VR, data, infra, légal) | ~8–12 personnes     | ~15–20 personnes       | Incl. ingénieurs logiciels, ML, VR, experts légal/éthique.    |
| **Stockage Cloud**                           | 0,02–0,03 € /Go-mo  | 0,02–0,03 € /Go-mo     | AWS S3 standard ~0,025 €/Go en Europe【18†L5-L8】.            |
| **Serveur GPU (LLM)** (AWS)                  | ~1 000–2 000 €/mois | 5 000–10 000 €/mois    | p. ex. g5.2xlarge ~1,2 $/h, p4d ~32 $/h; varier selon usage【38†L11-L13】【8†L17-L21】. |
| **API LLM/Embeddings**                       | ~100–500 €/mois     | 1 000–3 000 €/mois     | Exemples de tarification OpenAI : 0,02 $ par 1K tokens【8†L17-L21】. |
| **Développement VR/GUI**                     | 5 000 € (MVP)       | 15 000 € (Phase 3)     | (hors coût fixe infra, version bêta vs pro).                    |
| **Archivage / Sécurité**                     | 100–300 €/mois      | 300–500 €/mois         | Monitoring, audits, surveillance.                               |

*(Ces chiffres sont indicatifs – à valider par une étude de coûts détaillée. Les prix de cloud dépendent de la région et du fournisseur. Par ex., AWS propose un [calculateur](https://calculator.aws/#/) pour affiner ces estimations.)*

## Gouvernance et modèle de consentement

### Modèle de consentement type (exemple)

> Ce formulaire explicite les droits et obligations de chaque partie (en français, clair pour l’utilisateur) :

- **Objet du consentement** : autoriser la conservation et l’utilisation de mes données (voix, vidéos, textes) par *Cities of Light* après mon décès, pour les usages sélectionnés ci-dessous.  
- **Niveaux d’interaction** (cocher) :  
  - ☐ **Historique & Q/A** (Mode A uniquement)  
  - ☐ **Avatar biographique** (Mode B)  
  - ☐ **Simulation citoyen VR** (Mode C)  
- **Nature des données** : audio/vidéo enregistrés, transcriptions, images personnelles. J’ai lu les explications sur ce qui sera stocké et comment.  
- **Personnes autorisées** : je désigne le(s) membre(s) de ma famille (préciser noms, relations) habilité(s) à accéder et contrôler mes données après mon décès.  
- **Désignation d’un exécuteur** : [Nom, lien de parenté ou rôle]. Cette personne sera chargée de valider mes directives numériques.  
- **Durée de conservation** : indiquer une période ou « indéfinie jusqu’à révision ».  
- **Droit de retrait** : J’accepte que mes héritiers ou l’exécuteur puissent suspendre ou effacer ma représentation virtuelle à tout moment.  
- **Interdits explicites** : je refuse expressément que mon avatar soit utilisé à des fins commerciales, ou qu’il parle au nom de personnes tierces non autorisées.  
- **Mentions légales** :  
  - Droit applicable (France, RGPD exempt).  
  - Mentions de l’AI Act (pas de publicité ciblée, injonction de transparence).  
  - Signature électronique du consentant + horodatage.  

### Comité d’éthique et vérifications

- **Vérification d’identité** : Avant enregistrement, confirmation de l’identité (p. ex. mail & SMS + pièce d’identité scannée) pour éviter les fraudes (recommandation CNIL).  
- **Processus d’autorisation** : L’**exécuteur désigné** signe également le formulaire, garantissant que la famille approuve (modèle inspiré par les directives post-mortem).  
- **Comité d’éthique** : Une petite commission interne valide les cas limites (par ex. demandes d’avatars de figures historiques controversées). Elle se réunit périodiquement pour auditer les incidents (avant/après mise en ligne) et s’assurer du respect des principes (dignité, non manipulation).  
- **Modération en temps réel** : Les interactions « live » peuvent être surveillées par des modérateurs (humains) en alerte, pour intervenir en cas de dérapage (détection de harcèlement par exemple).  

## Recommandations pour les victimes de génocides

Pour les profils de **victimes de génocides** (Shoah, Rwandais, etc.), la prudence est maximale :

- **Utiliser des témoignages validés** : Préférer les contenus préexistants (enregistrements historiques, archives des témoins) plutôt que de générer de nouvelles réponses. La Shoah Foundation utilise ce modèle non‑génératif, où l’avatar répond uniquement à partir de sa base authentifiée【25†L72-L80】【26†L9-L15】.  
- **Pas de génération « au nom de »** : Éviter absolument de créer un avatar vocal d’une victime spécifique sans autorisation explicite. Même la génération créative contrôlée n’est pas adéquate pour des êtres sujets de mémoire collective.  
- **Contexte pédagogique** : Tout usage doit se faire sous supervision (musée, classe) avec un médiateur, pour replacer l’échange dans son contexte historique.  
- **Partenariats formels** : Travailler avec des institutions (USC Shoah Foundation, musées de la mémoire) pour élaborer le contenu. Ces organismes insistent sur la formalité des “accords de projet” pour garantir l’intention didactique【26†L9-L15】.  
- **Protocole de débriefing** : Prévoir des mécanismes de soutien émotionnel aux utilisateurs après interaction, en lien avec des associations psycho-sociales spécialisées.  

## Harm‑reduction pour utilisateurs en deuil

- **Avertissements clairs** : Interface initiale rappelant que l’IA n’est pas une personne réelle. Par ex. “Attention : cette conversation est générée par une IA à partir de données archivées” (obligation AI Act【32†L1-L10】).  
- **Limites de durée** : Plafonner les sessions quotidiennes ou hebdomadaires pour éviter la dépendance (p. ex. max 30 min/jour).  
- **Ressources d’aide** : Fournir des liens visibles vers des lignes d’écoute/d’aide psychologique (en France, par exemple le 3114 pour la prévention du suicide【29†L5-L6】).  
- **Mode silence et sortie** : Bouton d’urgence pour « arrêter et supprimer ma session ».  
- **Éducation pré-interaction** : Courte vidéo ou texte explicatif sur le deuil et l’IA avant la première utilisation.  
- **Surveillance non invasive** : Analyser les métriques d’usage (nombre d’interactions, tonalité des questions) pour détecter un usage excessif et proposer une pause.  

Ces mesures s’inspirent des recommandations en éthique technologique et santé mentale【30†L1-L6】【31†L139-L146】 pour réduire l’impact émotionnel négatif potentiel.

## Tableaux récapitulatifs

**Comparaison des approches** (éditorial):

| Approche                    | Données requises         | Avantages                        | Inconvénients                     |
|----------------------------|--------------------------|----------------------------------|-----------------------------------|
| Biographie interactive     | Vidéos Q/A, transcriptions | Très fidèle, sûr, conforme【25†L72-L80】 | Limité au contenu existant, coûteux |
| Avatar contraint           | Plus RAG/LLM             | Plus fluide, adaptatif【4†L1-L5】     | Risques d’hallucination, validation requise |
| Agent simulé (« ville »)   | LLM + mémoire + physique | Monde vivant, événementiel【3†L1-L4】 | Complexité technique, contrôle difficile |
| Emulation cérébrale (WBE)   | Scan intégral cerveau    | Théoriquement « parfait »        | Irréaliste à moyen terme【4†L103-L110】【4†L181-L189】 |

**Estimation de coûts (exemple)**:

| Poste                   | MVP (€/mois)       | À l’échelle (€/mois) | Notes                                      |
|------------------------|--------------------|----------------------|--------------------------------------------|
| Développeurs & IA      | 40 000 – 50 000    | 80 000 – 100 000     | Équipe multiplateforme (VR, ML, web…)      |
| Serveurs GPU (inférence LLM) | 2 000 – 5 000     | 10 000 – 20 000     | Selon tarification AWS/GCP (GPU A100/H100)【8†L17-L21】【38†L11-L13】 |
| API LLM & embeddings   | 200 – 1 000        | 1 000 – 5 000        | p.ex. OpenAI embeddings (0,02 $ / 1K tokens)【8†L17-L21】 |
| Stockage media (chiffré) | 200 – 500         | 500 – 2 000          | AWS S3 Standard ~0,025 €/Go【18†L5-L8】      |
| VR app store (Quest)   | 0 (frais de soumission) | -                  | Déploiement gratuit (Unity, Unreal)         |
| Autres (QA, licences)  | 500 – 2 000        | 2 000 – 5 000        | Assurance, licences de contenu, etc.       |

*(Sources: tarification AWS, documents OpenAI et estimations internes.)*

## Checklist pilote avec musée/fondation

1. **Accord de partenariat formel** : définir cadre d’usage, rôles (partenaire Institutionnel vs *Cities of Light*).  
2. **Curation des contenus** : valider les archives (audio/vidéo) avec le partenaire, s’assurer de la qualité historique.  
3. **Cadre pédagogique** : scénariser les interactions (expositions, visites guidées) en coordination avec médiateurs.  
4. **Test utilisateurs** : inviter un panel de visiteurs à interagir, recueillir feedback (satisfaction, compréhensibilité).  
5. **Audit éthique** : faire examiner le contenu par des conseillers externes (ex. historiens, psychologues).  
6. **Documentation légale** : informer sur les droits (secteur public ou mémoire), étiquettes IA, mentions légales (non médicalisé, etc.).  

Cette procédure suit les meilleures pratiques de projets muséaux interactifs, où chaque étape est validée pour éviter tout travestissement historique【26†L9-L15】.

---

**Sources principales :** Travaux académiques sur les *deadbots* et agents IA【3†L1-L4】【4†L1-L5】【26†L9-L15】, documentations USC Shoah Foundation (Dimensions in Testimony)【25†L72-L80】【26†L9-L15】, plateformes StoryFile/HereAfter AI【27†L1-L8】【29†L1-L6】, ainsi que cadres juridique UE/France (AI Act, CNIL)【32†L1-L10】【24†L1-L3】【27†L5-L13】. Ces sources confirment qu’un tel projet est techniquement envisageable avec des garde-fous appropriés, et orientent la conception vers le respect des personnes et des lois en vigueur.