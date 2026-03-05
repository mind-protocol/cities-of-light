using UnityEngine;
using UnityEngine.XR;
using System.Collections.Generic;

/// <summary>
/// Requests 90Hz display + foveated rendering on Quest 3.
/// Unity 2022.3 LTS compatible.
/// </summary>
public class FoveationSetup : MonoBehaviour
{
    void Start()
    {
        Request90Hz();
    }

    void Request90Hz()
    {
        var displays = new List<XRDisplaySubsystem>();
        SubsystemManager.GetSubsystems(displays);

        foreach (var display in displays)
        {
            // Request 90Hz refresh rate
            if (display.TryGetDisplayRefreshRate(out float currentRate))
            {
                Debug.Log($"[Quest] Current refresh rate: {currentRate}Hz");
                if (currentRate < 90f)
                {
                    display.TryRequestDisplayRefreshRate(90f);
                    Debug.Log("[Quest] Requested 90Hz");
                }
            }

            // Foveated rendering — set via OpenXR feature in Project Settings.
            // The "Foveated Rendering" OpenXR feature handles this automatically
            // when enabled. No runtime code needed in 2022.3 + OpenXR path.
            // If using Meta XR Core SDK with OVRManager, uncomment:
            // OVRManager.foveatedRenderingLevel = OVRManager.FoveatedRenderingLevel.HighTop;
            // OVRManager.useDynamicFoveatedRendering = true;
        }

        if (displays.Count == 0)
        {
            Debug.LogWarning("[Quest] No XR display subsystem found — running in editor?");
        }
    }
}
