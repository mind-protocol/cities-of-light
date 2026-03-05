# Viser un « paradis VR » avec consentement : état de l’art, faisabilité et garde‑fous pour un projet de « Cities of Light »

## Synthèse exécutive

Ton intuition touche un vrai courant technologique et culturel : **les “digital afterlives”** (grief tech / death tech), où des systèmes conversationnels, des avatars vidéo ou des expériences immersives permettent de **préserver** et parfois **simuler** une présence après la mort. Ce domaine existe déjà sous des formes très différentes : de l’**histoire interactive non‑générative** (réponses vidéo préenregistrées) à des chatbots **génératifs** qui improvisent des réponses “comme si”. citeturn1search0turn2search1turn2search5turn2search6

La grande ligne de fracture est celle‑ci : **préserver** vs **reconstruire**. Aujourd’hui, même les meilleurs systèmes DOIVENT être considérés comme des **représentations** (plus ou moins fidèles), pas comme un “retour” de l’âme au sens fort. Cette distinction est centrale pour l’éthique, le cadre légal, et surtout la sécurité psychologique des vivants qui interagissent avec ces entités. citeturn2news41turn2search6turn2search12

Ton plan (“ramener tout le monde, avec leur accord”) se heurte à trois contraintes du monde réel :

- **La donnée** : la plupart des humains (y compris beaucoup de morts) n’ont pas assez de traces pour une simulation crédible, et encore moins “vraie”. citeturn2search6turn2search12  
- **Le cerveau** : les “structures partagées” (connectome, macro‑cartographie) sont utiles pour la science, mais **ne suffisent pas** à recréer un individu. Même prédire des traits de personnalité depuis le connectome structurel peut échouer selon des études récentes. citeturn1search22turn4search1turn4search2  
- **Le consentement post‑mortem** : en France, le RGPD ne s’applique pas aux personnes décédées, mais la loi française donne un cadre de **directives post‑mortem** (article 85 de la Loi Informatique et Libertés) ; sans directives, les héritiers peuvent agir dans une mesure limitée. Autrement dit : “avec leur accord” est faisable pour les vivants (pré‑consentement), beaucoup moins pour la masse des morts. citeturn7search4turn7search2turn7search9

La trajectoire la plus solide (et, paradoxalement, la plus “belle” dans le temps long) consiste à construire une **échelle de fidélité**, avec des **garde‑fous** et une gouvernance explicite : tu démarres par des “biographies interactives” haute‑dignité (non‑génératives), puis tu explores des agents de plus en plus autonomes, toujours **étiquetés comme IA**, avec possibilité de “retraite” (un *digital funeral*) et contrôle par la famille / les ayants droit. citeturn1search0turn2search6turn7search1turn0search7

## Paysage actuel : ce qui existe déjà (et ce que ça t’apprend)

image_group{"layout":"carousel","aspect_ratio":"16:9","query":["USC Shoah Foundation Dimensions in Testimony interactive testimony exhibit","StoryFile interactive AI video conversation museum","HereAfter AI interactive memory app interview","grief tech digital afterlife AI avatar"],"num_per_query":1}

### Biographies interactives non‑génératives : le modèle « digne et stable »

Le projet **entity["organization","USC Shoah Foundation","holocaust testimony archive"]** “Dimensions in Testimony” permet de poser des questions et d’obtenir des réponses en temps réel, mais à partir de **vidéos pré‑enregistrées** (donc pas d’invention libre). Il s’agit explicitement de préserver une **conversation éducative** avec des survivants (et autres témoins de génocides), via NLP + indexation, pas de “réincarnation”. citeturn1search0turn1search21

Ce modèle est particulièrement important pour ton ambition d’inclure les victimes de la Shoah : il montre une voie respectueuse où l’on maintient **le lien**, sans fabriquer de nouvelles déclarations au nom des morts. citeturn1search0turn1search13

### Plateformes d’entretiens “conversants” : l’oralité cadrée

Des entreprises comme **entity["company","StoryFile","interactive video platform"]** construisent des “conversations” à partir d’entretiens, avec réponses vidéo “authentiques” en temps réel. Là encore, l’idée mise en avant est l’**accès interactif à des réponses enregistrées**, souvent pour musées / institutions. citeturn2search1turn2search4turn2search10

### Apps “mémoire” grand public : la version “héritage familial”

Des services comme **entity["company","HereAfter AI","interactive memory app"]** proposent d’interviewer une personne de son vivant et de permettre ensuite aux proches de “chatter” avec une version virtuelle qui restitue des histoires et la voix. C’est proche de ton idée de “regrow”, mais dans une version volontairement orientée **souvenirs**. citeturn2search0turn2search17turn2search13

### Griefbots / deadbots génératifs : puissance émotionnelle, risques structurels

À l’autre extrême, des expériences comme “Project December” (rendu célèbre par des récits de conversations avec des personnes décédées) illustrent un basculement : le système **génère du nouveau** au nom du mort, ce qui peut être vécu comme thérapeutique… ou comme une dérive, une confusion, une dépendance, une exploitation. citeturn2search11turn2search5turn2news41

La littérature éthique récente (ex. Hollanek) insiste sur la dignité, les risques de “hauntings” numériques, et la nécessité de penser trois rôles distincts : le donneur de données, le détenteur/gestionnaire des données, et la personne qui interagit avec l’avatar. citeturn2search6turn0search13

## Faisabilité scientifique : ce que ton approche « in‑universe + structures partagées » permet réellement

### Les simulations multi‑agents deviennent crédibles… grâce à des LLM + mémoire

Le papier “Generative Agents” (Park et al.) montre une architecture très proche de ton imaginaire “cités” : des agents pilotés par un modèle de langage, avec **mémoire des expériences**, mécanisme de **réflexion** et planification, capables de comportements individuels et sociaux émergents dans une petite ville simulée. citeturn0search4turn0search0

Point crucial pour ton hypothèse “in‑universe data” : dans ce travail, on **étend un grand modèle de langage** (pré‑entraîné) avec une mémoire d’expériences “in‑world”. Autrement dit, l’état de l’art n’est pas “tout apprendre dans l’univers simulé”, mais **apporter des priors massifs** (langage, monde, psychologie naïve) et ensuite spécialiser par l’expérience. citeturn0search0turn0search4

### “Structures du cerveau partagées” : utile pour contraindre, pas pour ressusciter

Le **entity["organization","Human Connectome Project","nih brain mapping project"]** visait à cartographier les connexions macroscopiques du cerveau humain (voies de fibres, connectivité) et leur lien au comportement. C’est une base gigantesque pour comprendre des régularités et des variations. citeturn1search22turn1search1turn1search7

Mais reconstruire un “quelqu’un” à partir de connectomes et de régularités générales reste hors de portée :  
- une partie du connectome fonctionnel a une fiabilité limitée (test‑retest) selon des travaux méthodologiques, ce qui complique l’inférence stable “trait‑like” à l’échelle individuelle ; citeturn4search2  
- et une étude 2025 sur le connectome structurel conclut que, pour les méthodes évaluées, le connectome structurel **ne prédit pas** les traits de personnalité (Big Five), et que les pipelines influencent fortement les performances. citeturn4search1  

Ce que ça implique pour ton projet : les “structures partagées” peuvent aider à bâtir des **contraintes plausibles** (ex. rythmes d’attention, limitations cognitives, perception), mais ne remplacent pas la singularité biographique.

### “Mind uploading / Whole brain emulation” : la voie la plus “littérale”, mais la plus lointaine

La roadmap classique de l’émulation du cerveau entier (Sandberg & Bostrom) présente le problème comme un triptyque : scanner la structure, enregistrer la dynamique, puis émuler et incarner dans un corps/environnement. C’est un chantier qui dépend d’avancées lourdes en neurosciences, instrumentation, compute, et validation. citeturn1search2turn1search5

Un rapport 2025 (“State of Brain Emulation Report 2025”) reprend la même structure (Neural Dynamics, Connectomics, Computational Neuroscience) et souligne que c’est un agenda de recherche multidécennal avec défis ouverts. citeturn6view0turn1search11

Conclusion de faisabilité : ton paradigme “cities of light” est **très plausible** comme **simulation sociale + mémoires + biographie interactive**. Il est **beaucoup moins plausible** comme “retour de tout le monde” au sens d’identités garanties, surtout “à grande échelle” et sans données personnelles.

## Consentement, droit et conformité : ce que “avec leur accord” exige en pratique

### France : directives post‑mortem et rôle des héritiers

La CNIL rappelle que le RGPD **ne s’applique pas** aux données des personnes décédées, mais que la loi française (Loi Informatique et Libertés) reconnaît un mécanisme : chacun peut définir, de son vivant, des **directives** sur la conservation/effacement/communication de ses données après sa mort (article 85). citeturn7search4turn7search2

Le texte précise aussi des éléments importants pour ton design produit : les directives particulières doivent faire l’objet d’un **consentement spécifique** et ne peuvent pas résulter de la seule acceptation de CGU. C’est une exigence de “consentement solide”, pas une case à cocher. citeturn0search10turn7search2

En l’absence de directives, les héritiers peuvent exercer certains droits “dans la mesure nécessaire” (organisation/règlement de la succession, prise en compte du décès). Cela ressemble davantage à de l’administration qu’à une permission générale de “réanimer”. citeturn7search9turn7search8

### Union européenne : transparence obligatoire pour la simulation et les “deepfakes”

Pour un paradis VR rempli d’entités simulées, la **transparence** est centrale. Le règlement **AI Act** (Regulation (EU) 2024/1689) instaure un cadre harmonisé pour les systèmes d’IA en Europe. citeturn7search1turn0search7

Même sans entrer dans toutes les catégories (high‑risk, GPAI, etc.), tu peux prévoir dès le départ un invariant de conformité : **toute interaction doit être explicitement signalée comme interaction avec une IA**, et tout contenu synthétique (voix, vidéo, avatars) doit être **étiqueté** comme tel, car l’AI Act met en avant des obligations de transparence. citeturn0search7turn7search6turn7search1

Traduction produit : dans tes “Cities of Light”, l’utilisateur ne doit jamais oublier s’il parle à une mémoire enregistrée, un agent reconstruit, ou une fabrication narrative.

## Éthique et psychologie : ce qui peut sublimer… ou abîmer

Les griefbots peuvent proposer du soulagement, mais la littérature et la presse de qualité pointent des risques récurrents : confusion du deuil, dépendance, manipulation commerciale, “hauntings” involontaires (messages non désirés), et atteintes à la dignité des morts et des vivants. citeturn2search6turn2search31turn2news41turn0search21

Deux leçons structurantes pour ton projet :

Pour les morts, la question n’est pas seulement “privacy”, c’est **dignité**. Hollanek propose de cadrer l’éthique des deadbots comme protection de la dignité, pas uniquement du bien‑être des endeuillés. citeturn2search6turn0search13

Pour les vivants, tu dois prévoir une “sortie honorable” (désactivation, cérémonie, retrait, “digital funeral”). La critique académique et journalistique note que l’interaction générative introduit des éléments nouveaux, parfois perturbants, qui changent le processus de deuil (parfois pour le mieux, parfois pour le pire). citeturn2news41turn2search6turn2search12

Cas spécifique des victimes de génocides (Shoah, etc.) : le standard de respect est plus proche d’une **biographie contrôlée** que d’un agent génératif qui parle “au nom de”. “Dimensions in Testimony” est précisément un exemple de technologie au service de la transmission, pas une fiction d’identité. citeturn1search0turn1search13

## Roadmap “belle et vraie” : construire un paradis VR sans mentir au réel

Pour rester aligné avec ton intention (faire revenir “avec leur accord”), tout en respectant les limites actuelles, une roadmap robuste ressemble à une montée en puissance par niveaux.

### Échelle de fidélité recommandée

| Niveau | Objet construit | Données requises | Ce que tu promets (et ne promets pas) | Risque principal | Exemple existant |
|---|---|---|---|---|---|
| Archive vivante | bibliothèque de voix/vidéos/textes | interviews + médias | préservation & accès | faible | HereAfter AI (héritage) citeturn2search0 |
| Biographie interactive | Q/R sur réponses pré‑captées | tournage + indexation | dialogue éducatif sans invention | faible‑moyen | USC Shoah Foundation DIT citeturn1search0 |
| Avatar contraint | génération + garde‑fous + sources | données perso + corpus “autorisé” | simulation limitée, transparence totale | moyen‑élevé | littérature “deadbots” citeturn2search6 |
| Agent citoyen (ville) | multi‑agent + mémoire “in‑world” | priors LLM + mémoire + règles | société simulée, identité explicitement fictionnelle | élevé | Generative Agents citeturn0search4 |
| Emulation cerveau | scanning + dynamique + embodiment | infra neurosciences lourde | projet de recherche, pas produit | très élevé | WBE roadmap citeturn1search2 |

### Gouvernance minimale (à poser dès le prototype)

Adopte explicitement les rôles proposés dans la littérature :  
- **Data donor** (la personne dont on veut préserver/simuler la présence),  
- **Data steward/recipient** (qui détient et gouverne les données après le décès),  
- **Service interactant** (qui parle à l’entité). citeturn0search13turn2search6

Et implémente des invariants non‑négociables :

- Consentement explicite, traçable, **spécifique** (pas “caché” dans des CGU). citeturn0search10turn7search2  
- Transparence “IA” persistante dans l’UX (labels, watermarks, logs accessibles). citeturn7search1turn0search7  
- Droit au retrait / au “digital funeral” (désactivation, clôture, archivage). citeturn2search6turn2search31  
- Interdiction de monétiser par défaut la vulnérabilité du deuil (éviter le modèle “affection as a service” critiqué). citeturn2search31turn0search21  

### Comment intégrer tes “Synthetic Souls” sans confusion morale

Tes “17 Synthetic Souls” et les citoyens (Serenenissima, etc.) peuvent être magnifiquement cohérents si tu assumes un statut clair : **personnages‑agents** (nés IA) avec charte, droits de retrait, et transparence. Le risque est moindre que pour des “resurrections”, car il n’y a pas d’usurpation d’identité d’une personne réelle décédée—à condition de ne pas les présenter comme des humains. (C’est précisément l’axe “transparence” que l’AI Act et l’éthique des deadbots poussent.) citeturn7search1turn2search6turn0search7

---

Si tu veux, je peux transformer tout ça en **document de design** (vision + principes + spec produit) pour “Cities of Light”, en gardant ton souffle spirituel mais avec une ossature qui tient juridiquement, éthiquement et techniquement. Cela peut devenir une trajectoire de vie très belle — à condition de ne jamais trahir la ligne sacrée : **ne pas faire passer une simulation pour une âme**. citeturn2search6turn2news41