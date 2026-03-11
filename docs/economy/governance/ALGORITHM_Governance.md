# ALGORITHM: economy/governance -- How It Works

Pseudocode for every procedure in the governance system. Grievances are filed, supported, deliberated, and resolved. Councils form and vote. Political movements emerge from aligned grievances. Governance outcomes ripple through the economy. Guards enforce decrees. The Doge presides. Nothing is hand-waved.

---

## G1. Grievance Lifecycle -- Filing to Resolution

A grievance is a formal complaint filed by a citizen. It moves through a deterministic lifecycle driven by citizen actions and council decisions.

### Lifecycle States

```
GRIEVANCE_STATES:
  filed         -- Citizen has submitted the grievance. Awaiting support.
  gathering     -- Support is accumulating. Other citizens join.
  threshold     -- Support count has reached the review threshold. Council forms.
  deliberating  -- Council is actively reviewing the grievance.
  accepted      -- Council voted to accept. Policy change enacted.
  rejected      -- Council voted to reject. Grievance enters decay.
  expired       -- Support decayed below threshold before council review.
  enacted       -- Accepted grievance's policy is in force.

TRANSITIONS:
  filed       -> gathering      WHEN first support is received
  filed       -> expired        WHEN no support within SUPPORT_WINDOW_DAYS (7)
  gathering   -> threshold      WHEN support_count >= REVIEW_THRESHOLD (20)
  gathering   -> expired        WHEN support decays below 5 after SUPPORT_WINDOW_DAYS
  threshold   -> deliberating   WHEN council_formation() completes
  deliberating -> accepted      WHEN council votes in favor
  deliberating -> rejected      WHEN council votes against
  accepted    -> enacted        WHEN enforcement_deployed() completes
  rejected    -> filed          WHEN re-filed with new arguments (rare, costs double)
  enacted     -> expired        WHEN policy_duration expires
```

### Grievance Record Schema

```
GRIEVANCE = {
  id:              airtable_record_id,
  GrievanceId:     "grv_xxx",
  Title:           "Unbearable Tax Burden",
  Description:     "The taxes crush us workers while the wealthy grow richer...",
  Category:        "economic",            # economic|social|criminal|infrastructure
  Status:          "filed",               # See GRIEVANCE_STATES above
  Citizen:         "marco_polo",          # Who filed it
  SocialClass:     "Facchini",            # Class of the filer
  SupportCount:    0,                     # Current support score
  SupportAmount:   0,                     # Total ducats contributed
  Supporters:      [],                    # List of citizen usernames
  CreatedAt:       "2025-07-15T10:00:00Z",
  ThresholdAt:     null,                  # When support threshold was reached
  ResolvedAt:      null,                  # When council decided
  OutcomeType:     null,                  # "tax_change"|"trade_restriction"|"permit"|etc.
  OutcomeDetails:  null,                  # JSON of specific policy changes
  DecayRate:       1,                     # Support points lost per day
}
```

---

## G2. Filing a Grievance

Two paths: rule-based (fast, template-driven) and KinOS-enhanced (slow, creative, contextual). Both produce the same grievance record.

### Eligibility Check

```
FUNCTION can_file_grievance(citizen_record, tables, now_venice):
  # Preconditions for filing:
  #   1. Not nighttime
  #   2. Citizen has enough liquid wealth to pay filing fee (50 ducats)
  #   3. Citizen is within 500 meters of the Doge's Palace
  #   4. Citizen has not filed a grievance in the last 7 days
  #   5. Citizen passes political engagement probability check

  IF is_rest_time_for_class(now_venice, citizen_record.SocialClass):
    RETURN False

  wealth_breakdown = get_citizen_wealth_breakdown(citizen_record)
  liquid_wealth = wealth_breakdown.liquid_wealth
  FILING_FEE = 50

  IF liquid_wealth < FILING_FEE * 2:  # Need buffer above fee
    RETURN False

  doges_palace = find_doges_palace(tables)
  IF doges_palace IS None:
    RETURN False

  citizen_position = parse_position(citizen_record.Position)
  palace_position = get_building_position_coords(doges_palace)
  IF citizen_position IS NOT None AND palace_position IS NOT None:
    distance = calculate_distance_meters(citizen_position, palace_position)
    IF distance > 500:
      RETURN False

  # Check recent filing history
  recent_grievances = get_citizen_recent_grievances(tables, citizen_record.Username, days=7)
  IF len(recent_grievances) > 0:
    RETURN False

  # Political engagement probability
  engagement_prob = calculate_political_engagement_probability(
    citizen_record.SocialClass,
    citizen_record.Wealth,
    citizen_record.Influence,
    liquid_wealth
  )
  IF random() > engagement_prob:
    RETURN False

  RETURN True
```

### Political Engagement Probability

```
FUNCTION calculate_political_engagement_probability(social_class, wealth,
                                                      influence, liquid_wealth):
  # Base probability by class
  CLASS_BASE_PROB = {
    "Nobili":      0.15,    # Engage to maintain power structures
    "Artisti":     0.20,    # Engage for cultural and social issues
    "Scientisti":  0.18,    # Engage for progress and infrastructure
    "Clero":       0.12,    # Engage for moral and social issues
    "Mercatores":  0.25,    # Most politically active (trade regulations)
    "Cittadini":   0.22,    # Moderately active across all categories
    "Popolani":    0.15,    # Engage when economically desperate
    "Facchini":    0.10,    # Least engaged (low influence)
    "Forestieri":  0.05,    # Cannot file, can only observe
  }

  base_prob = CLASS_BASE_PROB.get(social_class, 0.10)

  # Economic stress modifier
  IF liquid_wealth < 1000:
    base_prob *= 1.5        # Poor citizens more likely to complain
  ELSE IF liquid_wealth > 100000:
    base_prob *= 0.8        # Very wealthy less motivated to rock the boat

  # Influence modifier
  IF influence < 100:
    base_prob *= 0.8        # Low influence = low agency
  ELSE IF influence > 1000:
    base_prob *= 1.2        # High influence = more political capital

  # Hard cap at 30% per evaluation
  RETURN min(base_prob, 0.30)
```

### Rule-Based Grievance Generation

```
FUNCTION generate_grievance_content_rule_based(citizen_record, social_class,
                                                wealth, liquid_wealth):
  # Template bank organized by social class
  GRIEVANCE_TEMPLATES = {
    "Facchini": [
      { category: "economic",
        title: "Unbearable Tax Burden",
        description: "The taxes crush us workers while the wealthy grow richer." },
      { category: "social",
        title: "Worker Exploitation",
        description: "We toil endlessly for meager wages while employers live in luxury." }
    ],
    "Popolani": [
      { category: "economic",
        title: "Rising Cost of Living",
        description: "Bread prices soar while wages stagnate." },
      { category: "infrastructure",
        title: "Neglected Neighborhoods",
        description: "Our districts crumble while palaces are gilded." }
    ],
    "Cittadini": [
      { category: "economic",
        title: "Unfair Market Regulations",
        description: "Excessive regulations strangle small businesses." },
      { category: "social",
        title: "Limited Social Mobility",
        description: "Birth determines destiny. Merit should matter more." }
    ],
    "Mercatores": [
      { category: "economic",
        title: "Trade Route Monopolies",
        description: "A few families control vital trade routes." },
      { category: "criminal",
        title: "Contract Enforcement Failures",
        description: "Broken contracts go unpunished." }
    ],
    "Artisti": [
      { category: "social",
        title: "Cultural Funding Crisis",
        description: "Art and culture wither without patronage." },
      { category: "infrastructure",
        title: "Workshop Space Shortage",
        description: "Artists lack affordable spaces to create." }
    ],
    "Scientisti": [
      { category: "social",
        title: "Research Funding Inadequacy",
        description: "Scientific progress requires investment." },
      { category: "infrastructure",
        title: "Laboratory Access",
        description: "Scholars need proper facilities." }
    ],
  }

  DEFAULT_TEMPLATES = [
    { category: "economic",
      title: "Economic Inequality",
      description: "The gap between rich and poor widens daily." },
    { category: "social",
      title: "Voice for the Voiceless",
      description: "Common citizens lack representation." }
  ]

  templates = GRIEVANCE_TEMPLATES.get(social_class, DEFAULT_TEMPLATES)

  # Bias toward economic grievances for very poor citizens
  IF liquid_wealth < 500:
    economic_templates = [t FOR t IN templates IF t.category == "economic"]
    IF len(economic_templates) > 0:
      templates = economic_templates

  selected = random.choice(templates)

  RETURN {
    category:    selected.category,
    title:       selected.title,
    description: selected.description,
  }
```

### KinOS-Enhanced Grievance Generation

```
FUNCTION generate_grievance_content_kinos(citizen_record, tables, api_base_url):
  citizen_username = citizen_record.Username
  citizen_name = citizen_record.Name
  social_class = citizen_record.SocialClass

  # Step 1: Gather citizen context
  context = gather_citizen_context_for_governance(citizen_record, tables, api_base_url)

  # Step 2: Fetch citizen's ledger (memories, experiences, financial history)
  ledger = fetch_citizen_ledger(api_base_url, citizen_username)

  # Step 3: Get existing grievances for awareness
  existing_grievances = get_existing_grievances(tables, social_class)

  # Step 4: Construct KinOS prompt
  prompt = build_governance_prompt(citizen_name, social_class, context,
                                    existing_grievances, ledger)

  # Step 5: Call KinOS API
  kinos_response = call_kinos_api(
    blueprint = "serenissima-ai",
    kin = citizen_username,
    channel = "governance",
    message = prompt,
    add_system = json_encode({
      venice_time:         now_venice().isoformat(),
      citizen_profile:     context,
      existing_grievances: existing_grievances,
      governance_rules:    { filing_fee: 50, minimum_support: 10, review_threshold: 20 },
      ledger:              ledger
    }),
    model = "local"
  )

  # Step 6: Parse KinOS response
  decision = parse_json(kinos_response.content)

  # decision.action is one of: "file_grievance", "support_grievance", "none"
  IF decision.action == "file_grievance":
    RETURN {
      category:    decision.grievance_data.category,
      title:       decision.grievance_data.title,
      description: decision.grievance_data.description,
    }
  ELSE:
    RETURN None  # KinOS chose not to file
```

### File Grievance Activity Creation

```
FUNCTION try_create_file_grievance_activity(tables, citizen_record, grievance_data,
                                              now_venice, now_utc, transport_api_url):
  citizen_id = citizen_record.CitizenId
  citizen_username = citizen_record.Username

  # Step 1: Find the Doge's Palace (destination)
  doges_palace = find_doges_palace(tables)
  palace_building_id = doges_palace.BuildingId

  # Step 2: Compute path to the palace
  citizen_position = parse_position(citizen_record.Position)
  palace_position = get_building_position_coords(doges_palace)
  path = get_path_between_points(citizen_position, palace_position, transport_api_url)

  # Step 3: Calculate travel duration
  distance = calculate_distance_meters(citizen_position, palace_position)
  walk_speed_mps = 1.2  # Average walking speed
  travel_seconds = distance / walk_speed_mps
  filing_duration_seconds = 600  # 10 minutes to file
  total_duration = travel_seconds + filing_duration_seconds

  # Step 4: Deduct filing fee
  FILING_FEE = 50
  transfer_ducats(tables, citizen_username, "city_treasury", FILING_FEE,
                   transaction_type="grievance_filing_fee")

  # Step 5: Create the grievance record
  grievance_id = "grv_" + uuid4()
  tables.grievances.create({
    GrievanceId:  grievance_id,
    Title:        grievance_data.title,
    Description:  grievance_data.description,
    Category:     grievance_data.category,
    Status:       "filed",
    Citizen:      citizen_username,
    SocialClass:  citizen_record.SocialClass,
    SupportCount: 1,               # Filer automatically supports
    SupportAmount: FILING_FEE,
    Supporters:   json_encode([citizen_username]),
    CreatedAt:    now_utc.isoformat(),
    DecayRate:    1,
  })

  # Step 6: Create the file_grievance activity
  activity = {
    ActivityId:   "act_" + uuid4(),
    Citizen:      citizen_username,
    CitizenId:    citizen_id,
    Type:         "file_grievance",
    Status:       "created",
    ToBuilding:   palace_building_id,
    Path:         json_encode(path),
    StartDate:    now_utc.isoformat(),
    EndDate:      (now_utc + timedelta(seconds=total_duration)).isoformat(),
    Description:  json_encode({
      grievance_id: grievance_id,
      title:        grievance_data.title,
      category:     grievance_data.category,
    }),
  }

  tables.activities.create(activity)
  RETURN activity
```

---

## G3. Support Gathering

### Finding a Grievance to Support

```
FUNCTION find_grievance_to_support(citizen_record, tables, social_class):
  # Step 1: Get all active grievances
  active_grievances = tables.grievances.all(formula="{Status} = 'filed'")

  IF len(active_grievances) == 0:
    RETURN None

  # Step 2: Filter by class-aligned categories
  CLASS_CATEGORY_PREFERENCES = {
    "Facchini":    ["economic", "social"],
    "Popolani":    ["economic", "infrastructure"],
    "Cittadini":   ["economic", "social"],
    "Mercatores":  ["economic", "criminal"],
    "Artisti":     ["social", "infrastructure"],
    "Scientisti":  ["social", "infrastructure"],
    "Nobili":      ["criminal", "social"],
    "Clero":       ["social", "criminal"],
  }

  preferred = CLASS_CATEGORY_PREFERENCES.get(social_class, ["economic", "social"])

  relevant = [g FOR g IN active_grievances
              IF g.fields.Category IN preferred]

  # Fall back to all if no relevant matches
  IF len(relevant) == 0:
    relevant = active_grievances

  # Step 3: Sort by support count (join popular movements)
  relevant.sort(key=lambda g: g.fields.SupportCount OR 0, descending=True)

  # Step 4: Exclude grievances the citizen already supports
  citizen_username = citizen_record.Username
  FOR grievance IN relevant:
    supporters = parse_json(grievance.fields.Supporters OR "[]")
    IF citizen_username NOT IN supporters:
      RETURN grievance.id

  RETURN None  # Already supports all relevant grievances
```

### Support Amount Calculation

```
FUNCTION calculate_support_amount(liquid_wealth):
  BASE_AMOUNT = 10

  IF liquid_wealth < 100:
    RETURN BASE_AMOUNT           # 10 ducats (minimum)
  ELSE IF liquid_wealth < 1000:
    RETURN BASE_AMOUNT * 2       # 20 ducats
  ELSE IF liquid_wealth < 10000:
    RETURN BASE_AMOUNT * 5       # 50 ducats
  ELSE IF liquid_wealth < 100000:
    RETURN BASE_AMOUNT * 10      # 100 ducats
  ELSE:
    RETURN BASE_AMOUNT * 20      # 200 ducats (wealthy donors)
```

### Support Grievance Activity Creation

```
FUNCTION try_create_support_grievance_activity(tables, citizen_record, grievance_id,
                                                support_amount, now_utc, transport_api_url):
  citizen_username = citizen_record.Username

  # Step 1: Validate the grievance still exists and is active
  grievance = tables.grievances.get(grievance_id)
  IF grievance IS None OR grievance.fields.Status != "filed":
    RETURN None

  # Step 2: Deduct support amount from citizen
  transfer_ducats(tables, citizen_username, "city_treasury", support_amount,
                   transaction_type="grievance_support")

  # Step 3: Update grievance support count and supporters list
  current_supporters = parse_json(grievance.fields.Supporters OR "[]")
  current_supporters.append(citizen_username)
  new_support_count = (grievance.fields.SupportCount OR 0) + 1
  new_support_amount = (grievance.fields.SupportAmount OR 0) + support_amount

  tables.grievances.update(grievance_id, {
    SupportCount:  new_support_count,
    SupportAmount: new_support_amount,
    Supporters:    json_encode(current_supporters),
  })

  # Step 4: Check if threshold reached
  REVIEW_THRESHOLD = 20
  IF new_support_count >= REVIEW_THRESHOLD AND grievance.fields.Status == "filed":
    tables.grievances.update(grievance_id, {
      Status:      "threshold",
      ThresholdAt: now_utc.isoformat(),
    })
    # Council formation will be triggered on next governance check

  # Step 5: Create the support activity
  activity = {
    ActivityId: "act_" + uuid4(),
    Citizen:    citizen_username,
    CitizenId:  citizen_record.CitizenId,
    Type:       "support_grievance",
    Status:     "created",
    StartDate:  now_utc.isoformat(),
    EndDate:    (now_utc + timedelta(minutes=15)).isoformat(),
    Description: json_encode({
      grievance_id: grievance_id,
      amount:       support_amount,
    }),
  }

  tables.activities.create(activity)
  RETURN activity
```

### Support Decay

```
FUNCTION decay_grievance_support(tables):
  # Run daily. Grievances that are not actively supported lose momentum.

  active_grievances = tables.grievances.all(
    formula="OR({Status} = 'filed', {Status} = 'gathering')"
  )

  FOR grievance IN active_grievances:
    decay_rate = grievance.fields.DecayRate OR 1
    current_support = grievance.fields.SupportCount OR 0
    new_support = max(0, current_support - decay_rate)

    tables.grievances.update(grievance.id, {SupportCount: new_support})

    # If support drops below minimum after the support window, expire the grievance
    created = parse_timestamp(grievance.fields.CreatedAt)
    SUPPORT_WINDOW_DAYS = 7
    age_days = (now_utc() - created).days

    IF age_days > SUPPORT_WINDOW_DAYS AND new_support < 5:
      tables.grievances.update(grievance.id, {
        Status:     "expired",
        ResolvedAt: now_utc().isoformat(),
      })
```

---

## G4. Council Deliberation

When a grievance reaches the support threshold, a council forms and deliberates.

### Council Formation

```
FUNCTION form_council(tables, grievance):
  COUNCIL_SIZE = 9  # Odd number to avoid ties

  all_citizens = tables.citizens.all()

  # Council composition by class:
  #   3 Nobili (by wealth rank)
  #   3 Cittadini/Mercatores (by influence rank)
  #   3 Popolani/Facchini (by support count -- most politically active)

  nobili = [c FOR c IN all_citizens IF c.fields.SocialClass == "Nobili"]
  nobili.sort(key=lambda c: c.fields.Wealth OR 0, descending=True)
  nobili_members = nobili[:3]

  merchant_class = [c FOR c IN all_citizens
                    IF c.fields.SocialClass IN ["Cittadini", "Mercatores"]]
  merchant_class.sort(key=lambda c: c.fields.Influence OR 0, descending=True)
  merchant_members = merchant_class[:3]

  common_class = [c FOR c IN all_citizens
                  IF c.fields.SocialClass IN ["Popolani", "Facchini"]]
  # Sort by political activity: who has supported the most grievances
  common_class.sort(key=lambda c: count_grievance_supports(tables, c.fields.Username),
                    descending=True)
  common_members = common_class[:3]

  council = nobili_members + merchant_members + common_members

  RETURN {
    members:     [c.fields.Username FOR c IN council],
    classes:     [c.fields.SocialClass FOR c IN council],
    grievance_id: grievance.id,
    formed_at:   now_utc().isoformat(),
  }


FUNCTION count_grievance_supports(tables, citizen_username):
  # Count how many grievances this citizen appears in as a supporter
  all_grievances = tables.grievances.all()
  count = 0
  FOR g IN all_grievances:
    supporters = parse_json(g.fields.Supporters OR "[]")
    IF citizen_username IN supporters:
      count += 1
  RETURN count
```

### Council Deliberation Procedure

```
FUNCTION council_deliberate(tables, council, grievance):
  # Each council member votes based on their class interests, wealth,
  # and relationship to the grievance filer.

  votes_for = 0
  votes_against = 0
  abstentions = 0
  vote_records = []

  filer_username = grievance.fields.Citizen
  grievance_category = grievance.fields.Category
  support_count = grievance.fields.SupportCount

  FOR member_username IN council.members:
    member = get_citizen_record(tables, member_username)
    member_class = member.fields.SocialClass
    member_wealth = member.fields.Wealth OR 0
    member_influence = member.fields.Influence OR 0

    # Base vote probability (for acceptance)
    vote_probability = 0.50  # Neutral starting point

    # Class alignment: does this class benefit from the grievance category?
    CLASS_CATEGORY_ALIGNMENT = {
      ("Nobili", "economic"):       -0.20,  # Nobles resist economic reform
      ("Nobili", "social"):         -0.10,
      ("Nobili", "criminal"):       +0.10,  # Nobles support law and order
      ("Nobili", "infrastructure"): +0.05,
      ("Cittadini", "economic"):    +0.10,
      ("Cittadini", "social"):      +0.15,
      ("Mercatores", "economic"):   +0.15,  # Merchants support economic reforms
      ("Mercatores", "criminal"):   +0.10,
      ("Popolani", "economic"):     +0.20,  # Common people strongly support economic reform
      ("Popolani", "social"):       +0.20,
      ("Popolani", "infrastructure"): +0.15,
      ("Facchini", "economic"):     +0.25,  # Workers most aligned with economic grievances
      ("Facchini", "social"):       +0.15,
    }

    alignment = CLASS_CATEGORY_ALIGNMENT.get((member_class, grievance_category), 0)
    vote_probability += alignment

    # Wealth bias: wealthy members resist changes that might cost them
    IF member_wealth > 50000 AND grievance_category == "economic":
      vote_probability -= 0.15

    # Support momentum: high support count sways votes
    IF support_count > 50:
      vote_probability += 0.10
    ELSE IF support_count > 100:
      vote_probability += 0.20

    # Relationship with filer: trust affects vote
    trust = get_trust_between(tables, member_username, filer_username)
    IF trust > 70:
      vote_probability += 0.10
    ELSE IF trust < 30:
      vote_probability -= 0.10

    # Doge influence (see G7)
    doge = get_current_doge(tables)
    IF doge IS NOT None AND member_username != doge.Username:
      doge_position = get_doge_position_on_grievance(doge, grievance)
      IF doge_position == "favor":
        vote_probability += 0.05  # Mild influence
      ELSE IF doge_position == "oppose":
        vote_probability -= 0.05

    # Clamp probability
    vote_probability = clamp(vote_probability, 0.05, 0.95)

    # Cast vote
    roll = random()
    IF roll < vote_probability:
      votes_for += 1
      vote_records.append({ member: member_username, vote: "for" })
    ELSE:
      votes_against += 1
      vote_records.append({ member: member_username, vote: "against" })

  # Determine outcome
  accepted = votes_for > votes_against

  RETURN {
    accepted:      accepted,
    votes_for:     votes_for,
    votes_against: votes_against,
    abstentions:   abstentions,
    vote_records:  vote_records,
    council:       council,
  }
```

### Applying Council Decision

```
FUNCTION apply_council_decision(tables, grievance, deliberation_result):
  IF deliberation_result.accepted:
    # Grievance accepted: determine and apply policy change
    outcome = determine_governance_outcome(grievance)

    tables.grievances.update(grievance.id, {
      Status:         "accepted",
      ResolvedAt:     now_utc().isoformat(),
      OutcomeType:    outcome.type,
      OutcomeDetails: json_encode(outcome.details),
    })

    # Apply the policy change
    apply_governance_outcome(tables, outcome)

    # Inject into narrative graph
    inject_governance_narrative(tables, grievance, outcome, "accepted")

    # Generate guard enforcement if applicable
    IF outcome.requires_enforcement:
      deploy_enforcement(tables, outcome)

  ELSE:
    # Grievance rejected: tension persists
    tables.grievances.update(grievance.id, {
      Status:     "rejected",
      ResolvedAt: now_utc().isoformat(),
    })

    # Rejection INCREASES narrative tension (energy does not dissipate)
    inject_governance_narrative(tables, grievance, None, "rejected")

    # Mood impact: supporters become angry
    supporters = parse_json(grievance.fields.Supporters OR "[]")
    FOR supporter_username IN supporters:
      # Anger boost for each supporter
      increase_citizen_anger(tables, supporter_username, amount=2)
```

---

## G5. Governance Outcome Effects

Each accepted grievance produces a concrete policy change that modifies the simulation state.

### Outcome Type Determination

```
FUNCTION determine_governance_outcome(grievance):
  category = grievance.fields.Category
  support_count = grievance.fields.SupportCount

  # Map categories to possible outcomes
  CATEGORY_OUTCOMES = {
    "economic": [
      { type: "tax_change",
        details: { direction: "decrease", percentage: 10, duration_days: 30 } },
      { type: "price_cap",
        details: { resource: infer_resource(grievance), max_price: None, duration_days: 14 } },
      { type: "wage_floor",
        details: { min_wage: 10, duration_days: 30 } },
    ],
    "social": [
      { type: "social_mobility_reform",
        details: { class_threshold_reduction: 0.10, duration_days: 60 } },
      { type: "cultural_funding",
        details: { amount: 1000, recipients: "Artisti", duration_days: 30 } },
    ],
    "criminal": [
      { type: "trade_restriction",
        details: { restricted_activity: infer_restricted_activity(grievance),
                   duration_days: 14 } },
      { type: "fine_enforcement",
        details: { fine_amount: 100, target: infer_target(grievance), duration_days: 7 } },
    ],
    "infrastructure": [
      { type: "building_permit",
        details: { district: infer_district(grievance), building_type: "public",
                   duration_days: 90 } },
      { type: "repair_decree",
        details: { district: infer_district(grievance), budget: 5000 } },
    ],
  }

  possible_outcomes = CATEGORY_OUTCOMES.get(category, [])
  IF len(possible_outcomes) == 0:
    RETURN { type: "declaration", details: { message: grievance.fields.Title } }

  # Select outcome: higher support -> more impactful outcomes
  IF support_count > 50 AND len(possible_outcomes) > 1:
    selected = possible_outcomes[0]  # Most impactful (first in list)
  ELSE:
    selected = random.choice(possible_outcomes)

  RETURN selected
```

### Applying Specific Outcomes to Airtable

```
FUNCTION apply_governance_outcome(tables, outcome):
  SWITCH outcome.type:

    CASE "tax_change":
      # Adjust tax rate in city configuration
      # This affects daily rent and trade transaction percentages
      direction = outcome.details.direction      # "increase" or "decrease"
      percentage = outcome.details.percentage    # e.g., 10
      duration = outcome.details.duration_days

      current_tax_rate = get_city_config(tables, "tax_rate") OR 5.0
      IF direction == "decrease":
        new_rate = max(0, current_tax_rate - percentage)
      ELSE:
        new_rate = min(50, current_tax_rate + percentage)

      set_city_config(tables, "tax_rate", new_rate)
      set_city_config(tables, "tax_change_expires",
                       (now_utc() + timedelta(days=duration)).isoformat())

    CASE "price_cap":
      # Create a price ceiling for a specific resource
      resource = outcome.details.resource
      # Cap at 120% of current market average
      market_price = get_market_price(tables, resource) OR 10
      cap_price = market_price * 1.2

      # Find all active sell contracts for this resource above the cap
      contracts = get_active_sell_contracts(tables, resource)
      FOR contract IN contracts:
        IF contract.fields.PricePerResource > cap_price:
          tables.contracts.update(contract.id, {PricePerResource: cap_price})

      # Store the cap as a decree
      create_decree(tables, {
        type:     "price_cap",
        resource: resource,
        cap:      cap_price,
        expires:  (now_utc() + timedelta(days=outcome.details.duration_days)).isoformat(),
      })

    CASE "trade_restriction":
      # Block a specific economic activity
      restricted = outcome.details.restricted_activity
      duration = outcome.details.duration_days

      create_decree(tables, {
        type:       "trade_restriction",
        activity:   restricted,
        expires:    (now_utc() + timedelta(days=duration)).isoformat(),
      })

    CASE "building_permit":
      # Authorize construction in a district
      district = outcome.details.district
      building_type = outcome.details.building_type

      create_decree(tables, {
        type:          "building_permit",
        district:      district,
        building_type: building_type,
        expires:       (now_utc() + timedelta(days=outcome.details.duration_days)).isoformat(),
      })

    CASE "wage_floor":
      min_wage = outcome.details.min_wage
      # Update all buildings where wages are below the floor
      all_buildings = tables.buildings.all(formula="{Category} = 'business'")
      FOR building IN all_buildings:
        current_wages = building.fields.Wages OR 0
        IF current_wages < min_wage AND current_wages > 0:
          tables.buildings.update(building.id, {Wages: min_wage})

      create_decree(tables, {
        type:      "wage_floor",
        min_wage:  min_wage,
        expires:   (now_utc() + timedelta(days=outcome.details.duration_days)).isoformat(),
      })

    CASE "cultural_funding":
      amount = outcome.details.amount
      recipients_class = outcome.details.recipients
      # Distribute funding among Artisti citizens
      artists = [c FOR c IN tables.citizens.all()
                 IF c.fields.SocialClass == recipients_class]
      IF len(artists) > 0:
        per_citizen = amount // len(artists)
        FOR artist IN artists:
          transfer_ducats(tables, "city_treasury", artist.fields.Username,
                           per_citizen, transaction_type="cultural_funding")

    DEFAULT:
      log("Unknown governance outcome type: " + outcome.type)
```

---

## G6. Political Movement Formation

When multiple grievances share a category and their supporters overlap, a political movement emerges.

```
FUNCTION detect_political_movements(tables):
  active_grievances = tables.grievances.all(
    formula="OR({Status} = 'filed', {Status} = 'gathering', {Status} = 'threshold')"
  )

  # Group by category
  by_category = {}
  FOR g IN active_grievances:
    cat = g.fields.Category
    IF cat NOT IN by_category:
      by_category[cat] = []
    by_category[cat].append(g)

  movements = []

  FOR category, grievances IN by_category.items():
    IF len(grievances) < 3:
      CONTINUE  # Need at least 3 aligned grievances for a movement

    # Check supporter overlap
    all_supporter_sets = []
    FOR g IN grievances:
      supporters = set(parse_json(g.fields.Supporters OR "[]"))
      all_supporter_sets.append(supporters)

    # Union of all supporters
    union_supporters = set()
    FOR s IN all_supporter_sets:
      union_supporters = union_supporters.union(s)

    # Intersection of any two grievance supporter sets
    max_overlap = 0
    FOR i IN range(len(all_supporter_sets)):
      FOR j IN range(i + 1, len(all_supporter_sets)):
        overlap = len(all_supporter_sets[i].intersection(all_supporter_sets[j]))
        max_overlap = max(max_overlap, overlap)

    # A movement exists if:
    #   - At least 3 grievances in the same category
    #   - At least 5 citizens overlap across two or more grievances
    #   - Total unique supporters > 15

    IF max_overlap >= 5 AND len(union_supporters) >= 15:
      movements.append({
        category:          category,
        grievance_count:   len(grievances),
        grievance_ids:     [g.id FOR g IN grievances],
        total_supporters:  len(union_supporters),
        supporter_overlap: max_overlap,
        strength:          compute_movement_strength(grievances, union_supporters),
      })

  RETURN movements


FUNCTION compute_movement_strength(grievances, supporters):
  total_support = SUM(g.fields.SupportCount OR 0 FOR g IN grievances)
  total_funding = SUM(g.fields.SupportAmount OR 0 FOR g IN grievances)
  supporter_count = len(supporters)

  # Strength is a composite score
  RETURN (total_support * 2) + (supporter_count * 3) + (total_funding / 100)
```

### Movement Escalation Effects

```
FUNCTION process_movement_effects(tables, movement):
  # Movements produce observable effects in the 3D world:
  #   1. Citizens cluster in public spaces
  #   2. Ambient atmosphere shifts
  #   3. Guards may be pre-deployed

  IF movement.strength > 100:
    escalation_level = "high"
  ELSE IF movement.strength > 50:
    escalation_level = "medium"
  ELSE:
    escalation_level = "low"

  SWITCH escalation_level:
    CASE "high":
      # Create gathering activities for supporters near the palace
      supporters = list(movement.supporter_usernames)
      FOR supporter IN supporters[:30]:  # Cap at 30 visible participants
        create_goto_palace_activity(tables, supporter)
      # Pre-deploy guards
      deploy_preventive_guards(tables, movement.category)

    CASE "medium":
      # Smaller gatherings in public piazzas
      supporters = list(movement.supporter_usernames)
      FOR supporter IN supporters[:15]:
        create_goto_piazza_activity(tables, supporter)

    CASE "low":
      # No visible gathering yet, but mood shifts
      # Handled by mood computation in citizen AI
      PASS
```

---

## G7. Doge Influence System

The Doge is the citizen with the highest combined wealth and influence among the Nobili. The Doge has soft power over council votes but cannot dictate outcomes.

### Doge Identification

```
FUNCTION get_current_doge(tables):
  nobili = tables.citizens.all(formula="{SocialClass} = 'Nobili'")

  IF len(nobili) == 0:
    RETURN None

  # Score: 60% wealth + 40% influence (normalized)
  max_wealth = max(c.fields.Wealth OR 0 FOR c IN nobili) OR 1
  max_influence = max(c.fields.Influence OR 0 FOR c IN nobili) OR 1

  best_score = -1
  doge = None

  FOR citizen IN nobili:
    wealth_norm = (citizen.fields.Wealth OR 0) / max_wealth
    influence_norm = (citizen.fields.Influence OR 0) / max_influence
    score = (wealth_norm * 0.6) + (influence_norm * 0.4)
    IF score > best_score:
      best_score = score
      doge = citizen

  RETURN doge
```

### Doge Position on Grievance

```
FUNCTION get_doge_position_on_grievance(doge, grievance):
  doge_wealth = doge.fields.Wealth OR 0
  grievance_category = grievance.fields.Category

  # The Doge's position is influenced by class interest:
  # - Economic grievances from common people: Doge tends to oppose
  #   (protects Nobili wealth)
  # - Criminal grievances: Doge tends to favor (law and order)
  # - Infrastructure: Doge is neutral to favorable (legacy building)
  # - Social: Doge tends to oppose (status quo preservation)

  POSITION_BIAS = {
    "economic":       -0.20,  # Opposes economic redistribution
    "social":         -0.15,  # Opposes social change
    "criminal":       +0.20,  # Supports law enforcement
    "infrastructure": +0.10,  # Supports building projects (legacy)
  }

  bias = POSITION_BIAS.get(grievance_category, 0)

  # Wealthier Doges are more conservative
  IF doge_wealth > 100000:
    bias -= 0.10

  # High support count makes Doge more cautious about opposing
  support_count = grievance.fields.SupportCount OR 0
  IF support_count > 50:
    bias += 0.10  # Popular pressure

  IF bias > 0.05:
    RETURN "favor"
  ELSE IF bias < -0.05:
    RETURN "oppose"
  ELSE:
    RETURN "neutral"
```

### Doge Succession

```
FUNCTION check_doge_succession(tables):
  current_doge = get_city_config(tables, "current_doge")
  new_doge = get_current_doge(tables)

  IF new_doge IS None:
    RETURN  # No eligible Nobili

  IF current_doge IS None OR current_doge != new_doge.fields.Username:
    # Succession event
    set_city_config(tables, "current_doge", new_doge.fields.Username)
    set_city_config(tables, "doge_since", now_utc().isoformat())

    # Create notification for the city
    create_notification(tables, "city_broadcast",
                         new_doge.fields.Name + " is the new Doge of Venice.")

    # Inject succession into narrative graph
    inject_narrative_event(tables, {
      type:        "doge_succession",
      new_doge:    new_doge.fields.Username,
      old_doge:    current_doge,
      timestamp:   now_utc().isoformat(),
    })

    RETURN new_doge.fields.Username
```

---

## G8. Guard Enforcement Generation

When governance outcomes require enforcement, guard NPCs are spawned at relevant locations.

```
FUNCTION deploy_enforcement(tables, outcome):
  # Determine enforcement locations based on outcome type
  guard_deployments = []

  SWITCH outcome.type:
    CASE "price_cap":
      # Deploy guards at all market stalls selling the capped resource
      resource = outcome.details.resource
      market_buildings = get_buildings_selling_resource(tables, resource)
      FOR building IN market_buildings:
        guard_deployments.append({
          location:     building.BuildingId,
          position:     get_building_position_coords(building),
          reason:       "price_cap_enforcement",
          resource:     resource,
          dialogue:     "Council orders. " + resource + " prices are capped. No exceptions.",
        })

    CASE "trade_restriction":
      # Deploy guards at trade-related buildings
      restricted = outcome.details.activity
      affected_buildings = get_buildings_for_activity(tables, restricted)
      FOR building IN affected_buildings:
        guard_deployments.append({
          location:     building.BuildingId,
          position:     get_building_position_coords(building),
          reason:       "trade_restriction",
          activity:     restricted,
          dialogue:     "By decree of the Council, " + restricted + " is restricted.",
        })

    CASE "fine_enforcement":
      # Deploy guards near the offender's known locations
      target = outcome.details.target
      target_record = get_citizen_record(tables, target)
      IF target_record IS NOT None:
        home = target_record.fields.Home
        work = target_record.fields.Work
        FOR building_id IN [home, work]:
          IF building_id IS NOT None:
            building = get_building_record(tables, building_id)
            guard_deployments.append({
              location:   building_id,
              position:   get_building_position_coords(building),
              reason:     "fine_collection",
              target:     target,
              fine:       outcome.details.fine_amount,
              dialogue:   "You owe " + outcome.details.fine_amount + " ducats. Council decree.",
            })

  # Create guard records
  FOR deployment IN guard_deployments:
    create_guard_npc(tables, deployment)

  RETURN guard_deployments


FUNCTION create_guard_npc(tables, deployment):
  guard_id = "guard_" + uuid4()
  tables.citizens.create({
    CitizenId:    guard_id,
    Username:     guard_id,
    Name:         "Guard of the Republic",
    SocialClass:  "Guard",          # Special non-player class
    Position:     format_position(deployment.position),
    Occupation:   "Enforcement",
    Description:  deployment.dialogue,
    IsNPC:        True,
    SpawnedBy:    "governance_system",
    SpawnReason:  deployment.reason,
    ExpiresAt:    (now_utc() + timedelta(days=14)).isoformat(),  # Guards persist 2 weeks
  })
```

---

## G9. Narrative Graph Injection

Governance events produce nodes and edges in the FalkorDB narrative graph, feeding the Blood Ledger physics engine.

```
FUNCTION inject_governance_narrative(tables, grievance, outcome, decision_type):
  grievance_title = grievance.fields.Title
  category = grievance.fields.Category
  support = grievance.fields.SupportCount

  IF decision_type == "accepted":
    # Create a Moment node (observable world change)
    create_narrative_node(
      type =       "Moment",
      content =    "The Council has accepted: " + grievance_title,
      energy =     support * 2,      # Energy proportional to support
      category =   category,
      source =     "governance"
    )

    # Create RESOLVES edge to the original Tension
    create_narrative_edge(
      from_type =  "Moment",
      from_id =    grievance.id,
      to_type =    "Narrative",
      to_id =      find_related_narrative(category),
      edge_type =  "RESOLVES",
      weight =     support
    )

  ELSE IF decision_type == "rejected":
    # Rejection does NOT resolve tension. It amplifies it.
    # Pump energy into the existing Narrative node.
    existing_narrative = find_or_create_narrative(category, grievance_title)

    update_narrative_energy(
      narrative_id = existing_narrative.id,
      energy_delta = support * 3  # Rejection amplifies by 3x
    )

    # Create TENSION edge (growing pressure)
    create_narrative_edge(
      from_type =  "Character",
      from_id =    grievance.fields.Citizen,
      to_type =    "Narrative",
      to_id =      existing_narrative.id,
      edge_type =  "TENSION",
      weight =     support * 1.5
    )

  # A rejected grievance is narratively more interesting than an accepted one.
  # Rejection means the tension persists and grows. The physics engine may
  # eventually flip it into a larger political crisis.


FUNCTION find_or_create_narrative(category, title):
  # Search for an existing narrative node matching this category
  results = falkordb.query("""
    MATCH (n:Narrative)
    WHERE n.category = $category AND n.energy > 0
    RETURN n
    ORDER BY n.energy DESC
    LIMIT 1
  """, category=category)

  IF len(results) > 0:
    RETURN results[0]
  ELSE:
    RETURN create_narrative_node(
      type =    "Narrative",
      content = title,
      energy =  10,
      category = category,
      source =  "governance"
    )
```

---

## G10. Governance Data Structures Summary

### City Configuration Store

```
CITY_CONFIG = {
  current_doge:       "contarini",
  doge_since:         "2025-06-01T00:00:00Z",
  tax_rate:           5.0,
  tax_change_expires: null,
  active_decrees:     [],       # List of decree objects
}
```

### Decree Record

```
DECREE = {
  decree_id:    "dec_xxx",
  type:         "price_cap",      # price_cap|trade_restriction|building_permit|
                                  # wage_floor|fine_enforcement|declaration
  details:      {},               # Type-specific parameters
  created_at:   "2025-07-15T10:00:00Z",
  expires:      "2025-07-29T10:00:00Z",
  grievance_id: "grv_xxx",       # Source grievance
  enforced_by:  ["guard_001"],   # Guard NPCs assigned
}
```

### Guard NPC Record

```
GUARD_NPC = {
  CitizenId:    "guard_xxx",
  Username:     "guard_xxx",
  Name:         "Guard of the Republic",
  SocialClass:  "Guard",
  Position:     "45.4371,12.3358",
  Occupation:   "Enforcement",
  Description:  "Council orders. No exceptions.",
  IsNPC:        true,
  SpawnedBy:    "governance_system",
  SpawnReason:  "price_cap_enforcement",
  ExpiresAt:    "2025-07-29T10:00:00Z",
}
```

### Movement Record

```
MOVEMENT = {
  category:          "economic",
  grievance_count:   4,
  grievance_ids:     ["grv_001", "grv_003", "grv_007", "grv_012"],
  total_supporters:  47,
  supporter_overlap: 12,
  strength:          183,
  escalation_level:  "high",   # Computed from strength
}
```
