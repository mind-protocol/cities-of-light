using UnityEngine;
using TMPro;

/// <summary>
/// Glowing beacon pillar for zone teleportation.
/// Place at the edge of each island, pointing toward the target zone.
/// Player enters trigger radius → teleports via ZoneManager.
/// </summary>
public class TeleportBeacon : MonoBehaviour
{
    [Header("Config")]
    public string targetZoneId;
    public string targetZoneName;
    public Color beaconColor = Color.cyan;
    public float activationRadius = 2.5f;

    [Header("References")]
    public ZoneManager zoneManager;
    public Transform playerTransform;  // XR Origin

    private Renderer _pillarRenderer;
    private float _cooldown;
    private bool _built;

    void Start()
    {
        BuildBeacon();
    }

    void BuildBeacon()
    {
        if (_built) return;
        _built = true;

        // Pillar
        var pillar = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
        pillar.name = "Pillar";
        pillar.transform.SetParent(transform, false);
        pillar.transform.localPosition = new Vector3(0, 1.5f, 0);
        pillar.transform.localScale = new Vector3(0.3f, 1.5f, 0.3f);

        var mat = new Material(Shader.Find("Universal Render Pipeline/Lit"));
        mat.color = beaconColor;
        mat.SetColor("_EmissionColor", beaconColor * 1.5f);
        mat.EnableKeyword("_EMISSION");
        _pillarRenderer = pillar.GetComponent<Renderer>();
        _pillarRenderer.material = mat;

        Destroy(pillar.GetComponent<Collider>()); // no physics needed

        // Label
        var labelGO = new GameObject("Label");
        labelGO.transform.SetParent(transform, false);
        labelGO.transform.localPosition = new Vector3(0, 3.5f, 0);

        var tmp = labelGO.AddComponent<TextMeshPro>();
        tmp.text = targetZoneName;
        tmp.fontSize = 3f;
        tmp.alignment = TextAlignmentOptions.Center;
        tmp.color = beaconColor;
        tmp.enableAutoSizing = false;

        // Billboard behavior — face camera
        labelGO.AddComponent<Billboard>();
    }

    void Update()
    {
        if (playerTransform == null || zoneManager == null) return;
        if (_cooldown > 0) { _cooldown -= Time.deltaTime; return; }

        // Pulse emission
        float pulse = 0.8f + Mathf.Sin(Time.time * 2f) * 0.4f;
        if (_pillarRenderer != null)
        {
            _pillarRenderer.material.SetColor("_EmissionColor", beaconColor * pulse);
        }

        // Check proximity
        float dist = Vector3.Distance(
            new Vector3(playerTransform.position.x, 0, playerTransform.position.z),
            new Vector3(transform.position.x, 0, transform.position.z));

        if (dist < activationRadius)
        {
            zoneManager.TeleportTo(targetZoneId);
            _cooldown = 3f; // prevent rapid re-teleport
        }
    }
}
