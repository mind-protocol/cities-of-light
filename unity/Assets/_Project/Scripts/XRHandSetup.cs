using UnityEngine;
using UnityEngine.XR;
using UnityEngine.XR.Hands;
using System.Collections.Generic;

/// <summary>
/// Runtime hand tracking initialization + controller fallback.
/// Attach to a manager GameObject. Logs tracking state.
///
/// Hand tracking works automatically via XR Hands package +
/// OpenXR Hand Tracking Subsystem feature enabled in Project Settings.
/// This script just monitors and logs state.
/// </summary>
public class XRHandSetup : MonoBehaviour
{
    [Header("Optional — drag hand GameObjects for visual feedback")]
    public GameObject leftHandVisual;
    public GameObject rightHandVisual;
    public GameObject leftControllerVisual;
    public GameObject rightControllerVisual;

    private XRHandSubsystem _handSubsystem;
    private bool _handsAvailable;

    void Start()
    {
        Debug.Log("[XRHands] Initializing hand tracking...");
        TryGetHandSubsystem();
    }

    void Update()
    {
        if (_handSubsystem == null)
        {
            TryGetHandSubsystem();
            return;
        }

        bool handsTracking = _handSubsystem.leftHand.isTracked || _handSubsystem.rightHand.isTracked;

        if (handsTracking != _handsAvailable)
        {
            _handsAvailable = handsTracking;
            Debug.Log($"[XRHands] Hands tracking: {_handsAvailable}");
            UpdateVisuals();
        }
    }

    void TryGetHandSubsystem()
    {
        var subsystems = new List<XRHandSubsystem>();
        SubsystemManager.GetSubsystems(subsystems);

        if (subsystems.Count > 0)
        {
            _handSubsystem = subsystems[0];
            Debug.Log("[XRHands] Hand subsystem found");
        }
    }

    void UpdateVisuals()
    {
        // Show hands when tracking, controllers when not
        if (leftHandVisual != null) leftHandVisual.SetActive(_handsAvailable);
        if (rightHandVisual != null) rightHandVisual.SetActive(_handsAvailable);
        if (leftControllerVisual != null) leftControllerVisual.SetActive(!_handsAvailable);
        if (rightControllerVisual != null) rightControllerVisual.SetActive(!_handsAvailable);
    }
}
