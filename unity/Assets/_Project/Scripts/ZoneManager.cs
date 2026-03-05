using UnityEngine;
using TMPro;

/// <summary>
/// Manages 3 zones: Island, Archive, Agora.
/// Detects which zone the player is in based on XZ distance.
/// Updates fog, lighting, and UI label.
/// </summary>
public class ZoneManager : MonoBehaviour
{
    [System.Serializable]
    public class Zone
    {
        public string id;
        public string displayName;
        public Vector3 center;     // world position (y=0)
        public Color fogColor;
        public float fogDensity;
        public Color lightColor;
        public float lightIntensity;
    }

    [Header("Zones")]
    public Zone[] zones = new Zone[]
    {
        new Zone {
            id = "island",
            displayName = "The Island",
            center = new Vector3(0, 0, 0),
            fogColor = new Color(0.56f, 0.67f, 0.75f),    // #8faac0
            fogDensity = 0.008f,
            lightColor = new Color(1f, 0.8f, 0.53f),       // warm amber
            lightIntensity = 2.5f,
        },
        new Zone {
            id = "archive",
            displayName = "The Archive",
            center = new Vector3(-30, 0, -25),
            fogColor = new Color(0.1f, 0.16f, 0.29f),     // #1a2a4a
            fogDensity = 0.012f,
            lightColor = new Color(0.27f, 0.53f, 1f),      // blue
            lightIntensity = 1.8f,
        },
        new Zone {
            id = "agora",
            displayName = "The Agora",
            center = new Vector3(-20, 0, 40),
            fogColor = new Color(0.75f, 0.66f, 0.5f),     // #c0a880
            fogDensity = 0.007f,
            lightColor = new Color(1f, 0.8f, 0.4f),        // warm gold
            lightIntensity = 2.2f,
        },
    };

    [Header("References")]
    public Transform xrOrigin;           // drag XR Origin here
    public Light directionalLight;
    public TextMeshProUGUI zoneLabel;     // optional UI label

    [Header("Transition")]
    public float lerpSpeed = 2f;          // ambient transition speed

    private Zone _current;
    private Color _targetFogColor;
    private float _targetFogDensity;
    private Color _targetLightColor;
    private float _targetLightIntensity;

    void Start()
    {
        RenderSettings.fog = true;
        RenderSettings.fogMode = FogMode.ExponentialSquared;

        // Default to Island
        _current = zones[0];
        ApplyZoneImmediate(_current);
    }

    void Update()
    {
        if (xrOrigin == null) return;

        // Detect nearest zone
        Vector3 playerPos = xrOrigin.position;
        Zone nearest = GetNearestZone(playerPos);

        if (nearest.id != _current.id)
        {
            _current = nearest;
            _targetFogColor = nearest.fogColor;
            _targetFogDensity = nearest.fogDensity;
            _targetLightColor = nearest.lightColor;
            _targetLightIntensity = nearest.lightIntensity;

            if (zoneLabel != null)
                zoneLabel.text = nearest.displayName;

            Debug.Log($"[Zone] Entered: {nearest.displayName}");
        }

        // Smooth lerp
        float t = lerpSpeed * Time.deltaTime;
        RenderSettings.fogColor = Color.Lerp(RenderSettings.fogColor, _targetFogColor, t);
        RenderSettings.fogDensity = Mathf.Lerp(RenderSettings.fogDensity, _targetFogDensity, t);

        if (directionalLight != null)
        {
            directionalLight.color = Color.Lerp(directionalLight.color, _targetLightColor, t);
            directionalLight.intensity = Mathf.Lerp(directionalLight.intensity, _targetLightIntensity, t);
        }
    }

    Zone GetNearestZone(Vector3 pos)
    {
        Zone nearest = zones[0];
        float minDist = float.MaxValue;

        foreach (var zone in zones)
        {
            float dx = pos.x - zone.center.x;
            float dz = pos.z - zone.center.z;
            float dist = dx * dx + dz * dz; // squared, no sqrt needed
            if (dist < minDist)
            {
                minDist = dist;
                nearest = zone;
            }
        }
        return nearest;
    }

    void ApplyZoneImmediate(Zone zone)
    {
        RenderSettings.fogColor = zone.fogColor;
        RenderSettings.fogDensity = zone.fogDensity;
        _targetFogColor = zone.fogColor;
        _targetFogDensity = zone.fogDensity;
        _targetLightColor = zone.lightColor;
        _targetLightIntensity = zone.lightIntensity;

        if (directionalLight != null)
        {
            directionalLight.color = zone.lightColor;
            directionalLight.intensity = zone.lightIntensity;
        }

        if (zoneLabel != null)
            zoneLabel.text = zone.displayName;
    }

    /// <summary>Teleport player to zone center.</summary>
    public void TeleportTo(string zoneId)
    {
        foreach (var zone in zones)
        {
            if (zone.id == zoneId)
            {
                xrOrigin.position = zone.center + Vector3.up * 0.1f;
                ApplyZoneImmediate(zone);
                Debug.Log($"[Zone] Teleported to {zone.displayName}");
                return;
            }
        }
    }
}
