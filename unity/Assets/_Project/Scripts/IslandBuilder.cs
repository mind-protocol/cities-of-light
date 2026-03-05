using UnityEngine;

/// <summary>
/// Procedural island generator. Creates terrain + vegetation for each zone.
/// Attach to an empty GameObject, set zoneType, call Build() or let Start() do it.
/// </summary>
public class IslandBuilder : MonoBehaviour
{
    public enum ZoneType { Island, Archive, Agora }

    [Header("Zone")]
    public ZoneType zoneType = ZoneType.Island;
    public int seed = 0;
    public float radius = 12f;

    [Header("Materials — assign in Inspector")]
    public Material terrainMaterial;
    public Material waterMaterial;
    public Material vegetationMaterial;

    void Start()
    {
        Build();
    }

    public void Build()
    {
        Random.InitState(seed);
        BuildTerrain();
        BuildVegetation();
    }

    void BuildTerrain()
    {
        // Circular island mesh — 32-segment disc with noise height
        int segments = 32;
        int rings = 8;
        var mesh = new Mesh();
        mesh.name = $"Island_{zoneType}";

        int vertCount = 1 + segments * rings;
        var verts = new Vector3[vertCount];
        var uvs = new Vector2[vertCount];

        // Center vertex
        verts[0] = Vector3.zero;
        uvs[0] = new Vector2(0.5f, 0.5f);

        for (int r = 1; r <= rings; r++)
        {
            float t = (float)r / rings;
            float ringRadius = radius * t;
            float heightFalloff = 1f - t * t; // dome falloff

            for (int s = 0; s < segments; s++)
            {
                int idx = 1 + (r - 1) * segments + s;
                float angle = (float)s / segments * Mathf.PI * 2f;
                float x = Mathf.Cos(angle) * ringRadius;
                float z = Mathf.Sin(angle) * ringRadius;

                // Perlin noise for natural terrain
                float nx = (x + seed) * 0.1f;
                float nz = (z + seed) * 0.1f;
                float height = Mathf.PerlinNoise(nx, nz) * 2f * heightFalloff;

                // Shore goes below water
                if (r >= rings - 1) height = -0.3f;

                verts[idx] = new Vector3(x, height, z);
                uvs[idx] = new Vector2(0.5f + x / (radius * 2), 0.5f + z / (radius * 2));
            }
        }

        // Triangles
        var tris = new int[segments * 3 + (rings - 1) * segments * 6];
        int ti = 0;

        // Center fan
        for (int s = 0; s < segments; s++)
        {
            tris[ti++] = 0;
            tris[ti++] = 1 + (s + 1) % segments;
            tris[ti++] = 1 + s;
        }

        // Ring strips
        for (int r = 1; r < rings; r++)
        {
            int ringStart = 1 + (r - 1) * segments;
            int nextRingStart = 1 + r * segments;

            for (int s = 0; s < segments; s++)
            {
                int s1 = s;
                int s2 = (s + 1) % segments;

                tris[ti++] = ringStart + s1;
                tris[ti++] = nextRingStart + s2;
                tris[ti++] = nextRingStart + s1;

                tris[ti++] = ringStart + s1;
                tris[ti++] = ringStart + s2;
                tris[ti++] = nextRingStart + s2;
            }
        }

        mesh.vertices = verts;
        mesh.uv = uvs;
        mesh.triangles = tris;
        mesh.RecalculateNormals();
        mesh.RecalculateBounds();

        var terrainGO = new GameObject("Terrain");
        terrainGO.transform.SetParent(transform, false);
        terrainGO.AddComponent<MeshFilter>().mesh = mesh;
        var mr = terrainGO.AddComponent<MeshRenderer>();
        mr.material = terrainMaterial != null ? terrainMaterial : CreateDefaultMaterial();
        mr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.On;
        mr.receiveShadows = true;
    }

    void BuildVegetation()
    {
        switch (zoneType)
        {
            case ZoneType.Island:
                BuildPalms(8);
                break;
            case ZoneType.Archive:
                BuildCrystals(10);
                break;
            case ZoneType.Agora:
                BuildColumns(8);
                break;
        }
    }

    void BuildPalms(int count)
    {
        for (int i = 0; i < count; i++)
        {
            float angle = Random.Range(0f, Mathf.PI * 2f);
            float dist = Random.Range(2f, radius * 0.7f);
            float x = Mathf.Cos(angle) * dist;
            float z = Mathf.Sin(angle) * dist;

            // Trunk — tall cylinder
            var palm = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            palm.name = $"Palm_{i}";
            palm.transform.SetParent(transform, false);
            float height = Random.Range(3f, 5f);
            palm.transform.localPosition = new Vector3(x, height * 0.5f, z);
            palm.transform.localScale = new Vector3(0.15f, height * 0.5f, 0.15f);

            var trunk = palm.GetComponent<Renderer>();
            trunk.material = CreateColorMaterial(new Color(0.45f, 0.3f, 0.15f)); // brown

            // Canopy — sphere on top
            var canopy = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            canopy.name = $"Canopy_{i}";
            canopy.transform.SetParent(transform, false);
            canopy.transform.localPosition = new Vector3(x, height + 0.5f, z);
            canopy.transform.localScale = Vector3.one * Random.Range(1.5f, 2.5f);

            var leafMat = CreateColorMaterial(new Color(0.2f, 0.5f, 0.15f)); // green
            canopy.GetComponent<Renderer>().material = leafMat;

            // Remove colliders (perf)
            Destroy(palm.GetComponent<Collider>());
            Destroy(canopy.GetComponent<Collider>());
        }
    }

    void BuildCrystals(int count)
    {
        for (int i = 0; i < count; i++)
        {
            float angle = Random.Range(0f, Mathf.PI * 2f);
            float dist = Random.Range(1f, radius * 0.6f);
            float x = Mathf.Cos(angle) * dist;
            float z = Mathf.Sin(angle) * dist;

            // Crystal — stretched capsule (icosahedron not available as primitive)
            var crystal = GameObject.CreatePrimitive(PrimitiveType.Capsule);
            crystal.name = $"Crystal_{i}";
            crystal.transform.SetParent(transform, false);
            float height = Random.Range(1.5f, 4f);
            crystal.transform.localPosition = new Vector3(x, height * 0.4f, z);
            crystal.transform.localScale = new Vector3(0.3f, height * 0.5f, 0.3f);
            crystal.transform.localRotation = Quaternion.Euler(
                Random.Range(-15f, 15f), Random.Range(0f, 360f), Random.Range(-15f, 15f));

            var mat = new Material(Shader.Find("Universal Render Pipeline/Lit"));
            mat.color = new Color(0.3f, 0.6f, 1f, 0.7f);
            mat.SetFloat("_Surface", 1); // transparent
            mat.SetFloat("_Metallic", 0.8f);
            mat.SetFloat("_Smoothness", 0.9f);
            mat.SetColor("_EmissionColor", new Color(0.2f, 0.4f, 1f) * 2f);
            mat.EnableKeyword("_EMISSION");
            mat.EnableKeyword("_SURFACE_TYPE_TRANSPARENT");
            mat.SetFloat("_Blend", 0); // alpha
            mat.SetFloat("_DstBlend", 10);
            mat.SetFloat("_SrcBlend", 5);
            mat.SetFloat("_ZWrite", 0);
            mat.renderQueue = 3000;
            crystal.GetComponent<Renderer>().material = mat;

            Destroy(crystal.GetComponent<Collider>());
        }
    }

    void BuildColumns(int count)
    {
        for (int i = 0; i < count; i++)
        {
            float angle = ((float)i / count) * Mathf.PI * 2f + Random.Range(-0.2f, 0.2f);
            float dist = Random.Range(3f, radius * 0.6f);
            float x = Mathf.Cos(angle) * dist;
            float z = Mathf.Sin(angle) * dist;

            // Column — cylinder
            var col = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            col.name = $"Column_{i}";
            col.transform.SetParent(transform, false);
            float height = Random.Range(3f, 5f);
            col.transform.localPosition = new Vector3(x, height * 0.5f, z);
            col.transform.localScale = new Vector3(0.4f, height * 0.5f, 0.4f);

            var mat = CreateColorMaterial(new Color(0.85f, 0.82f, 0.75f)); // marble
            mat.SetFloat("_Smoothness", 0.7f);
            col.GetComponent<Renderer>().material = mat;

            // Capital — cube on top
            var cap = GameObject.CreatePrimitive(PrimitiveType.Cube);
            cap.name = $"Capital_{i}";
            cap.transform.SetParent(transform, false);
            cap.transform.localPosition = new Vector3(x, height + 0.2f, z);
            cap.transform.localScale = new Vector3(0.8f, 0.3f, 0.8f);
            cap.GetComponent<Renderer>().material = mat;

            Destroy(col.GetComponent<Collider>());
            Destroy(cap.GetComponent<Collider>());
        }
    }

    Material CreateDefaultMaterial()
    {
        return zoneType switch
        {
            ZoneType.Island => CreateColorMaterial(new Color(0.83f, 0.72f, 0.48f)),   // sand
            ZoneType.Archive => CreateColorMaterial(new Color(0.23f, 0.29f, 0.42f)),   // dark blue
            ZoneType.Agora => CreateColorMaterial(new Color(0.84f, 0.81f, 0.75f)),     // marble
            _ => CreateColorMaterial(Color.gray),
        };
    }

    Material CreateColorMaterial(Color color)
    {
        var mat = new Material(Shader.Find("Universal Render Pipeline/Lit"));
        mat.color = color;
        return mat;
    }
}
