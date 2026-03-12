# ALGORITHM: economy/simulation -- How It Works

Pseudocode for every procedure in the economic simulation engine. Activities are created, processed, and completed. Stratagems manipulate markets. Resources flow from production to consumption. Prices emerge from supply and demand. Citizens earn, spend, and sometimes go bankrupt. Nothing is hand-waved.

---

## S1. Simulation Tick -- The Master Loop

The simulation tick is Serenissima's heartbeat. Each tick processes all citizens sequentially, respecting Airtable's 5 req/sec rate limit.

```
FUNCTION simulation_tick():

  tables = initialize_airtable()
  resource_defs = fetch_resource_definitions_from_api()
  building_type_defs = fetch_building_type_definitions_from_api()
  now_venice = datetime.now(VENICE_TIMEZONE)
  now_utc = now_venice.astimezone(UTC)

  # ── PHASE 1: Process concluded activities ──────────────────
  concluded = fetch_concluded_activities(tables, now_utc)
  FOR activity IN concluded:
    processor = ACTIVITY_PROCESSORS.get(activity.Type)
    IF processor IS NOT None:
      success = processor(tables, activity, building_type_defs, resource_defs)
      IF success:
        mark_activity(tables, activity.id, status="processed")
        update_citizen_position(tables, activity)
      ELSE:
        mark_activity(tables, activity.id, status="failed")
    ELSE:
      mark_activity(tables, activity.id, status="failed",
                     notes="No processor for type: " + activity.Type)

  # ── PHASE 2: Create activities for idle citizens ───────────
  idle_citizens = get_idle_citizens(tables, now_utc)
  FOR citizen IN idle_citizens:
    activity = determine_next_activity(tables, citizen,
                                        resource_defs, building_type_defs,
                                        now_venice, now_utc)
    IF activity IS NOT None:
      write_activity_to_airtable(tables, activity)

  # ── PHASE 3: Process active stratagems ─────────────────────
  active_stratagems = get_active_stratagems(tables)
  FOR stratagem IN active_stratagems:
    processor = STRATAGEM_PROCESSORS.get(stratagem.Type)
    IF processor IS NOT None:
      success = processor(tables, stratagem, resource_defs,
                          building_type_defs, API_BASE_URL)
      IF NOT success:
        update_stratagem_status(tables, stratagem.id, "failed")
      ELSE:
        check_and_expire_stratagem(tables, stratagem)
    ELSE:
      update_stratagem_status(tables, stratagem.id, "failed",
                               "No processor defined")

  # ── PHASE 4: Daily economic processing (once per day) ──────
  IF is_new_venice_day(now_venice):
    process_daily_wages(tables)
    process_daily_rent_payments(tables)
    process_daily_loan_payments(tables)
    process_building_maintenance(tables)
    process_treasury_redistribution(tables)
    calculate_citizen_financials(tables)
    update_social_classes(tables)
    process_influence(tables)

  # ── PHASE 5: Market price recalculation ────────────────────
  recalculate_market_prices(tables, resource_defs)

  RETURN {
    activities_processed: len(concluded),
    activities_created: len(idle_citizens),
    stratagems_processed: len(active_stratagems)
  }
```

### Tick Scheduling

```
CONSTANTS:
  TICK_INTERVAL_MINUTES  = 5       # Time between ticks when simulation is active
  AIRTABLE_RATE_LIMIT    = 5       # Requests per second
  ESTIMATED_CALLS_PER_CITIZEN = 4  # Read citizen, read activity, write result, update position
  CITIZEN_COUNT           = 152

  # At 5 req/sec with 4 calls/citizen:
  # 152 citizens * 4 calls = 744 calls
  # 744 / 5 = ~149 seconds per full tick (~2.5 minutes)
  # 5-minute interval provides comfortable margin

FUNCTION schedule_ticks():
  WHILE simulation_is_active:
    tick_start = now()
    simulation_tick()
    tick_duration = now() - tick_start

    sleep_time = max(0, TICK_INTERVAL_MINUTES * 60 - tick_duration)
    sleep(sleep_time)
```

---

## S2. Activity Processing Loop

### Fetching Concluded Activities

```
FUNCTION fetch_concluded_activities(tables, now_utc):
  # An activity is concluded when:
  #   1. EndDate is in the past
  #   2. Status is NOT "processed" and NOT "failed"

  formula = AND(
    IS_BEFORE({EndDate}, now_utc.isoformat()),
    {Status} != 'processed',
    {Status} != 'failed',
    {Status} != 'cancelled'
  )

  RETURN tables.activities.all(formula=formula)
```

### Activity Processor Dispatch Table

```
ACTIVITY_PROCESSORS = {
  "deliver_resource_batch":    process_deliver_resource_batch,
  "goto_home":                 process_goto_home,
  "goto_work":                 process_goto_work,
  "production":                process_production,
  "fetch_resource":            process_fetch_resource,
  "eat":                       process_eat,
  "pickup_from_galley":        process_pickup_from_galley,
  "deliver_resource_to_buyer": process_deliver_resource_to_buyer,
  "leave_venice":              process_leave_venice,
  "deliver_construction_materials": process_deliver_construction_materials,
  "construct_building":        process_construct_building,
  "goto_construction_site":    process_goto_construction_site,
  "deliver_to_storage":        process_deliver_to_storage,
  "fetch_from_storage":        process_fetch_from_storage,
  "fishing":                   process_fishing,
  "goto_location":             process_goto_location,
  "manage_guild_membership":   process_manage_guild_membership,
  "bid_on_land":               process_bid_on_land,
  "manage_public_sell_contract": process_manage_public_sell_contract,
  "manage_import_contract":    process_manage_import_contract,
  "request_loan":              process_request_loan,
  "send_message":              process_send_message,
  "file_grievance":            process_file_grievance,    # placeholder
  "support_grievance":         process_support_grievance,  # placeholder
  "rest":                      process_rest,
  "pray":                      process_pray,
  "idle":                      process_placeholder,
  "work_on_art":               process_work_on_art,
  "read_book":                 process_read_book,
  "drink_at_inn":              process_drink_at_inn,
  "attend_theater_performance": process_attend_theater_performance,
  "use_public_bath":           process_use_public_bath,
  "talk_publicly":             process_talk_publicly,
  "spread_rumor":              process_spread_rumor,
  # ... additional types follow same pattern
}
```

### Processing a Single Activity: Production Example

```
FUNCTION process_production(tables, activity_record, building_type_defs, resource_defs):
  fields = activity_record.fields
  citizen_id = fields.CitizenId
  building_id = fields.FromBuilding
  recipe_inputs = parse_json(fields.RecipeInputs)    # [{resource: "wheat", amount: 5}]
  recipe_outputs = parse_json(fields.RecipeOutputs)   # [{resource: "bread", amount: 10}]

  # Step 1: Resolve the building and its operator
  building = get_building_record(tables, building_id)
  IF building IS None:
    RETURN False

  operator = building.fields.RunBy OR building.fields.Owner

  # Step 2: Verify input resources exist in building inventory
  FOR input IN recipe_inputs:
    available = get_resource_in_building(tables, building_id, input.resource, operator)
    IF available < input.amount:
      log("Insufficient " + input.resource + ": need " + input.amount
          + ", have " + available)
      RETURN False

  # Step 3: Verify building has storage capacity for outputs after inputs consumed
  current_storage = get_building_current_storage(tables, building_id)
  max_storage = building.fields.StorageCapacity OR building_type_defs[building.BuildingType].storage
  input_volume = SUM(input.amount FOR input IN recipe_inputs)
  output_volume = SUM(output.amount FOR output IN recipe_outputs)
  projected_storage = current_storage - input_volume + output_volume

  IF projected_storage > max_storage:
    log("Insufficient storage: projected " + projected_storage + " > max " + max_storage)
    RETURN False

  # Step 4: Consume inputs
  FOR input IN recipe_inputs:
    decrement_resource(tables, building_id, input.resource, input.amount, operator)

  # Step 5: Produce outputs
  FOR output IN recipe_outputs:
    increment_or_create_resource(tables, building_id, output.resource,
                                  output.amount, operator)

  RETURN True
```

### Processing a Single Activity: Fetch Resource Example

```
FUNCTION process_fetch_resource(tables, activity_record, building_type_defs, resource_defs):
  fields = activity_record.fields
  citizen_id = fields.CitizenId
  citizen_username = fields.Citizen
  from_building = fields.FromBuilding
  contract_id = fields.ContractId
  resource_type = fields.ResourceType

  # Step 1: Look up the contract
  contract = get_contract_record(tables, contract_id)
  IF contract IS None:
    RETURN False

  seller = contract.fields.Seller
  buyer = contract.fields.Buyer
  price_per_unit = contract.fields.PricePerResource
  target_amount = contract.fields.TargetAmount

  # Step 2: Determine actual pickup amount
  stock_at_source = get_resource_in_building(tables, from_building, resource_type, seller)
  citizen_capacity = MAX_CARRY_CAPACITY - get_citizen_current_load(tables, citizen_id)
  buyer_record = get_citizen_record(tables, buyer)
  buyer_ducats = buyer_record.fields.Ducats

  max_affordable = floor(buyer_ducats / price_per_unit) IF price_per_unit > 0 ELSE target_amount
  actual_amount = min(target_amount, stock_at_source, citizen_capacity, max_affordable)

  IF actual_amount <= 0:
    log("Cannot fetch: stock=" + stock_at_source + " capacity=" + citizen_capacity
        + " affordable=" + max_affordable)
    RETURN False

  # Step 3: Financial transaction (buyer pays seller)
  total_cost = actual_amount * price_per_unit
  transfer_ducats(tables, buyer, seller, total_cost,
                  transaction_type="purchase",
                  resource=resource_type, amount=actual_amount)

  # Step 4: Move resource from building to citizen inventory
  decrement_resource(tables, from_building, resource_type, actual_amount, seller)
  add_to_citizen_inventory(tables, citizen_id, resource_type, actual_amount, owner=buyer)

  # Step 5: Update citizen position to source building
  building_position = get_building_position_coords(from_building)
  update_citizen_position(tables, citizen_id, building_position)

  RETURN True
```

---

## S3. Activity Creation -- What Should a Citizen Do Next?

The activity creation pipeline evaluates a citizen's situation and dispatches them to the appropriate handler. Handlers are tried in priority order. The first handler that returns a non-None activity wins.

```
FUNCTION determine_next_activity(tables, citizen, resource_defs,
                                  building_type_defs, now_venice, now_utc):

  # Extract citizen state
  username         = citizen.fields.Username
  custom_id        = citizen.fields.CitizenId
  airtable_id      = citizen.id
  social_class     = citizen.fields.SocialClass
  position         = parse_position(citizen.fields.Position)
  ducats           = citizen.fields.Ducats
  hunger           = citizen.fields.HungerLevel OR 50
  is_night         = is_rest_time_for_class(now_venice, social_class)

  # ── PRIORITY 1: Survival needs ─────────────────────────────
  # Eating is checked first. A starving citizen does nothing else.
  IF hunger > 80:
    # Try eating from personal inventory
    activity = try_eat_from_inventory(tables, citizen, ...)
    IF activity: RETURN activity

    # Try eating at home
    activity = try_eat_at_home(tables, citizen, ...)
    IF activity: RETURN activity

    # Try buying food at a tavern
    activity = try_eat_at_tavern(tables, citizen, ...)
    IF activity: RETURN activity

    # Emergency: try fishing
    activity = try_emergency_fishing(tables, citizen, ...)
    IF activity: RETURN activity

  # ── PRIORITY 2: Rest (nighttime) ───────────────────────────
  IF is_night:
    IF citizen_is_at_home(tables, citizen):
      RETURN try_create_rest_activity(tables, citizen, now_utc)
    ELSE:
      # Go home to sleep
      activity = try_goto_home(tables, citizen, ...)
      IF activity: RETURN activity
      # No home? Find an inn
      activity = try_travel_to_inn(tables, citizen, ...)
      IF activity: RETURN activity

  # ── PRIORITY 3: Work (daytime) ─────────────────────────────
  IF is_work_time(now_venice, social_class):
    # Construction work takes priority (if citizen is assigned)
    activity = try_professional_construction(tables, citizen, ...)
    IF activity: RETURN activity

    # Production at workplace
    activity = try_production_and_general_work(tables, citizen, ...)
    IF activity: RETURN activity

    # Porter/logistics tasks
    activity = try_porter_tasks(tables, citizen, ...)
    IF activity: RETURN activity

    # Fishing for fishermen
    activity = try_fishing(tables, citizen, ...)
    IF activity: RETURN activity

    # Resource fetching for active contracts
    activity = try_resource_fetching(tables, citizen, ...)
    IF activity: RETURN activity

  # ── PRIORITY 4: Governance ─────────────────────────────────
  activity = try_governance_participation(tables, citizen, ...)
  IF activity: RETURN activity

  # ── PRIORITY 5: Leisure (late afternoon / evening) ─────────
  IF is_leisure_time(now_venice, social_class):
    activity = try_attend_theater(tables, citizen, ...)
    IF activity: RETURN activity

    activity = try_drink_at_inn(tables, citizen, ...)
    IF activity: RETURN activity

    activity = try_work_on_art(tables, citizen, ...)
    IF activity: RETURN activity

    activity = try_pray(tables, citizen, ...)
    IF activity: RETURN activity

    activity = try_use_public_bath(tables, citizen, ...)
    IF activity: RETURN activity

  # ── PRIORITY 6: Management decisions ───────────────────────
  activity = try_manage_public_sell_contract(tables, citizen, ...)
  IF activity: RETURN activity

  activity = try_manage_import_contract(tables, citizen, ...)
  IF activity: RETURN activity

  activity = try_bid_on_land(tables, citizen, ...)
  IF activity: RETURN activity

  # ── FALLBACK: Idle ─────────────────────────────────────────
  RETURN try_create_idle_activity(tables, citizen, now_utc,
                                   duration_hours=IDLE_ACTIVITY_DURATION_HOURS)
```

### Activity Record Schema

```
ACTIVITY_RECORD = {
  ActivityId:      uuid4(),                    # Unique identifier
  Citizen:         citizen_username,            # Who performs it
  CitizenId:       citizen_custom_id,           # Custom ID
  Type:            "production",                # Activity type string
  Status:          "created",                   # created → in_progress → processed/failed
  FromBuilding:    building_custom_id,          # Source location
  ToBuilding:      destination_building_id,     # Destination (if travel)
  ResourceType:    "bread",                     # Resource involved (if applicable)
  ContractId:      contract_id,                 # Linked contract (if applicable)
  RecipeInputs:    json([{resource, amount}]),  # For production
  RecipeOutputs:   json([{resource, amount}]),  # For production
  Path:            json([{lat, lng}]),           # Walking path coordinates
  StartDate:       now_utc.isoformat(),         # When activity begins
  EndDate:         (now_utc + duration).isoformat(),  # When activity concludes
  CreatedAt:       now_utc.isoformat(),
}
```

---

## S4. Stratagem Execution

Stratagems are competitive economic moves. Each has a processor function that reads state, computes effects, and writes results. The dispatch table maps type strings to processor functions.

### Stratagem Processor Dispatch Table

```
STRATAGEM_PROCESSORS = {
  "undercut":                      process_undercut,
  "coordinate_pricing":            process_coordinate_pricing,
  "hoard_resource":                process_hoard_resource,
  "supplier_lockout":              process_supplier_lockout,
  "monopoly_pricing":              process_monopoly_pricing,
  "political_campaign":            process_political_campaign,
  "reputation_assault":            process_reputation_assault,
  "reputation_boost":              process_reputation_boost,
  "emergency_liquidation":         process_emergency_liquidation,
  "cultural_patronage":            process_cultural_patronage,
  "information_network":           process_information_network,
  "maritime_blockade":             process_maritime_blockade,
  "theater_conspiracy":            process_theater_conspiracy,
  "printing_propaganda":           process_printing_propaganda,
  "cargo_mishap":                  process_cargo_mishap,
  "marketplace_gossip":            process_marketplace_gossip,
  "joint_venture":                 process_joint_venture,
  "financial_patronage":           process_financial_patronage,
  "neighborhood_watch":            process_neighborhood_watch,
  "canal_mugging":                 process_canal_mugging,
  "transfer_ducats":               process_transfer_ducats,
  "organize_gathering":            process_organize_gathering,
  "organize_collective_delivery":  process_organize_collective_delivery,
  "express_creative_will":         process_express_creative_will,
  "employee_corruption":           process_employee_corruption,   # placeholder
  "arson":                         process_arson,                  # placeholder
  "charity_distribution":          process_charity_distribution,   # placeholder
  "festival_organisation":         process_festival_organisation,  # placeholder
}
```

### Undercut Stratagem Decision Tree

```
FUNCTION process_undercut(tables, stratagem_record, resource_defs,
                          building_type_defs, api_base_url):
  fields = stratagem_record.fields
  executed_by = fields.ExecutedBy
  target_citizen = fields.TargetCitizen
  target_building = fields.TargetBuilding
  target_resource = fields.TargetResourceType
  intensity = fields.Intensity OR "Standard"

  # Step 1: Determine undercut percentage from intensity
  UNDERCUT_PERCENTAGES = {
    "Mild":       0.10,   # 10% below competition
    "Standard":   0.15,   # 15% below competition
    "Aggressive": 0.20,   # 20% below competition
  }
  undercut_pct = UNDERCUT_PERCENTAGES.get(intensity, 0.15)

  # Step 2: Determine which resources to target
  IF target_resource IS NOT None:
    resource_types = [target_resource]
  ELSE IF target_building IS NOT None:
    resource_types = get_distinct_resources_sold_by_building(tables, target_building)
  ELSE IF target_citizen IS NOT None:
    resource_types = get_distinct_resources_sold_by_citizen(tables, target_citizen)
  ELSE:
    log("No target specified")
    RETURN False

  # Step 3: For each resource type, find competition prices and adjust own
  adjusted_count = 0
  FOR resource_type IN resource_types:
    competitor_prices = get_competition_prices(tables, stratagem_record, executed_by)
    IF len(competitor_prices) == 0:
      CONTINUE

    min_competitor_price = min(competitor_prices)
    new_price = round(min_competitor_price * (1.0 - undercut_pct), 2)
    new_price = max(new_price, 0.01)  # Floor: never go below 0.01

    # Find executor's own contracts for this resource
    own_contracts = get_citizen_active_sell_contracts(tables, executed_by, resource_type)
    FOR contract IN own_contracts:
      current_price = contract.fields.PricePerResource
      IF current_price > new_price:
        tables.contracts.update(contract.id, {PricePerResource: new_price})
        adjusted_count += 1

    # Update trust: undercutting damages relationship with target
    IF target_citizen IS NOT None:
      update_trust_score_for_activity(tables, executed_by, target_citizen,
                                       trust_change=-2.0,
                                       activity_type="undercut_stratagem",
                                       success=True)

  RETURN adjusted_count > 0
```

### Coordinate Pricing Stratagem Decision Tree

```
FUNCTION process_coordinate_pricing(tables, stratagem_record, resource_defs,
                                      building_type_defs, api_base_url):
  fields = stratagem_record.fields
  executed_by = fields.ExecutedBy
  target_resource = fields.TargetResourceType

  # Step 1: Determine which resources to coordinate
  IF target_resource IS NOT None:
    resource_types = [target_resource]
  ELSE:
    resource_types = get_distinct_resources_sold_by_citizen(tables, executed_by)

  # Step 2: For each resource, compute average market price and match it
  adjusted_count = 0
  FOR resource_type IN resource_types:
    reference_prices = get_reference_prices(tables, stratagem_record,
                                             resource_type, executed_by)
    IF len(reference_prices) == 0:
      CONTINUE

    average_price = statistics.mean(reference_prices)
    coordinated_price = round(average_price, 2)

    # Adjust executor's contracts to match the average
    own_contracts = get_citizen_active_sell_contracts(tables, executed_by, resource_type)
    FOR contract IN own_contracts:
      current_price = contract.fields.PricePerResource
      IF abs(current_price - coordinated_price) > 0.01:
        tables.contracts.update(contract.id, {PricePerResource: coordinated_price})
        adjusted_count += 1

  RETURN adjusted_count > 0
```

### Hoard Resource Stratagem Decision Tree

```
FUNCTION process_hoard_resource(tables, stratagem_record, resource_defs,
                                 building_type_defs, api_base_url):
  fields = stratagem_record.fields
  executed_by = fields.ExecutedBy
  target_resource = fields.TargetResourceType

  # Step 1: Find or select a storage building owned by the hoarder
  owned_buildings = get_buildings_owned_by(tables, executed_by)
  storage_building = None
  FOR building IN owned_buildings:
    storage_details = get_building_storage_details(tables, building.BuildingId)
    IF storage_details.available_capacity > 0:
      storage_building = building
      BREAK

  IF storage_building IS None:
    log("No storage building with capacity found for " + executed_by)
    RETURN False

  # Step 2: Ensure a storage_query contract exists
  storage_contract_id = ensure_storage_query_contract(
    tables, fields, storage_building.BuildingId, now_utc=datetime.now(UTC)
  )
  IF storage_contract_id IS None:
    RETURN False

  # Step 3: Find employees of the hoarder
  employees = get_employees_of(tables, executed_by)
  agents = [executed_by] + [e.Username FOR e IN employees]

  # Step 4: For each agent, create fetch_resource activities
  #         targeting available sell contracts for the resource
  created_count = 0
  available_contracts = find_sell_contracts_for_resource(tables, target_resource,
                                                          exclude_seller=executed_by)
  FOR agent IN agents:
    agent_load = get_citizen_current_load(tables, agent)
    agent_capacity = get_citizen_effective_carry_capacity(tables, agent) - agent_load
    IF agent_capacity <= 0:
      CONTINUE

    FOR sell_contract IN available_contracts:
      # Check if agent has enough ducats
      agent_ducats = get_citizen_ducats(tables, agent)
      affordable = floor(agent_ducats / sell_contract.PricePerResource)
      fetch_amount = min(affordable, agent_capacity, sell_contract.TargetAmount)

      IF fetch_amount > 0:
        create_fetch_resource_activity(tables, agent, sell_contract,
                                        fetch_amount, storage_building)
        created_count += 1
        BREAK  # One fetch per agent per tick

  RETURN created_count > 0
```

### Supplier Lockout Stratagem Decision Tree

```
FUNCTION process_supplier_lockout(tables, stratagem_record, resource_defs,
                                    building_type_defs, api_base_url):
  fields = stratagem_record.fields
  executed_by = fields.ExecutedBy
  target_citizen = fields.TargetCitizen
  target_building = fields.TargetBuilding
  target_resource = fields.TargetResourceType

  # Parse configuration from Notes JSON
  notes = parse_json(fields.Notes OR "{}")
  premium_pct = notes.get("premium_percentage", 15)
  duration_days = notes.get("contract_duration_days", 30)

  # Step 1: Validate required fields
  IF NOT all([executed_by, target_citizen, target_resource]):
    update_stratagem_status(tables, stratagem_record.id, "failed",
                             "Missing required fields")
    RETURN False

  # Step 2: Already executed? Maintain existing contracts
  IF fields.ExecutedAt IS NOT None:
    RETURN maintain_exclusive_contracts(tables, stratagem_record, notes)

  # Step 3: Get current market price and compute premium
  market_price = get_market_price(tables, target_resource)
  IF market_price IS None:
    market_price = get_base_price(target_resource)
  premium_price = market_price * (1 + premium_pct / 100)

  # Step 4: Verify supplier has production buildings
  production_buildings = get_supplier_production_buildings(
    tables, target_citizen, target_resource, target_building
  )
  IF len(production_buildings) == 0:
    log("Supplier " + target_citizen + " has no production for " + target_resource)
    RETURN False

  # Step 5: Verify buyer can afford the premium
  buyer = get_citizen_record(tables, executed_by)
  buyer_ducats = buyer.fields.Ducats
  estimated_cost = premium_price * 100  # Rough estimate for 100 units
  IF buyer_ducats < estimated_cost:
    log("Warning: buyer may lack funds for exclusive contract")

  # Step 6: Create exclusive import contracts at premium price
  now_utc = datetime.now(UTC)
  contract_end = now_utc + timedelta(days=duration_days)
  created_contracts = []

  FOR building IN production_buildings:
    contract = create_exclusive_contract(
      tables,
      buyer=executed_by,
      seller=target_citizen,
      resource=target_resource,
      price=premium_price,
      building=building.BuildingId,
      start=now_utc,
      end=contract_end,
      exclusive=True
    )
    created_contracts.append(contract)

  # Step 7: Notify target that their supplier is locked
  create_notification(tables, target_citizen,
                       "A supplier you relied on has entered an exclusive contract.")

  # Step 8: Update trust: lockout severely damages relationship
  update_trust_score_for_activity(tables, executed_by, target_citizen,
                                   trust_change=-5.0,
                                   activity_type="supplier_lockout",
                                   success=True)

  update_stratagem_status(tables, stratagem_record.id, "executed",
                           "Created " + len(created_contracts) + " exclusive contracts")
  RETURN True
```

---

## S5. Resource Flow Chain

Resources move through a five-stage chain. Each stage is an activity type.

```
RESOURCE FLOW CHAIN:

  Stage 1: IMPORT / PRODUCTION
  ─────────────────────────────
  Source: Galley arrival OR workshop production activity
  Action: Resources appear in building inventory
  Activity types: pickup_from_galley, production

  Stage 2: STORAGE
  ─────────────────
  Source: Production building or personal inventory
  Action: Resources moved to warehouse for bulk storage
  Activity types: deliver_to_storage, fetch_from_storage

  Stage 3: TRANSPORT
  ──────────────────
  Source: Warehouse or production building
  Action: Citizen carries goods to market stall or buyer
  Activity types: deliver_resource_batch, deliver_resource_to_buyer, fetch_resource

  Stage 4: MARKET
  ───────────────
  Source: Market stall (building with sell contracts)
  Action: Public sell contract matched to buyer. Price determined by contract.
  Activity types: manage_public_sell_contract (creates contracts),
                  fetch_resource (buyer picks up goods)

  Stage 5: CONSUMPTION
  ────────────────────
  Source: Citizen inventory or home building
  Action: Resource consumed (food eaten, materials used in production)
  Activity types: eat, production (as input consumer)
```

### Resource Transfer Primitives

```
FUNCTION decrement_resource(tables, building_id, resource_type, amount, owner):
  # Find the resource record
  formula = AND(
    {BuildingId} = building_id,
    {ResourceType} = resource_type,
    {Owner} = owner
  )
  records = tables.resources.all(formula=formula)
  IF len(records) == 0:
    RAISE "Resource not found"

  record = records[0]
  current = record.fields.Count
  IF current < amount:
    RAISE "Insufficient quantity"

  new_count = current - amount
  IF new_count == 0:
    tables.resources.delete(record.id)
  ELSE:
    tables.resources.update(record.id, {Count: new_count})


FUNCTION increment_or_create_resource(tables, building_id, resource_type, amount, owner):
  formula = AND(
    {BuildingId} = building_id,
    {ResourceType} = resource_type,
    {Owner} = owner
  )
  records = tables.resources.all(formula=formula)

  IF len(records) > 0:
    record = records[0]
    tables.resources.update(record.id, {Count: record.fields.Count + amount})
  ELSE:
    tables.resources.create({
      ResourceId:   uuid4(),
      BuildingId:   building_id,
      ResourceType: resource_type,
      Count:        amount,
      Owner:        owner,
      AssetType:    "building"
    })


FUNCTION add_to_citizen_inventory(tables, citizen_id, resource_type, amount, owner):
  formula = AND(
    {Asset} = citizen_id,
    {AssetType} = 'citizen',
    {ResourceType} = resource_type,
    {Owner} = owner
  )
  records = tables.resources.all(formula=formula)

  IF len(records) > 0:
    record = records[0]
    tables.resources.update(record.id, {Count: record.fields.Count + amount})
  ELSE:
    tables.resources.create({
      ResourceId:   uuid4(),
      Asset:        citizen_id,
      AssetType:    "citizen",
      ResourceType: resource_type,
      Count:        amount,
      Owner:        owner
    })

MAX_CARRY_CAPACITY = 10  # Units a citizen can carry simultaneously
```

---

## S6. Market Price Dynamics

Prices emerge from supply and demand through the contract system. There is no global price oracle. Price per resource is set by individual sell contracts and adjusted by economic pressure.

### Price Discovery Through Contracts

```
FUNCTION get_market_price(tables, resource_type):
  # Market price = median of all active public_sell contract prices for this resource
  now_iso = datetime.now(UTC).isoformat()
  formula = AND(
    {Type} = 'public_sell',
    {Status} = 'active',
    {ResourceType} = resource_type,
    {TargetAmount} > 0,
    IS_BEFORE({CreatedAt}, now_iso),
    IS_AFTER({EndAt}, now_iso)
  )

  contracts = tables.contracts.all(formula=formula, fields=['PricePerResource'])
  prices = [c.fields.PricePerResource FOR c IN contracts
            IF c.fields.PricePerResource IS NOT None]

  IF len(prices) == 0:
    RETURN None

  prices.sort()
  mid = len(prices) // 2
  IF len(prices) % 2 == 0:
    RETURN (prices[mid - 1] + prices[mid]) / 2
  ELSE:
    RETURN prices[mid]
```

### Supply and Demand Pressure

```
FUNCTION compute_supply_demand_ratio(tables, resource_type):
  # Supply = total quantity available across all active sell contracts
  sell_contracts = get_active_sell_contracts(tables, resource_type)
  total_supply = SUM(c.fields.TargetAmount FOR c IN sell_contracts)

  # Demand = total quantity requested across all active buy/import contracts
  buy_contracts = get_active_buy_contracts(tables, resource_type)
  total_demand = SUM(c.fields.TargetAmount FOR c IN buy_contracts)

  IF total_demand == 0:
    RETURN float('inf') IF total_supply > 0 ELSE 1.0

  RETURN total_supply / total_demand


FUNCTION price_adjustment_pressure(supply_demand_ratio):
  # When supply > demand (ratio > 1): downward pressure
  # When demand > supply (ratio < 1): upward pressure
  # Ratio = 1.0: equilibrium, no pressure

  IF supply_demand_ratio > 2.0:
    RETURN -0.10   # Strong downward pressure: -10%
  ELSE IF supply_demand_ratio > 1.5:
    RETURN -0.05   # Moderate downward pressure: -5%
  ELSE IF supply_demand_ratio > 1.1:
    RETURN -0.02   # Mild downward pressure: -2%
  ELSE IF supply_demand_ratio > 0.9:
    RETURN 0.0     # Equilibrium band: no pressure
  ELSE IF supply_demand_ratio > 0.5:
    RETURN +0.05   # Moderate upward pressure: +5%
  ELSE:
    RETURN +0.15   # Strong upward pressure: +15% (scarcity)
```

### Contract Price Adjustment Per Tick

```
FUNCTION recalculate_market_prices(tables, resource_defs):
  # For each resource type in the economy, compute pressure and nudge contracts
  # that have auto-adjust enabled.

  all_resource_types = [r.type FOR r IN resource_defs.values()]

  FOR resource_type IN all_resource_types:
    ratio = compute_supply_demand_ratio(tables, resource_type)
    pressure = price_adjustment_pressure(ratio)

    IF abs(pressure) < 0.001:
      CONTINUE  # No adjustment needed at equilibrium

    # Find contracts flagged for auto-adjustment
    # (managed by manage_public_sell_contract activity creator)
    auto_contracts = get_auto_adjust_contracts(tables, resource_type)

    FOR contract IN auto_contracts:
      current_price = contract.fields.PricePerResource
      base_price = get_resource_base_price(resource_defs, resource_type)

      # Apply pressure as percentage change
      new_price = current_price * (1.0 + pressure)

      # Price floor: never below 50% of base cost
      price_floor = base_price * 0.5
      # Price ceiling: never above 500% of base cost
      price_ceiling = base_price * 5.0

      new_price = clamp(new_price, price_floor, price_ceiling)
      new_price = round(new_price, 2)

      IF abs(new_price - current_price) > 0.01:
        tables.contracts.update(contract.id, {PricePerResource: new_price})
```

---

## S7. Income and Expense Computation Per Citizen

Financials are computed from the TRANSACTIONS table across three time windows.

```
FUNCTION calculate_citizen_financials(tables):
  all_citizens = tables.citizens.all()
  all_transactions = tables.transactions.all()

  now = datetime.now(UTC)
  windows = {
    "daily":   now - timedelta(days=1),
    "weekly":  now - timedelta(days=7),
    "monthly": now - timedelta(days=30),
  }

  # Build lookup: username -> airtable_record_id
  username_to_id = {}
  wallet_to_id = {}
  citizen_financials = {}  # record_id -> {DailyIncome, DailyExpenses, ...}

  FOR citizen IN all_citizens:
    rid = citizen.id
    username = citizen.fields.Username
    wallet = citizen.fields.Wallet
    username_to_id[username.lower()] = rid
    IF wallet:
      wallet_to_id[wallet.lower()] = rid
    citizen_financials[rid] = {
      DailyIncome: 0, DailyExpenses: 0,
      WeeklyIncome: 0, WeeklyExpenses: 0,
      MonthlyIncome: 0, MonthlyExpenses: 0,
    }

  # Process every transaction
  FOR tx IN all_transactions:
    executed_at = parse_timestamp(tx.fields.ExecutedAt)
    IF executed_at IS None:
      CONTINUE
    price = tx.fields.Price
    IF price IS None OR price <= 0:
      CONTINUE

    # Identify recipient (income)
    recipient = tx.fields.Seller OR tx.fields.To
    recipient_id = resolve_citizen_id(recipient, username_to_id, wallet_to_id)

    # Identify payer (expense)
    payer = tx.fields.Buyer OR tx.fields.From
    payer_id = resolve_citizen_id(payer, username_to_id, wallet_to_id)

    # Accumulate into time windows
    FOR window_name, window_start IN windows.items():
      IF executed_at >= window_start:
        IF recipient_id IS NOT None:
          citizen_financials[recipient_id][window_name.capitalize() + "Income"] += price
        IF payer_id IS NOT None:
          citizen_financials[payer_id][window_name.capitalize() + "Expenses"] += price

  # Write back to Airtable
  FOR rid, financials IN citizen_financials.items():
    tables.citizens.update(rid, financials)
```

### Daily Wage Payment

```
FUNCTION process_daily_wages(tables):
  employed_citizens = get_employed_citizens(tables)  # Citizens with non-empty Work field

  FOR citizen IN employed_citizens:
    workplace = get_citizen_workplace(tables, citizen)
    IF workplace IS None:
      CONTINUE

    wage = workplace.fields.Wages OR 0
    IF wage <= 0:
      CONTINUE

    employer = workplace.fields.RunBy OR workplace.fields.Owner
    employer_record = get_citizen_record(tables, employer)
    employer_ducats = employer_record.fields.Ducats

    IF employer_ducats >= wage:
      # Transfer wage: employer -> citizen
      transfer_ducats(tables, employer, citizen.fields.Username, wage,
                       transaction_type="wage_payment")
      # Positive trust: paying wages builds trust
      update_trust_score(tables, employer, citizen.fields.Username,
                          trust_change=+1.0, activity_type="wage_payment")
    ELSE:
      # Employer cannot pay: trust damage
      update_trust_score(tables, employer, citizen.fields.Username,
                          trust_change=-2.0, activity_type="wage_payment_failed")
      create_notification(tables, citizen.fields.Username,
                           "Your employer " + employer + " could not pay your wages.")
```

### Daily Rent Payment

```
FUNCTION process_daily_rent_payments(tables):
  # Housing rent: occupant pays building owner
  occupied_buildings = get_buildings_with_occupants(tables)  # Category='home', non-empty Occupant

  FOR building IN occupied_buildings:
    occupant = building.fields.Occupant
    owner = building.fields.Owner
    rent = building.fields.RentPrice

    IF occupant == owner OR rent <= 0:
      CONTINUE

    occupant_record = get_citizen_record(tables, occupant)
    occupant_ducats = occupant_record.fields.Ducats

    IF occupant_ducats >= rent:
      transfer_ducats(tables, occupant, owner, rent,
                       transaction_type="rent_payment")
    ELSE:
      # Cannot pay rent: partial payment + notification
      partial = min(occupant_ducats, rent)
      IF partial > 0:
        transfer_ducats(tables, occupant, owner, partial,
                         transaction_type="partial_rent_payment")
      create_notification(tables, occupant,
                           "You could not afford full rent. Eviction risk.")
      create_notification(tables, owner,
                           occupant + " could not pay full rent.")
```

---

## S8. Bankruptcy Detection and Consequences

Bankruptcy is not an event; it is a state that emerges when a citizen's financial situation becomes unsustainable.

```
FUNCTION detect_bankruptcy(tables, citizen_record):
  ducats = citizen_record.fields.Ducats
  daily_expenses = citizen_record.fields.DailyExpenses OR 0
  daily_income = citizen_record.fields.DailyIncome OR 0
  has_job = citizen_record.fields.Work IS NOT None
  has_home = citizen_record.fields.Home IS NOT None
  outstanding_loans = get_outstanding_loans(tables, citizen_record.fields.Username)

  # Bankruptcy conditions (all must be true):
  # 1. Ducats <= 0
  # 2. Daily expenses exceed daily income
  # 3. No liquid assets that could be sold

  is_bankrupt = (
    ducats <= 0
    AND daily_income < daily_expenses
    AND count_sellable_assets(tables, citizen_record) == 0
  )

  RETURN is_bankrupt


FUNCTION process_bankruptcy(tables, citizen_record):
  username = citizen_record.fields.Username

  # ── CONSEQUENCE 1: Lose employment ─────────────────────────
  IF citizen_record.fields.Work IS NOT None:
    remove_employment(tables, citizen_record)

  # ── CONSEQUENCE 2: Lose housing ────────────────────────────
  IF citizen_record.fields.Home IS NOT None:
    evict_citizen(tables, citizen_record)

  # ── CONSEQUENCE 3: Lose owned buildings ────────────────────
  owned_buildings = get_buildings_owned_by(tables, username)
  FOR building IN owned_buildings:
    # Buildings revert to city ownership or go to auction
    transfer_building_ownership(tables, building.id, new_owner="city_treasury")

  # ── CONSEQUENCE 4: Cancel all active contracts ─────────────
  active_contracts = get_citizen_active_contracts(tables, username)
  FOR contract IN active_contracts:
    tables.contracts.update(contract.id, {Status: "cancelled"})

  # ── CONSEQUENCE 5: Social class demotion ───────────────────
  current_class = citizen_record.fields.SocialClass
  demoted_class = demote_social_class(current_class)
  tables.citizens.update(citizen_record.id, {
    SocialClass: demoted_class,
    Ducats: 0
  })

  # ── CONSEQUENCE 6: Trust damage with all relationships ─────
  relationships = get_citizen_relationships(tables, username)
  FOR rel IN relationships:
    other = rel.fields.Citizen2 IF rel.fields.Citizen1 == username ELSE rel.fields.Citizen1
    update_trust_score(tables, username, other,
                        trust_change=-3.0,
                        activity_type="bankruptcy")

  create_notification(tables, username, "You have gone bankrupt.")

  RETURN True


FUNCTION demote_social_class(current_class):
  DEMOTION_MAP = {
    "Nobili":     "Cittadini",
    "Cittadini":  "Popolani",
    "Mercatores": "Cittadini",
    "Artisti":    "Popolani",
    "Scientisti": "Popolani",
    "Popolani":   "Facchini",
    "Facchini":   "Facchini",  # Cannot fall lower
  }
  RETURN DEMOTION_MAP.get(current_class, "Facchini")


FUNCTION count_sellable_assets(tables, citizen_record):
  username = citizen_record.fields.Username
  # Count: owned buildings + owned land + inventory with value > 0
  buildings = get_buildings_owned_by(tables, username)
  lands = get_lands_owned_by(tables, username)
  inventory = get_citizen_inventory(tables, citizen_record.fields.CitizenId)
  valued_inventory = [i FOR i IN inventory IF i.fields.Count > 0]

  RETURN len(buildings) + len(lands) + len(valued_inventory)
```

---

## S9. Ducat Transfer Primitive

All money movement flows through this function. It ensures atomicity and creates an audit trail.

```
FUNCTION transfer_ducats(tables, from_username, to_username, amount,
                          transaction_type, resource=None, resource_amount=None):
  # Validate
  IF amount <= 0:
    RAISE "Transfer amount must be positive"

  from_record = get_citizen_record(tables, from_username)
  to_record = get_citizen_record(tables, to_username)

  IF from_record IS None OR to_record IS None:
    RAISE "Citizen not found"

  from_ducats = from_record.fields.Ducats
  IF from_ducats < amount:
    RAISE "Insufficient funds: " + from_username + " has " + from_ducats
          + " but needs " + amount

  # Execute transfer
  tables.citizens.update(from_record.id, {Ducats: from_ducats - amount})
  tables.citizens.update(to_record.id, {Ducats: to_record.fields.Ducats + amount})

  # Create transaction record for audit trail
  tables.transactions.create({
    TransactionId: uuid4(),
    Type:          transaction_type,
    From:          from_username,
    To:            to_username,
    Price:         amount,
    ResourceType:  resource,
    Amount:        resource_amount,
    ExecutedAt:    datetime.now(UTC).isoformat(),
    Status:        "completed"
  })
```

---

## S10. Simulation Data Structures

### Citizen Record (Airtable CITIZENS)

```
CITIZEN = {
  id:                 airtable_record_id,
  CitizenId:          "cit_xxx",            # Custom unique ID
  Username:           "marco_polo",
  Name:               "Marco Polo",
  SocialClass:        "Mercatores",         # Nobili|Cittadini|Mercatores|Artisti|
                                            # Scientisti|Popolani|Facchini|Forestieri
  Ducats:             1500,
  Wealth:             45000,                # Total asset value
  Influence:          320,
  Position:           "45.4371,12.3358",    # lat,lng string
  Home:               "bld_xxx",            # Building ID (home)
  Work:               "bld_yyy",            # Building ID (workplace)
  Occupation:         "Merchant",
  HungerLevel:        35,                   # 0-100 (100 = starving)
  DailyIncome:        120,                  # Computed from TRANSACTIONS
  DailyExpenses:      85,                   # Computed from TRANSACTIONS
  WeeklyIncome:       840,
  MonthlyIncome:      3600,
  Wallet:             "solana_address",     # Optional crypto wallet
  UpdatedAt:          "2025-07-15T10:30:00Z"
}
```

### Contract Record (Airtable CONTRACTS)

```
CONTRACT = {
  id:                 airtable_record_id,
  ContractId:         "con_xxx",
  Type:               "public_sell",        # public_sell|markup_buy|import|storage_query|exclusive
  Status:             "active",             # active|completed|cancelled|expired
  Seller:             "marco_polo",
  Buyer:              "elena_rossi",        # May be empty for public_sell
  SellerBuilding:     "bld_xxx",
  ResourceType:       "spice",
  PricePerResource:   25.0,
  TargetAmount:       100,
  FilledAmount:       45,
  CreatedAt:          "2025-07-10T08:00:00Z",
  EndAt:              "2025-08-10T08:00:00Z",
  Exclusive:          false,                # True for lockout contracts
}
```

### Stratagem Record (Airtable STRATAGEMS)

```
STRATAGEM = {
  id:                 airtable_record_id,
  StratagemId:        "str_xxx",
  Type:               "undercut",           # See STRATAGEM_PROCESSORS keys
  Status:             "active",             # active|executed|failed|expired|error
  ExecutedBy:         "marco_polo",
  TargetCitizen:      "elena_rossi",        # Optional
  TargetBuilding:     "bld_xxx",            # Optional
  TargetResourceType: "silk",               # Optional
  Intensity:          "Standard",           # Mild|Standard|Aggressive
  Notes:              "{}",                 # JSON for processor-specific params
  ExpiresAt:          "2025-08-01T00:00:00Z",
  ExecutedAt:         null,
  CreatedAt:          "2025-07-15T10:00:00Z",
}
```
