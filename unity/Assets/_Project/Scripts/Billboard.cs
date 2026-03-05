using UnityEngine;

/// <summary>
/// Makes a GameObject always face the main camera.
/// Used for zone labels and beacon text.
/// </summary>
public class Billboard : MonoBehaviour
{
    private Transform _cam;

    void Start()
    {
        _cam = Camera.main?.transform;
    }

    void LateUpdate()
    {
        if (_cam == null)
        {
            _cam = Camera.main?.transform;
            if (_cam == null) return;
        }

        transform.LookAt(transform.position + _cam.forward);
    }
}
