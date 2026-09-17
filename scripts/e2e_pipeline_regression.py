#!/usr/bin/env python3
"""End-to-end regression for the blueprint -> map -> navigation-graph pipeline.

Runs a real IFC and a real SVG floor plan through EVERY stage against a running
backend, and ASSERTS the outcome at each hop (upload, normalize, geometry,
candidates, USOs, semantics, map rooms/names/types, nav nodes). Prints PASS/FAIL
per check and exits non-zero if any check fails, so it doubles as a demo and a
regression guard.

Usage:
    python3 scripts/e2e_pipeline_regression.py

Requires the dev backend on :5000 (override with ATLAS_API) and the real
fixtures below (override the dir with ATLAS_FIXTURES):
    <fixtures>/real-building.ifc        (IFC2X3 Duplex; Level 1 = 10 IfcSpaces)
    <fixtures>/one_park_mall_2f.svg     (real mall floor)

It reuses/creates a building named "E2E Regression" and appends fresh floors
(unique levels) so repeated runs never collide and test data persists for
browsing.
"""
import json, os, sys, urllib.request, urllib.error, uuid

BASE = os.environ.get("ATLAS_API", "http://localhost:5000/api")
FIX = os.environ.get("ATLAS_FIXTURES", "/Users/unifynd-pro/Desktop/Atlas-Platform/assets")
BUILDING_NAME = "E2E Regression"

FIXTURES = [
    {
        "label": "IFC Duplex (Level 1)",
        "file": f"{FIX}/real-building.ifc",
        "mime": "application/x-ifc",
        "normalize_body": {"storeyName": "Level 1"},
        "expect": {"candidate_rooms": 10, "map_rooms": 10, "map_named": 10,
                   "all_category_room": True, "nav_nodes_min": 1},
    },
    {
        "label": "SVG One Park Mall (2F)",
        "file": f"{FIX}/one_park_mall_2f.svg",
        "mime": "image/svg+xml",
        "normalize_body": {},
        # SVG has ~no labels, so names/types are not expected; room COUNT is the
        # stable geometric anchor (35 candidates -> 34 rooms, 1 floor envelope).
        "expect": {"candidate_rooms": 35, "map_rooms": 34, "map_named": None,
                   "all_category_room": None, "nav_nodes_min": 0},
    },
]

RESULTS = []


def req(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json"} if body is not None else {}
    r = urllib.request.Request(BASE + path, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(r, timeout=180) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode())
        except Exception:
            return e.code, {"message": str(e)}
    except Exception as e:
        return 0, {"message": str(e)}


def upload(building, floor, path, mime):
    boundary = "----b" + uuid.uuid4().hex
    with open(path, "rb") as f:
        content = f.read()
    fname = os.path.basename(path)
    body = b"".join([
        f"--{boundary}\r\n".encode(),
        f'Content-Disposition: form-data; name="file"; filename="{fname}"\r\n'.encode(),
        f"Content-Type: {mime}\r\n\r\n".encode(), content, b"\r\n",
        f"--{boundary}--\r\n".encode(),
    ])
    url = f"{BASE}/buildings/{building}/floors/{floor}/blueprint-imports"
    r = urllib.request.Request(url, data=body, method="POST",
                               headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
    with urllib.request.urlopen(r, timeout=180) as resp:
        return json.loads(resp.read().decode())["data"]


def check(label, name, ok, detail=""):
    RESULTS.append(ok)
    print(f"    [{'PASS' if ok else 'FAIL'}] {name}{(' — ' + detail) if detail else ''}")


def resolve_building():
    _, d = req("GET", "/buildings")
    for b in d.get("data", []):
        if b.get("name") == BUILDING_NAME:
            return b["id"], [f.get("level", 0) for f in
                             (req("GET", f"/buildings/{b['id']}/floors")[1].get("data", []))]
    _, d = req("POST", "/buildings", {"name": BUILDING_NAME, "city": "Test", "country": "US", "timezone": "UTC"})
    return d["data"]["id"], []


def run_fixture(building, level, fx):
    exp = fx["expect"]
    print(f"\n=== {fx['label']} ===")
    _, fd = req("POST", f"/buildings/{building}/floors", {"name": fx["label"], "level": level})
    if "data" not in fd:
        check(fx["label"], "create floor", False, str(fd)[:80]); return
    floor = fd["data"]["id"]

    imp = upload(building, floor, fx["file"], fx["mime"])
    check(fx["label"], "upload accepted", bool(imp.get("id")), imp.get("mimeType", ""))
    imp_base = f"/buildings/{building}/floors/{floor}/blueprint-imports/{imp['id']}"

    s, _ = req("POST", f"{imp_base}/normalize", fx["normalize_body"])
    check(fx["label"], "normalize", s == 201)
    s, g = req("POST", f"{imp_base}/geometry")
    geo_id = (g.get("data") or {}).get("id")
    check(fx["label"], "geometry extracted", s == 201 and bool(geo_id))
    _, gc = req("POST", f"{imp_base}/geometry/candidates")
    rooms = (gc.get("data", {}) or {}).get("diagnostics", {}).get("boundaryCount")
    check(fx["label"], f"candidate rooms == {exp['candidate_rooms']}",
          rooms == exp["candidate_rooms"], f"got {rooms}")

    check(fx["label"], "generate-usos", req("POST", f"/geometry/{geo_id}/generate-usos")[0] == 201)
    check(fx["label"], "generate-semantics", req("POST", f"/usos/{geo_id}/generate-semantics")[0] == 201)
    check(fx["label"], "map-model generate", req("POST", f"/floors/{floor}/map-model/generate")[0] == 201)

    inner = ((req("GET", f"/floors/{floor}/map-model")[1].get("data") or {}).get("data") or {})
    mrooms = inner.get("rooms", []) if isinstance(inner, dict) else []
    named = [r for r in mrooms if r.get("name")]
    check(fx["label"], f"map rooms == {exp['map_rooms']}", len(mrooms) == exp["map_rooms"], f"got {len(mrooms)}")
    if exp["map_named"] is not None:
        check(fx["label"], f"named rooms == {exp['map_named']}", len(named) == exp["map_named"],
              f"got {len(named)}: {[r.get('name') for r in named][:6]}")
    if exp["all_category_room"]:
        allroom = len(mrooms) > 0 and all(r.get("category") == "ROOM" for r in mrooms)
        check(fx["label"], "every room category == ROOM", allroom,
              f"cats={sorted({r.get('category') for r in mrooms})}")

    _, ng = req("POST", "/navigation-graphs", {"buildingId": building, "floorId": floor})
    G = (ng.get("data") or {}).get("id")
    if G:
        req("POST", f"/navigation-graphs/{G}/candidates")
        req("POST", f"/navigation-graphs/{G}/nodes")
        nodes = req("GET", f"/navigation-graphs/{G}/nodes")[1].get("data", [])
        n = len(nodes) if isinstance(nodes, list) else 0
        check(fx["label"], f"nav nodes >= {exp['nav_nodes_min']}", n >= exp["nav_nodes_min"], f"got {n}")


def main():
    for fx in FIXTURES:
        if not os.path.exists(fx["file"]):
            print(f"MISSING fixture: {fx['file']} (set ATLAS_FIXTURES)"); sys.exit(2)
    building, levels = resolve_building()
    base_level = (max(levels) if levels else 0) + 1
    for i, fx in enumerate(FIXTURES):
        run_fixture(building, base_level + i, fx)
    passed = sum(1 for r in RESULTS if r)
    print(f"\n=== {passed}/{len(RESULTS)} checks passed ===")
    sys.exit(0 if passed == len(RESULTS) else 1)


if __name__ == "__main__":
    main()
