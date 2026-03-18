"""
Seed Venice Graph — Airtable Citizens → FalkorDB cities_of_light

Fetches citizen data from Serenissima Airtable, generates synthetic narratives
from class/personality dynamics, and seeds the FalkorDB graph for physics simulation.

Usage:
    cd /home/mind-protocol/cities-of-light
    AIRTABLE_API_KEY=pat... python scripts/seed_venice_graph.py

    # Or with options:
    python scripts/seed_venice_graph.py --graph cities_of_light --clear --dry-run

Environment:
    AIRTABLE_API_KEY  — Airtable Personal Access Token (required)
    AIRTABLE_BASE_ID  — Override base ID (default: appk6RszUo2a2L2L8)
    FALKORDB_HOST     — FalkorDB host (default: localhost)
    FALKORDB_PORT     — FalkorDB port (default: 6379)
"""

import os
import sys
import json
import math
import hashlib
import logging
import argparse
from collections import Counter, defaultdict
from typing import List, Dict, Any, Tuple

from pyairtable import Api
from falkordb import FalkorDB

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s %(message)s"
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

AIRTABLE_BASE_ID = os.environ.get("AIRTABLE_BASE_ID", "appk6RszUo2a2L2L8")

CHARACTER_BOOTSTRAP_ENERGY = 0.5
NARRATIVE_BOOTSTRAP_ENERGY = 0.3

# Venice sestieri (districts) with approximate center coordinates
VENICE_DISTRICTS = {
    "San Marco":    {"lat": 45.4340, "lng": 12.3380, "description": "Heart of political power. The Doge's Palace, Piazza San Marco."},
    "Castello":     {"lat": 45.4380, "lng": 12.3530, "description": "The Arsenale, naval power, shipbuilders and sailors."},
    "Dorsoduro":    {"lat": 45.4300, "lng": 12.3270, "description": "Artists, scholars, the university. Cultural heart."},
    "San Polo":     {"lat": 45.4370, "lng": 12.3310, "description": "The Rialto market, center of commerce and trade."},
    "Santa Croce":  {"lat": 45.4400, "lng": 12.3230, "description": "Warehouses, foreign traders, the western gateway."},
    "Cannaregio":   {"lat": 45.4440, "lng": 12.3280, "description": "The Ghetto, northern canals, diverse communities."},
    "Giudecca":     {"lat": 45.4260, "lng": 12.3300, "description": "Island district. Monasteries, gardens, exiles."},
}

# Social class weights for narrative influence
CLASS_WEIGHTS = {
    "Nobili":       3.0,   # Nobles — maximum narrative influence
    "Cittadini":    2.0,   # Citizen class — significant influence
    "Popolani":     1.0,   # Common people — base influence
    "Artisti":      1.5,   # Artists — cultural influence
    "Scientisti":   1.5,   # Scientists — intellectual influence
    "Innovatori":   1.5,   # Innovators — progressive influence
    "Clero":        2.0,   # Clergy — moral/spiritual influence
    "Facchini":     0.7,   # Laborers — voice of the masses (individually less, collectively strong)
    "Forestieri":   0.5,   # Foreigners — outsider influence
    "Ambasciatore": 2.5,   # Ambassadors — diplomatic influence
}

# Narrative templates: class-based beliefs that create natural tensions
CLASS_NARRATIVES = {
    "Nobili": [
        ("narr_noble_birthright", "The nobility's right to govern is ordained by God and history", "oath", 0.9),
        ("narr_noble_trade_beneath", "Trade is beneath those of noble blood", "belief", 0.7),
        ("narr_noble_republic_eternal", "The Republic must endure through noble stewardship", "alliance", 0.8),
    ],
    "Cittadini": [
        ("narr_citt_merit_over_birth", "Merit and service should determine rank, not birth alone", "belief", 0.8),
        ("narr_citt_bureaucracy_backbone", "The state's bureaucracy is the true backbone of Venice", "belief", 0.7),
        ("narr_citt_guild_power", "The guilds must have a voice in the Senate", "grievance", 0.6),
    ],
    "Popolani": [
        ("narr_pop_labor_exploitation", "The wealthy grow fat while workers starve", "grievance", 0.8),
        ("narr_pop_fair_wages", "Every worker deserves fair pay for honest labor", "belief", 0.9),
        ("narr_pop_noble_corruption", "The nobility is corrupt and out of touch", "grievance", 0.7),
    ],
    "Facchini": [
        ("narr_fac_porter_dignity", "Porters and laborers deserve respect and fair treatment", "grievance", 0.9),
        ("narr_fac_guild_solidarity", "Workers must stand together or be crushed individually", "alliance", 0.8),
        ("narr_fac_bread_price", "The price of bread rises while our wages stay the same", "grievance", 0.8),
    ],
    "Artisti": [
        ("narr_art_beauty_truth", "True beauty reveals divine truth", "belief", 0.8),
        ("narr_art_patron_chains", "Patronage brings gold but also chains", "grudge", 0.6),
        ("narr_art_venice_muse", "Venice herself is the greatest work of art", "belief", 0.9),
    ],
    "Scientisti": [
        ("narr_sci_reason_over_faith", "Reason and observation trump tradition and superstition", "belief", 0.8),
        ("narr_sci_university_freedom", "Scholars must have freedom to question everything", "belief", 0.7),
        ("narr_sci_progress_inevitable", "Progress cannot be stopped by fear", "belief", 0.6),
    ],
    "Clero": [
        ("narr_cle_faith_foundation", "Faith is the foundation upon which Venice stands", "oath", 0.9),
        ("narr_cle_moral_decay", "The Republic suffers from moral decay and excess", "grievance", 0.7),
        ("narr_cle_charity_duty", "Charity toward the poor is a sacred duty", "belief", 0.8),
    ],
    "Forestieri": [
        ("narr_for_outsider_suspicion", "Venice smiles at foreigners but trusts none of them", "grudge", 0.7),
        ("narr_for_trade_opportunity", "Venice's canals are the gateway to unimaginable wealth", "belief", 0.8),
        ("narr_for_home_longing", "No matter how long you stay, Venice is never truly home", "belief", 0.6),
    ],
    "Innovatori": [
        ("narr_inn_old_ways_failing", "The old ways are failing; Venice must innovate or perish", "belief", 0.8),
        ("narr_inn_new_world_trade", "The New World will reshape all trade routes", "belief", 0.7),
        ("narr_inn_printing_revolution", "The printing press will change everything", "belief", 0.6),
    ],
    "Ambasciatore": [
        ("narr_amb_balance_of_power", "Venice's survival depends on playing powers against each other", "belief", 0.9),
        ("narr_amb_ottoman_threat", "The Ottoman advance threatens all of Christendom", "belief", 0.8),
    ],
}

# Cross-class tensions: pairs of narratives that contradict each other
TENSION_PAIRS = [
    # Class conflict
    ("narr_noble_birthright",      "narr_citt_merit_over_birth",  "Class tension: birth vs merit"),
    ("narr_noble_trade_beneath",   "narr_pop_fair_wages",         "Economic tension: noble disdain vs worker dignity"),
    ("narr_noble_birthright",      "narr_pop_noble_corruption",   "Political tension: noble right vs corruption charge"),
    ("narr_pop_labor_exploitation", "narr_noble_republic_eternal", "Social tension: exploitation vs stability"),
    ("narr_fac_bread_price",       "narr_noble_trade_beneath",    "Economic tension: hunger vs aristocratic detachment"),
    # Faith vs reason
    ("narr_sci_reason_over_faith", "narr_cle_faith_foundation",   "Intellectual tension: reason vs faith"),
    ("narr_sci_university_freedom","narr_cle_moral_decay",        "Cultural tension: academic freedom vs moral order"),
    # Art and patronage
    ("narr_art_patron_chains",     "narr_noble_republic_eternal", "Cultural tension: artistic freedom vs noble control"),
    # Innovation vs tradition
    ("narr_inn_old_ways_failing",  "narr_noble_republic_eternal", "Temporal tension: innovation vs tradition"),
    ("narr_inn_old_ways_failing",  "narr_cle_faith_foundation",   "Paradigm tension: progress vs tradition"),
    # Insider vs outsider
    ("narr_for_outsider_suspicion","narr_amb_balance_of_power",   "Diplomatic tension: xenophobia vs realpolitik"),
    ("narr_for_trade_opportunity", "narr_pop_labor_exploitation",  "Economic tension: foreign opportunity vs local exploitation"),
    # Guild vs state
    ("narr_citt_guild_power",      "narr_noble_birthright",       "Power tension: guild voice vs noble prerogative"),
    ("narr_fac_guild_solidarity",  "narr_noble_birthright",       "Collective tension: solidarity vs hierarchy"),
]

# Moment seeds: district-level tension clusters that can flip
MOMENT_SEEDS = [
    {
        "id": "moment_rialto_market_crisis",
        "description": "The Rialto market erupts as merchants refuse new tariffs imposed by the Senate",
        "category": "economic_crisis",
        "district": "San Polo",
        "threshold": 3.0,
        "feeds": ["narr_pop_labor_exploitation", "narr_fac_bread_price", "narr_noble_trade_beneath"],
    },
    {
        "id": "moment_arsenale_strike",
        "description": "Arsenale workers threaten to lay down tools over unpaid wages",
        "category": "guild_dispute",
        "district": "Castello",
        "threshold": 3.5,
        "feeds": ["narr_fac_porter_dignity", "narr_fac_guild_solidarity", "narr_pop_fair_wages"],
    },
    {
        "id": "moment_senate_reform_debate",
        "description": "A heated debate in the Senate over allowing Cittadini into government positions",
        "category": "political_uprising",
        "district": "San Marco",
        "threshold": 4.0,
        "feeds": ["narr_citt_merit_over_birth", "narr_noble_birthright", "narr_citt_guild_power"],
    },
    {
        "id": "moment_university_censorship",
        "description": "The Church demands the University of Padua cease teaching certain astronomical theories",
        "category": "guild_dispute",
        "district": "Dorsoduro",
        "threshold": 3.0,
        "feeds": ["narr_sci_reason_over_faith", "narr_cle_faith_foundation", "narr_sci_university_freedom"],
    },
    {
        "id": "moment_foreign_merchant_riot",
        "description": "Local traders attack a Genoese warehouse, accusing foreigners of undercutting prices",
        "category": "trade_disruption",
        "district": "Santa Croce",
        "threshold": 2.5,
        "feeds": ["narr_for_outsider_suspicion", "narr_for_trade_opportunity", "narr_pop_labor_exploitation"],
    },
    {
        "id": "moment_ghetto_curfew_protest",
        "description": "Residents of the Ghetto petition against the midnight curfew",
        "category": "political_uprising",
        "district": "Cannaregio",
        "threshold": 3.0,
        "feeds": ["narr_for_outsider_suspicion", "narr_cle_charity_duty", "narr_citt_merit_over_birth"],
    },
    {
        "id": "moment_noble_feast_scandal",
        "description": "A lavish noble feast during a week of worker deaths sparks outrage",
        "category": "personal_tragedy",
        "district": "San Marco",
        "threshold": 2.5,
        "feeds": ["narr_pop_noble_corruption", "narr_noble_birthright", "narr_cle_moral_decay"],
    },
    {
        "id": "moment_printing_press_arrival",
        "description": "A new printing press threatens the scribes' guild monopoly on book production",
        "category": "trade_disruption",
        "district": "San Polo",
        "threshold": 3.0,
        "feeds": ["narr_inn_printing_revolution", "narr_inn_old_ways_failing", "narr_art_beauty_truth"],
    },
    {
        "id": "moment_ottoman_fleet_sighting",
        "description": "Reports arrive of an Ottoman fleet gathering near Corfu",
        "category": "political_uprising",
        "district": "Castello",
        "threshold": 4.0,
        "feeds": ["narr_amb_ottoman_threat", "narr_amb_balance_of_power", "narr_noble_republic_eternal"],
    },
    {
        "id": "moment_glass_guild_secession",
        "description": "Murano glassmakers threaten to leave Venice if new export taxes are enforced",
        "category": "guild_dispute",
        "district": "Cannaregio",
        "threshold": 3.5,
        "feeds": ["narr_art_patron_chains", "narr_citt_guild_power", "narr_inn_old_ways_failing"],
    },
    {
        "id": "moment_patron_saint_festival",
        "description": "The Feast of San Marco becomes a flashpoint between pious celebration and secular excess",
        "category": "celebration",
        "district": "San Marco",
        "threshold": 2.0,
        "feeds": ["narr_cle_faith_foundation", "narr_cle_moral_decay", "narr_art_venice_muse"],
    },
    {
        "id": "moment_canal_plague_rumor",
        "description": "Rumors spread that plague has arrived on a merchant ship from the East",
        "category": "personal_tragedy",
        "district": "Santa Croce",
        "threshold": 2.0,
        "feeds": ["narr_for_outsider_suspicion", "narr_cle_moral_decay", "narr_pop_labor_exploitation"],
    },
]


# ---------------------------------------------------------------------------
# District assignment
# ---------------------------------------------------------------------------

def assign_district(position_json: str) -> str:
    """Assign a citizen to their nearest Venice district based on lat/lng."""
    if not position_json:
        return "San Marco"  # Default

    try:
        pos = json.loads(position_json) if isinstance(position_json, str) else position_json
        lat = pos.get("lat", 45.434)
        lng = pos.get("lng", 12.338)
    except (json.JSONDecodeError, TypeError):
        return "San Marco"

    best_district = "San Marco"
    best_dist = float("inf")

    for name, info in VENICE_DISTRICTS.items():
        d = math.sqrt((lat - info["lat"]) ** 2 + (lng - info["lng"]) ** 2)
        if d < best_dist:
            best_dist = d
            best_district = name

    return best_district


def char_id(username: str) -> str:
    """Convert Airtable username to graph character ID."""
    return f"char_{username.lower().replace(' ', '_')}"


def seeded_variance(character_id: str, stddev: float = 0.2) -> float:
    """Deterministic per-character variance from character_id hash."""
    h = int(hashlib.md5(character_id.encode()).hexdigest()[:8], 16)
    # Map to [-1, 1] range then scale by stddev
    normalized = (h / 0xFFFFFFFF) * 2.0 - 1.0
    return normalized * stddev


# ---------------------------------------------------------------------------
# Graph seeding
# ---------------------------------------------------------------------------

class VeniceGraphSeeder:
    def __init__(self, graph_name: str = "cities_of_light",
                 host: str = "localhost", port: int = 6379,
                 dry_run: bool = False):
        self.graph_name = graph_name
        self.dry_run = dry_run
        self.stats = Counter()

        if not dry_run:
            self.db = FalkorDB(host=host, port=port)
            self.graph = self.db.select_graph(graph_name)
        else:
            self.db = None
            self.graph = None

    def query(self, cypher: str, params: dict = None):
        """Execute a Cypher query."""
        if self.dry_run:
            logger.debug(f"[DRY RUN] {cypher[:120]}...")
            return []
        try:
            result = self.graph.query(cypher, params or {})
            return result.result_set if hasattr(result, 'result_set') else []
        except Exception as e:
            logger.warning(f"Query error: {e}\n  Cypher: {cypher[:200]}")
            return []

    def create_indexes(self):
        """Create idempotent indexes for performance."""
        indexes = [
            "CREATE INDEX ON :Character(id)",
            "CREATE INDEX ON :Narrative(id)",
            "CREATE INDEX ON :Place(id)",
            "CREATE INDEX ON :Moment(id)",
        ]
        for idx in indexes:
            try:
                self.query(idx)
            except Exception as e:
                logger.debug("Index creation skipped (may already exist): %s", e)
        logger.info("[Indexes] Created/verified")

    def seed_districts(self):
        """Create 7 Place nodes for Venice districts."""
        for name, info in VENICE_DISTRICTS.items():
            place_id = f"place_{name.lower().replace(' ', '_')}"
            cypher = """
            MERGE (p:Place {id: $id})
            SET p.name = $name,
                p.description = $desc,
                p.lat = $lat,
                p.lng = $lng,
                p.type = 'district',
                p.energy = 0.0,
                p.weight = 1.0
            """
            self.query(cypher, {
                "id": place_id,
                "name": name,
                "desc": info["description"],
                "lat": info["lat"],
                "lng": info["lng"],
            })
            self.stats["places"] += 1

        logger.info(f"[Districts] Seeded {self.stats['places']} Place nodes")

    def seed_characters(self, citizens: List[Dict]) -> Dict[str, Dict]:
        """Create Character nodes from Airtable citizen data.

        Returns: dict of username -> {district, class, ...} for downstream use
        """
        citizen_map = {}

        for citizen in citizens:
            fields = citizen["fields"]
            username = fields.get("Username", "")
            if not username:
                continue

            social_class = fields.get("SocialClass", "Popolani")
            ducats = fields.get("Ducats", 0) or 0
            position = fields.get("Position", "")
            district = assign_district(position)
            weight = CLASS_WEIGHTS.get(social_class, 1.0)
            cid = char_id(username)

            # Apply propensity variance to initial energy
            variance = seeded_variance(cid)
            energy = CHARACTER_BOOTSTRAP_ENERGY * (1.0 + variance)

            first_name = fields.get("FirstName", username)
            last_name = fields.get("LastName", "")
            description = fields.get("Description", "")
            personality = fields.get("CorePersonality", "[]")

            cypher = """
            MERGE (c:Character {id: $id})
            SET c.name = $name,
                c.first_name = $first,
                c.last_name = $last,
                c.energy = $energy,
                c.weight = $weight,
                c.class = $class,
                c.district = $district,
                c.ducats = $ducats,
                c.alive = true,
                c.description = $desc,
                c.personality = $personality,
                c.guild = $guild,
                c.influence = $influence
            """
            self.query(cypher, {
                "id": cid,
                "name": f"{first_name} {last_name}".strip(),
                "first": first_name,
                "last": last_name,
                "energy": round(energy, 4),
                "weight": weight,
                "class": social_class,
                "district": district,
                "ducats": round(ducats, 2),
                "desc": (description or "")[:500],
                "personality": personality,
                "guild": fields.get("GuildId", ""),
                "influence": fields.get("Influence", 0) or 0,
            })

            # AT edge: Character → Place (home district)
            place_id = f"place_{district.lower().replace(' ', '_')}"
            self.query("""
            MATCH (c:Character {id: $cid}), (p:Place {id: $pid})
            MERGE (c)-[:AT]->(p)
            """, {"cid": cid, "pid": place_id})

            citizen_map[username] = {
                "id": cid,
                "class": social_class,
                "district": district,
                "ducats": ducats,
                "weight": weight,
            }
            self.stats["characters"] += 1

        logger.info(f"[Characters] Seeded {self.stats['characters']} Character nodes")
        return citizen_map

    def seed_narratives(self, citizen_map: Dict[str, Dict]) -> Dict[str, str]:
        """Create Narrative nodes and BELIEVES edges.

        Returns: dict of narrative_id -> narrative_type for downstream use
        """
        narrative_types = {}

        # Create class-based narratives
        for social_class, narratives in CLASS_NARRATIVES.items():
            for narr_id, content, narr_type, base_confidence in narratives:
                cypher = """
                MERGE (n:Narrative {id: $id})
                SET n.content = $content,
                    n.type = $type,
                    n.energy = $energy,
                    n.weight = 1.0,
                    n.class_origin = $class
                """
                self.query(cypher, {
                    "id": narr_id,
                    "content": content,
                    "type": narr_type,
                    "energy": NARRATIVE_BOOTSTRAP_ENERGY,
                    "class": social_class,
                })
                narrative_types[narr_id] = narr_type
                self.stats["narratives"] += 1

            # Create BELIEVES edges for citizens of this class
            class_citizens = [
                info for info in citizen_map.values()
                if info["class"] == social_class
            ]
            for info in class_citizens:
                for narr_id, _, _, base_confidence in narratives:
                    # Vary confidence per citizen for diversity
                    var = seeded_variance(info["id"] + narr_id, stddev=0.15)
                    confidence = max(0.1, min(1.0, base_confidence + var))

                    self.query("""
                    MATCH (c:Character {id: $cid}), (n:Narrative {id: $nid})
                    MERGE (c)-[b:BELIEVES]->(n)
                    SET b.confidence = $conf,
                        b.weight = $conf,
                        b.energy = 0.0
                    """, {
                        "cid": info["id"],
                        "nid": narr_id,
                        "conf": round(confidence, 3),
                    })
                    self.stats["believes_edges"] += 1

        # Cross-class beliefs: some citizens believe narratives from adjacent classes
        cross_beliefs = [
            ("Cittadini", ["narr_pop_fair_wages"], 0.4),
            ("Popolani", ["narr_fac_guild_solidarity"], 0.5),
            ("Artisti", ["narr_sci_reason_over_faith"], 0.3),
            ("Clero", ["narr_noble_republic_eternal"], 0.5),
            ("Nobili", ["narr_amb_balance_of_power"], 0.6),
            ("Facchini", ["narr_pop_noble_corruption"], 0.6),
        ]
        for social_class, narr_ids, conf in cross_beliefs:
            class_citizens = [
                info for info in citizen_map.values()
                if info["class"] == social_class
            ]
            for info in class_citizens:
                for nid in narr_ids:
                    var = seeded_variance(info["id"] + nid, stddev=0.1)
                    confidence = max(0.1, min(1.0, conf + var))
                    self.query("""
                    MATCH (c:Character {id: $cid}), (n:Narrative {id: $nid})
                    MERGE (c)-[b:BELIEVES]->(n)
                    SET b.confidence = $conf,
                        b.weight = $conf,
                        b.energy = 0.0
                    """, {
                        "cid": info["id"],
                        "nid": nid,
                        "conf": round(confidence, 3),
                    })
                    self.stats["believes_edges"] += 1

        logger.info(f"[Narratives] Seeded {self.stats['narratives']} Narrative nodes, "
                    f"{self.stats['believes_edges']} BELIEVES edges")
        return narrative_types

    def seed_tensions(self, narrative_types: Dict[str, str]):
        """Create TENSION edges between contradicting narratives."""
        for narr_a, narr_b, description in TENSION_PAIRS:
            if narr_a not in narrative_types or narr_b not in narrative_types:
                continue

            self.query("""
            MATCH (n1:Narrative {id: $a}), (n2:Narrative {id: $b})
            MERGE (n1)-[t:TENSION]->(n2)
            SET t.description = $desc,
                t.strength = 0.1,
                t.weight = 1.0,
                t.energy = 0.0
            """, {"a": narr_a, "b": narr_b, "desc": description})
            self.stats["tensions"] += 1

        logger.info(f"[Tensions] Seeded {self.stats['tensions']} TENSION edges")

    def seed_moments(self, narrative_types: Dict[str, str]):
        """Create Moment nodes and FEEDS edges from narratives."""
        for moment in MOMENT_SEEDS:
            mid = moment["id"]
            district = moment["district"]
            place_id = f"place_{district.lower().replace(' ', '_')}"

            self.query("""
            MERGE (m:Moment {id: $id})
            SET m.description = $desc,
                m.category = $cat,
                m.district = $district,
                m.threshold = $threshold,
                m.energy = 0.0,
                m.weight = 1.0,
                m.flipped = false,
                m.status = 'possible'
            """, {
                "id": mid,
                "desc": moment["description"],
                "cat": moment["category"],
                "district": district,
                "threshold": moment["threshold"],
            })

            # AT edge: Moment → Place
            self.query("""
            MATCH (m:Moment {id: $mid}), (p:Place {id: $pid})
            MERGE (m)-[:AT]->(p)
            """, {"mid": mid, "pid": place_id})

            # FEEDS edges: Narrative → Moment
            for narr_id in moment["feeds"]:
                if narr_id in narrative_types:
                    self.query("""
                    MATCH (n:Narrative {id: $nid}), (m:Moment {id: $mid})
                    MERGE (n)-[f:FEEDS]->(m)
                    SET f.factor = 0.5,
                        f.weight = 1.0,
                        f.energy = 0.0
                    """, {"nid": narr_id, "mid": mid})
                    self.stats["feeds_edges"] += 1

            self.stats["moments"] += 1

        logger.info(f"[Moments] Seeded {self.stats['moments']} Moment nodes, "
                    f"{self.stats['feeds_edges']} FEEDS edges")

    def seed_relationships(self, relationships: List[Dict], citizen_map: Dict[str, Dict]):
        """Create RELATES edges from Airtable relationships (sample)."""
        count = 0
        # Only seed the strongest relationships to keep graph manageable
        for rel in relationships:
            fields = rel["fields"]
            c1 = fields.get("Citizen1", "")
            c2 = fields.get("Citizen2", "")
            if not c1 or not c2:
                continue
            if c1 not in citizen_map or c2 not in citizen_map:
                continue

            cid1 = citizen_map[c1]["id"]
            cid2 = citizen_map[c2]["id"]
            desc = (fields.get("Description", "") or "")[:200]

            self.query("""
            MATCH (c1:Character {id: $c1}), (c2:Character {id: $c2})
            MERGE (c1)-[r:RELATES]->(c2)
            SET r.description = $desc,
                r.weight = 0.5,
                r.energy = 0.0
            """, {"c1": cid1, "c2": cid2, "desc": desc})
            count += 1

            if count >= 500:  # Cap at 500 relationship edges
                break

        self.stats["relates_edges"] = count
        logger.info(f"[Relationships] Seeded {count} RELATES edges")

    def verify(self):
        """Run verification queries."""
        checks = [
            ("Characters", "MATCH (c:Character) RETURN count(c) AS count"),
            ("Narratives", "MATCH (n:Narrative) RETURN count(n) AS count"),
            ("Places",     "MATCH (p:Place) RETURN count(p) AS count"),
            ("Moments",    "MATCH (m:Moment {flipped: false}) RETURN count(m) AS count"),
            ("BELIEVES",   "MATCH ()-[b:BELIEVES]->() RETURN count(b) AS count"),
            ("TENSION",    "MATCH ()-[t:TENSION]->() RETURN count(t) AS count"),
            ("FEEDS",      "MATCH ()-[f:FEEDS]->() RETURN count(f) AS count"),
            ("AT",         "MATCH ()-[a:AT]->() RETURN count(a) AS count"),
            ("RELATES",    "MATCH ()-[r:RELATES]->() RETURN count(r) AS count"),
        ]

        logger.info("\n" + "=" * 50)
        logger.info("VERIFICATION")
        logger.info("=" * 50)

        all_pass = True
        for label, cypher in checks:
            result = self.query(cypher)
            if result:
                count = result[0][0] if isinstance(result[0], (list, tuple)) else result[0]
                logger.info(f"  {label:12s}: {count}")
                if label == "Characters" and count == 0:
                    all_pass = False
            else:
                logger.warning(f"  {label:12s}: QUERY FAILED")
                all_pass = False

        # Check total system energy > 0
        energy_result = self.query(
            "MATCH (c:Character) RETURN sum(c.energy) AS total"
        )
        if energy_result:
            total_e = energy_result[0][0] if isinstance(energy_result[0], (list, tuple)) else energy_result[0]
            logger.info(f"  {'Total energy':12s}: {total_e:.2f}")
            if total_e <= 0:
                logger.error("  FAIL: Bootstrap energy is 0 — PI12 violated")
                all_pass = False

        # Check class distribution
        class_result = self.query(
            "MATCH (c:Character) RETURN c.class AS class, count(c) AS count ORDER BY count DESC"
        )
        if class_result:
            logger.info("\n  Class distribution:")
            for row in class_result:
                if isinstance(row, (list, tuple)):
                    logger.info(f"    {row[0]:15s}: {row[1]}")
                else:
                    logger.info(f"    {row}")

        # Check district distribution
        district_result = self.query(
            "MATCH (c:Character) RETURN c.district AS district, count(c) AS count ORDER BY count DESC"
        )
        if district_result:
            logger.info("\n  District distribution:")
            for row in district_result:
                if isinstance(row, (list, tuple)):
                    logger.info(f"    {row[0]:15s}: {row[1]}")
                else:
                    logger.info(f"    {row}")

        if all_pass:
            logger.info("\n  ALL CHECKS PASSED")
        else:
            logger.error("\n  SOME CHECKS FAILED")

        return all_pass

    def clear_venice_data(self):
        """Remove existing Venice Character/Narrative/Moment nodes (keep Blood Ledger Actor nodes)."""
        logger.info("[Clear] Removing existing Venice data...")
        self.query("MATCH (c:Character) DETACH DELETE c")
        self.query("MATCH (n:Narrative) WHERE n.class_origin IS NOT NULL DETACH DELETE n")
        self.query("MATCH (m:Moment) WHERE m.district IS NOT NULL DETACH DELETE m")
        self.query("MATCH (p:Place) WHERE p.type = 'district' DETACH DELETE p")
        logger.info("[Clear] Done")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Seed Venice graph from Airtable")
    parser.add_argument("--graph", default="cities_of_light", help="FalkorDB graph name")
    parser.add_argument("--host", default=os.environ.get("FALKORDB_HOST", "localhost"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("FALKORDB_PORT", "6379")))
    parser.add_argument("--clear", action="store_true", help="Clear existing Venice data first")
    parser.add_argument("--dry-run", action="store_true", help="Print queries without executing")
    parser.add_argument("--skip-relationships", action="store_true", help="Skip Airtable relationships")
    args = parser.parse_args()

    # Check Airtable key
    api_key = os.environ.get("AIRTABLE_API_KEY")
    if not api_key:
        logger.error("AIRTABLE_API_KEY environment variable required")
        logger.error("Set it: export AIRTABLE_API_KEY=pat...")
        sys.exit(1)

    # Connect to Airtable
    logger.info(f"Connecting to Airtable base {AIRTABLE_BASE_ID}...")
    api = Api(api_key)
    citizens_table = api.table(AIRTABLE_BASE_ID, "CITIZENS")

    logger.info("Fetching citizens...")
    citizens = citizens_table.all()
    # Filter to only AI citizens that are in Venice
    citizens = [
        c for c in citizens
        if c["fields"].get("IsAI", False) and c["fields"].get("InVenice", True)
    ]
    logger.info(f"Found {len(citizens)} AI citizens in Venice")

    relationships = []
    if not args.skip_relationships:
        logger.info("Fetching relationships...")
        rel_table = api.table(AIRTABLE_BASE_ID, "RELATIONSHIPS")
        relationships = rel_table.all()
        logger.info(f"Found {len(relationships)} relationships")

    # Initialize seeder
    seeder = VeniceGraphSeeder(
        graph_name=args.graph,
        host=args.host,
        port=args.port,
        dry_run=args.dry_run,
    )

    if args.clear:
        seeder.clear_venice_data()

    # Seed in order
    logger.info(f"\nSeeding graph '{args.graph}'...")
    seeder.create_indexes()
    seeder.seed_districts()
    citizen_map = seeder.seed_characters(citizens)
    narrative_types = seeder.seed_narratives(citizen_map)
    seeder.seed_tensions(narrative_types)
    seeder.seed_moments(narrative_types)

    if relationships:
        seeder.seed_relationships(relationships, citizen_map)

    # Verify
    if not args.dry_run:
        seeder.verify()

    # Summary
    logger.info(f"\nSeed complete. Stats: {dict(seeder.stats)}")


if __name__ == "__main__":
    main()
