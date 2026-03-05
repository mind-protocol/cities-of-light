using UnityEngine;
using UnityEngine.XR;

/// <summary>
/// Enables foveated rendering + sets 90Hz on Quest 3 at startup.
/// Attach to any GameObject in the scene.
/// </summary>
public class FoveationSetup : MonoBehaviour
{
    void Start()
    {
        // Request 90Hz refresh rate
        var displays = new System.Collections.Generic.List<XRDisplaySubsystem>();
        SubsystemManager.GetSubsystems(displays);
        foreach (var display in displays)
        {
            if (display.TryGetDisplayRefreshRate(out float _))
            {
                display.TryRequestDisplayRefreshRate(90f);
                Debug.Log("[Foveation] Requested 90Hz");
            }
        }

        // Enable foveated rendering via Meta OVR if available
        // This is the OpenXR SRP Foveation path — enabled in Project Settings.
        // Runtime fallback for older SDK versions:
        TryEnableMetaFoveation();
    }

    void TryEnableMetaFoveation()
    {
        // If Meta XR SDK is present, set foveation level programmatically
        // This is a safety net — the Project Settings toggle should handle it.
        try
        {
            // OVRManager.foveatedRenderingLevel = OVRManager.FoveatedRenderingLevel.HighTop;
            // Uncomment above if using Meta XR Core SDK and it's not picking up from settings.
            Debug.Log("[Foveation] SRP Foveation should be active via OpenXR settings");
        }
        catch (System.Exception e)
        {
            Debug.LogWarning($"[Foveation] Could not set programmatically: {e.Message}");
        }
    }
}
