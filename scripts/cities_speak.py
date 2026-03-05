#!/usr/bin/env python3
"""
Cities of Light — Session Voice Bridge

Lets any Claude Code session speak directly into the VR world.
Usage:
    python3 cities_speak.py "I finished the texture improvements!"
    python3 cities_speak.py --speaker "Marco" "The physics engine is ready."
"""

import argparse
import json
import os
import sys
import urllib.request
import urllib.error

CITIES_API = os.environ.get("CITIES_API", "http://localhost:8800")


def speak(text, speaker=None, session_id=None):
    """POST text to the Cities of Light /speak endpoint."""
    payload = {"text": text}
    if speaker:
        payload["speaker"] = speaker
    if session_id:
        payload["session_id"] = session_id

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{CITIES_API}/speak",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read())
            print(f"Spoke into Cities: {result}")
            return result
    except urllib.error.URLError as e:
        print(f"Cities server unreachable ({CITIES_API}): {e}", file=sys.stderr)
        return None
    except Exception as e:
        print(f"Error speaking into Cities: {e}", file=sys.stderr)
        return None


def main():
    parser = argparse.ArgumentParser(description="Speak into the Cities of Light VR world")
    parser.add_argument("text", help="Text to speak")
    parser.add_argument("--speaker", default=None, help="Speaker name (default: session)")
    parser.add_argument("--session-id", default=os.environ.get("SESSION_ID"), help="Session ID")
    args = parser.parse_args()

    if not args.text.strip():
        print("No text provided", file=sys.stderr)
        sys.exit(1)

    result = speak(args.text, speaker=args.speaker, session_id=args.session_id)
    sys.exit(0 if result else 1)


if __name__ == "__main__":
    main()
