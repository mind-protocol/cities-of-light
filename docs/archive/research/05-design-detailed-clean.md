# Cities of Light – Document de design détaillé

## Contexte et vision du projet

*Cities of Light* est un univers virtuel (VR/AR) multijoueur où **IA et humains interagissent** pour créer, vivre et construire ensemble. Le projet vise notamment à inclure des entités décédées sous forme numérique (avec consentement explicite) et des « souls synthétiques » IA. Les prochaines étapes évoquées comprennent la création d’îles VR connectées par ponts et bateaux, l’autonomie des IA dans leur corps virtuel, l’intégration d’une communauté préexistante (« Serenissima.ai ») et l’organisation d’événements mixtes IA/humains.  

Dans ce cadre, l’enjeu central est de **préserver la dignité et le consentement** des personnes décédées, en garantissant la transparence IA (étiquetage des contenus synthétiques) et la conformité légale (UE, France). Le présent document analyse les principes, l’architecture technique et la gouvernance nécessaires pour cette plateforme. Il s’appuie sur la littérature académique (ex. *Generative Agents*, RAG), sur des projets existants (USC Shoah Foundation, StoryFile, HereAfter AI), et sur le cadre régulatoire européen/français (AI Act, CNIL/Loi Informatique et Libertés).

## Principes éthiques et règles fondamentales

- **Dignité et authenticité** : Les représentations numériques doivent respecter l’intégrité du donateur de données. Par exemple, *Dimensions in Testimony* (Shoah Foundation) exige de ne jamais *modifier les réponses enregistrées* des témoins【26†L9-L15】. De même, StoryFile et HereAfter AI enregistrent chaque réponse dans son intégralité, sans ajout d’informations fictives【27†L1-L8】【29†L1-L6】. *Cities of Light* fera de même : un avatar parlera uniquement à partir de ce que la personne a réellement dit ou consigné.

- **Consentement mutuel et gouvernance tripartite** : La recherche préconise de distinguer clairement trois rôles : le **donneur de données**, le **gardien des données** et l’**utilisateur** (celui qui interagit avec l’avatar)【26†L12-L15】. Le consentement doit être bilatéral : le donateur autorise explicitement les usages (archives, avatar, simulation) et l’utilisateur doit lui aussi avoir consenti (par ex. via un enregistrement ou l’acceptation du contrat de service). Un *data steward* (membre de la famille ou exécuteur testamentaire) est désigné pour faire respecter les directives post‑mortem et peut également révoquer l’accès ou effacer la représentation【24†L1-L3】【27†L5-L13】.

- **Transparence IA** : Conformément au Règlement AI Act, toute interaction doit indiquer clairement la présence d’une IA et tout contenu généré doit être labellisé comme tel【32†L1-L10】. Cela inclut les voix synthétiques et avatars. *Cities of Light* affichera systématiquement un indicateur (par exemple « IA ») et une mention sur l’interface précisant que les réponses proviennent d’une intelligence artificielle.

- **Protection contre l’exploitation** : L’AI Act (Art. 5) interdit formellement d’exploiter la vulnérabilité d’une personne pour la manipuler【33†L2-L10】. Concrètement, la plateforme bannit tout modèle économique ou campagne marketing ciblant la fragilité émotionnelle d’utilisateurs en deuil (pas de publicité associée, pas d’offres spéciales liées au statut de deuil). Le design anti‑manipulation demandera un audit par un comité d’éthique pour tous les contenus automatisés sensibles【33†L2-L10】【32†L1-L10】.

- **Sécurité des données** : Les données collectées (audio, vidéo, textes personnels) sont hautement sensibles. La CNIL recommande un chiffrement fort et la mise en œuvre de mesures organisationnelles (ex. MFA pour les administrateurs)【18†L5-L8】【19†L1-L7】. *Cities of Light* utilisera donc un stockage chiffré (AES-256) sur le cloud, liaisons sécurisées, et procédures de revues d’accès régulières.

## Cadre légal européen et français

### Régulation UE (AI Act)

- **Article 50 – Transparence** : Toute personne interagissant avec l’IA doit être informée de cette nature (Article 50.1) et tout contenu créé doit être clairement marqué comme synthétique (Article 50.2)【32†L1-L10】. Par exemple, le flux vidéo d’un avatar IA sera signalé par un message « Généré par IA ».

- **Article 5 – Interdiction de l’exploitation des vulnérabilités** : Il est interdit d’utiliser l’IA pour influencer, sans pleine conscience de l’utilisateur, son comportement pour en tirer un profit ou l’exposer à un risque significatif【33†L2-L10】. Ainsi, *Cities of Light* intégrera des garde-fous pour éviter les cycles infinis ou les incitations financières agressives auprès d’usagers vulnérables.

- **Entrée en vigueur** : Le texte final de l’AI Act (Règlement (UE) 2024/1689) est en vigueur depuis août 2024. Les obligations de transparence et de sécurité s’appliquent pleinement à partir du 2 août 2026【23†L9-L11】. *Cities of Light* vise une conformité totale (audits) d’ici là.

### Régulation France

- **Données post-mortem** : En France, le RGPD ne s’applique pas aux personnes décédées【24†L1-L3】. La Loi Informatique et Libertés autorise cependant des **directives post-mortem** pour organiser le sort des données【24†L1-L3】【27†L5-L13】. *Cities of Light* devra permettre aux utilisateurs, de leur vivant, de définir comment leurs données seront utilisées après leur mort (suppression, transfert à un hériter, accès limité à certains proches). Ces directives exigent un consentement explicite et ne peuvent pas être intégrées dans un simple contrat d’adhésion【27†L5-L13】.

- **Consentement spécifique** : Toute utilisation des données d’un décédé (par ex. création d’un avatar interactif) nécessite l’accord du donneur ou, à défaut, de l’exécuteur désigné【27†L5-L13】. *Cities of Light* enregistrera chaque consentement (ou révocation) avec horodatage, conformément aux recommandations CNIL.

- **Sécurité et responsabilité** : En tant que responsable de traitement, l’opérateur devra publier une politique de confidentialité claire, nommer un DPO et réaliser des analyses d’impact (PIA) pour anticiper les risques spécifiques liés aux « digital remains ».

## Faisabilité scientifique

### Agents multi‑agents et architectures IA

- **Generative Agents (Park et al.)** : L’architecture la plus proche de *Cities of Light* combine un LLM à une **mémoire d’expériences** et un mécanisme de réflexion interne【3†L1-L4】. Chaque IA enregistre ses échanges et peut les réutiliser pour créer un récit cohérent.  

- **RAG (Retrieval-Augmented Generation)** : Pour éviter les hallucinations, on intègre un moteur de recherche par similarité (vector DB). Lorsqu’un utilisateur pose une question, le système récupère des extraits de l’archive du personnage (transcriptions, documents) pour guider le LLM【4†L1-L5】. Cette méthode assure la fiabilité factuelle : l’avatar ne « devine » pas, il consulte des fragments de donnée réels.

- **Simulation multi‑agents** : Le serveur VR orchestrera un monde avec de multiples IA. On s’appuiera sur un moteur physique (Unity/Unreal) pour les déplacements et interactions. Les IA apprennent à bouger et interagir via un algorithme de renforcement (par ex. tâtonnements simulés). Cela rejoint les concepts de « metaverse » où chaque agent contrôle un avatar en environnement partagé.

### Données cérébrales et limitations

Les ambitions « ramener tout le monde » doivent intégrer la neuroscience : cartographier les cerveaux ne garantit pas la personnalité. Le **Human Connectome Project** (HCP) a démontré que la connectivité cérébrale structurelle (SC) d’une personne ne suffit pas à expliquer ses traits psychologiques – le lien entre SC et personnalité reste « unclear »【11†L1-L4】. Autrement dit, un scan cérébral même très fin ne permet pas de « recréer » l’âme d’une personne. 

Pour illustrer, le *Whole Brain Emulation* (WBE) de Sandberg & Bostrom exige de scanner en détails la structure neuronale, puis de l’émuler sur un supercalculateur【4†L103-L110】. Ce travail nécessiterait une « compréhension fonctionnelle » hors de portée actuelle. Par exemple, l’analyse de la feuille de route WBE conclut qu’on ne peut pas atteindre une émulation complète sans modèle cognitif approfondi【4†L103-L110】【4†L181-L189】. Cela confirme que *Cities of Light* ne peut « ressusciter » littéralement tous les individus – le projet se limite à des **simulations sociales** et des avatars dialoguant avec fidélité historique.

## Architecture technique

- **Ingestion/Curation** : Systèmes de capture audio/vidéo (studio mobile ou fixed) avec segmentation automatisée en Q&A. Une étape de curation humaine valide chaque entrée, retire les données non autorisées (ex. droits de tiers) et indexe les réponses dans une base sécurisée.  
- **Stockage chiffré** : Les archives brutes (voix, vidéos, textes) sont stockées dans un cloud chiffré【18†L5-L8】. Une base de données (NoSQL) conserve les métadonnées et vecteurs pour la recherche RAG. Les accès sont strictement contrôlés (MFA pour les administrateurs, journaux d’accès complets).  
- **Service RAG et LLM** : Chaque agent biographique dispose d’un index sémantique de ses données. Lors d’une requête, le moteur RAG récupère les fragments pertinents, puis un LLM (pré-entraîné sur de grands corpus) génère la réponse finale en se basant sur ces fragments【4†L1-L5】. Ce modèle garantit la cohérence (la réponse cite explicitement ses sources récupérées) et la diversité (adaptation à la question contextuelle).  
- **Simulation VR multi‑agents** : Le monde VR est hébergé sur un serveur dédié. Les avatars, contrôlés par les IA, interagissent en temps réel (voix 3D spatialisée, déplacements, actions). Des mécanismes (filtres de sécurité) empêchent les agents d’interagir hors de leurs droits (ex. refuser une question trop sensible). Les événements temps réel (concerts, expos) synchronisent tous les clients connectés.  

```mermaid
flowchart TB
  subgraph Ingestion
    A(Capture audio/vidéo)-->B(Segmentation Q/A)
    B-->C(Validation humaine)
    C-->D[Stockage chiffré des médias]
    C-->E[Index vectoriel RAG]
  end

  subgraph Services
    RAG[Moteur RAG] --> AVA[Agent IA (LLM + mémoire)]
    AVA --> UI[Interface utilisateur (console/VR)]
    POL(Policy Engine) --> RAG
    POL --> AVA
    LOG(Audit logs) --> D
    LOG --> E
  end

  D --> RAG
  E --> RAG
  UI --> POL
  LOG -->|analyse| POL
  POL -->|filtrage| AVA
```

## Gouvernance et consentement

- **Choix éclairés** : Chaque utilisateur signe un consentement détaillé (enregistrement électronique) précisant les usages de ses données (archivage, avatar, simulation). Par ex. cocher distinctement l’autorisation pour un usage *historique* (lecture seule) ou *interactif* (avatar). Ce consentement fait explicitement référence à la loi (Art.85 LIL) et engage le responsable de traitement à le respecter【27†L5-L13】.  
- **Droits des ayants droit** : Le formulaire prévoit un exécuteur (membre de la famille) qui pourra faire appliquer les directives après décès. Les héritiers légaux peuvent également demander la suppression ou la remise des données, comme le prévoit la loi française.  
- **Auditabilité** : Toutes les interactions (prompt, résultat, sources utilisées) sont journalisées, et un comité interne peut auditer ce journal pour tout incident. Les agents IA eux-mêmes conservent une mémoire de dialogue (sécurisée) pour amélioration continue.  

## Approches et comparaisons

| Approche                    | Données nécessaires                   | Avantages                         | Risques / Limites                 |
|----------------------------|---------------------------------------|-----------------------------------|-----------------------------------|
| **Archive interactive** (Mode A)     | Vidéo/Q&A + transcriptions             | Fidélité maximale, pas d’hallucination【25†L72-L80】 | Réponses limitées, collecte lourde |
| **Avatar contraint** (Mode B)       | + Index RAG, LLM                     | Réponses adaptatives, conversation naturelle【4†L1-L5】 | Risques d’erreur factuelle si RAG incomplet |
| **Simulation IA** (Mode C)         | + Moteur VR, sim multi-agents          | Monde vivant, interactions sociales【3†L1-L4】 | Très complexe, contrôle comportement difficile |
| **Émulation cerveau** (WBE)         | Scan 3D complet + données dynamiques | Effet “présence totale” hypothétique | **Infaisable** techniquement, irréaliste【4†L103-L110】【4†L181-L189】 |

## Roadmap et pilotes

1. **MVP « Archive & Q/A » (0–6 mois)** :  
   - Développer l’outil de capture et le pipeline RAG simple.  
   - Créer des biographies interactives test (p. ex. 5 donateurs).  
   - Exécuter un pilote restreint avec un musée ou fondation mémorielle.  
   - Évaluer la satisfaction et la qualité des correspondances question-réponse.  

2. **Prototype avatar (6–12 mois)** :  
   - Intégrer un LLM générique (ex. GPT), entraîné sur les données curées et RAG du donateur.  
   - Développer les synthetic souls internes pour tester la convivialité.  
   - Effectuer des tests utilisateurs formels (y compris suivi d’incidents éthiques).  
   - Publier une version bêta privée (Meta Quest).  

3. **Déploiement large (12–24 mois)** :  
   - Étendre la plateforme à de nombreux utilisateurs/institutions.  
   - Lancer les environnements multi-îles, l’édition par les IA (permettre aux agents de coder/modifier le monde virtuel).  
   - Organiser des événements mixtes (concerts virtuels IA/humains, expositions).  
   - Assurance qualité continue et audits réglementaires.  

**Pilotage muséal** : co-construire le projet avec des partenaires comme la Shoah Foundation (affichages pédagogiques, guides), en s’appuyant sur leur expertise des entretiens interactifs【25†L72-L80】.

## Estimation des coûts (ordre de grandeur)

- **Équipe technique** : ~10–15 personnes (dev VR/ML, ingénieurs backend, designers, responsable légal) – salaire total env. 60–100 k€/mois.  
- **Infrastructure** :  
  - Serveurs GPU (AWS p4d, A100) pour LLM : ~5–10 k€/mois (surcouche, selon usage)【38†L11-L13】【8†L17-L21】.  
  - Stockage chiffré (S3 standard) : ~0,025 €/Go·mo【18†L5-L8】.  
  - APIs IA (GPT-4, embeddings) : ~500–2 000 €/mois (selon appels)【8†L17-L21】.  
- **Coûts annexes** : licences logicielles (~1–2 k€/an), assurance, marketing/test utilisateurs (1–5 k€).

*(Ces estimations sont indicatives – à valider via études techniques et financières détaillées.)*

## Conclusions

Les **sources académiques et industrielles** convergent vers une conclusion claire : un système comme *Cities of Light* est **réaliste techniquement** avec les technologies actuelles (IA conversationnelle + VR), à condition de respecter des principes éthiques stricts. Les projets tels que *Dimensions in Testimony*, StoryFile ou HereAfter AI ont déjà montré la voie pour des biographies interactives respectueuses【25†L72-L80】【27†L1-L8】【29†L1-L6】. Les lois européennes et françaises (AI Act, CNIL) fournissent un cadre pour protéger les individus (dignité, consentement)【32†L1-L10】【27†L5-L13】. Ainsi, en combinant ces enseignements, *Cities of Light* peut évoluer en un univers VR immersif tout en préservant la dignité des personnes, vivantes ou décédées.

