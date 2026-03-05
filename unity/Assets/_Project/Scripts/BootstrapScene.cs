using UnityEngine;

/// <summary>
/// Scene bootstrap — builds all 3 zones and places teleport beacons.
/// Attach to a single "Bootstrap" GameObject in MainScene.
/// This is the ONE entry point that constructs the entire world.
/// </summary>
public class BootstrapScene : MonoBehaviour
{
    [Header("Prefab references — leave null for procedural")]
    public ZoneManager zoneManager;
    public Transform xrOrigin;

    void Awake()
    {
        if (zoneManager == null)
            zoneManager = FindObjectOfType<ZoneManager>();

        if (xrOrigin == null)
        {
            var xrGO = GameObject.Find("XR Origin (XR Rig)");
            if (xrGO != null) xrOrigin = xrGO.transform;
        }

        BuildWorld();
    }

    void BuildWorld()
    {
        Debug.Log("[Bootstrap] Building Cities of Light...");

        // --- Ocean ---
        var ocean = GameObject.CreatePrimitive(PrimitiveType.Plane);
        ocean.name = "Ocean";
        ocean.transform.position = new Vector3(0, -0.5f, 0);
        ocean.transform.localScale = new Vector3(30, 1, 30); // 300x300 units
        var oceanMat = new Material(Shader.Find("Universal Render Pipeline/Lit"));
        oceanMat.color = new Color(0.08f, 0.25f, 0.35f, 0.85f);
        oceanMat.SetFloat("_Smoothness", 0.95f);
        ocean.GetComponent<Renderer>().material = oceanMat;
        ocean.AddComponent<OceanSimple>();
        Destroy(ocean.GetComponent<Collider>());

        // --- 3 Zones ---
        var islandGO = CreateZoneIsland("Zone_Island", Vector3.zero, IslandBuilder.ZoneType.Island, 0);
        var archiveGO = CreateZoneIsland("Zone_Archive", new Vector3(-30, 0, -25), IslandBuilder.ZoneType.Archive, 333);
        var agoraGO = CreateZoneIsland("Zone_Agora", new Vector3(-20, 0, 40), IslandBuilder.ZoneType.Agora, 888);

        // --- Teleport Beacons ---
        // Island → Archive, Island → Agora
        PlaceBeacon(new Vector3(0, 0, 0), new Vector3(-30, 0, -25), "archive", "The Archive", new Color(0.27f, 0.53f, 1f));
        PlaceBeacon(new Vector3(0, 0, 0), new Vector3(-20, 0, 40), "agora", "The Agora", new Color(1f, 0.8f, 0.4f));

        // Archive → Island
        PlaceBeacon(new Vector3(-30, 0, -25), new Vector3(0, 0, 0), "island", "The Island", new Color(1f, 0.8f, 0.53f));

        // Agora → Island
        PlaceBeacon(new Vector3(-20, 0, 40), new Vector3(0, 0, 0), "island", "The Island", new Color(1f, 0.8f, 0.53f));

        Debug.Log("[Bootstrap] World built: 3 zones, 4 beacons");
    }

    GameObject CreateZoneIsland(string name, Vector3 position, IslandBuilder.ZoneType type, int seed)
    {
        var go = new GameObject(name);
        go.transform.position = position;
        var builder = go.AddComponent<IslandBuilder>();
        builder.zoneType = type;
        builder.seed = seed;
        builder.radius = 12f;
        // Build is called in Start()
        return go;
    }

    void PlaceBeacon(Vector3 fromZoneCenter, Vector3 toZoneCenter, string targetId, string targetName, Color color)
    {
        // Place beacon on the shore of fromZone, facing toZone
        Vector3 dir = (toZoneCenter - fromZoneCenter).normalized;
        Vector3 beaconPos = fromZoneCenter + dir * 11f; // shore edge (~11m from center of 12m radius island)
        beaconPos.y = 0f;

        var beaconGO = new GameObject($"Beacon_{targetId}");
        beaconGO.transform.position = beaconPos;

        var beacon = beaconGO.AddComponent<TeleportBeacon>();
        beacon.targetZoneId = targetId;
        beacon.targetZoneName = targetName;
        beacon.beaconColor = color;
        beacon.zoneManager = zoneManager;
        beacon.playerTransform = xrOrigin;
    }
}
