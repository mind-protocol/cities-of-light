"""
Seed ALL Serenissima L1 Relationships — Airtable → FalkorDB with Embeddings

Fetches all 1,178 relationships from Airtable RELATIONSHIPS table,
creates RELATES edges in FalkorDB with real descriptions and TrustScore-based weights,
then generates embeddings for semantic search on each edge.

Replaces the old capped-at-500 relationship seeding with full coverage.

Usage:
    cd /home/mind-protocol/cities-of-light
    AIRTABLE_API_KEY=pat... python scripts/seed_all_relationships_with_embeddings.py

    # Options:
    --clear          Delete existing RELATES edges before seeding
    --skip-embeddings Skip embedding generation (just seed edges)
    --dry-run        Print what would be done without executing
    --batch-size N   Embedding batch size (default: 32)

Environment:
    AIRTABLE_API_KEY  — Airtable Personal Access Token (required)
    AIRTABLE_BASE_ID  — Override base ID (default: appk6RszUo2a2L2L8)
    FALKORDB_HOST     — FalkorDB host (default: localhost)
    FALKORDB_PORT     — FalkorDB port (default: 6379)
"""

import os
import sys
import json
import logging
import argparse
from collections import Counter
from typing import List, Dict, Any, Optional

from pyairtable import Api
from falkordb import FalkorDB

# Add manemus .mind runtime to path for embedding service
sys.path.insert(0, "/home/mind-protocol/manemus/.mind/runtime")

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s %(message)s"
)
logger = logging.getLogger(__name__)

AIRTABLE_BASE_ID = os.environ.get("AIRTABLE_BASE_ID", "appk6RszUo2a2L2L8")


def char_id(username: str) -> str:
    """Convert Airtable username to FalkorDB Character ID."""
    return f"char_{username.lower()}"


def build_description(fields: dict) -> str:
    """Build embeddable description from Description and Notes fields.

    Priority: Description (human-readable) > Notes (activity log).
    For Notes-only records, extract unique activity types as summary.
    """
    desc = (fields.get("Description") or "").strip()
    notes = (fields.get("Notes") or "").strip()
    title = (fields.get("Title") or "").strip()

    parts = []

    if title:
        parts.append(title)

    if desc:
        parts.append(desc)
    elif notes:
        # Notes are comma-separated activity types — extract unique ones
        activities = set()
        for chunk in notes.split(","):
            chunk = chunk.strip()
            if chunk:
                # Clean activity names: "activity_housing_rent_payment_success" → "housing rent payment success"
                clean = chunk.replace("activity_", "").replace("_", " ").strip()
                if clean:
                    activities.add(clean)
        if activities:
            parts.append("Activities: " + ", ".join(sorted(activities)[:10]))

    c1 = fields.get("Citizen1", "?")
    c2 = fields.get("Citizen2", "?")

    if not parts:
        return f"Relationship between {c1} and {c2}"

    return f"{c1} — {c2}: " + ". ".join(parts)


def trust_to_weight(trust_score: float) -> float:
    """Convert TrustScore (0-100) to edge weight (0.0-1.0).

    Mapping: linear 0-100 → 0.0-1.0
    """
    if trust_score is None:
        return 0.5
    return round(max(0.0, min(1.0, trust_score / 100.0)), 4)


class RelationshipSeeder:
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

    def get_character_ids(self) -> set:
        """Get all Character IDs currently in the graph."""
        result = self.query("MATCH (c:Character) RETURN c.id")
        ids = set()
        for row in result:
            val = row[0] if isinstance(row, (list, tuple)) else row
            if val:
                ids.add(val)
        return ids

    def clear_relates(self):
        """Delete all existing RELATES edges."""
        result = self.query("MATCH ()-[r:RELATES]->() DELETE r")
        logger.info("[Clear] Deleted all existing RELATES edges")

    def seed_relationships(self, relationships: List[Dict], character_ids: set) -> List[Dict]:
        """Create RELATES edges from Airtable relationships.

        Returns list of edge data for embedding generation.
        """
        edges_for_embedding = []
        skipped_missing = 0

        for rel in relationships:
            fields = rel["fields"]
            c1_username = fields.get("Citizen1", "")
            c2_username = fields.get("Citizen2", "")
            if not c1_username or not c2_username:
                self.stats["skipped_empty"] += 1
                continue

            cid1 = char_id(c1_username)
            cid2 = char_id(c2_username)

            # Check both characters exist in graph
            if cid1 not in character_ids or cid2 not in character_ids:
                skipped_missing += 1
                continue

            trust = fields.get("TrustScore")
            strength = fields.get("StrengthScore")
            weight = trust_to_weight(trust)
            description = build_description(fields)
            status = fields.get("Status", "active")

            self.query("""
            MATCH (c1:Character {id: $c1}), (c2:Character {id: $c2})
            MERGE (c1)-[r:RELATES]->(c2)
            SET r.description = $desc,
                r.weight = $weight,
                r.trust_score = $trust,
                r.strength_score = $strength,
                r.status = $status,
                r.energy = 0.0
            """, {
                "c1": cid1,
                "c2": cid2,
                "desc": description[:500],
                "weight": weight,
                "trust": trust or 50.0,
                "strength": strength or 0.0,
                "status": status,
            })

            edges_for_embedding.append({
                "c1": cid1,
                "c2": cid2,
                "description": description,
                "weight": weight,
            })
            self.stats["created"] += 1

        if skipped_missing:
            logger.info(f"[Relationships] Skipped {skipped_missing} edges (characters not in graph)")
        logger.info(f"[Relationships] Created {self.stats['created']} RELATES edges")
        return edges_for_embedding

    def embed_relationships(self, edges: List[Dict], batch_size: int = 32):
        """Generate and store embeddings for all RELATES edges."""
        from infrastructure.embeddings.service import get_embedding_service
        embedder = get_embedding_service()
        logger.info(f"[Embeddings] Generating for {len(edges)} edges (batch_size={batch_size})")

        total_embedded = 0

        for i in range(0, len(edges), batch_size):
            batch = edges[i:i + batch_size]
            texts = [e["description"] for e in batch]

            embeddings = embedder.embed_batch(texts)

            for edge, embedding in zip(batch, embeddings):
                # Store embedding as JSON array on the edge
                embedding_json = json.dumps(embedding)
                self.query("""
                MATCH (c1:Character {id: $c1})-[r:RELATES]->(c2:Character {id: $c2})
                SET r.embedding = $emb
                """, {
                    "c1": edge["c1"],
                    "c2": edge["c2"],
                    "emb": embedding_json,
                })
                total_embedded += 1

            done = min(i + batch_size, len(edges))
            logger.info(f"  [{done}/{len(edges)}] embedded")

        self.stats["embedded"] = total_embedded
        logger.info(f"[Embeddings] Stored {total_embedded} embeddings ({embedder.dimension}d)")

    def verify(self):
        """Verify seeded relationships."""
        checks = [
            ("RELATES edges",   "MATCH ()-[r:RELATES]->() RETURN count(r) AS count"),
            ("With description", "MATCH ()-[r:RELATES]->() WHERE r.description <> '' RETURN count(r) AS count"),
            ("With embedding",   "MATCH ()-[r:RELATES]->() WHERE r.embedding IS NOT NULL RETURN count(r) AS count"),
            ("Characters",       "MATCH (c:Character) RETURN count(c) AS count"),
        ]

        logger.info("\n" + "=" * 50)
        logger.info("VERIFICATION")
        logger.info("=" * 50)

        for label, cypher in checks:
            result = self.query(cypher)
            if result:
                count = result[0][0] if isinstance(result[0], (list, tuple)) else result[0]
                logger.info(f"  {label:20s}: {count}")
            else:
                logger.warning(f"  {label:20s}: QUERY FAILED")

        # Trust score distribution
        dist_result = self.query("""
        MATCH ()-[r:RELATES]->()
        RETURN
            sum(CASE WHEN r.trust_score >= 80 THEN 1 ELSE 0 END) AS high,
            sum(CASE WHEN r.trust_score >= 60 AND r.trust_score < 80 THEN 1 ELSE 0 END) AS medium_high,
            sum(CASE WHEN r.trust_score >= 40 AND r.trust_score < 60 THEN 1 ELSE 0 END) AS medium,
            sum(CASE WHEN r.trust_score < 40 THEN 1 ELSE 0 END) AS low
        """)
        if dist_result:
            row = dist_result[0]
            if isinstance(row, (list, tuple)):
                logger.info(f"\n  Trust distribution:")
                logger.info(f"    High (>=80):    {row[0]}")
                logger.info(f"    Med-High (60+): {row[1]}")
                logger.info(f"    Medium (40+):   {row[2]}")
                logger.info(f"    Low (<40):      {row[3]}")


def main():
    parser = argparse.ArgumentParser(description="Seed ALL Serenissima relationships with embeddings")
    parser.add_argument("--graph", default="cities_of_light", help="FalkorDB graph name")
    parser.add_argument("--host", default=os.environ.get("FALKORDB_HOST", "localhost"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("FALKORDB_PORT", "6379")))
    parser.add_argument("--clear", action="store_true", help="Delete existing RELATES edges first")
    parser.add_argument("--skip-embeddings", action="store_true", help="Skip embedding generation")
    parser.add_argument("--batch-size", type=int, default=32, help="Embedding batch size")
    parser.add_argument("--dry-run", action="store_true", help="Print actions without executing")
    args = parser.parse_args()

    api_key = os.environ.get("AIRTABLE_API_KEY")
    if not api_key:
        logger.error("AIRTABLE_API_KEY environment variable required")
        sys.exit(1)

    # Fetch ALL relationships from Airtable (no cap)
    logger.info("[Airtable] Fetching ALL relationships...")
    api = Api(api_key)
    rel_table = api.table(AIRTABLE_BASE_ID, "RELATIONSHIPS")
    relationships = rel_table.all()
    logger.info(f"[Airtable] Fetched {len(relationships)} relationships")

    # Initialize seeder
    seeder = RelationshipSeeder(
        graph_name=args.graph,
        host=args.host,
        port=args.port,
        dry_run=args.dry_run,
    )

    # Get existing characters
    character_ids = seeder.get_character_ids()
    logger.info(f"[Graph] Found {len(character_ids)} Character nodes")

    # Optionally clear existing
    if args.clear:
        seeder.clear_relates()

    # Seed all relationships
    edges = seeder.seed_relationships(relationships, character_ids)

    # Generate embeddings
    if not args.skip_embeddings and edges:
        seeder.embed_relationships(edges, batch_size=args.batch_size)

    # Verify
    if not args.dry_run:
        seeder.verify()

    logger.info(f"\nDone. Stats: {dict(seeder.stats)}")


if __name__ == "__main__":
    main()
