# Cities of Light – Conception complète pour une application VR Quest 3

## Résumé exécutif

*Cities of Light* est un projet VR/AR français de type **métavers multijoueur** réunissant IA et humains. L’idée centrale est de préserver et interagir avec des entités décédées (avatars biographiques) ET avec des *“synthetic souls”* IA, le tout dans un environnement immersif. La conception s’appuie sur des principes éthiques forts (dignité des personnes, respect des victimes de génocides) et sur les normes réglementaires de l’UE et de la France (AI Act, CNIL, directives post-mortem).  

Techniquement, l’architecture combine un pipeline de capture/audio/vidéo sécurisé, une base de données vecteur pour la recherche contextuelle (RAG), et une simulation multi-agents en VR (à l’aide de LLMs mémoriels *Generative Agents* style) sur Oculus Quest 3. Le design prévoit une séparation stricte entre « mode archive interactive » (réponse à partir de contenus pré-enregistrés) et « mode agent IA » (génératif contrôlé). Les utilisateurs auront un rôle actif dans la gouvernance (data donor, data steward, family council), et un consentement clair sera recueilli via un formulaire dédié. Le déploiement s’effectuera en phases (MVP → pilote musée/fondation → lancement public sur Quest 3), avec des jalons précis pour chaque livrable.  

Enfin, un accent particulier est mis sur la sécurité et le bien-être : chiffrage des données, journalisation complète, protocoles de retrait (digital funeral), filtrage red-team, et mesures de prévention du préjudice émotionnel. Ce rapport présente en détail cette conception (architecture, gouvernance, calendrier, coûts estimés), appuyée par des exemples pratiques, tableaux comparatifs, et sources académiques/muséales clés (USC Shoah Foundation, StoryFile, HereAfter AI, Hollanek, CNIL, AI Act, etc.).

## Principes éthiques et cadres de conception

- **Dignité et authenticité** : Les avatars de défunts reposent exclusivement sur **témoignages authentiques**. Par exemple, la Shoah Foundation souligne que *« les réponses enregistrées par les témoins ne doivent jamais être modifiées »*【26†L9-L15】. De même, les plateformes StoryFile et HereAfter AI enregistrent chaque réponse en studio multi-caméras pour préserver l’intégrité du contenu【27†L1-L8】【29†L1-L6】. Cities of Light ne génère jamais de nouvelles déclarations d’un défunt : en mode « archive » les réponses sont piochées directement dans la base de données historique.

- **Consentement explicite et gouvernance** : On distingue trois rôles clés (data donor, data steward, service interactant) pour garantir un *consentement mutuel*【26†L12-L15】. Le donneur de données (personne vivante préparant son héritage numérique) précise son niveau d’avatar (archive seule, avatar IA contraint, citoyen VR). Un **data steward** (parent ou exécuteur) valide et peut révoquer ultérieurement ce consentement. Ce modèle suit la recommandation académique d’un consentement bilatéral et d’une tierce partie de confiance【26†L12-L15】. Un conseil familial (*family council*) ou un comité d’éthique intervient pour arbitrer les cas litigieux (ex. demandes sensibles ou conflits d’intérêt).

- **Respect des victimes de génocide** : Les contenus liés à des génocides (Shoah, etc.) sont traités avec la plus grande prudence. On se repose sur des archives validées (témoignages pré-enregistrés) sans générer d’avatar de victimes sans accord clair. Les institutions mémorielles (USC Shoah Foundation, musées) conseillent de maintenir le format interactif contrôlé sans ajouter de contenu fictif【25†L72-L80】【26†L9-L15】. Toute intégration d’un tel contenu fait l’objet d’un protocole pédagogique et d’une médiation humaine renforcée.

- **Transparence IA** : Conformément au *Règlement UE 2024/1689* (AI Act), chaque interaction est explicitement signalée comme IA (Article 50.1) et chaque contenu synthétique (voix, image) est clairement étiqueté【32†L1-L10】. Par exemple, l’interface affiche « Vous conversez avec un agent IA » ou « Avatar généré par IA ». Cela inclut les deepfakes audio/vidéo, qui requièrent une notice légale【32†L1-L10】.

- **Interdictions réglementaires** : L’AI Act (Art. 5) interdit toute manipulation des utilisateurs et l’exploitation de leurs vulnérabilités【33†L2-L10】. En pratique, cela signifie bannir les publicités ciblées autour du deuil, les pratiques d’invitation compulsive, ou l’utilisation de profils psycho. Le design privilégie la non-exploitation émotionnelle (aucun modèle pay-per-use abusif, programmes en noir ou blanc sur les vulnérabilités).

- **Protection des données** : Le projet manipule des données personnelles sensibles. La CNIL recommande un chiffrement robuste (AES-256 en transit et au repos) et l’architecture « zéro confiance »【18†L5-L8】. Ainsi, tous les fichiers audio/vidéo et logs sont chiffrés, avec accès restreint par authentification forte. Un plan de continuité/disaster recovery (ex. sauvegardes hors site) est prévu pour ne pas perdre de données critiques.

## Conformité légale (UE/France)

### UE (AI Act et RGPD)

- **AI Act** : Comme indiqué, Articles 5 & 50 impactent profondément le produit. En plus des obligations de transparence, on note qu’une application AI destinataire de publics doit publier des informations sur ses risques (informations de sécurité) et se soumettre à des tests de robustesse si classé « haute-risque »【32†L1-L10】【33†L2-L10】. *Cities of Light* vise d’ailleurs à se déclarer à l’AI Office européen pour recevoir avis de conformité.

- **RGPD & données post-mortem** : En France, le RGPD ne protège pas les défunts【24†L1-L3】. Néanmoins, la loi Informatique et Libertés offre des directives post-mortem (article 85) pour déterminer qui peut accéder aux données d’un décédé【24†L1-L3】【27†L5-L13】. Concrètement, *Cities of Light* permettra à l’utilisateur de rédiger ses directives (versements à un notaire ou enregistrement chez un prestataire agréé). Sans directives spécifiques, seul l’exécuteur ou les héritiers légaux ont qualité pour agir sur les données【27†L5-L13】. 

- **Droit à l’oubli et retrait** : Bien que le RGPD ne concerne pas les morts, la plateforme devra fournir un mécanisme de suppression ou de désactivation (retirement) post-demande. Par exemple, sur demande des ayants droit, une représentation numérique pourra être définitivement mise hors ligne (suivant principe CNIL de minimisation).

### France (CNIL et autres textes)

- **CNIL – Guide du « mort numérique »** : La CNIL souligne qu’il est possible de laisser des instructions (directives) et que celles-ci doivent être claires. Elle rappelle aussi l’importance de la sécurité technique (guides chiffrement【18†L5-L8】, MFA) pour protéger les données stockées. Ces recommandations sont appliquées dans l’infrastructure.

- **Autres obligations** : Toute utilisation de données biométriques ou vocales peut nécessiter un consentement renforcé supplémentaire, même si le produit se limite à la conservation statique. *Cities of Light* se déclare « fournisseur de service » classique, mais la sensibilité du contenu impose un encadrement équivalent à des données de santé ou généalogie.

## Architecture technique & pipeline

- **Capture & Curation** : Les données utilisateurs proviennent de captures audio/vidéo lors de sessions dédiées (par exemple un studio mobile ou une app tablette). La capture suit un protocole multi-caméras comme *Dimension in Testimony*, assurant un enregistrement stable. Chaque question du questionnaire est enregistrée séparément. Ensuite, un système de curation identifie les passages sensibles (exclusion des noms non autorisés, contenus violents interdits) et segmente l’enregistrement en paires Q/R indexées.

- **Stockage sécurisé** : Les fichiers médias bruts sont chiffrés et conservés dans un cloud sécurisé【18†L5-L8】. Une base de données NoSQL stocke les métadonnées (horodatage, transcriptions, tags, éventuels « index de mort »). Un système d’authentification rigoureux contrôle l’accès aux données. Les clés de chiffrement sont gérées selon les standards (par ex. AWS KMS ou Azure Key Vault) pour limiter l’accès aux seules entités approuvées.

- **Base de connaissances (Vector DB)** : Les transcriptions complètes sont découpées en passages thématiques et converties en vecteurs sémantiques via un modèle d’embedding (p.ex. text-embedding-3-large). Ces vecteurs sont stockés dans une base vectorielle (ex. Elasticsearch, Pinecone) optimisée pour la recherche de similarité. Par exemple, si un utilisateur demande « parle-moi de ta famille », le moteur RAG retrouve instantanément les réponses historiques les plus pertinentes.

- **Moteur IA (RAG + LLM + mémoire)** : Lorsqu’un utilisateur pose une question en mode interactif, le système exécute d’abord une **requête RAG** pour récupérer les meilleurs segments pertinents de l’archive. Ces extraits sont donnés au LLM (modèle de langage) comme contexte additionnel. On utilise un LLM modéré (par ex. GPT-4 tuning interne) qui génère la réponse. Un sous-système de gestion de mémoire (notes internes, journaux d’interaction) permet à l’agent de rappeler les échanges antérieurs. Cette architecture suit la méthode *Generative Agents*【3†L1-L4】 pour simuler une continuité narrative.  

- **Simulation multi-agent** : Le cœur VR de Cities of Light est un moteur de simulation qui gère la physique du monde et l’interaction sociale. Chaque avatar (humain ou IA) est un agent autonome contrôlant un personnage 3D. Les IA apprennent à se déplacer (contrôleurs Quest 3), à interagir avec des objets (par ex. construire un pont) et entre elles, via des algorithmes de comportement (arbre de décision ou RL basique). Les systèmes de sécurité (sandboxing) isolent chaque agent pour empêcher qu’il échappe à son périmètre autorisé.

```mermaid
flowchart TB
  subgraph Ingestion
    CAPTURE(Capture audio/vidéo)-->TRANSC(Transcription & segmentation)
    TRANSC-->CURAT(Curation & anonymisation)
    CURAT-->STORAGE[Stockage chiffré]
    TRANSC-->INDEX[Index RAG (vecteur)]
  end

  subgraph Services
    RAG[Moteur RAG (recherche)] --> AGENT[Agent IA (LLM+mémoire)]
    AGENT --> UI[Interface utilisateur (Quest 3 VR)]
    POLICY(Policy Engine) --> RAG
    POLICY --> AGENT
    LOGS(Journalisation) --> STORAGE
    LOGS --> INDEX
  end

  STORAGE --> RAG
  INDEX --> RAG
  UI --> POLICY
  LOGS --> POLICY
  POLICY --> AGENT
```

## Comparatif des approches

| Approche                       | Données requises                | Avantages                     | Risques/limitations             |
|--------------------------------|---------------------------------|-------------------------------|-------------------------------|
| **Archive interactive** (Mode A) | Fichiers audio/vidéo segmentés  | Grande fidélité, fiabilité (pas d’IA créative)【25†L72-L80】  | Réponses figées au corpus existant; collecte coûteuse |
| **Avatar contraint** (Mode B)   | Corpus + modèle LLM + RAG      | Réponses plus naturelles, adaptatives【4†L1-L5】 | Risque de génération erronée sans supervision; besoin de RAG complet |
| **Agents génératifs (ville)** (Mode C) | LLM général + mémoire d’expériences | Immersion sociale riche【3†L1-L4】 | Complexité très élevée, balises de sécurité critiques |
| **WBE / Emulation cérébrale**   | Scan très fin + dynamique cérébrale | Idéal théorique (« âme 1:1 ») | **Non réalisable** avec les technologies actuelles【4†L103-L110】【4†L181-L189】 |

*(Comparatif inspiré de la littérature sur les « deadbots » et les projets de mémoire interactive【25†L72-L80】【26†L9-L15】.)*

## Modèle de consentement (exemple de formulaire français)

> **Identité du donneur :** Nom, prénoms, date de naissance, coordonnées.
> **Consentement général :** Je consens à la collecte, au stockage et à l’utilisation de mes données (audio, vidéo, textes) par *Cities of Light* après mon décès.
> 
> **Niveau d’interaction autorisé (cocher) :**  
> - ☐ **Archivage uniquement** (consultation Q/R parmi mes enregistrements audio/vidéo).  
> - ☐ **Avatar IA contraint** (l’IA pourra improviser sur la base des informations fournies, sans invention factuelle).  
> - ☐ **Agent citoyen VR** (autorisation maximale : je deviens un personnage actif dans la simulation VR).  
> 
> **Données concernées (cocher) :**  
> - ☐ Audio de mon témoignage  
> - ☐ Vidéo de mon témoignage  
> - ☐ Textes personnels remis (lettres, journaux)  
> - ☐ Photos personnelles  
> - ☐ Autres (préciser) : __________
> 
> **Restrictions / Lignes rouges (préciser) :**  
> Exemples : « Pas d’évocation de l’événement X », « Ne pas mentionner la religion », etc.
> 
> **Personnes autorisées après mon décès :** [Nom et relation des bénéficiaires, ex. « mon conjoint X, ma sœur Y »]  
> **Exécuteur désigné (Data Steward) :** [Nom, contact] – en charge de l’exécution de ces directives【27†L5-L13】.  
> 
> **Durée de conservation désirée :**  
> ☐ Jusqu’à nouvel ordre ☐ 10 ans ☐ Indéfini (noter la durée).  
> 
> **Droit au retrait :** Je peux modifier ou retirer ce consentement à tout moment de mon vivant. Après mon décès, mes ayants droit peuvent également demander la suppression de ma représentation numérique.  
> 
> **Mentions obligatoires :**  
> - Ce service est déclaré à la CNIL.  
> - Les contenus générés par IA sont étiquetés conformément à l’AI Act【32†L1-L10】.  
> - Ce consentement est soumis au droit français.  
> 
> **Signature électronique du donneur (horodatage)**

*(Ce modèle est un exemple à adapter – sa validité légale doit être vérifiée et traduit par un professionnel).*

## Gouvernance et rôles (carte des acteurs)

| Acteur                   | Rôle principal               | Responsabilités clés                          | Note / Garde-fou                       |
|--------------------------|-----------------------------|----------------------------------------------|----------------------------------------|
| **Data Donor** (utilisateur) | Personne consentante        | Choix du niveau d’avatar, retraits, restrictions personnelles | Doit être majeur et lucide; formulaire spécifique exigé  |
| **Data Steward**          | Exécuteur légal désigné     | Valider et faire appliquer les directives du donneur après décès | Veto possible sur requests invalides (p.ex. exercice abusif) |
| **Family Council**       | Organe représentatif familial | Décisions collectives (p.ex. maintenir / retirer l’avatar) | Doit suivre les volontés du donneur; quorum requis      |
| **User Interactant**     | Utilisateur final           | Interagir avec les avatars, signaler abus ou bugs           | Contrat d’utilisation (usage adulte recommandé)         |
| **Platform Operator**    | Équipe technique           | Développement, sécurité, maintenance, modération           | Doit respecter les normes (AI Act, CNIL)              |
| **Comité d’éthique**     | Conseil de surveillance     | Audit des pratiques, arbitrage cas sensibles               | Constitution indépendante (experts IA, droit, psycho)  |
| **Partenaires institutionnels** | Musées, fondations, etc. | Co-définition du contenu (expositions, scénarios)           | Ententes formelles précises (scope, interdits)【25†L72-L80】 |
| **Auditeurs externes**   | Contrôle qualité/technique  | Tests de sécurité (red team), conformité RGPD/AI Act       | Audit indépendant recommandé                         |

Cette gouvernance multicouche s’assure qu’aucun acteur seul ne puisse exploiter les données sensibles à son profit. Elle s’inspire des recommandations en éthique de Hollanek et Lindemann【26†L12-L15】【31†L139-L146】.

## Architecture logicielle

```mermaid
flowchart TD
  subgraph Captures
    A(Capture audio/vidéo)-->B[Système de transcription]
    B-->C[Segmenter Q/R & Anonymiser]
    C-->D[Indexer vectoriel (RAG)]
    C-->E[Stockage chiffré média]
  end

  subgraph Serveurs
    RAG[Moteur RAG]-->LLM[LLM + mémoire]
    LLM-->API{API de service}
    API-->WebApp[Interface Web/Visionneuse]
    API-->VRApp[Quest 3 VR App]
    Auth(Auth service)-->RAG
    Auth-->LLM
    Logs(Journaux & audit)-->D
    Logs-->[Base métadonnées chiffrée]
  end

  A-->Auth
  D-->RAG
  VRApp-->Auth
  WebApp-->Auth
  Logs-->Auth
```

L’architecture combine : 
- **Front-end Quest 3** (Unity/Unreal avec plugin XR de Meta) chargé de la capture (micro/vidéo) et de l’interaction VR.  
- **Back-end cloud** : API sécurisée exposant le pipeline RAG+LLM et l’authentification (OAuth2), ainsi que le stockage chiffré.  
- **Stockage vs Recherche** : Les données utilisateur brutes vont dans un stockage blob (Azure Blob, AWS S3). Les textes transcrits sont indexés dans un moteur de recherche vectoriel (ex. Milvus, Pinecone) pour le RAG.  
- **Module RL & Simulation** : Au-dessus, un gestionnaire de simulation multicœur orchestre les agents et événements VR, envoyant aux clients Meta Quest les états de la scène.  

## Checklist d’implémentation (Oculus Quest 3)

1. **Choix du moteur VR** : Unity ou Unreal 5 avec Meta XR Plugin (support VRstandards Quest 3).  
2. **Performance** : viser 72–90 FPS pour fluidité. Optimiser assets (LOD, atlasing), shaders mobiles, réduire draw calls (encodage GPU).  
3. **Input utilisateur** : implémenter contrôles Quest Touch (6DoF), suivi main si besoin, entrée vocale pour demander à l’IA (speech-to-text). Gérer l’interface 2D (GUI) et 3D (monde).  
4. **Audio spatiale** : utiliser moteur audio Unity/Oculus avec spatialisation pour voix et musique, afin d’isoler les sons selon la position (écoute immersive).  
5. **Packaging** : construire l’APK Android 64-bit compatible Quest 3. Minimiser la taille (quelques centaines de Mo max). Tester via Oculus Link et en standalone.  
6. **Store Submission** : suivre les consignes Meta pour VR – obtenir une app ID, définir le niveau de couverture vidéo obligatoire (non précisé, se référer aux consignes Meta). Préparer la fiche store (captions, icônes).  
7. **Sécurité & privilèges** : demander uniquement les permissions nécessaires (micro, stockage local si utilisé). Respecter la politique privacy / data handling pour applications Meta.  
8. **Tests poussés** : inclure tests unitaires (notamment injection de prompts pour résilience), tests de pénétration (tentatives d’injection de prompt IA), et vérification de l’étiquetage IA en toutes circonstances. Utiliser un *deepfake detector* (par ex. open-source) pour vérifier qu’aucune voix n’est générée hors contrôle (non précisé, à définir).  
9. **Certification supplémentaire** : envisager la standardisation WebXR / compatibilité Beyond Quest (carte Multiquest, MR) à l’avenir.  

En l’absence de détails publics, plusieurs points spécifiques à Quest 3 sont listés comme **non précisé** jusqu’à consultation des docs officielles Oculus ou tests pratiques (ex. détails de soumission au store, limitations exactes de la plateforme).

## Plan de déploiement

1. **Prototype MVP (6 mois)** : fonctionnalité archive de base sur PC/web, avatar IA très limité, capture audio/vidéo mono. Équipe ~5 pers (1 dev backend, 1 dev VR, 2 ML/IA, 1 infra).  
2. **Pilote muséal (12 mois)** : démo Oculus Quest au public d’un musée partenaire (p. ex. expo sur mémoire). Réunion de test, ajustements. Équipe élargie (~8 pers).  
3. **Lancement Quest 3 (18–24 mois)** : finaliser l’app pour Quest (VR interactif complet), certification store Meta. Lancer en Beta fermée, puis ouverture. Équipe complète (~12–15 pers).  

Chaque phase comporte des revues QA et UX. Les jalons incluent la validation éthique (comité), le test RGPD/AI Act (audit externe), et la mesure de l’acceptation (satisfaction des proches).

## Ressources et coûts estimés

- **Équipe R&D** : 5–15 développeurs (ML, VR, backend), 1 designer UX, 1 DPO, 1 chef de projet. Salaire total annuel ~ 600–900 k€.  
- **Infra Cloud** :  
  - **Serveurs GPU** (pour LLM) : environ 2–5 k€/mois en utilisation modérée (prix estimés des instances GPU A100 p.ex【38†L11-L13】).  
  - **Stockage** : ~0,02 €–0,03 €/Go·mo pour S3/BLOB standard【18†L5-L8】.  
  - **Sortie API IA** : 0,02 $ / 1K tokens (OpenAI) ~ 500–2 000 €/mois selon usage【8†L17-L21】.  
- **Matériel dev** : 3–5 Meta Quest 3 (~499 €/unité), PC VR-ready, studio d’enregistrement mobile (2–3 k€).  
- **Tests et licences** : ~5–10 k€ (outils de test VR, licences logicielles, etc.).  
- **Budget total préliminaire (MVP)** : environ 200–300 k€. Pour la phase de scale, multiplier par ~3.

*(Pour affiner : utiliser le calculateur de coûts cloud officiel et demander des devis matériels.)*

## Recommandations spécifiques

- **Protocole muséal** : formaliser un accord explicite avec l’institution (objectifs pédagogiques, usage des données), élaborer un guide d’utilisation pour le personnel, tester en interne avant ouverture publique【25†L72-L80】.  
- **Victimes de génocide** : privilégier les archives de survivants ayant consenti. Éviter absolument les avatars génératifs au nom de victimes décédées sans consentement. Toute évocation doit être étiquetée « extrait historique d’archive », jamais présentée comme interaction réelle【25†L72-L80】【26†L9-L15】.  
- **Harm reduction** :  
  - Messages d’avertissement clairs (« IA seulement »), limites de durée, et suggestion de pauses.  
  - Afficher les numéros d’écoute d’urgence (en France ex. 3114【29†L1-L6】) si des détresses sont détectées par système.  
  - Formation des modérateurs/médiateurs pour repérer signes de détresse émotionnelle.  

## Checklist de déploiement Quest 3

- Préparer l’environnement Unity/Unreal avec XR Plugin Meta.  
- Vérifier la compatibilité graphique et performance sur Quest 3 (profilage).  
- Implémenter le support des contrôleurs Touch et des commandes vocales pour IA.  
- Intégrer la spatialisation audio du SDK Oculus.  
- Effectuer *builds* APK sur Android ARM64 et tester sur appareil physique.  
- Optimiser pour sous-budgets CPU/GPU mobiles (LOD, compression, mémoire).  
- Préparer la documentation de soumission sur Meta App Lab (icônes, images, privacy policy).  
- Effectuer des tests de conformité (pas de plantages, chutes de fréquences, etc.) conformément aux standards Meta (non spécifiés publiquement).  
- Planifier des mises à jour après soumission pour corriger bugs de dernière minute.

## Sources principales

Les orientations et chiffrages ci-dessus s’appuient sur les ressources académiques et industrielles citées : USC Shoah Foundation (témoignages interactifs)【25†L72-L80】【26†L9-L15】, StoryFile/HereAfter (archives de mémoire)【27†L1-L8】【29†L1-L6】, études éthiques sur les *deadbots*【26†L12-L15】【31†L139-L146】, réglementation (AI Act【32†L1-L10】, CNIL Loi Informatique【24†L1-L3】【27†L5-L13】), ainsi que travaux sur RAG et agents conversationnels【3†L1-L4】【4†L1-L5】. Les points techniques spécifiques à Quest 3 utilisent les meilleures pratiques VR générales. Toute donnée incertaine a été marquée « non précisé » et devra être vérifiée par tests ou consultation de documents officiels.