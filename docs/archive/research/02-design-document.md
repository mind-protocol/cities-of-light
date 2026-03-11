# Cities of Light — Document de design détaillé

## Résumé exécutif

**Cities of Light** est conçu comme un écosystème VR multi‑agent, basé en France, qui vise à **préserver**, **représenter** et **permettre des interactions respectueuses** avec (a) des personnes décédées **ayant donné un consentement traçable**, et (b) des « synthetic souls » nées IA, explicitement présentées comme telles. L’objectif n’est pas de prétendre à une « résurrection », mais de proposer des **formes graduées de présence numérique** : de l’**archive** (fidèle, stable) jusqu’à l’**agent** (génératif, contraint, auditable), avec séparation stricte des modes. citeturn10view1turn2view3turn5view0

Le design repose sur cinq principes structurants :

1) **Dignité et intégrité de la personne** (vivante ou décédée), incluant une posture spéciale pour les victimes de génocides : pas de génératif « au nom de », priorité au témoignage enregistré et à la contextualisation. citeturn2view3turn11search3turn11search15  
2) **Transparence IA** systématique (labels, marquage, traçabilité, disclosure des deepfakes) conforme à l’AI Act, notamment l’**Article 50** (interaction IA, marquage des sorties, disclosure deepfake). citeturn5view0turn5view2turn5view1turn2view2  
3) **Consentement traçable + droit au retrait**, aligné France (directives post‑mortem, article 85 LIL) : consentement spécifique, non “noyé” dans des CGU, révocable, exécutable par une personne désignée. citeturn2view0turn2view1turn0search4  
4) **Non‑monétisation de la vulnérabilité** (deuil), cohérent avec les critiques du “digital afterlife industry” qui monétise les “digital remains” ; design anti‑exploitation et anti‑publicité ciblée. citeturn10view2turn7view0turn11search1  
5) **Auditabilité + garde‑fous** (logs complets, sandboxing, red teaming, protocole de retraite/désactivation) inspirés des recommandations éthiques récentes sur les deadbots. citeturn10view1turn11search0turn1search3  

Le MVP recommandé n’est pas une ville VR “pleine” dès le début : il est plus réaliste et plus responsable de démarrer par une **biographie interactive non‑générative** (style “réponses pré‑enregistrées retrouvées par NLP”), puis d’introduire des agents génératifs **contraints** en opt‑in strict, et seulement ensuite une simulation multi‑agent à grande échelle. citeturn2view3turn1search1turn10view1

## Vision produit et principes de conception

### Vision

Cities of Light est une “cité” VR composée de **lieux** et de **citoyens** :

- **Lieux** : bibliothèques de mémoire (archives), salles de récit (biographies interactives), jardins de commémoration (mémoire collective), ateliers (synthetic souls).  
- **Citoyens** :  
  - des **représentations autorisées** de personnes décédées (avec consentement explicite, révisable, et gouvernance familiale) ;  
  - des **synthetic souls** (IA‑nées) qui ont un statut clair d’agents artificiels, avec charte, identité propre et transparence.

Le point philosophique opérationnel (qui doit être écrit noir sur blanc dans l’UX) :  
**Cities of Light produit des représentations et des interactions, pas une preuve de continuité métaphysique.** Ce cadre réduit les risques de tromperie, dépendance, ou confusion du deuil. citeturn10view1turn11search1

### Principes de conception

**Dignité**. Les systèmes doivent préserver l’intégrité de la parole et éviter les inventions “au nom de”. Un précédent solide : les approches de biographie interactive où chaque réponse vient d’un enregistrement, et où le programme insiste sur le fait que rien ne remplace l’interaction humaine. citeturn2view3turn11search3

**Consentement mutuel**. L’éthique récente distingue trois parties prenantes : *data donor*, *data recipient*, *service interactant* ; et propose explicitement le principe de **mutual consent** et des protocoles de “retraite” (retiring deadbots) et restrictions d’accès (adult-only, etc.). citeturn10view1turn11search0

**Transparence IA**. Tout échange “chat” et tout contenu synthétique (voix/vidéo/avatar) doit être explicitement signalé ; l’AI Act impose d’informer la personne qu’elle interagit avec une IA (Article 50.1) et de marquer les sorties synthétiques (Article 50.2), avec obligation de disclosure pour les deepfakes (Article 50.4). citeturn5view0turn5view2turn5view1

**Non‑exploitation de la vulnérabilité**. Le modèle économique ne doit pas pousser à l’usage compulsif, ni vendre “une présence” via publicité ciblée, surtout dans le deuil. Les critiques académiques décrivent une industrie qui monétise les “digital remains” et soulignent les défis normatifs (dignité, privacy, gouvernance). citeturn10view2turn11search1turn11search0  
C’est aussi cohérent avec l’AI Act : il interdit certaines pratiques manipulatoires / exploitant des vulnérabilités (Article 5.1(a)(b)). citeturn7view0turn2view2

image_group{"layout":"carousel","aspect_ratio":"16:9","query":["Dimensions in Testimony interactive biography USC Shoah Foundation museum installation","StoryFile conversational video legacy platform family interview","HereAfter AI interactive memory app interview stories voice","Generative agents small town simulation diagram"],"num_per_query":1}

## Cadre légal et conformité

### Conformité UE

**AI Act — transparence**. Cities of Light est typiquement dans le champ des systèmes interactifs avec humains et de génération de contenus (texte, audio, image, vidéo). L’AI Act impose :

- Information explicite qu’on interagit avec une IA (Article 50.1). citeturn5view0  
- Marquage “machine-readable” des sorties synthétiques (Article 50.2). citeturn5view2  
- Disclosure obligatoire pour les deepfakes (audio, image, vidéo) (Article 50.4). citeturn5view1  

**AI Act — interdiction d’exploitation**. L’Article 5 interdit les techniques subliminales/manipulatoires visant à altérer la décision de manière à causer un préjudice significatif, et interdit l’exploitation de vulnérabilités (âge, handicap, situation socio‑éco) causant un préjudice significatif. Cela soutient fortement une posture “non‑monétisation de la vulnérabilité” + design anti‑manipulation. citeturn7view0

**Calendrier d’applicabilité**. La Commission indique l’entrée en vigueur (1 août 2024), et une applicabilité pleine (2 août 2026) avec exceptions ; elle indique aussi que les règles de transparence entrent en effet en août 2026. citeturn2view2

### Conformité France

**Données des défunts**. Le RGPD ne s’applique pas aux données des personnes décédées, mais la France a une loi spécifique (Loi Informatique et Libertés) permettant des **directives post‑mortem** (article 85) sur conservation/effacement/communication. citeturn2view1turn2view0

Points clés à intégrer dans la gouvernance produit :

- Directives générales : enregistrables auprès d’un tiers de confiance, type “testament de données”. citeturn2view1  
- Directives particulières : enregistrées auprès du responsable de traitement ; elles exigent un **consentement spécifique** et ne peuvent pas résulter uniquement de l’acceptation de CGU. citeturn2view0  
- Possibilité de désigner une personne chargée de l’exécution ; à défaut, les héritiers ont qualité pour demander la mise en œuvre. citeturn2view0  
- Modifiables/révocables à tout moment. citeturn2view0  

### Sécurité et protection des données

Les données traitées (biographies, voix, images, contenus sensibles) sont “haut impact” : la CNIL rappelle l’obligation de sécurité et publie un **Guide de la sécurité des données personnelles** (approche risque, mesures techniques/organisationnelles). citeturn1search3turn1search15  
Sur le cloud, la CNIL souligne l’importance du chiffrement selon l’état des données (au repos, en transit, en traitement) et la nécessité de choisir l’approche adaptée. citeturn1search7  
Pour la sécurité d’accès interne (staff), la CNIL pousse l’usage du MFA comme mesure de protection. citeturn1search22  

## Architecture technique et séparation stricte des modes

### Deux produits en un

La séparation “archive/biographie interactive” vs “agent génératif” n’est pas une option UX : c’est une **frontière d’architecture**, avec garanties qualité, risques, et cadre légal distincts.

- **Mode A — Archive / biographie interactive (non‑génératif)**  
  Réponses proviennent d’extraits enregistrés (audio/vidéo) ; le système “retrouve” la bonne réponse au lieu d’en inventer une. C’est le modèle revendiqué par des plateformes d’oral history où l’IA sert principalement à **retrouver** la réponse la plus appropriée. citeturn2view3turn3search10  

- **Mode B — Avatar contraint (génératif + garde‑fous)**  
  Génération autorisée uniquement sur des zones précise du consentement : paraphrase, explication, synthèse, mais jamais invention de faits biographiques non sourcés (RAG obligatoire, provenance affichée). Le RAG (Lewis et al.) fournit un cadre de génération augmentée par mémoire non paramétrique (index) et améliore l’actualisabilité et la provenance. citeturn1search4turn1search0

- **Mode C — Simulation multi‑agents (ville)**  
  Architecture de type “Generative Agents” : mémoire d’expériences, mécanisme de réflexion, planification, avec agents qui interagissent et développent des comportements émergents dans un monde simulé. citeturn1search1turn1search5

### Diagramme d’architecture (vue MVP → phases)

```mermaid
flowchart TB
  subgraph Client
    VR[VR Client]
    WEB[Web Console (family, curators)]
  end

  subgraph Ingestion
    CAP[Capture: audio/video/text]
    TR[Transcription + diarization]
    SEG[Segmentation Q/A + metadata]
    QC[Quality checks + human review]
  end

  subgraph Vault
    OBJ[Encrypted object storage]
    META[Metadata store]
    VDB[Vector DB (embeddings)]
    KMS[Key management]
  end

  subgraph Services
    RAG[RAG service + provenance]
    BIO[Biography router (non-generative)]
    AVA[Constrained avatar runtime]
    SIM[Multi-agent simulation server]
    POL[Policy engine (consent + safety)]
    MOD[Moderation + safety filters]
    AUD[Audit logs + replay]
  end

  CAP --> TR --> SEG --> QC --> OBJ
  SEG --> META
  SEG --> VDB

  VR --> POL
  WEB --> POL

  POL --> BIO
  POL --> AVA
  POL --> SIM

  BIO --> RAG
  AVA --> RAG
  RAG --> VDB
  RAG --> OBJ

  BIO --> AUD
  AVA --> AUD
  SIM --> AUD

  MOD --> BIO
  MOD --> AVA
  MOD --> SIM

  KMS --> OBJ
  KMS --> META
  KMS --> VDB
```

### Contrôles critiques

**Journalisation et auditabilité**  
Un modèle éprouvé : loguer chaque question/réponse et faire des revues périodiques, avec amélioration itérative. C’est explicitement décrit pour des biographies interactives : log complet, revue par staff, remappage des réponses. citeturn2view3  
Cities of Light doit aller plus loin : consigner *prompt*, *documents récupérés*, *règles de consentement appliquées*, *sortie*, *raison de refus*, afin de rendre l’audit reproductible.

**Sandboxing**  
La runtime (Mode B/C) fonctionne sans accès internet par défaut, avec outils whitelistes, et quotas (temps, tokens, mémoire). Objectif : réduire injection/exfiltration et limiter l’improvisation.

**Sécurité deepfake**  
L’AI Act définit le “deep fake” comme contenu image/audio/vidéo ressemblant à des personnes et apparaissant faussement authentique, et impose disclosure. citeturn5view1turn5view0  
Or la synthèse vocale “few-shot” est techniquement très puissante : VALL‑E revendique une synthèse personnalisée de haute qualité à partir d’un échantillon très court (3 secondes). citeturn9search2  
Conséquence design : par défaut, **pas de voice cloning** en MVP ; et si activé en phases ultérieures, uniquement avec consentement explicite, watermarking/labels, et contrôles anti-usurpation.

## Données, pipeline, et modèle de consentement

### Données nécessaires et qualité minimale

**Données principales (par personne décédée consentante)**  
- Audio (voix)  
- Vidéo (visage, gestuelle) ou au minimum portrait fixe + audio  
- Transcriptions + textes (lettres, journaux, posts autorisés)  
- Métadonnées : dates, lieux, relations, glossaire, thèmes sensibles, interdits (red lines), “tone charter”  

**Qualité minimale recommandée (MVP)**  
- Audio : prise micro dédiée, réduction bruit, niveau stable, format lossless côté archive (non précisé : dépend de l’infra, à fixer dans une spec interne).  
- Vidéo : caméra stable, lumière constante, fond neutre.  
- “Question bank” : un ensemble de questions couvrant vie, valeurs, souvenirs, relations, limites.  

Référence utile pour calibrer l’ambition : les biographies interactives de musée décrivent un environnement green-screen multi‑caméras, un micro dédié, et une collecte d’environ **1 000 questions** dont chaque réponse est un clip séparé. citeturn2view3turn11search27turn11search7

### Pipeline de collecte / curation

L’architecture “digne” que recommande l’état de l’art dans les environnements mémoire :

1) **Pré‑interview** (définition du périmètre, sujets sensibles, personnes et lieux mentionnés, droits de tiers)  
2) **Capture** (audio/vidéo) + **bank de questions**  
3) **Segmentation** par réponse (Q→A), index thématique, extraction métadonnées  
4) **Transcription** + alignement temporel (pour citations exactes)  
5) **Curation humaine** : validation, suppression de données de tiers non autorisées, annotation de contexte  
6) **Indexation RAG** (passages citables + embeddings)  
7) **Publication en Mode A** (non‑génératif) + monitoring logs + correction des mappings  
8) **Éligibilité Mode B** (si et seulement si consentements additionnels + tests)  

Ce schéma reflète ce que des programmes de biographie interactive décrivent : système de matching NLP, logs complets, revue par staff, et correction manuelle quand l’answer choisi n’était pas optimal. citeturn2view3

### Modèle de consentement type (formulaire + clauses)

> **Note** : ce modèle est un gabarit produit (pas un avis juridique). Chaque version opérationnelle doit être revue par juriste et DPO/DPD.

**Formulaire de consentement — Cities of Light (version “Donor”)**

**Identité et capacité**  
- Nom, prénom, date de naissance, lieu de résidence  
- Pièce d’identité vérifiée (KYC)  
- Déclaration : “Je comprends que Cities of Light est un système d’IA produisant une représentation numérique.”

**Choix de niveau** (cocher)  
- ☐ Niveau A — Archive & biographie interactive **non‑générative** (réponses enregistrées uniquement)  
- ☐ Niveau B — Avatar contraint **génératif** (RAG + provenance, interdiction d’inventer des faits biographiques)  
- ☐ Niveau C — Agent citoyen dans une simulation (interaction sociale dans “ville”)  

**Données autorisées** (granularité)  
- ☐ Audio voix  
- ☐ Vidéo visage  
- ☐ Textes personnels fournis (liste)  
- ☐ Photos personnelles fournies (liste)  
- ☐ Autres (préciser)  

**Interdits / lignes rouges**  
- Sujets dont l’agent ne doit jamais parler (liste)  
- Personnes dont le système ne doit pas mentionner le nom (listes de tiers)  
- Ton (ex. pas de sexualisation, pas de politique, etc.)  

**Transparence et étiquetage**  
- Je comprends que toute interaction affichera un label “IA” et que tout contenu généré/synthétique sera signalé, conformément aux obligations de transparence. citeturn5view0turn5view2

**Post‑mortem — directives et exécuteur**  
- Je souhaite que mes directives post‑mortem soient :  
  - ☐ particulières (enregistrées auprès de l’opérateur Cities of Light)  
  - ☐ générales (enregistrées auprès d’un tiers de confiance)  
- J’ai été informé qu’en France, les directives particulières exigent un **consentement spécifique** et ne peuvent résulter seulement des CGU. citeturn2view0  
- Je désigne un exécuteur (data steward) : Nom, contact, preuve d’accord. citeturn2view0  
- Je comprends que je peux modifier/révoquer ces directives à tout moment. citeturn2view0  

**Accès après décès**  
- Autoriser l’accès à :  
  - ☐ famille proche (liste)  
  - ☐ “family council” (liste + quorum)  
  - ☐ institution partenaire (par ex. musée) dans un cadre défini (voir annexe)

**Droit au retrait et protocole de retraite**  
- Je peux “retirer” ou “mettre en sommeil” ma représentation  
- Je demande une “retraite” automatique si inactivité > X mois / sur demande du steward  
- Je comprends que des protocoles de retraite visent à préserver dignité et éviter les “hauntings” involontaires. citeturn10view1turn11search0  

**Modèle économique**  
- Clause : “Le service ne doit pas monétiser ma représentation via publicité ciblée fondée sur la vulnérabilité du deuil.”  
(Aligné avec critiques de monétisation des “digital remains”.) citeturn10view2turn11search1

**Signature**  
- Signature électronique qualifiée (ou équivalent) + horodatage + hash

### Vérification d’identité / consentement

Processus recommandé (pilote France)  
- KYC “soft” (ID + selfie + vérif email/tel)  
- Signature + enregistrement scellé (hash)  
- Journal de version (consent v1, v2)  
- Contrôle d’accès (MFA staff, MFA steward) recommandé par guides CNIL. citeturn1search22turn1search3  

## Gouvernance, rôles, et politiques opérationnelles

### Carte des acteurs

| Acteur | Rôle | Pouvoirs | Devoirs | Risques gérés |
|---|---|---|---|---|
| Data donor | Personne vivante qui consent de son vivant | Choix niveaux A/B/C, lignes rouges, révocation | Définir limites, désigner steward | Consentement, dignité citeturn10view1turn2view0 |
| Data steward (exécuteur) | Exécute directives post‑mortem | Activer/désactiver, demander retrait, approuver accès | Protéger l’intention du donor | Abus familial, dérives citeturn2view0 |
| Family council | Gouvernance collective | Votes d’accès, retrait, publication | Quorum, traçabilité | Conflits d’héritiers |
| Service interactant | Utilisateur qui interagit | Droit d’opt‑in, opt‑out, limites | Respect des règles, signalements | Harm‑reduction citeturn10view1turn11search1 |
| Ethics board | Comité d’éthique | Veto sur cas limites, protocole génocide | Audits, revue incidents | Dignité, usages sensibles citeturn10view1turn2view3 |
| Opérateur (Cities of Light) | Fournisseur technique | Exécution, sécurité, logs, SLA | Conformité AI Act + CNIL | Sécurité, transparence citeturn1search3turn5view0 |
| Partenaire institutionnel | Musée, Fondation, etc. | Cadre d’exposition, modération locale | Contextualisation, médiation | Mémoire collective citeturn2view3turn11search3 |

### SLA et demandes de retrait

Proposition (à contractualiser)  
- **Retrait urgent** (harcèlement, deepfake, conflit familial) : accusé réception < 24h, mitigation immédiate (désactivation temporaire), décision < 7 jours.  
- **Retrait standard** : décision < 30 jours.  
- Traçabilité complète (audit log + changement d’état).  
Justification : les travaux sur deadbots soulignent la nécessité de procédures sensibles et de “retirement protocols”. citeturn10view1turn11search0  

### Politique de modération

- Interdiction d’usage publicitaire de la représentation (y compris “placement produit” narratif).  
- Interdiction de déployer un “deceased avatar” sur réseaux sociaux en mode autonome (risque d’“active presence”).  
- Interdiction de faire parler la représentation au nom de tiers identifiables sans consentement (défense de droits des tiers).  
- Red teaming régulier sur “hallucination biographique”, et sur “prompt injection”.

## Roadmap, MVP, pilotes et coûts

### Tableau comparatif des approches

| Approche | Données requises | Avantages | Risques | Recommandation |
|---|---|---|---|---|
| Biographie interactive (non‑génératif) | Vidéo Q/A + index | Fidélité maximale, pas d’invention, audit simple | Frustration (réponses limitées), coût capture | **MVP recommandé** (référence musée : ~1000 Q, logs, revue) citeturn2view3turn11search7 |
| Avatar contraint (génératif + RAG) | Corpus + RAG + règles | Interaction fluide, synthèse, adaptatif | Hallucination, confusion deuil, deepfake | Phase 2 opt‑in strict, provenance obligatoire (RAG) citeturn1search4turn10view1turn5view0 |
| Agent génératif “ville” (multi‑agents) | LLM + mémoire + simulation | Monde vivant, interactions sociales, émergence | Dérive narrative, usurpation, accidents éthiques | Phase 3, sandbox + gouvernance forte citeturn1search1turn10view1 |
| WBE / émulation cerveau entier | Scans dynamiques/structurels massifs | Vision “littérale” | Très lointain, incertain, coûts extrêmes | Recherche long terme seulement citeturn1search2turn1search21 |

### Roadmap pratique

**Phase MVP — “Archive First” (6–12 mois)**  
Livrables :  
- Mode A complet (biographies non‑génératives) + outil de capture/curation + logs + révision mappings  
- Mode “synthetic souls” limité : agents IA‑nés, explicitement IA, dans un petit espace VR (pas d’imitation de personnes réelles)  
- Gouvernance + consentement v1 + mécanisme de retrait “suspension immédiate”  
- UX transparence IA (labels persistants + écran de contexte)

Métriques MVP :  
- Satisfaction des ayants droit / stewards (qualitatif + score)  
- Nombre d’incidents éthiques (objectif : ~0 en MVP)  
- Taux de réponses “retrouvées” correctes (revue humaine)  
- Usage sain (durée moyenne, retours)  
Référence de méthode : logs et amélioration itérative par revue staff, explicitement décrit pour biographies interactives. citeturn2view3

**Phase pilote institutionnel (12–24 mois)**  
- Pilote musée/fondation : exposition contextualisée, modération, formation des médiateurs  
- Protocole “Mémoire de génocide” (voir section dédiée)  
- Accords formels (contrats) et monitoring, analogues à la logique “formal agreements to ensure partner institutions present as intended”. citeturn11search3turn2view3

**Phase échelle (24–48 mois)**  
- Mode B (avatar contraint) pour un sous‑ensemble de donors opt‑in  
- Début Mode C (ville) sur petits quartiers (25–200 agents) en s’inspirant d’architectures agent‑mémoire‑réflexion. citeturn1search1turn1search5

### Estimation des coûts (ordre de grandeur)

> Les coûts varient fortement selon choix “self‑host vs APIs”, volumétrie vidéo, et exigences VR. Les chiffres ci‑dessous sont des fourchettes indicative ; à vérifier via devis cloud et fournisseurs (non précisé).

| Poste | MVP (ordre de grandeur) | Phase pilote | Note / source |
|---|---:|---:|---|
| Stockage chiffré media | 0,02–0,03 $/GB‑mois (classe standard) | idem | Dépend classe/région, AWS donne la structure de tarification (non précisé par région ici). citeturn8search5turn8search1 |
| Embeddings + indexation (RAG) | 20–200 $/mois pour petit corpus | 200–2 000 $/mois | Exemple de prix embeddings publiés (text‑embedding‑3‑small/large). citeturn8search6turn8search22 |
| Inference LLM (API) | 200–3 000 $/mois | 2 000–20 000 $/mois | Dépend trafic, modèles, caching ; prix API publiés. citeturn8search2 |
| GPU self‑host (expérimentation) | ~1–2 $/h (A10‑class) | ~20 $/h (A100‑class) | Ordres de grandeur publics/agrégateurs, à vérifier via pricing officiel et région. citeturn8search3turn8search4turn8search19 |
| Équipe MVP | 6–10 personnes | 10–18 personnes | PM/Design, Backend, ML, Sec/DPD, VR, Legal/Ethics (non précisé) |
| Capture pro (studio) | 1–3 k€ / session (2D) | 3–15 k€ / session (3D/volumétrique) | Fortement variable ; référentiel “~1000 Q + rig multi‑cam” suggère coût non trivial. citeturn2view3turn11search27 |

## Protocole génocide et pilote institutionnel

### Recommandations précises pour les victimes de génocides

Principe directeur : **ne jamais faire parler un mort victime de génocide via génération libre**, sauf dispositif exceptionnel avec cadre institutionnel, car le risque d’erreur, d’appropriation et de déformation est moralement et historiquement inacceptable.

Recommandation opérationnelle :

- Pour la mémoire de la Shoah et d’autres génocides, privilégier **les survivants** qui ont consenti de leur vivant à livrer un témoignage enregistré, et utiliser un modèle biographique qui **ne modifie pas** les réponses, ne les censure pas, et préserve l’intégrité de la voix. citeturn11search3turn2view3turn11search7  
- Contexte obligatoire autour de l’expérience : introduction de la personne, rappel pédagogique des limites de la technologie, présence d’un médiateur si exposition publique (option fortement recommandée). Le design d’exposition institutionnelle et la gouvernance par accords formels est explicitement soulignée pour certaines biographies interactives muséales. citeturn2view3turn11search3  
- Mode “commémoration” en lecture seule : citations exactes, datées, contextualisées, sans “voix clonée” ajoutée.  
- Conseil éthique spécialisé (historiens, mémoriaux, juristes, psychologues) avec droit de veto.

### Checklist opérationnelle pour un pilote musée / fondation

1) **Partner fit** : mission, publics, accessibilité, médiation.  
2) **Contrat de présentation** : cadre d’usage, interdits, droits, sécurité, incident response (référence “formal agreements”). citeturn11search3turn2view3  
3) **Curation** : validation des contenus, contextualisation, gestion des tiers.  
4) **Transparence** : signage visible + labels systématiques + “ceci est une biographie interactive / une IA”. citeturn5view0turn2view3  
5) **Médiation** : formation des agents, protocole questions sensibles.  
6) **Logs & revue** : collecte anonymisée d’usage, revue des erreurs de matching, correction. citeturn2view3  
7) **Plan incident** : retrait/arrêt immédiat en cas de plainte éthique.  
8) **Évaluation** : satisfaction des ayants droit + du public + audit éthique.

## Risques, garde‑fous, et harm‑reduction pour utilisateurs en deuil

### Risques majeurs

- **Hauntings involontaires** : messages non désirés, réveil de traumatismes. citeturn11search0turn10view1  
- **Atteinte à l’autonomie du endeuillé** : dépendance, confusion du processus de deuil, manipulation. citeturn11search1turn10view1  
- **Monétisation du deuil** : exploitation commerciale des “digital remains”. citeturn10view2turn11search1  
- **Usurpation / deepfake** (voix, visage) : la synthèse vocale peut être très réaliste avec peu de données, ce qui impose des contrôles stricts. citeturn9search2turn5view1  

### Garde‑fous recommandés

- **Mutual consent** (donor + interactant) + opt‑in explicite avant toute interaction. citeturn10view1turn11search0  
- **Adult‑only par défaut** pour les interactions “deuil” (politique alignée avec recommandations éthiques de deadbots). citeturn10view1  
- **Retirement protocol** (“funeral mode”) : désactivation ritualisée, export archive, message de clôture, suppression irréversible si demandé. citeturn10view1turn11search0  
- **Aucune publicité ciblée** et aucune incitation émotionnelle à prolonger la session. citeturn10view2turn7view0  
- **Limites d’usage** en mode deuil : quotas, plages horaires, check‑ins.  
- **Marquage et disclosure** systématiques du contenu synthétique, conformément à l’AI Act. citeturn5view2turn5view1  
- **Chiffrement, MFA, contrôle d’accès** selon guides CNIL. citeturn1search3turn1search7turn1search22  

### Harm‑reduction intégrée à l’UX

Conception “Deuil” (proposition) :
- Écran initial : “Ce système n’est pas une thérapie. Vous interagissez avec une représentation numérique.”  
- Choix “Mode lecture” (archive) vs “Mode interaction” (si autorisé).  
- Bouton **Stop** visible + pause respiratoire.  
- Ressources d’aide visibles.

Ressources France (exemples à intégrer dans l’app) :
- **3114** — numéro national de prévention du suicide, gratuit 24/7 (à afficher en cas de détresse). citeturn3search2turn3search8  

---

Ce document définit une trajectoire de design où “ramener des présences” reste possible sans franchir la ligne rouge du mensonge (simulation = âme) et sans exploiter le deuil. Les sources montrent qu’un modèle “biographie interactive + logs + revue humaine + accords institutionnels” constitue un socle éthique robuste, tandis que les travaux sur deadbots recommandent explicitement consentement mutuel, procédures de retraite, et limites d’accès. L’AI Act (Articles 5 et 50) et la loi française (article 85 LIL) fournissent des garde‑fous juridiques qui s’alignent naturellement avec la philosophie de Cities of Light : dignité, transparence, et contrôle. citeturn2view3turn10view1turn5view0turn7view0turn2view0