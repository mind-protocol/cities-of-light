using UnityEngine;

/// <summary>
/// Simple animated ocean plane. Gentle vertex wave via shader not needed —
/// just bobs the plane up/down slightly for atmosphere.
/// </summary>
public class OceanSimple : MonoBehaviour
{
    public float amplitude = 0.1f;
    public float frequency = 0.3f;

    private float _baseY;

    void Start()
    {
        _baseY = transform.position.y;
    }

    void Update()
    {
        float y = _baseY + Mathf.Sin(Time.time * frequency) * amplitude;
        transform.position = new Vector3(transform.position.x, y, transform.position.z);
    }
}
